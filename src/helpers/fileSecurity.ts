/**
 * Upload malware protection.
 *
 * Every uploaded file is checked AFTER multer saved it and BEFORE the route
 * uses it. If any file in the request fails, ALL files of that request are
 * deleted and the request is rejected (400).
 *
 * Checks (no external service needed):
 *  1. Real content matches the extension (magic bytes) — a .png must be a PNG.
 *  2. No executables (Windows .exe/.dll, Linux ELF, macOS Mach-O, Java class,
 *     shell scripts) hidden behind an allowed extension.
 *  3. No embedded web/server code (<script>, <?php, <iframe>, javascript: …)
 *     — blocks "polyglot" images and stored-XSS files.
 *  4. PDF: no JavaScript / auto-launch / embedded files.
 *  5. Word .doc: no VBA macros.
 *  6. ZIP: no executables/scripts inside, no path traversal (../).
 *  7. Optional ClamAV virus scan (real antivirus signatures) when
 *     CLAMAV_HOST is set. If it is set but ClamAV can't be reached, the
 *     upload is rejected (fail closed).
 */
import fs from "fs";
import fsp from "fs/promises";
import net from "net";
import path from "path";

type FileKind = "image" | "pdf" | "doc" | "text" | "zip" | "mp4" | "mp3";

const KIND_BY_EXTENSION: Record<string, FileKind> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".pdf": "pdf",
  ".doc": "doc",
  ".txt": "text",
  ".json": "text",
  ".geojson": "text",
  ".kml": "text",
  ".zip": "zip",
  ".mp4": "mp4",
  ".mp3": "mp3",
};

// Files bigger than this are only inspected at the start (media); ClamAV
// still streams the whole file when enabled.
const FULL_READ_LIMIT = 60 * 1024 * 1024;
const HEAD_BYTES = 4 * 1024 * 1024;

export class UnsafeFileError extends Error {}

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length &&
  bytes.every((byte, i) => buf[offset + i] === byte);

// ---------- 1. magic bytes ----------
const MAGIC_CHECKS: Record<FileKind, (buf: Buffer) => boolean> = {
  image: (b) =>
    startsWith(b, [0xff, 0xd8, 0xff]) || // JPEG
    startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG
  pdf: (b) => b.subarray(0, 1024).includes("%PDF-"),
  doc: (b) =>
    startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), // OLE2
  zip: (b) =>
    startsWith(b, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(b, [0x50, 0x4b, 0x05, 0x06]), // empty zip
  mp4: (b) => b.subarray(4, 8).toString("latin1") === "ftyp",
  mp3: (b) =>
    b.subarray(0, 3).toString("latin1") === "ID3" ||
    (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  // text: no NUL bytes (binary disguised as text)
  text: (b) => !b.subarray(0, 64 * 1024).includes(0),
};

// ---------- 2. executables ----------
const EXECUTABLE_SIGNATURES: { name: string; bytes: number[] }[] = [
  { name: "Windows executable (MZ)", bytes: [0x4d, 0x5a] },
  { name: "Linux executable (ELF)", bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { name: "macOS executable", bytes: [0xfe, 0xed, 0xfa, 0xce] },
  { name: "macOS executable", bytes: [0xfe, 0xed, 0xfa, 0xcf] },
  { name: "macOS executable", bytes: [0xce, 0xfa, 0xed, 0xfe] },
  { name: "macOS executable", bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: "Java class / fat binary", bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { name: "Script (#!)", bytes: [0x23, 0x21] },
];

// ---------- 3. embedded code ----------
// Long enough that they don't appear by chance inside compressed image data.
const EMBEDDED_CODE_PATTERNS: RegExp[] = [
  /<\?php/i,
  /<script[\s>/]/i,
  /<iframe[\s>/]/i,
  /<object[\s>/]/i,
  /<embed[\s>/]/i,
  /<html[\s>]/i,
  /<svg[\s>/][^]*?\son\w+\s*=/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /\son(?:error|load|click|mouseover|focus)\s*=/i,
];
// Short patterns: only safe to check in text files (in binary data a
// 2–3 byte sequence would match by chance).
const TEXT_ONLY_PATTERNS: RegExp[] = [/<%[@=\s]/]; // ASP/JSP

// ---------- 4. PDF ----------
const PDF_DANGEROUS_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "JavaScript", re: /\/(?:JavaScript|JS)[\s(<[/]/ },
  { name: "auto-launch action", re: /\/Launch[\s<[/]/ },
  { name: "embedded file", re: /\/EmbeddedFiles?[\s<[/]/ },
  { name: "rich media", re: /\/RichMedia[\s<[/]/ },
];

// ---------- 5. Word macros (OLE stream names are UTF-16LE) ----------
const DOC_MACRO_MARKERS = [
  Buffer.from("_VBA_PROJECT", "utf16le"),
  Buffer.from("VBA", "utf16le"),
  Buffer.from("Macros", "utf16le"),
];

// ---------- 6. ZIP ----------
const DANGEROUS_IN_ZIP =
  /\.(exe|dll|bat|cmd|com|scr|pif|msi|msp|jar|js|jse|vbs|vbe|wsf|wsh|ps1|psm1|sh|bash|php\d?|phtml|asp|aspx|jsp|hta|html?|svg|lnk|reg|apk|app|dmg|iso|docm|xlsm|pptm)$/i;

const zipEntryNames = (buf: Buffer): string[] => {
  // Central directory file headers: PK\x01\x02, name length @28, name @46
  const names: string[] = [];
  let i = buf.indexOf("PK\x01\x02", 0, "latin1");
  while (i !== -1 && i + 46 <= buf.length) {
    const nameLength = buf.readUInt16LE(i + 28);
    names.push(buf.subarray(i + 46, i + 46 + nameLength).toString("utf8"));
    i = buf.indexOf("PK\x01\x02", i + 46, "latin1");
  }
  return names;
};

// ---------- 7. ClamAV (optional) ----------
const scanWithClamAV = (filePath: string): Promise<void> => {
  const host = process.env.CLAMAV_HOST;
  if (!host) return Promise.resolve();
  const port = Number(process.env.CLAMAV_PORT) || 3310;

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks: Buffer[] = [];
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };

    socket.setTimeout(60_000, () =>
      done(new UnsafeFileError("Virus scan timed out")),
    );
    socket.on("error", () =>
      done(new UnsafeFileError("Virus scanner is not available")),
    );
    socket.on("data", (data: string | Buffer) =>
      chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data)),
    );
    socket.on("end", () => {
      const reply = Buffer.concat(chunks).toString("utf8").replace(/\0/g, "");
      if (/:\s*OK$/.test(reply.trim())) return done();
      const found = reply.match(/:\s*(.+)\s+FOUND/);
      done(
        new UnsafeFileError(
          found ? `Virus detected (${found[1]})` : "Virus scan failed",
        ),
      );
    });

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const stream = fs.createReadStream(filePath, {
        highWaterMark: 64 * 1024,
      });
      stream.on("data", (chunk: string | Buffer) => {
        const data: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(data.length);
        socket.write(size);
        socket.write(data);
      });
      stream.on("end", () => socket.write(Buffer.alloc(4))); // end of stream
      stream.on("error", () => done(new UnsafeFileError("Cannot read file")));
    });
  });
};

const readForInspection = async (filePath: string, size: number) => {
  if (size <= FULL_READ_LIMIT) return fsp.readFile(filePath);
  const handle = await fsp.open(filePath, "r");
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buf, 0, HEAD_BYTES, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

/** Throws UnsafeFileError with a short reason when the file is not safe. */
export const inspectFile = async (file: {
  path: string;
  originalname: string;
  size: number;
}) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const kind = KIND_BY_EXTENSION[ext];
  if (!kind) throw new UnsafeFileError(`File type ${ext || "?"} not allowed`);
  if (file.size === 0) throw new UnsafeFileError("Empty file");

  const buf = await readForInspection(file.path, file.size);

  if (!MAGIC_CHECKS[kind](buf)) {
    throw new UnsafeFileError(`Content is not a real ${ext} file`);
  }

  if (kind !== "doc" && kind !== "zip") {
    for (const sig of EXECUTABLE_SIGNATURES) {
      if (startsWith(buf, sig.bytes)) {
        throw new UnsafeFileError(`${sig.name} is not allowed`);
      }
    }
  }

  // ZIP and Word files are compressed/structured — code patterns are
  // checked through their own rules (entry names / macros) instead.
  if (kind !== "zip" && kind !== "doc") {
    const text = buf.toString("latin1");
    const patterns =
      kind === "text"
        ? [...EMBEDDED_CODE_PATTERNS, ...TEXT_ONLY_PATTERNS]
        : EMBEDDED_CODE_PATTERNS;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        throw new UnsafeFileError("File contains embedded script/code");
      }
    }
    if (kind === "pdf") {
      for (const { name, re } of PDF_DANGEROUS_PATTERNS) {
        if (re.test(text)) throw new UnsafeFileError(`PDF contains ${name}`);
      }
    }
  }

  if (kind === "doc" && DOC_MACRO_MARKERS.some((m) => buf.includes(m))) {
    throw new UnsafeFileError("Word document contains macros");
  }

  if (kind === "zip") {
    for (const name of zipEntryNames(buf)) {
      if (name.includes("..") || path.isAbsolute(name) || /^[a-z]:/i.test(name)) {
        throw new UnsafeFileError("ZIP contains an unsafe path");
      }
      if (DANGEROUS_IN_ZIP.test(name)) {
        throw new UnsafeFileError(`ZIP contains a blocked file (${name})`);
      }
    }
  }

  await scanWithClamAV(file.path);
};

type UploadedFiles =
  | Record<string, Express.Multer.File[]>
  | Express.Multer.File[]
  | undefined;

const flattenFiles = (files: UploadedFiles): Express.Multer.File[] =>
  !files ? [] : Array.isArray(files) ? files : Object.values(files).flat();

export const deleteUploadedFiles = async (files: UploadedFiles) => {
  await Promise.all(
    flattenFiles(files).map((file) =>
      fsp.unlink(file.path).catch(() => undefined),
    ),
  );
};

/**
 * Inspect every file of a request. On the first unsafe file, delete all of
 * the request's files and throw (the caller turns it into a 400).
 */
export const scanUploadedFiles = async (files: UploadedFiles) => {
  const list = flattenFiles(files);
  for (const file of list) {
    try {
      await inspectFile(file);
    } catch (error) {
      await deleteUploadedFiles(files);
      const reason =
        error instanceof UnsafeFileError ? error.message : "File check failed";
      throw new UnsafeFileError(`${file.originalname}: ${reason}`);
    }
  }
};

export const isClamAVEnabled = () => Boolean(process.env.CLAMAV_HOST);

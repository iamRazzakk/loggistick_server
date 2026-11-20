import { NextFunction, Request, Response } from "express";
import { stripMongoOperators } from "./sanitizeMongo";
import { stripDangerousHtml } from "./sanitizeInput";
import {
  deleteUploadedFiles,
  scanUploadedFiles,
} from "../../helpers/fileSecurity";
import { errorLogger } from "../../shared/logger";
import fs from "fs";
import path from "path";
import multer, { FileFilterCallback } from "multer";
import { randomBytes } from "crypto";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../errors/ApiErrors";

/**
 * multer handler
 * Supports multiple folders, dynamic file types, file size limits, and safe filenames
 */

// Config-driven setup
interface UploadConfigItem {
  folder: string;
  allowedMimeTypes: string[];
  maxCount: number;
  maxSize?: number; // optional max file size in bytes
  // Saved files keep their extension, and express/nginx serve them by
  // extension — so only these are accepted (blocks .html/.js/.svg → XSS).
  allowedExtensions: string[];
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"];
// Geofence uploads: browsers send odd/empty MIME types for these.
const GEO_EXTENSIONS = [".json", ".geojson", ".kml", ".zip"];

const UPLOAD_CONFIG: Record<string, UploadConfigItem> = {
  image: {
    folder: "image",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/jpg"],
    maxCount: 3,
    maxSize: 20 * 1024 * 1024, // 20MB
    allowedExtensions: IMAGE_EXTENSIONS,
  },
  "driverData[licenseImage]": {
    folder: "image",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/jpg"],
    maxCount: 10,
    maxSize: 20 * 1024 * 1024,
    allowedExtensions: IMAGE_EXTENSIONS,
  },
  "driverData.licenseImage": {
    folder: "image",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/jpg"],
    maxCount: 10,
    maxSize: 20 * 1024 * 1024,
    allowedExtensions: IMAGE_EXTENSIONS,
  },
  doc: {
    folder: "docs",
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/json",
      "application/geo+json",
      "text/plain",
      "application/octet-stream",
    ],
    maxCount: 5,
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: [".pdf", ".doc", ".txt", ...GEO_EXTENSIONS],
  },
  file: {
    folder: "files",
    allowedMimeTypes: [
      "application/json",
      "application/geo+json",
      "text/plain",
      "application/octet-stream",
    ],
    maxCount: 5,
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: [".txt", ...GEO_EXTENSIONS],
  },
  media: {
    folder: "media",
    allowedMimeTypes: ["video/mp4", "audio/mpeg"],
    maxCount: 2,
    maxSize: 500 * 1024 * 1024, // 500MB (was 50GB — disk-fill risk)
    allowedExtensions: [".mp4", ".mp3"],
  },
};

// Base upload directory
const BASE_UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Utility: ensure a directory exists
const ensureDirExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

// Utility: sanitize filenames (remove spaces and unsafe chars)
const sanitizeFilename = (name: string) => {
  return name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "") // remove unsafe characters
    .toLowerCase();
};

// Multer storage
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    const config = UPLOAD_CONFIG[file.fieldname];
    if (!config) {
      return cb(
        new ApiError(
          StatusCodes.BAD_REQUEST,
          `Unsupported field: ${file.fieldname}`,
        ),
        "",
      );
    }

    const folderPath = path.join(BASE_UPLOAD_DIR, config.folder);
    ensureDirExists(folderPath);
    cb(null, folderPath);
  },

  filename: (_req: Request, file: Express.Multer.File, cb) => {
    // ext was checked against the field's allowlist in fileFilter
    const ext = path.extname(file.originalname).toLowerCase();
    const name =
      sanitizeFilename(path.basename(file.originalname, path.extname(file.originalname))) ||
      "file";
    cb(null, `${name.slice(0, 80)}-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`);
  },
});

// Multer file filter
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const config = UPLOAD_CONFIG[file.fieldname];
  if (!config) {
    return cb(
      new ApiError(
        StatusCodes.BAD_REQUEST,
        `Unsupported field: ${file.fieldname}`,
      ),
    );
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!config.allowedExtensions.includes(ext)) {
    return cb(
      new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid file extension for ${
          file.fieldname
        }. Allowed: ${config.allowedExtensions.join(", ")}`,
      ),
    );
  }

  // MIME is client-supplied; it is checked too, except for geofence files
  // (their extension is already restricted above).
  const isGeoFile = GEO_EXTENSIONS.includes(ext);
  if (!config.allowedMimeTypes.includes(file.mimetype) && !isGeoFile) {
    return cb(
      new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid file type for ${
          file.fieldname
        }. Allowed: ${config.allowedMimeTypes.join(", ")}`,
      ),
    );
  }

  cb(null, true);
};

type IUploadField = keyof typeof UPLOAD_CONFIG;

/**
 * Multer middleware for the given fields (default: all).
 * The size limit is the largest maxSize among those fields, so a route that
 * only takes images can't be used to upload a 500MB file.
 */
export const getUploadFields = (fields?: IUploadField[]) => {
  const names = fields?.length ? fields : Object.keys(UPLOAD_CONFIG);
  const fileSize = Math.max(
    ...names.map((field) => UPLOAD_CONFIG[field].maxSize ?? 20 * 1024 * 1024),
  );
  const upload = multer({ storage, fileFilter, limits: { fileSize } });
  const handler = upload.fields(
    names.map((field) => ({
      name: field,
      maxCount: UPLOAD_CONFIG[field].maxCount,
    })),
  );
  return (req: Request, res: Response, next: NextFunction) =>
    handler(req, res, async (err?: unknown) => {
      if (err) {
        // multer error (size, type…) → don't keep partial files
        await deleteUploadedFiles(req.files as never);
        return next(err);
      }
      // Malware check: real file type, no executables/scripts/macros,
      // optional ClamAV. Unsafe → every file of this request is deleted.
      try {
        await scanUploadedFiles(req.files as never);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unsafe file";
        errorLogger.warn(
          `Blocked unsafe upload from ${req.ip} (user ${req.user?.id ?? "anonymous"}): ${reason}`,
        );
        return next(new ApiError(StatusCodes.BAD_REQUEST, `File rejected — ${reason}`));
      }
      // multer builds req.body from form fields (e.g. "a[$ne]") → strip
      // Mongo operators and injected scripts
      req.body = stripDangerousHtml(stripMongoOperators(req.body ?? {}));
      next();
    });
};

// Helpers to get file paths (fully type-safe)
type IFolderName = keyof typeof UPLOAD_CONFIG;

export const getSingleFilePath = (
  files: Record<string, Express.Multer.File[]>,
  folder: IFolderName,
) => {
  const fieldFiles = files?.[folder];
  if (fieldFiles && fieldFiles.length > 0) {
    return `/${UPLOAD_CONFIG[folder].folder}/${fieldFiles[0].filename}`;
  }
  return undefined;
};

// get multiple file paths
export const getMultipleFilePaths = (
  files: Record<string, Express.Multer.File[]>,
  folder: IFolderName,
) => {
  const fieldFiles = files?.[folder];
  if (fieldFiles && fieldFiles.length > 0) {
    return fieldFiles.map(
      (file) => `/${UPLOAD_CONFIG[folder].folder}/${file.filename}`,
    );
  }
  return [];
};

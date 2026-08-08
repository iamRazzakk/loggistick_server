import { Request } from "express";
import fs from "fs";
import path from "path";
import multer, { FileFilterCallback } from "multer";
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
}

const UPLOAD_CONFIG: Record<string, UploadConfigItem> = {
  image: {
    folder: "image",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/jpg"],
    maxCount: 3,
    maxSize: 20 * 1024 * 1024, // 20MB
  },
  doc: {
    folder: "docs",
    allowedMimeTypes: ["application/pdf", "application/msword"],
    maxCount: 5,
    maxSize: 50 * 1024 * 1024, // 50MB
  },
  media: {
    folder: "media",
    allowedMimeTypes: ["video/mp4", "audio/mpeg"],
    maxCount: 2,
    maxSize: 50 * 1024 * 1024 * 1024, // 50GB
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
    const ext = path.extname(file.originalname);
    const name = sanitizeFilename(file.originalname.replace(ext, ""));
    cb(null, `${name}-${Date.now()}${ext}`);
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

  if (!config.allowedMimeTypes.includes(file.mimetype)) {
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

// Multer upload instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 * 1024, // 50GB max for any file
  },
});

// Factory function to get multer fields for routes
export const getUploadFields = () => {
  return upload.fields(
    Object.keys(UPLOAD_CONFIG).map((field) => ({
      name: field,
      maxCount: UPLOAD_CONFIG[field].maxCount,
    })),
  );
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

export const getMultipleFilesPath = (
  files: Record<string, Express.Multer.File[]>,
  folder: IFolderName,
) => {
  const fieldFiles = files?.[folder];
  if (fieldFiles && Array.isArray(fieldFiles)) {
    return fieldFiles.map(
      (file) => `/${UPLOAD_CONFIG[folder].folder}/${file.filename}`,
    );
  }
  return undefined;
};

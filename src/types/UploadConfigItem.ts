export interface UploadConfigItem {
  folder: string;
  allowedMimeTypes: string[];
  maxCount: number;
  maxSize?: number; // optional max file size in bytes
}
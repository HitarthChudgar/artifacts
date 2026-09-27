import path from "node:path";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

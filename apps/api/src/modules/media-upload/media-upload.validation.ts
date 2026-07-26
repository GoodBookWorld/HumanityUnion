import type { MediaUploadPurpose } from "./media-upload.types.js";

export const MEDIA_UPLOAD_LIMITS = {
  avatar: 2 * 1024 * 1024,
  "initiative-image": 5 * 1024 * 1024,
} as const satisfies Record<MediaUploadPurpose, number>;

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export interface ValidatedUploadFile {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  size: number;
}

export function validateUploadedImageFile(
  purpose: MediaUploadPurpose,
  file: Express.Multer.File | undefined,
): ValidatedUploadFile {
  if (!file) {
    throw new Error("An image file is required.");
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw new Error("Unsupported image type. Allowed formats: JPEG, PNG, WEBP.");
  }

  const extension = MIME_TO_EXTENSION[file.mimetype];

  if (!extension) {
    throw new Error("Unsupported image type.");
  }

  const originalExtension = pathExtension(file.originalname).toLowerCase();

  if (originalExtension && originalExtension !== extension && originalExtension !== ".jpeg") {
    throw new Error("File extension does not match the detected image type.");
  }

  if (file.size > MEDIA_UPLOAD_LIMITS[purpose]) {
    const maxMb = MEDIA_UPLOAD_LIMITS[purpose] / (1024 * 1024);
    throw new Error(`Image exceeds the ${maxMb} MB size limit.`);
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new Error("Uploaded image is empty.");
  }

  return {
    buffer: file.buffer,
    mimeType: file.mimetype,
    extension,
    size: file.size,
  };
}

function pathExtension(filename: string): string {
  const index = filename.lastIndexOf(".");

  if (index === -1) {
    return "";
  }

  return filename.slice(index);
}

export function isPlatformMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.pathname.startsWith("/api/v1/media/files/");
  } catch {
    return url.startsWith("/api/v1/media/files/");
  }
}

import type { MediaUploadPurpose } from "./media-upload.types.js";
import { detectImageSignature, looksLikeMarkupOrScript } from "./image-signature.js";
import { readImageDimensions } from "./image-dimensions.js";

export const MEDIA_UPLOAD_LIMITS = {
  avatar: 2 * 1024 * 1024,
  "initiative-image": 5 * 1024 * 1024,
  "blog-image": 5 * 1024 * 1024,
} as const satisfies Record<MediaUploadPurpose, number>;

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * Part 4 decompression-bomb guard: dimensions are read from uncompressed
 * headers only (see `image-dimensions.ts`), never decoded, so this simply
 * bounds the declared canvas size before anything downstream would ever
 * attempt to render or transcode the file.
 */
const MAX_IMAGE_DIMENSION_PX = 8000;
const MAX_IMAGE_PIXELS = 40_000_000;

export interface ValidatedUploadFile {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  size: number;
  width: number;
  height: number;
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

  // Part 4 — reject SVG/HTML/script content masquerading as an image via a
  // spoofed extension/MIME type, before ever trusting the declared type.
  if (looksLikeMarkupOrScript(file.buffer)) {
    throw new Error("This file could not be verified as a supported image and was rejected.");
  }

  // Part 4 — validate the *actual* file signature rather than trusting the
  // client-supplied Content-Type, and reject any mismatch between the two.
  const detectedType = detectImageSignature(file.buffer);

  if (!detectedType) {
    throw new Error("This file could not be verified as a supported image and was rejected.");
  }

  if (detectedType !== file.mimetype) {
    throw new Error("The file's contents do not match its declared image type.");
  }

  const dimensions = readImageDimensions(file.buffer, detectedType);

  if (!dimensions) {
    throw new Error("This image appears to be corrupted and could not be verified.");
  }

  if (
    dimensions.width > MAX_IMAGE_DIMENSION_PX ||
    dimensions.height > MAX_IMAGE_DIMENSION_PX ||
    dimensions.width * dimensions.height > MAX_IMAGE_PIXELS
  ) {
    throw new Error(
      `Image dimensions exceed the maximum allowed size of ${MAX_IMAGE_DIMENSION_PX}x${MAX_IMAGE_DIMENSION_PX} pixels.`,
    );
  }

  return {
    buffer: file.buffer,
    mimeType: file.mimetype,
    extension,
    size: file.size,
    width: dimensions.width,
    height: dimensions.height,
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
    if (parsed.pathname.startsWith("/api/v1/media/files/")) {
      return true;
    }

    const r2Base = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
    if (r2Base) {
      const base = new URL(r2Base);
      return parsed.origin === base.origin && parsed.pathname.startsWith(base.pathname === "/" ? "/" : `${base.pathname}/`);
    }

    return false;
  } catch {
    return url.startsWith("/api/v1/media/files/");
  }
}

/**
 * UX Evolution Pack 03 Part 4 — actual file-signature (magic byte) detection.
 *
 * Multer's `file.mimetype` is only the client-supplied `Content-Type` of the
 * multipart field: a caller can set it to anything regardless of the actual
 * file bytes. This module inspects the real bytes so the declared MIME type
 * can be cross-checked against what the file actually is, rather than
 * trusted on its own.
 *
 * Pack 22C.2 — GIF87a / GIF89a signatures for Blog publication media.
 */

export type DetectedImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function detectImageSignature(buffer: Buffer): DetectedImageMimeType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.length >= 6) {
    const header = buffer.toString("ascii", 0, 6);
    if (header === "GIF87a" || header === "GIF89a") {
      return "image/gif";
    }
  }

  return null;
}

/**
 * Defense-in-depth text-based sniff for SVG/HTML/script content masquerading
 * as an image via a spoofed MIME type and/or extension (Part 4 "reject
 * executable/polyglot files"). Only looks at a small leading slice of the
 * buffer — this is a cheap rejection check, not a substitute for the binary
 * signature check above.
 */
export function looksLikeMarkupOrScript(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 512).toString("utf8").toLowerCase();

  return (
    sample.includes("<svg") ||
    sample.includes("<?xml") ||
    sample.includes("<!doctype html") ||
    sample.includes("<html") ||
    sample.includes("<script")
  );
}

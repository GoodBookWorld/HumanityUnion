/**
 * UX Evolution Pack 03 Part 4 — pixel-dimension inspection without
 * decompression.
 *
 * Every format below stores its pixel dimensions in an uncompressed header
 * (PNG's `IHDR` chunk, WebP's `VP8`/`VP8L`/`VP8X` chunk header, JPEG's
 * `SOFx` marker segment, GIF Logical Screen Descriptor). Reading them only
 * requires scanning bytes — never inflating/decoding pixel data — so this
 * cannot itself be used to trigger a decompression bomb, and it lets the
 * caller reject implausibly large declared dimensions before any decoder
 * ever touches the file.
 */
import type { DetectedImageMimeType } from "./image-signature.js";

export interface ImageDimensions {
  width: number;
  height: number;
}

function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24 || buffer.toString("ascii", 12, 16) !== "IHDR") {
    return null;
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  return width > 0 && height > 0 ? { width, height } : null;
}

function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 21) {
    return null;
  }

  const fourCC = buffer.toString("ascii", 12, 16);

  if (fourCC === "VP8X" && buffer.length >= 30) {
    const width = buffer.readUIntLE(24, 3) + 1;
    const height = buffer.readUIntLE(27, 3) + 1;
    return { width, height };
  }

  if (fourCC === "VP8 " && buffer.length >= 30) {
    if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) {
      return null;
    }
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (fourCC === "VP8L" && buffer.length >= 25) {
    if (buffer[20] !== 0x2f) {
      return null;
    }
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return { width, height };
  }

  return null;
}

/** Standalone markers that carry no length field and no payload. */
function isLengthlessJpegMarker(marker: number): boolean {
  return marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

/** Start-Of-Frame markers; excludes DHT (C4), JPG (C8), and DAC (CC), which share the C0-CF range but are not SOF. */
function isStartOfFrameMarker(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  const maxIterations = buffer.length;
  let iterations = 0;

  while (offset + 1 < buffer.length && iterations < maxIterations) {
    iterations += 1;

    if (buffer[offset] !== 0xff) {
      return null;
    }

    const marker = buffer[offset + 1] as number;

    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    if (isLengthlessJpegMarker(marker)) {
      offset += 2;
      continue;
    }

    if (offset + 4 > buffer.length) {
      return null;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (isStartOfFrameMarker(marker)) {
      if (offset + 9 > buffer.length) {
        return null;
      }
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }

    if (marker === 0xda) {
      return null;
    }

    if (segmentLength < 2) {
      return null;
    }

    offset += 2 + segmentLength;
  }

  return null;
}

/** Pack 22C.2 — GIF Logical Screen Descriptor width/height (little-endian). */
function readGifDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 10) {
    return null;
  }

  const header = buffer.toString("ascii", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") {
    return null;
  }

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  return width > 0 && height > 0 ? { width, height } : null;
}

export function readImageDimensions(
  buffer: Buffer,
  mimeType: DetectedImageMimeType,
): ImageDimensions | null {
  switch (mimeType) {
    case "image/png":
      return readPngDimensions(buffer);
    case "image/webp":
      return readWebpDimensions(buffer);
    case "image/jpeg":
      return readJpegDimensions(buffer);
    case "image/gif":
      return readGifDimensions(buffer);
    default:
      return null;
  }
}

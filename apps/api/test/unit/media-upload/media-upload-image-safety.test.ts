import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPlatformMediaUrl, validateUploadedImageFile } from "../../../src/modules/media-upload/media-upload.validation.js";

/**
 * UX Evolution Pack 03 Part 4/12 — image safety validation tests.
 *
 * These build minimal *synthetic* JPEG/PNG/WebP buffers directly from the
 * documented file-format headers (JPEG SOF0 marker, PNG IHDR chunk, WebP
 * VP8X chunk) rather than embedding opaque real-image fixtures, so every
 * byte asserted on here is traceable to a real format spec and to the
 * parser under test (`image-signature.ts` / `image-dimensions.ts`). None of
 * these need to be full, pixel-decodable images: the validator under test
 * never decompresses pixel data, only headers.
 */

function buildMinimalJpeg(width: number, height: number): Buffer {
  const sofPayload = Buffer.alloc(15);
  sofPayload[0] = 8; // precision
  sofPayload.writeUInt16BE(height, 1);
  sofPayload.writeUInt16BE(width, 3);
  sofPayload[5] = 3; // component count

  const sofLength = Buffer.alloc(2);
  sofLength.writeUInt16BE(sofPayload.length + 2, 0);

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]), // SOI
    Buffer.from([0xff, 0xc0]), // SOF0
    sofLength,
    sofPayload,
    Buffer.from([0xff, 0xd9]), // EOI
  ]);
}

function buildMinimalPng(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(13, 0);
  const ihdrType = Buffer.from("IHDR", "ascii");
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  const crc = Buffer.alloc(4);

  return Buffer.concat([signature, length, ihdrType, ihdrData, crc]);
}

function buildMinimalWebp(width: number, height: number): Buffer {
  const flags = Buffer.from([0x10]); // "has alpha"
  const reserved = Buffer.alloc(3);
  const widthMinus1 = Buffer.alloc(3);
  widthMinus1.writeUIntLE(width - 1, 0, 3);
  const heightMinus1 = Buffer.alloc(3);
  heightMinus1.writeUIntLE(height - 1, 0, 3);
  const vp8xPayload = Buffer.concat([flags, reserved, widthMinus1, heightMinus1]);
  const vp8xSize = Buffer.alloc(4);
  vp8xSize.writeUInt32LE(vp8xPayload.length, 0);
  const chunk = Buffer.concat([Buffer.from("VP8X", "ascii"), vp8xSize, vp8xPayload]);
  const fileSize = Buffer.alloc(4);
  fileSize.writeUInt32LE(4 + chunk.length, 0);

  return Buffer.concat([Buffer.from("RIFF", "ascii"), fileSize, Buffer.from("WEBP", "ascii"), chunk]);
}

function buildFile(overrides: Partial<Express.Multer.File>): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: "upload.bin",
    encoding: "7bit",
    mimetype: "application/octet-stream",
    size: 0,
    buffer: Buffer.alloc(0),
    stream: undefined as never,
    destination: "",
    filename: "",
    path: "",
    ...overrides,
  } as Express.Multer.File;
}

describe("UX Evolution Pack 03 — validateUploadedImageFile", () => {
  it("accepts a valid JPEG upload", () => {
    const buffer = buildMinimalJpeg(200, 100);
    const result = validateUploadedImageFile(
      "initiative-image",
      buildFile({ mimetype: "image/jpeg", originalname: "cover.jpg", buffer, size: buffer.length }),
    );

    assert.equal(result.mimeType, "image/jpeg");
    assert.equal(result.width, 200);
    assert.equal(result.height, 100);
  });

  it("accepts a valid PNG upload", () => {
    const buffer = buildMinimalPng(50, 60);
    const result = validateUploadedImageFile(
      "initiative-image",
      buildFile({ mimetype: "image/png", originalname: "cover.png", buffer, size: buffer.length }),
    );

    assert.equal(result.mimeType, "image/png");
    assert.equal(result.width, 50);
    assert.equal(result.height, 60);
  });

  it("accepts a valid WebP upload", () => {
    const buffer = buildMinimalWebp(80, 40);
    const result = validateUploadedImageFile(
      "initiative-image",
      buildFile({ mimetype: "image/webp", originalname: "cover.webp", buffer, size: buffer.length }),
    );

    assert.equal(result.mimeType, "image/webp");
    assert.equal(result.width, 80);
    assert.equal(result.height, 40);
  });

  it("rejects a file whose extension does not match its declared MIME type", () => {
    const buffer = buildMinimalPng(10, 10);
    assert.throws(
      () =>
        validateUploadedImageFile(
          "initiative-image",
          buildFile({ mimetype: "image/png", originalname: "cover.jpg", buffer, size: buffer.length }),
        ),
      /does not match/,
    );
  });

  it("rejects an unsupported image MIME type", () => {
    const buffer = Buffer.from("GIF89a");
    assert.throws(
      () =>
        validateUploadedImageFile(
          "initiative-image",
          buildFile({ mimetype: "image/gif", originalname: "cover.gif", buffer, size: buffer.length }),
        ),
      /Unsupported image type/,
    );
  });

  it("rejects an oversized image", () => {
    const buffer = buildMinimalPng(10, 10);
    assert.throws(
      () =>
        validateUploadedImageFile(
          "initiative-image",
          buildFile({
            mimetype: "image/png",
            originalname: "cover.png",
            buffer,
            size: 6 * 1024 * 1024,
          }),
        ),
      /size limit/,
    );
  });

  it("rejects SVG content masquerading as a PNG via a spoofed MIME type", () => {
    const buffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.throws(
      () =>
        validateUploadedImageFile(
          "initiative-image",
          buildFile({ mimetype: "image/png", originalname: "cover.png", buffer, size: buffer.length }),
        ),
      /could not be verified/,
    );
  });

  it("rejects an HTML polyglot file masquerading as a JPEG", () => {
    const buffer = Buffer.from("<!DOCTYPE html><html><body>polyglot</body></html>");
    assert.throws(
      () =>
        validateUploadedImageFile(
          "initiative-image",
          buildFile({ mimetype: "image/jpeg", originalname: "cover.jpg", buffer, size: buffer.length }),
        ),
      /could not be verified/,
    );
  });

  it("rejects a file whose real signature does not match its declared MIME type", () => {
    // Real bytes are a JPEG, but the declared Content-Type claims PNG.
    const buffer = buildMinimalJpeg(20, 20);
    assert.throws(
      () =>
        validateUploadedImageFile(
          "initiative-image",
          buildFile({ mimetype: "image/png", originalname: "cover.png", buffer, size: buffer.length }),
        ),
      /do not match its declared image type/,
    );
  });

  it("rejects a corrupted image with a valid signature but no readable header", () => {
    const buffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0, 0, 0, 0]), // truncated / missing IHDR chunk
    ]);
    assert.throws(
      () =>
        validateUploadedImageFile(
          "initiative-image",
          buildFile({ mimetype: "image/png", originalname: "cover.png", buffer, size: buffer.length }),
        ),
      /corrupted/,
    );
  });

  it("rejects an image exceeding the maximum pixel dimensions", () => {
    // JPEG dimensions are stored as 16-bit values, so drive the rejection via
    // the total-pixel-count guard instead (within the 16-bit range but still
    // over the 40-megapixel cap).
    const buffer = buildMinimalJpeg(8000, 6000);
    assert.throws(
      () =>
        validateUploadedImageFile(
          "initiative-image",
          buildFile({ mimetype: "image/jpeg", originalname: "cover.jpg", buffer, size: buffer.length }),
        ),
      /exceed the maximum allowed size/,
    );
  });

  it("rejects an empty upload buffer", () => {
    assert.throws(
      () =>
        validateUploadedImageFile(
          "initiative-image",
          buildFile({ mimetype: "image/png", originalname: "cover.png", buffer: Buffer.alloc(0), size: 0 }),
        ),
      /empty/,
    );
  });

  it("rejects when no file is provided", () => {
    assert.throws(() => validateUploadedImageFile("initiative-image", undefined), /required/);
  });
});

describe("UX Evolution Pack 03 — isPlatformMediaUrl", () => {
  it("accepts a platform-hosted media path", () => {
    assert.equal(isPlatformMediaUrl("/api/v1/media/files/initiatives/abc.png"), true);
  });

  it("accepts a platform-hosted absolute media URL", () => {
    assert.equal(isPlatformMediaUrl("https://app.example.org/api/v1/media/files/initiatives/abc.png"), true);
  });

  it("rejects an arbitrary external image URL (no remote hosting / SSRF surface)", () => {
    assert.equal(isPlatformMediaUrl("https://evil.example.com/payload.png"), false);
  });
});

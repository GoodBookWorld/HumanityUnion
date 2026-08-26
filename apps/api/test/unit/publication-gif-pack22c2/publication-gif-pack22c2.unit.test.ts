/**
 * Pack 22C.2 — Animated GIF upload for Blog publication media.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { detectImageSignature } from "../../../src/modules/media-upload/image-signature.js";
import { readImageDimensions } from "../../../src/modules/media-upload/image-dimensions.js";
import { validateUploadedImageFile } from "../../../src/modules/media-upload/media-upload.validation.js";
import { sanitizeBlogHtml } from "../../../src/modules/blog/blog-content-sanitize.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

/** Minimal GIF Logical Screen Descriptor (no pixel data required for header checks). */
function buildMinimalGif(version: "GIF87a" | "GIF89a", width: number, height: number): Buffer {
  const header = Buffer.from(version, "ascii");
  const screen = Buffer.alloc(7);
  screen.writeUInt16LE(width, 0);
  screen.writeUInt16LE(height, 2);
  screen[4] = 0x00; // packed fields
  screen[5] = 0x00; // background
  screen[6] = 0x00; // aspect
  return Buffer.concat([header, screen]);
}

function buildMinimalJpeg(width: number, height: number): Buffer {
  const sofPayload = Buffer.alloc(15);
  sofPayload[0] = 8;
  sofPayload.writeUInt16BE(height, 1);
  sofPayload.writeUInt16BE(width, 3);
  sofPayload[5] = 3;
  const sofLength = Buffer.alloc(2);
  sofLength.writeUInt16BE(sofPayload.length + 2, 0);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.from([0xff, 0xc0]),
    sofLength,
    sofPayload,
    Buffer.from([0xff, 0xd9]),
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
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  return Buffer.concat([signature, length, ihdrType, ihdrData, Buffer.alloc(4)]);
}

function buildMinimalWebp(width: number, height: number): Buffer {
  const flags = Buffer.from([0x10]);
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

describe("Pack 22C.2 — Blog publication GIF upload", () => {
  it("accepts image/gif for blog-image (GIF89a)", () => {
    const buffer = buildMinimalGif("GIF89a", 120, 80);
    const result = validateUploadedImageFile(
      "blog-image",
      buildFile({
        mimetype: "image/gif",
        originalname: "anim.gif",
        buffer,
        size: buffer.length,
      }),
    );
    assert.equal(result.mimeType, "image/gif");
    assert.equal(result.extension, ".gif");
    assert.equal(result.width, 120);
    assert.equal(result.height, 80);
    assert.equal(Buffer.compare(result.buffer, buffer), 0);
  });

  it("accepts GIF87a", () => {
    const buffer = buildMinimalGif("GIF87a", 16, 16);
    assert.equal(detectImageSignature(buffer), "image/gif");
    const result = validateUploadedImageFile(
      "blog-image",
      buildFile({
        mimetype: "image/gif",
        originalname: "old.gif",
        buffer,
        size: buffer.length,
      }),
    );
    assert.equal(result.width, 16);
    assert.equal(result.height, 16);
  });

  it("rejects MIME/signature mismatch (jpeg bytes as gif)", () => {
    const buffer = buildMinimalJpeg(20, 20);
    assert.throws(
      () =>
        validateUploadedImageFile(
          "blog-image",
          buildFile({
            mimetype: "image/gif",
            originalname: "fake.gif",
            buffer,
            size: buffer.length,
          }),
        ),
      /do not match/,
    );
  });

  it("rejects fake .gif with non-GIF bytes", () => {
    const buffer = Buffer.from("not-a-gif-file");
    assert.equal(detectImageSignature(buffer), null);
    assert.throws(
      () =>
        validateUploadedImageFile(
          "blog-image",
          buildFile({
            mimetype: "image/gif",
            originalname: "fake.gif",
            buffer,
            size: buffer.length,
          }),
        ),
      /could not be verified/,
    );
  });

  it("rejects HTML/polyglot disguised as GIF", () => {
    const buffer = Buffer.from("<!DOCTYPE html><html><body>polyglot</body></html>");
    assert.throws(
      () =>
        validateUploadedImageFile(
          "blog-image",
          buildFile({
            mimetype: "image/gif",
            originalname: "x.gif",
            buffer,
            size: buffer.length,
          }),
        ),
      /could not be verified/,
    );
  });

  it("enforces file-size limit for GIF", () => {
    const buffer = buildMinimalGif("GIF89a", 10, 10);
    assert.throws(
      () =>
        validateUploadedImageFile(
          "blog-image",
          buildFile({
            mimetype: "image/gif",
            originalname: "big.gif",
            buffer,
            size: 6 * 1024 * 1024,
          }),
        ),
      /size limit/,
    );
  });

  it("enforces dimension limit for GIF", () => {
    const buffer = buildMinimalGif("GIF89a", 9000, 10);
    assert.throws(
      () =>
        validateUploadedImageFile(
          "blog-image",
          buildFile({
            mimetype: "image/gif",
            originalname: "huge.gif",
            buffer,
            size: buffer.length,
          }),
        ),
      /dimensions exceed/,
    );
  });

  it("does not accept GIF for avatar / initiative / logo purposes", () => {
    const buffer = buildMinimalGif("GIF89a", 32, 32);
    for (const purpose of ["avatar", "initiative-image", "media-resource-logo"] as const) {
      assert.throws(
        () =>
          validateUploadedImageFile(
            purpose,
            buildFile({
              mimetype: "image/gif",
              originalname: "x.gif",
              buffer,
              size: buffer.length,
            }),
          ),
        /Unsupported image type/,
      );
    }
  });

  it("JPEG / PNG / WEBP regressions still accept", () => {
    const jpeg = buildMinimalJpeg(10, 10);
    assert.equal(
      validateUploadedImageFile(
        "blog-image",
        buildFile({
          mimetype: "image/jpeg",
          originalname: "a.jpg",
          buffer: jpeg,
          size: jpeg.length,
        }),
      ).mimeType,
      "image/jpeg",
    );
    const png = buildMinimalPng(10, 10);
    assert.equal(
      validateUploadedImageFile(
        "blog-image",
        buildFile({
          mimetype: "image/png",
          originalname: "a.png",
          buffer: png,
          size: png.length,
        }),
      ).mimeType,
      "image/png",
    );
    const webp = buildMinimalWebp(10, 10);
    assert.equal(
      validateUploadedImageFile(
        "blog-image",
        buildFile({
          mimetype: "image/webp",
          originalname: "a.webp",
          buffer: webp,
          size: webp.length,
        }),
      ).mimeType,
      "image/webp",
    );
  });

  it("SVG remains rejected", () => {
    const buffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    assert.throws(
      () =>
        validateUploadedImageFile(
          "blog-image",
          buildFile({
            mimetype: "image/png",
            originalname: "x.png",
            buffer,
            size: buffer.length,
          }),
        ),
      /could not be verified/,
    );
  });

  it("GIF public HTML keeps alignment and % resize; native img element", () => {
    const html = sanitizeBlogHtml(
      `<figure class="image image_resized image-style-align-left" style="width: 35%;"><img src="/api/v1/media/files/blog/anim.gif" alt="Loop" /></figure>`,
    );
    assert.match(html, /image-style-align-left/);
    assert.match(html, /image_resized/);
    assert.match(html, /width:\s*35%/);
    assert.match(html, /anim\.gif/);
    assert.match(html, /<img /);
    assert.doesNotMatch(html, /<video|<canvas/i);
  });

  it("served MIME map and storage path preserve gif without transcode", () => {
    const app = readRepo("apps/api/src/app.ts");
    assert.match(app, /\.gif[\s\S]*image\/gif|endsWith\("\.gif"\)[\s\S]*image\/gif/);
    const service = readRepo("apps/api/src/modules/media-upload/media-upload.service.ts");
    assert.doesNotMatch(service, /sharp|transcode|gif-to-|extractFirstFrame|ffmpeg/i);
    const local = readRepo("apps/api/src/modules/media-upload/local-media.provider.ts");
    assert.match(local, /writeFile|buffer/i);
  });

  it("CKEditor adapter and cover picker accept GIF via blog-image", () => {
    const adapter = readRepo("apps/web/src/features/blog/ckeditor-upload-adapter.ts");
    assert.match(adapter, /uploadBlogImage/);
    assert.doesNotMatch(adapter, /mimetype|image\/jpeg/);
    const cover = readRepo("apps/web/src/features/blog/components/BlogCoverField.tsx");
    assert.match(cover, /image\/gif/);
    const dims = readImageDimensions(buildMinimalGif("GIF89a", 4, 5), "image/gif");
    assert.deepEqual(dims, { width: 4, height: 5 });
  });
});

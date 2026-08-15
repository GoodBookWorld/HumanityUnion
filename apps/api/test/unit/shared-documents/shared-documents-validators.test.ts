import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  MAX_SHARED_DOCUMENT_SIZE_BYTES,
  validateSharedDocumentFile,
} from "../../../src/modules/shared-documents/shared-documents.validators.js";
import { SharedDocumentValidationError } from "../../../src/modules/shared-documents/shared-documents.errors.js";

/**
 * Communication UX Pack 03.7 Part 2/5 — Stage 1 (Technical Validation),
 * pure-function, no Mongo/network required. Builds real fixture files
 * (via the system `zip` binary, matching how a genuine DOCX/ODT is
 * structured) rather than trusting hand-rolled byte arrays, so the
 * ZIP-container structural check (Part 2 "No ZIP") is exercised against
 * an authentic archive shape.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PDF_SIGNATURE = Buffer.from("%PDF-1.4\n%%EOF", "ascii");

function buildFile(overrides: Partial<Parameters<typeof validateSharedDocumentFile>[0]>) {
  return {
    originalName: "file.txt",
    buffer: Buffer.from("hello"),
    mimeType: "text/plain",
    size: 5,
    ...overrides,
  };
}

let tmpDir: string;

function fixture(relativeName: string): Buffer {
  return readFileSync(path.join(tmpDir, relativeName));
}

function setupFixtures(): void {
  tmpDir = mkdtempSync(path.join(tmpdir(), "shared-documents-fixtures-"));

  const docxDir = path.join(tmpDir, "docx-src");
  execFileSync("mkdir", ["-p", path.join(docxDir, "word")]);
  writeFileSync(path.join(docxDir, "[Content_Types].xml"), '<?xml version="1.0"?><Types/>');
  writeFileSync(path.join(docxDir, "word", "document.xml"), "<w:document/>");
  execFileSync("zip", ["-q", "-X", path.join(tmpDir, "real.docx"), "[Content_Types].xml", "word/document.xml"], {
    cwd: docxDir,
  });

  const odtDir = path.join(tmpDir, "odt-src");
  execFileSync("mkdir", ["-p", odtDir]);
  writeFileSync(path.join(odtDir, "mimetype"), "application/vnd.oasis.opendocument.text");
  writeFileSync(path.join(odtDir, "content.xml"), "<office:document-content/>");
  execFileSync("zip", ["-q", "-X", "-D", "-0", path.join(tmpDir, "real.odt"), "mimetype"], { cwd: odtDir });
  execFileSync("zip", ["-q", "-X", "-D", path.join(tmpDir, "real.odt"), "content.xml"], { cwd: odtDir });

  const zipDir = path.join(tmpDir, "zip-src");
  execFileSync("mkdir", ["-p", zipDir]);
  writeFileSync(path.join(zipDir, "payload.txt"), "just some generic zip content");
  execFileSync("zip", ["-q", "-X", path.join(tmpDir, "generic.zip"), "payload.txt"], { cwd: zipDir });
}

setupFixtures();

describe("Shared Documents Stage 1 validation — allowlist and size (Part 2)", () => {
  it("rejects a file type outside the allowlist", () => {
    assert.throws(
      () => validateSharedDocumentFile(buildFile({ originalName: "malware.exe", mimeType: "application/x-msdownload" })),
      SharedDocumentValidationError,
    );
  });

  it("rejects an oversized file", () => {
    assert.throws(
      () =>
        validateSharedDocumentFile(
          buildFile({ originalName: "big.txt", size: MAX_SHARED_DOCUMENT_SIZE_BYTES + 1 }),
        ),
      SharedDocumentValidationError,
    );
  });

  it("rejects an empty buffer", () => {
    assert.throws(
      () => validateSharedDocumentFile(buildFile({ buffer: Buffer.alloc(0), size: 0 })),
      SharedDocumentValidationError,
    );
  });

  it("rejects a missing/blank file name", () => {
    assert.throws(() => validateSharedDocumentFile(buildFile({ originalName: "" })), SharedDocumentValidationError);
    assert.throws(() => validateSharedDocumentFile(buildFile({ originalName: undefined })), SharedDocumentValidationError);
  });

  it("accepts a valid plain-text file", () => {
    const validated = validateSharedDocumentFile(buildFile({}));
    assert.equal(validated.subtype, "txt");
    assert.equal(validated.extension, ".txt");
  });
});

describe("Shared Documents Stage 1 validation — signature vs. declared type (Part 4/5)", () => {
  it("accepts a genuine PNG", () => {
    const validated = validateSharedDocumentFile(
      buildFile({ originalName: "photo.png", mimeType: "image/png", buffer: PNG_SIGNATURE, size: PNG_SIGNATURE.length }),
    );
    assert.equal(validated.subtype, "png");
  });

  it("accepts a genuine JPG/JPEG", () => {
    const validated = validateSharedDocumentFile(
      buildFile({ originalName: "photo.jpg", mimeType: "image/jpeg", buffer: JPEG_SIGNATURE, size: JPEG_SIGNATURE.length }),
    );
    assert.equal(validated.subtype, "jpg");

    const validatedJpeg = validateSharedDocumentFile(
      buildFile({ originalName: "photo.jpeg", mimeType: "image/jpeg", buffer: JPEG_SIGNATURE, size: JPEG_SIGNATURE.length }),
    );
    assert.equal(validatedJpeg.subtype, "jpg");
  });

  it("rejects a PNG-declared file whose bytes are not actually PNG", () => {
    assert.throws(
      () =>
        validateSharedDocumentFile(
          buildFile({ originalName: "photo.png", mimeType: "image/png", buffer: Buffer.from("not a png"), size: 9 }),
        ),
      SharedDocumentValidationError,
    );
  });

  it("rejects an SVG/HTML/script payload disguised with an allowed extension and MIME type", () => {
    const svgAsPng = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

    assert.throws(
      () => validateSharedDocumentFile(buildFile({ originalName: "image.png", mimeType: "image/png", buffer: svgAsPng, size: svgAsPng.length })),
      SharedDocumentValidationError,
    );

    const htmlAsTxt = Buffer.from("<!doctype html><html><body>hi</body></html>");

    assert.throws(
      () => validateSharedDocumentFile(buildFile({ originalName: "notes.txt", buffer: htmlAsTxt, size: htmlAsTxt.length })),
      SharedDocumentValidationError,
    );
  });

  it("accepts a genuine PDF", () => {
    const validated = validateSharedDocumentFile(
      buildFile({ originalName: "report.pdf", mimeType: "application/pdf", buffer: PDF_SIGNATURE, size: PDF_SIGNATURE.length }),
    );
    assert.equal(validated.subtype, "pdf");
  });

  it("rejects a PDF-declared file whose bytes are not actually a PDF", () => {
    assert.throws(
      () =>
        validateSharedDocumentFile(
          buildFile({ originalName: "report.pdf", mimeType: "application/pdf", buffer: Buffer.from("nope"), size: 4 }),
        ),
      SharedDocumentValidationError,
    );
  });

  it("rejects a text file that actually contains binary bytes", () => {
    const binary = Buffer.from([0x00, 0x01, 0x02, 0x03]);

    assert.throws(
      () => validateSharedDocumentFile(buildFile({ buffer: binary, size: binary.length })),
      SharedDocumentValidationError,
    );
  });
});

describe("Shared Documents Stage 1 validation — ZIP-container structure (Part 2 'No ZIP')", () => {
  it("accepts a genuine DOCX (OOXML) archive", () => {
    const buffer = fixture("real.docx");
    const validated = validateSharedDocumentFile(
      buildFile({
        originalName: "report.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer,
        size: buffer.length,
      }),
    );
    assert.equal(validated.subtype, "docx");
  });

  it("accepts a genuine ODT (OpenDocument) archive", () => {
    const buffer = fixture("real.odt");
    const validated = validateSharedDocumentFile(
      buildFile({
        originalName: "report.odt",
        mimeType: "application/vnd.oasis.opendocument.text",
        buffer,
        size: buffer.length,
      }),
    );
    assert.equal(validated.subtype, "odt");
  });

  it("rejects a generic .zip renamed to .docx (no OOXML marker entry)", () => {
    const buffer = fixture("generic.zip");

    assert.throws(
      () =>
        validateSharedDocumentFile(
          buildFile({
            originalName: "fake.docx",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            buffer,
            size: buffer.length,
          }),
        ),
      SharedDocumentValidationError,
    );
  });

  it("rejects a real DOCX archive relabeled as ODT (wrong internal structure for the declared subtype)", () => {
    const buffer = fixture("real.docx");

    assert.throws(
      () =>
        validateSharedDocumentFile(
          buildFile({
            originalName: "fake.odt",
            mimeType: "application/vnd.oasis.opendocument.text",
            buffer,
            size: buffer.length,
          }),
        ),
      SharedDocumentValidationError,
    );
  });

  it("rejects a plain .zip outright (not on the allowlist at all)", () => {
    const buffer = fixture("generic.zip");

    assert.throws(
      () => validateSharedDocumentFile(buildFile({ originalName: "archive.zip", mimeType: "application/zip", buffer, size: buffer.length })),
      SharedDocumentValidationError,
    );
  });
});

describe("Shared Documents Stage 1 validation — file name safety", () => {
  it("keeps only the leaf name of a path-like file name", () => {
    const validated = validateSharedDocumentFile(buildFile({ originalName: "../../etc/passwd.txt" }));
    assert.equal(validated.fileName, "passwd.txt");
  });

  it("rejects a file name containing control characters", () => {
    assert.throws(
      () => validateSharedDocumentFile(buildFile({ originalName: "bad\u0000name.txt" })),
      SharedDocumentValidationError,
    );
  });
});

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

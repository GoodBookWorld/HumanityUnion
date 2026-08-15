import { detectImageSignature, looksLikeMarkupOrScript } from "../media-upload/image-signature.js";

import { SharedDocumentValidationError } from "./shared-documents.errors.js";
import { isValidOdfPackage, isValidOoxmlPackage, isZipSignature, listZipEntryNames } from "./shared-documents-zip-inspector.js";

/**
 * Communication UX Pack 03.7 Part 2 — Stage 1 (Technical Validation) of
 * the AI Media Moderation Architecture's pipeline shape, applied to
 * documents: "is this file what it claims to be, and is it safe to
 * process at all?" A failure here is rejected before Stage 2 (AI
 * moderation) is ever invoked, and — per Part 3 — the upload is never
 * persisted at all.
 */
export const MAX_SHARED_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_SHARED_DOCUMENT_FILE_NAME_LENGTH = 255;

export type SharedDocumentAllowedSubtype =
  | "pdf"
  | "png"
  | "jpg"
  | "webp"
  | "txt"
  | "docx"
  | "xlsx"
  | "pptx"
  | "odt"
  | "ods"
  | "odp";

interface AllowlistEntry {
  subtype: SharedDocumentAllowedSubtype;
  mimeTypes: string[];
  extensions: string[];
}

/** Part 2 — the initial allowlist. JPG and JPEG are the same detected signature/MIME (`image/jpeg`), so both extensions map to the one `jpg` subtype. */
const ALLOWLIST: AllowlistEntry[] = [
  { subtype: "pdf", mimeTypes: ["application/pdf"], extensions: [".pdf"] },
  { subtype: "png", mimeTypes: ["image/png"], extensions: [".png"] },
  { subtype: "jpg", mimeTypes: ["image/jpeg"], extensions: [".jpg", ".jpeg"] },
  { subtype: "webp", mimeTypes: ["image/webp"], extensions: [".webp"] },
  { subtype: "txt", mimeTypes: ["text/plain"], extensions: [".txt"] },
  {
    subtype: "docx",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    extensions: [".docx"],
  },
  {
    subtype: "xlsx",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    extensions: [".xlsx"],
  },
  {
    subtype: "pptx",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    extensions: [".pptx"],
  },
  { subtype: "odt", mimeTypes: ["application/vnd.oasis.opendocument.text"], extensions: [".odt"] },
  { subtype: "ods", mimeTypes: ["application/vnd.oasis.opendocument.spreadsheet"], extensions: [".ods"] },
  { subtype: "odp", mimeTypes: ["application/vnd.oasis.opendocument.presentation"], extensions: [".odp"] },
];

const IMAGE_SUBTYPES = new Set<SharedDocumentAllowedSubtype>(["png", "jpg", "webp"]);
const OOXML_SUBTYPES = new Set<SharedDocumentAllowedSubtype>(["docx", "xlsx", "pptx"]);
const ODF_SUBTYPES = new Set<SharedDocumentAllowedSubtype>(["odt", "ods", "odp"]);

export function isImageSubtype(subtype: SharedDocumentAllowedSubtype): boolean {
  return IMAGE_SUBTYPES.has(subtype);
}

function isOoxmlSubtype(subtype: SharedDocumentAllowedSubtype): subtype is "docx" | "xlsx" | "pptx" {
  return OOXML_SUBTYPES.has(subtype);
}

function isOdfSubtype(subtype: SharedDocumentAllowedSubtype): subtype is "odt" | "ods" | "odp" {
  return ODF_SUBTYPES.has(subtype);
}

function resolveDeclaredSubtype(mimeType: string, fileName: string): AllowlistEntry | null {
  const extension = pathExtension(fileName).toLowerCase();

  return (
    ALLOWLIST.find((entry) => entry.mimeTypes.includes(mimeType) && entry.extensions.includes(extension)) ?? null
  );
}

function pathExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");

  return index === -1 ? "" : fileName.slice(index);
}

function sanitizeFileName(rawFileName: unknown): string {
  if (typeof rawFileName !== "string" || rawFileName.trim().length === 0) {
    throw new SharedDocumentValidationError("A file name is required.");
  }

  // Strip any path segments a client might send (defense against directory-traversal-flavored names); only the leaf name is ever stored.
  const leaf = rawFileName.replace(/\\/g, "/").split("/").pop() ?? rawFileName;
  const trimmed = leaf.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_SHARED_DOCUMENT_FILE_NAME_LENGTH) {
    throw new SharedDocumentValidationError(
      `File name must be between 1 and ${MAX_SHARED_DOCUMENT_FILE_NAME_LENGTH} characters.`,
    );
  }

  // eslint-disable-next-line no-control-regex -- intentional: rejects control characters in file names.
  if (/[\u0000-\u001f<>:"|?*]/.test(trimmed)) {
    throw new SharedDocumentValidationError("File name contains invalid characters.");
  }

  return trimmed;
}

export interface ValidatedSharedDocumentFile {
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  extension: string;
  size: number;
  subtype: SharedDocumentAllowedSubtype;
}

/**
 * Stage 1 — Technical Validation (Part 2/5). Checks, in order: declared
 * name/type is on the allowlist, size limit, actual byte signature
 * matches the declared type (never trusting the client-supplied
 * Content-Type/extension alone), and — for the ZIP-container formats —
 * that the archive is genuinely structured like the declared
 * Office/ODF format rather than an arbitrary `.zip` wearing a costume.
 */
export function validateSharedDocumentFile(file: {
  originalName: unknown;
  buffer: Buffer | undefined;
  mimeType: string;
  size: number;
}): ValidatedSharedDocumentFile {
  const fileName = sanitizeFileName(file.originalName);

  if (!file.buffer || file.buffer.length === 0) {
    throw new SharedDocumentValidationError("Uploaded file is empty.");
  }

  if (file.size > MAX_SHARED_DOCUMENT_SIZE_BYTES) {
    throw new SharedDocumentValidationError(
      `File exceeds the ${MAX_SHARED_DOCUMENT_SIZE_BYTES / (1024 * 1024)} MB size limit.`,
    );
  }

  const declared = resolveDeclaredSubtype(file.mimeType, fileName);

  if (!declared) {
    throw new SharedDocumentValidationError(
      "This file type is not supported. Allowed types: PDF, PNG, JPG, JPEG, WEBP, TXT, DOCX, XLSX, PPTX, ODT, ODS, ODP.",
    );
  }

  const isZipContainerSubtype = isOoxmlSubtype(declared.subtype) || isOdfSubtype(declared.subtype);

  // Part 2/5 — reject HTML/SVG/script content masquerading as any allowed
  // type via a spoofed extension/MIME type, before trusting the declared
  // type any further. Skipped for the ZIP-container formats: a legitimate
  // DOCX/ODF archive's own internal XML entries (e.g. `<?xml version=...`)
  // routinely appear within the first bytes of the archive, and the
  // dedicated ZIP-structure check below is already the correct, sufficient
  // gate for those types.
  if (!isZipContainerSubtype && looksLikeMarkupOrScript(file.buffer)) {
    throw new SharedDocumentValidationError("This file could not be verified and was rejected.");
  }

  if (IMAGE_SUBTYPES.has(declared.subtype)) {
    const detected = detectImageSignature(file.buffer);

    if (!detected || detected !== file.mimeType) {
      throw new SharedDocumentValidationError("The file's contents do not match its declared image type.");
    }
  } else if (declared.subtype === "pdf") {
    if (!isPdfSignature(file.buffer)) {
      throw new SharedDocumentValidationError("The file's contents do not match its declared PDF type.");
    }
  } else if (declared.subtype === "txt") {
    if (isZipSignature(file.buffer) || containsBinaryBytes(file.buffer)) {
      throw new SharedDocumentValidationError("The file's contents do not match its declared text type.");
    }
  } else if (isOoxmlSubtype(declared.subtype) || isOdfSubtype(declared.subtype)) {
    validateZipContainerStructure(file.buffer, declared.subtype);
  }

  return {
    fileName,
    buffer: file.buffer,
    mimeType: file.mimeType,
    extension: declared.extensions[0]!,
    size: file.size,
    subtype: declared.subtype,
  };
}

const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");

function isPdfSignature(buffer: Buffer): boolean {
  return buffer.length >= PDF_SIGNATURE.length && buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
}

/** A crude but effective binary/text discriminator: NUL bytes never legitimately appear in plain text. */
function containsBinaryBytes(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));

  return sample.includes(0);
}

/**
 * Part 2 — "No ZIP": DOCX/XLSX/PPTX/ODT/ODS/ODP are themselves ZIP
 * containers, so a plain-signature check cannot distinguish them from a
 * forbidden generic `.zip`. This inspects entry *names* only (never
 * decompresses content) to confirm the archive is genuinely structured
 * like the declared format.
 */
function validateZipContainerStructure(
  buffer: Buffer,
  subtype: "docx" | "xlsx" | "pptx" | "odt" | "ods" | "odp",
): void {
  if (!isZipSignature(buffer)) {
    throw new SharedDocumentValidationError("The file's contents do not match its declared type.");
  }

  if (OOXML_SUBTYPES.has(subtype)) {
    const entryNames = listZipEntryNames(buffer);

    if (!entryNames || !isValidOoxmlPackage(entryNames, subtype as "docx" | "xlsx" | "pptx")) {
      throw new SharedDocumentValidationError("The file's contents do not match its declared type.");
    }

    return;
  }

  if (!isValidOdfPackage(buffer, subtype as "odt" | "ods" | "odp")) {
    throw new SharedDocumentValidationError("The file's contents do not match its declared type.");
  }
}

/**
 * Communication UX Pack 03.7 Part 2/5 — DOCX/XLSX/PPTX (OOXML) and
 * ODT/ODS/ODP (OpenDocument) are all ZIP containers, but plain `.zip` is
 * explicitly forbidden. Magic bytes alone (`PK\x03\x04`) cannot tell them
 * apart, so this module reads just the ZIP *entry names* — never
 * decompresses any entry's content — to confirm the archive is genuinely
 * structured like the declared Office/ODF format before it is ever
 * accepted as one.
 *
 * This intentionally parses only the End Of Central Directory record and
 * the Central Directory File Headers (entry names + flags), which is
 * enough to answer "does this archive contain the marker file a real
 * OOXML/ODF document must contain" without ever inflating/decompressing
 * any entry — the same "read structure, never execute/decode content"
 * posture as `image-signature.ts`/`image-dimensions.ts`.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const MAX_EOCD_SEARCH_WINDOW = 65_557; // 22-byte EOCD record + max 65535-byte comment

export function isZipSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06)
  );
}

/** Entry names only (UTF-8/ASCII decoded); returns `null` if the buffer is not a well-formed ZIP central directory. */
export function listZipEntryNames(buffer: Buffer): string[] | null {
  const searchStart = Math.max(0, buffer.length - MAX_EOCD_SEARCH_WINDOW);
  let eocdOffset = -1;

  for (let offset = buffer.length - 22; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset === -1) {
    return null;
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (centralDirectoryOffset >= buffer.length) {
    return null;
  }

  const names: string[] = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      return names.length > 0 ? names : null;
    }

    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;

    if (nameEnd > buffer.length) {
      return names.length > 0 ? names : null;
    }

    names.push(buffer.toString("utf8", nameStart, nameEnd));
    cursor = nameEnd + extraLength + commentLength;
  }

  return names;
}

const OOXML_MARKER_ENTRY = "[Content_Types].xml";
const OOXML_SUBTYPE_ROOT: Record<"docx" | "xlsx" | "pptx", string> = {
  docx: "word/",
  xlsx: "xl/",
  pptx: "ppt/",
};

/** True only if the archive contains the OOXML package marker AND the subtype's own root folder (e.g. `docx` must contain `word/`). */
export function isValidOoxmlPackage(entryNames: readonly string[], subtype: "docx" | "xlsx" | "pptx"): boolean {
  if (!entryNames.includes(OOXML_MARKER_ENTRY)) {
    return false;
  }

  const requiredRoot = OOXML_SUBTYPE_ROOT[subtype];

  return entryNames.some((name) => name.startsWith(requiredRoot));
}

const ODF_MIMETYPE_BY_SUBTYPE: Record<"odt" | "ods" | "odp", string> = {
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};

/**
 * The ODF spec requires the archive's very first entry to be a
 * stored-uncompressed `mimetype` file whose content is exactly the
 * format's official MIME string — reading it requires locating that one
 * local file header directly (not the central directory), since it is
 * the one entry ODF guarantees is never compressed.
 */
export function isValidOdfPackage(buffer: Buffer, subtype: "odt" | "ods" | "odp"): boolean {
  if (buffer.length < 30) {
    return false;
  }

  const nameLength = buffer.readUInt16LE(26);
  const extraLength = buffer.readUInt16LE(28);
  const nameStart = 30;
  const nameEnd = nameStart + nameLength;

  if (nameEnd > buffer.length || buffer.toString("utf8", nameStart, nameEnd) !== "mimetype") {
    return false;
  }

  const compressionMethod = buffer.readUInt16LE(8);

  if (compressionMethod !== 0) {
    return false;
  }

  const compressedSize = buffer.readUInt32LE(18);
  const contentStart = nameEnd + extraLength;
  const contentEnd = contentStart + compressedSize;

  if (contentEnd > buffer.length) {
    return false;
  }

  const declaredMimeType = buffer.toString("ascii", contentStart, contentEnd);

  return declaredMimeType === ODF_MIMETYPE_BY_SUBTYPE[subtype];
}

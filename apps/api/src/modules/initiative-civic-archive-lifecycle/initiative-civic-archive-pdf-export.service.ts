import PDFDocument from "pdfkit";

import type { InitiativeLifecycleArchiveDocument } from "@hu/types";

import {
  getArchiveDocumentPdfCopy,
  resolveArchivePdfSectionTitle,
} from "./archive-document-copy.js";

/**
 * Initiative Lifecycle — Part M, Section 13. PDF export from the canonical
 * `InitiativeLifecycleArchiveDocument` projection. Generated on request into
 * a Buffer — never stored permanently. Deterministic for the same document
 * content + locale chrome. Never includes private fields (DM/channel/drafts).
 *
 * PDFKit Helvetica uses WinAnsi — Arabic RTL shaping and CJK glyphs are not
 * reliably rendered. Prefer Latin/Cyrillic chrome; non-Latin may omit glyphs.
 */
export async function generateCivicArchivePdfBuffer(
  document: InitiativeLifecycleArchiveDocument,
  options: { readonly draftWatermark?: boolean; readonly locale?: string | null } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const copy = getArchiveDocumentPdfCopy(options.locale);
    const title = document.finalArchiveTitle || copy.untitledArchive;
    const versionLabel =
      document.archiveVersion != null
        ? copy.archiveVersion(document.archiveVersion)
        : copy.draftPreview;
    const dateLabel = document.publishedAt ?? copy.notPublished;
    // Markers live in PDF info (plain parentheses strings). Body text uses
    // PDFKit hex/kerning arrays and is not reliably greppable as contiguous ASCII.
    const marker = `ARCHIVE_PDF_MARKERS title=${title} version=${document.archiveVersion ?? "draft"} date=${dateLabel}`;

    const doc = new PDFDocument({
      margin: 54,
      size: "A4",
      compress: false,
      info: {
        Title: title,
        Author: document.stewardDisplayName ?? "Humanity Union",
        Subject: "Initiative Lifecycle Civic Archive",
        Keywords: marker,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(18).text(title, { align: "left" });
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11).text(versionLabel);
    doc.text(`${copy.publishedLabel}: ${dateLabel}`);
    doc.text(`${copy.initiativeLabel}: ${document.initiativeTitle || document.initiativeId}`);
    if (document.stewardDisplayName) {
      doc.text(`${copy.stewardLabel}: ${document.stewardDisplayName}`);
    }
    doc.text(`${copy.publicUrlLabel}: ${document.publicUrlPath}`);

    if (options.draftWatermark || document.isDraftPreview) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(12).text(copy.draftWatermark);
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(13).text(copy.tableOfContents);
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10);
    for (const section of document.sections) {
      doc.text(`• ${resolveArchivePdfSectionTitle(section.sectionId, section.title, copy)}`);
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(13).text(copy.lifecycleTimeline);
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10);
    for (const entry of document.timeline) {
      doc.text(
        `${entry.label}: ${entry.status}` +
          (entry.publishedAt ? ` (${entry.publishedAt})` : "") +
          (entry.version != null ? ` v${entry.version}` : ""),
      );
    }

    if (document.finalSummary.trim()) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(13).text(copy.finalSummary);
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10).text(document.finalSummary, { align: "left" });
    }

    for (const section of document.sections) {
      doc.moveDown(0.8);
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(resolveArchivePdfSectionTitle(section.sectionId, section.title, copy));
      doc.moveDown(0.3);
      doc
        .font("Helvetica")
        .fontSize(10)
        .text(section.body.trim() || copy.emptySection, {
          align: "left",
        });
      if (section.sourceRecordIds.length > 0) {
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(9).fillColor("#444444");
        doc.text(`${copy.sourcesLabel}: ${section.sourceRecordIds.join(", ")}`);
        doc.fillColor("#000000");
      }
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(13).text(copy.sourcesAndCitations);
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10);
    if (document.citations.length === 0) {
      doc.text(copy.noCitations);
    } else {
      for (const citation of document.citations) {
        doc.text(`• ${citation}`);
      }
    }

    doc.moveDown(1);
    doc.font("Helvetica-Oblique").fontSize(9).text(copy.disclaimer, {
      align: "left",
    });

    doc.end();
  });
}

/** Decode PDFKit hex string fragments from a PDF buffer for test assertions. */
export function extractSearchablePdfText(buffer: Buffer): string {
  const latin1 = buffer.toString("latin1");
  const decodedHex = [...latin1.matchAll(/<([0-9A-Fa-f]+)>/g)]
    .map((match) => {
      try {
        return Buffer.from(match[1]!, "hex").toString("latin1");
      } catch {
        return "";
      }
    })
    .join("");

  return `${latin1}\n${decodedHex}`;
}

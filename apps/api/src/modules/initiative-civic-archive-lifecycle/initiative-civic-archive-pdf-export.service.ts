import PDFDocument from "pdfkit";

import type { InitiativeLifecycleArchiveDocument } from "@hu/types";

/**
 * Initiative Lifecycle — Part M, Section 13. PDF export from the canonical
 * `InitiativeLifecycleArchiveDocument` projection. Generated on request into
 * a Buffer — never stored permanently. Deterministic for the same document
 * content. Never includes private fields (DM/channel/drafts).
 */
export async function generateCivicArchivePdfBuffer(
  document: InitiativeLifecycleArchiveDocument,
  options: { readonly draftWatermark?: boolean } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const title = document.finalArchiveTitle || "Civic Archive";
    const versionLabel =
      document.archiveVersion != null ? `Archive Version ${document.archiveVersion}` : "Draft Preview";
    const dateLabel = document.publishedAt ?? "Not published";
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
    doc.text(`Published: ${dateLabel}`);
    doc.text(`Initiative: ${document.initiativeTitle || document.initiativeId}`);
    if (document.stewardDisplayName) {
      doc.text(`Steward: ${document.stewardDisplayName}`);
    }
    doc.text(`Public URL: ${document.publicUrlPath}`);

    if (options.draftWatermark || document.isDraftPreview) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(12).text("Draft Preview — Not Published");
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(13).text("Table of Contents");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10);
    for (const section of document.sections) {
      doc.text(`• ${section.title}`);
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(13).text("Lifecycle Timeline");
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
      doc.font("Helvetica-Bold").fontSize(13).text("Final Summary");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10).text(document.finalSummary, { align: "left" });
    }

    for (const section of document.sections) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(13).text(section.title);
      doc.moveDown(0.3);
      doc
        .font("Helvetica")
        .fontSize(10)
        .text(section.body.trim() || "(No content recorded for this section.)", {
          align: "left",
        });
      if (section.sourceRecordIds.length > 0) {
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(9).fillColor("#444444");
        doc.text(`Sources: ${section.sourceRecordIds.join(", ")}`);
        doc.fillColor("#000000");
      }
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(13).text("Sources and Citations");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10);
    if (document.citations.length === 0) {
      doc.text("No citations recorded.");
    } else {
      for (const citation of document.citations) {
        doc.text(`• ${citation}`);
      }
    }

    doc.moveDown(1);
    doc.font("Helvetica-Oblique").fontSize(9).text(document.disclaimer, {
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

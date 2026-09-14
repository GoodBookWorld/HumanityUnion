import PDFDocument from "pdfkit";

import type { PublicChoiceResultsSnapshot } from "./public-choice-results-snapshot.mongo-document.js";
import { getPublicChoiceResultsPdfCopy } from "./public-choice-results-document-copy.js";

/**
 * Pack 02C — temporary Final Results PDF from the frozen snapshot.
 * Reuses Civic Archive pdfkit pattern. Generated on request; never stored permanently.
 * Same canonical aggregate as the election page (snapshot frozen from Decision Vote).
 *
 * Chrome labels/disclaimer localize via plain locale maps (08G). PDFKit Helvetica
 * does not reliably render Arabic RTL or CJK glyphs.
 */
export async function generatePublicChoiceResultsPdfBuffer(
  snapshot: PublicChoiceResultsSnapshot,
  options: { readonly generatedAtIso?: string; readonly locale?: string | null } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const copy = getPublicChoiceResultsPdfCopy(options.locale);
    const generatedAt = options.generatedAtIso ?? new Date().toISOString();
    const title = snapshot.electionTitle || copy.finalResults;
    const marker = `PUBLIC_CHOICE_RESULTS_PDF initiative=${snapshot.initiativeId} decision=${snapshot.decisionId} close=${snapshot.votingCloseAt}`;

    const doc = new PDFDocument({
      margin: 54,
      size: "A4",
      compress: false,
      info: {
        Title: title,
        Author: "Humanity Union",
        Subject: "Public Choice Final Results",
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

    doc.font("Helvetica-Bold").fontSize(18).text(copy.brand, { align: "left" });
    doc.moveDown(0.2);
    doc.font("Helvetica-Bold").fontSize(16).text(copy.finalResults);
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(12).text(title);
    if (snapshot.electionDescription.trim()) {
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10).text(snapshot.electionDescription);
    }

    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10);
    doc.text(`${copy.geographyLabel}: ${snapshot.geographyLabel}`);
    doc.text(`${copy.votingClosedLabel}: ${new Date(snapshot.votingCloseAt).toUTCString()}`);
    doc.text(`${copy.totalEffectiveVotersLabel}: ${snapshot.totalEffectiveVoters}`);
    doc.text(`${copy.initiativeUrlLabel}: ${snapshot.publicUrlPath}`);
    doc.text(`${copy.downloadedLabel}: ${new Date(generatedAt).toUTCString()}`);

    doc.moveDown(0.8);
    const aggregates = snapshot.ballotAggregates;

    if (aggregates.ballotMode === "SELECT_ONE_CANDIDATE") {
      doc.font("Helvetica-Bold").fontSize(13).text(copy.candidateRanking);
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10);

      const byId = new Map(snapshot.candidates.map((candidate) => [candidate.candidateId, candidate]));
      for (const tally of aggregates.candidates) {
        const candidate = byId.get(tally.candidateId);
        const name = candidate?.name ?? tally.candidateId;
        const tie = tally.isTie ? copy.tieSuffix : "";
        doc.text(
          `#${tally.rank}${tie}  ${name}  —  ${tally.count} ${copy.votesWord}  (${tally.percentage.toFixed(1)}%)`,
        );
      }

      doc.moveDown(0.4);
      doc.text(
        `${copy.abstainLabel}: ${aggregates.abstain} (${aggregates.abstainPercentage.toFixed(1)}%)`,
      );

      const breakdown = aggregates.participationBreakdown;
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(12).text(copy.participation);
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10);
      doc.text(`${copy.totalVotersLabel}: ${breakdown.totalEffectiveVoters}`);
      doc.text(`${copy.visitorsLabel}: ${breakdown.visitors}`);
      doc.text(`${copy.participantsLabel}: ${breakdown.participants}`);
      doc.text(`${copy.membersLabel}: ${breakdown.members}`);
    } else {
      doc.font("Helvetica-Bold").fontSize(13).text(copy.supportOppose);
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10);
      doc.text(`${copy.supportLabel}: ${aggregates.total.support}`);
      doc.text(`${copy.doNotSupportLabel}: ${aggregates.total.doNotSupport}`);
      doc.text(`${copy.abstainLabel}: ${aggregates.total.abstain}`);
      doc.text(`${copy.totalLabel}: ${aggregates.total.totalVotes}`);

      const breakdown = aggregates.participationBreakdown;
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(12).text(copy.participation);
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10);
      doc.text(`${copy.totalVotersLabel}: ${breakdown.totalEffectiveVoters}`);
      doc.text(`${copy.visitorsLabel}: ${breakdown.visitors}`);
      doc.text(`${copy.participantsLabel}: ${breakdown.participants}`);
      doc.text(`${copy.membersLabel}: ${breakdown.members}`);
    }

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(11).text(copy.disclaimerTitle);
    doc.moveDown(0.2);
    doc.font("Helvetica-Oblique").fontSize(9).text(copy.disclaimer, { align: "left" });

    doc.end();
  });
}

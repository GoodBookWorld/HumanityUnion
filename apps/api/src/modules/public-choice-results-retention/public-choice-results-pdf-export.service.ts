import PDFDocument from "pdfkit";

import type { PublicChoiceResultsSnapshot } from "./public-choice-results-snapshot.mongo-document.js";

/**
 * Pack 02C — temporary Final Results PDF from the frozen snapshot.
 * Reuses Civic Archive pdfkit pattern. Generated on request; never stored permanently.
 * Same canonical aggregate as the election page (snapshot frozen from Decision Vote).
 */
export async function generatePublicChoiceResultsPdfBuffer(
  snapshot: PublicChoiceResultsSnapshot,
  options: { readonly generatedAtIso?: string } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const generatedAt = options.generatedAtIso ?? new Date().toISOString();
    const title = snapshot.electionTitle || "Public Choice Results";
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

    doc.font("Helvetica-Bold").fontSize(18).text("Humanity Union", { align: "left" });
    doc.moveDown(0.2);
    doc.font("Helvetica-Bold").fontSize(16).text("FINAL RESULTS");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(12).text(title);
    if (snapshot.electionDescription.trim()) {
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10).text(snapshot.electionDescription);
    }

    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Geography: ${snapshot.geographyLabel}`);
    doc.text(`Voting closed: ${new Date(snapshot.votingCloseAt).toUTCString()}`);
    doc.text(`Total effective voters: ${snapshot.totalEffectiveVoters}`);
    doc.text(`Initiative URL: ${snapshot.publicUrlPath}`);
    doc.text(`Downloaded: ${new Date(generatedAt).toUTCString()}`);

    doc.moveDown(0.8);
    const aggregates = snapshot.ballotAggregates;

    if (aggregates.ballotMode === "SELECT_ONE_CANDIDATE") {
      doc.font("Helvetica-Bold").fontSize(13).text("Candidate ranking");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10);

      const byId = new Map(snapshot.candidates.map((candidate) => [candidate.candidateId, candidate]));
      for (const tally of aggregates.candidates) {
        const candidate = byId.get(tally.candidateId);
        const name = candidate?.name ?? tally.candidateId;
        const tie = tally.isTie ? " (tie)" : "";
        doc.text(
          `#${tally.rank}${tie}  ${name}  —  ${tally.count} votes  (${tally.percentage.toFixed(1)}%)`,
        );
      }

      doc.moveDown(0.4);
      doc.text(
        `Abstain: ${aggregates.abstain} (${aggregates.abstainPercentage.toFixed(1)}%)`,
      );

      const breakdown = aggregates.participationBreakdown;
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(12).text("Participation");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Total voters: ${breakdown.totalEffectiveVoters}`);
      doc.text(`Visitors: ${breakdown.visitors}`);
      doc.text(`Participants: ${breakdown.participants}`);
      doc.text(`Members: ${breakdown.members}`);
    } else {
      doc.font("Helvetica-Bold").fontSize(13).text("Support / Oppose");
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Support: ${aggregates.total.support}`);
      doc.text(`Do not support: ${aggregates.total.doNotSupport}`);
      doc.text(`Abstain: ${aggregates.total.abstain}`);
      doc.text(`Total: ${aggregates.total.totalVotes}`);

      const breakdown = aggregates.participationBreakdown;
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(12).text("Participation");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Total voters: ${breakdown.totalEffectiveVoters}`);
      doc.text(`Visitors: ${breakdown.visitors}`);
      doc.text(`Participants: ${breakdown.participants}`);
      doc.text(`Members: ${breakdown.members}`);
    }

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(11).text("Community voting results");
    doc.moveDown(0.2);
    doc.font("Helvetica-Oblique").fontSize(9).text(snapshot.disclaimer, { align: "left" });

    doc.end();
  });
}

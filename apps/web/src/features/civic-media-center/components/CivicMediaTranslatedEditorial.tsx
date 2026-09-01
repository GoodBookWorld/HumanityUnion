"use client";

import {
  CivicPublicTranslatedSection,
  joinLinesForDisplay,
  stableJsonForDisplay,
} from "../../language";
import type { CivicMediaCenterPublic } from "@hu/types";

const CIVIC_MEDIA_RECORD_ID = "civic-media-center";

interface CivicMediaTranslatedEditorialProps {
  readonly media: CivicMediaCenterPublic;
}

/**
 * Pack 02G Task 05 — editorial Civic Media fields only (cache-first).
 * Trusted media / fact-check / propaganda resource rows stay canonical.
 */
export function CivicMediaTranslatedEditorial({ media }: CivicMediaTranslatedEditorialProps) {
  return (
    <section className="civic-media-translated-editorial" aria-label="Translated editorial content">
      <CivicPublicTranslatedSection
        sourceKind="civic_media"
        sourceRecordId={CIVIC_MEDIA_RECORD_ID}
        fallbackFields={{
          overviewTitle: media.overview.title,
          overviewSummary: media.overview.summary,
          overviewPoints: stableJsonForDisplay(
            media.overview.points.map((point) => ({
              heading: point.heading,
              body: point.body,
            })),
          ),
          selectionPrinciples: stableJsonForDisplay(
            media.selectionPrinciples.map((item) => ({
              title: item.title,
              description: item.description,
            })),
          ),
          faq: stableJsonForDisplay(
            media.faq.map((item) => ({
              question: item.question,
              answer: item.answer,
            })),
          ),
          initiativeFlowTitle: media.initiativeFlow.title,
          initiativeFlowSummary: media.initiativeFlow.summary,
          initiativeFlowStages: joinLinesForDisplay(media.initiativeFlow.stages),
        }}
      />
    </section>
  );
}

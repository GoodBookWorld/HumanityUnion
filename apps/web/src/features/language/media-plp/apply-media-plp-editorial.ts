/**
 * Reset 03C.1 / 03E — apply Media PLP entity presentations onto canonical editorial.
 * Principles + trusted explanations + overview/FAQ (civic_media_editorial).
 * Initiative-flow participant UX remains UI_DICTIONARY (pipeline.*).
 */

import type {
  CivicMediaCenterPublic,
  CivicMediaFaqItem,
  CivicMediaSelectionPrinciple,
} from "@hu/types";

import type { CivicMediaResolvedEditorial } from "../../civic-media-center/components/CivicMediaTranslatedEditorial";
import { buildCanonicalCivicMediaEditorial } from "../../civic-media-center/components/CivicMediaTranslatedEditorial";
import type { MediaPlpResolvedPresentation } from "./presentation";
import { readMediaPlpStringField } from "./presentation";

function readOverviewPoints(
  presentation: MediaPlpResolvedPresentation["presentation"],
  canonical: CivicMediaResolvedEditorial["overview"]["points"],
): CivicMediaResolvedEditorial["overview"]["points"] {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) {
    return canonical;
  }
  const raw = (presentation as Record<string, unknown>).overviewPoints;
  if (!Array.isArray(raw)) {
    return canonical;
  }
  return canonical.map((point, index) => {
    const hit = raw.find(
      (row) =>
        row &&
        typeof row === "object" &&
        !Array.isArray(row) &&
        (row as { id?: unknown }).id === point.id,
    ) as { heading?: unknown; body?: unknown } | undefined;
    const byIndex = raw[index] as { heading?: unknown; body?: unknown } | undefined;
    const row = hit ?? byIndex;
    if (!row) {
      return point;
    }
    return {
      ...point,
      heading:
        typeof row.heading === "string" && row.heading.trim()
          ? row.heading.trim()
          : point.heading,
      body: typeof row.body === "string" && row.body.trim() ? row.body.trim() : point.body,
    };
  });
}

function readFaqItems(
  presentation: MediaPlpResolvedPresentation["presentation"],
  canonical: readonly CivicMediaFaqItem[],
): CivicMediaFaqItem[] {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) {
    return [...canonical];
  }
  const raw = (presentation as Record<string, unknown>).faq;
  if (!Array.isArray(raw)) {
    return [...canonical];
  }
  return canonical.map((item, index) => {
    const hit = raw.find(
      (row) =>
        row &&
        typeof row === "object" &&
        !Array.isArray(row) &&
        (row as { id?: unknown }).id === item.id,
    ) as { question?: unknown; answer?: unknown } | undefined;
    const byIndex = raw[index] as { question?: unknown; answer?: unknown } | undefined;
    const row = hit ?? byIndex;
    if (!row) {
      return { ...item };
    }
    return {
      ...item,
      question:
        typeof row.question === "string" && row.question.trim()
          ? row.question.trim()
          : item.question,
      answer:
        typeof row.answer === "string" && row.answer.trim() ? row.answer.trim() : item.answer,
    };
  });
}

export function applyMediaPlpPresentationsToEditorial(input: {
  readonly media: CivicMediaCenterPublic;
  readonly trustedById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly principlesById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly editorialPresentation?: MediaPlpResolvedPresentation;
}): CivicMediaResolvedEditorial {
  const canonical = buildCanonicalCivicMediaEditorial(input.media);

  const selectionPrinciples: CivicMediaSelectionPrinciple[] =
    canonical.selectionPrinciples.map((principle) => {
      const resolved = input.principlesById[principle.id];
      if (!resolved || resolved.mode !== "PUBLISHED_LOCALIZED") {
        return principle;
      }
      const title = readMediaPlpStringField(resolved.presentation, "title");
      const description = readMediaPlpStringField(resolved.presentation, "description");
      // Whole-entity only: both semantic fields required or keep complete canonical.
      if (!title.trim() || !description.trim()) {
        return principle;
      }
      return {
        ...principle,
        title,
        description,
      };
    });

  const trustedExplanationsById: Record<string, string> = {
    ...canonical.trustedExplanationsById,
  };
  for (const resource of input.media.trustedMedia) {
    const resolved = input.trustedById[resource.id];
    if (!resolved || resolved.mode !== "PUBLISHED_LOCALIZED") {
      continue;
    }
    const explanation = readMediaPlpStringField(resolved.presentation, "explanation");
    if (explanation.trim()) {
      trustedExplanationsById[resource.id] = explanation;
    }
  }

  let overview = canonical.overview;
  let faq = [...canonical.faq];
  if (
    input.editorialPresentation &&
    input.editorialPresentation.mode === "PUBLISHED_LOCALIZED"
  ) {
    const presentation = input.editorialPresentation.presentation;
    const overviewTitle = readMediaPlpStringField(presentation, "overviewTitle").trim();
    const overviewSummary = readMediaPlpStringField(presentation, "overviewSummary").trim();
    // Whole-entity editorial: require title+summary; otherwise keep complete canonical.
    if (overviewTitle && overviewSummary) {
      overview = {
        title: overviewTitle,
        summary: overviewSummary,
        points: readOverviewPoints(presentation, canonical.overview.points),
      };
      faq = readFaqItems(presentation, canonical.faq);
    }
  }

  return {
    ...canonical,
    overview,
    faq,
    selectionPrinciples,
    trustedExplanationsById,
    translationChrome: {
      ...canonical.translationChrome,
      presentationMode: "plp_consumer",
    },
  };
}

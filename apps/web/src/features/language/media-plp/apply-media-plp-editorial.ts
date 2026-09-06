/**
 * Reset 03C.1 / 03E — apply Media PLP entity presentations onto canonical editorial.
 * Principles + trusted explanations + overview/FAQ (civic_media_editorial).
 * Fact-check mission/coverage and propaganda focus/explanation maps (exported helpers).
 * Initiative-flow participant UX remains UI_DICTIONARY (pipeline.*).
 */

import type {
  CivicMediaCenterPublic,
  CivicMediaFaqItem,
  CivicMediaSelectionPrinciple,
  FactCheckResource,
  PropagandaAnalysisResource,
} from "@hu/types";

import type { CivicMediaResolvedEditorial } from "../../civic-media-center/components/CivicMediaTranslatedEditorial";
import { buildCanonicalCivicMediaEditorial } from "../../civic-media-center/components/CivicMediaTranslatedEditorial";
import type { MediaPlpResolvedPresentation } from "./presentation";
import { readMediaPlpStringField } from "./presentation";

function readRowString(row: Record<string, unknown>, key: string): string {
  const raw = row[key];
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (
    raw &&
    typeof raw === "object" &&
    "value" in raw &&
    typeof (raw as { value: unknown }).value === "string"
  ) {
    return String((raw as { value: string }).value).trim();
  }
  return "";
}

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
        readRowString(row as Record<string, unknown>, "id") === point.id,
    ) as Record<string, unknown> | undefined;
    const byIndex = raw[index] as Record<string, unknown> | undefined;
    const row = hit ?? byIndex;
    if (!row) {
      return point;
    }
    const heading = readRowString(row, "heading");
    const body = readRowString(row, "body");
    return {
      ...point,
      heading: heading || point.heading,
      body: body || point.body,
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
        readRowString(row as Record<string, unknown>, "id") === item.id,
    ) as Record<string, unknown> | undefined;
    const byIndex = raw[index] as Record<string, unknown> | undefined;
    const row = hit ?? byIndex;
    if (!row) {
      return { ...item };
    }
    const question = readRowString(row, "question");
    const answer = readRowString(row, "answer");
    return {
      ...item,
      question: question || item.question,
      answer: answer || item.answer,
    };
  });
}

function applyPrincipleFromPlp(
  principle: CivicMediaSelectionPrinciple,
  resolved: MediaPlpResolvedPresentation | undefined,
): CivicMediaSelectionPrinciple {
  if (!resolved || resolved.mode !== "PUBLISHED_LOCALIZED") {
    return principle;
  }
  const title = readMediaPlpStringField(resolved.presentation, "title");
  const description = readMediaPlpStringField(resolved.presentation, "description");
  const whyItMatters = readMediaPlpStringField(resolved.presentation, "whyItMatters");
  const canonicalWhy = (principle.whyItMatters ?? "").trim();

  // Whole-entity: title+description always required.
  if (!title.trim() || !description.trim()) {
    return principle;
  }

  // When canonical carries whyItMatters, require it from the published presentation too.
  if (canonicalWhy) {
    if (!whyItMatters.trim()) {
      return principle;
    }
    return {
      ...principle,
      title,
      description,
      whyItMatters,
    };
  }

  // Otherwise apply why only when non-empty in the presentation.
  return {
    ...principle,
    title,
    description,
    ...(whyItMatters.trim() ? { whyItMatters } : {}),
  };
}

/** Apply fact-check mission/coverage from PLP — same whole-field pattern as trusted explanations. */
export function applyMediaPlpFactCheckMaps(input: {
  readonly resources: readonly FactCheckResource[];
  readonly factCheckById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
}): {
  readonly missionsById: Readonly<Record<string, string>>;
  readonly coverageById: Readonly<Record<string, string>>;
} {
  const missionsById: Record<string, string> = {};
  const coverageById: Record<string, string> = {};
  for (const resource of input.resources) {
    missionsById[resource.id] = resource.mission;
    coverageById[resource.id] = resource.coverage;
    const resolved = input.factCheckById[resource.id];
    if (!resolved || resolved.mode !== "PUBLISHED_LOCALIZED") {
      continue;
    }
    const mission = readMediaPlpStringField(resolved.presentation, "mission");
    const coverage = readMediaPlpStringField(resolved.presentation, "coverage");
    if (mission.trim()) {
      missionsById[resource.id] = mission;
    }
    if (coverage.trim()) {
      coverageById[resource.id] = coverage;
    }
  }
  return { missionsById, coverageById };
}

/** Apply propaganda focus/explanation from PLP — same pattern as trusted explanations. */
export function applyMediaPlpPropagandaMaps(input: {
  readonly resources: readonly PropagandaAnalysisResource[];
  readonly propagandaById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
}): {
  readonly focusById: Readonly<Record<string, string>>;
  readonly explanationsById: Readonly<Record<string, string>>;
} {
  const focusById: Record<string, string> = {};
  const explanationsById: Record<string, string> = {};
  for (const resource of input.resources) {
    focusById[resource.id] = resource.focus;
    explanationsById[resource.id] = resource.explanation;
    const resolved = input.propagandaById[resource.id];
    if (!resolved || resolved.mode !== "PUBLISHED_LOCALIZED") {
      continue;
    }
    const focus = readMediaPlpStringField(resolved.presentation, "focus");
    const explanation = readMediaPlpStringField(resolved.presentation, "explanation");
    if (focus.trim()) {
      focusById[resource.id] = focus;
    }
    if (explanation.trim()) {
      explanationsById[resource.id] = explanation;
    }
  }
  return { focusById, explanationsById };
}

export function applyMediaPlpPresentationsToEditorial(input: {
  readonly media: CivicMediaCenterPublic;
  readonly trustedById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly principlesById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly editorialPresentation?: MediaPlpResolvedPresentation;
}): CivicMediaResolvedEditorial {
  const canonical = buildCanonicalCivicMediaEditorial(input.media);

  const selectionPrinciples: CivicMediaSelectionPrinciple[] =
    canonical.selectionPrinciples.map((principle) =>
      applyPrincipleFromPlp(principle, input.principlesById[principle.id]),
    );

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

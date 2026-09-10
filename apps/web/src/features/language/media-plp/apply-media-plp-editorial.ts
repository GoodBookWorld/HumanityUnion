/**
 * Reset 03C.1 / 03E — apply Media PLP entity presentations onto canonical editorial.
 * Principles + trusted explanations + overview/FAQ (civic_media_editorial).
 * Fact-check mission/coverage and propaganda focus/explanation maps (exported helpers).
 * Initiative-flow participant UX remains UI_DICTIONARY (pipeline.*).
 *
 * Implementation 02 — fail-closed locale isolation: apply PUBLISHED_LOCALIZED
 * strings only when presentation locale equals requested document locale.
 */

import type {
  CivicMediaCenterPublic,
  CivicMediaFaqItem,
  CivicMediaSelectionPrinciple,
  FactCheckResource,
  PropagandaAnalysisResource,
} from "@hu/types";
import { mayApplyPersistedLocalizedPresentation } from "@hu/types";

import type { CivicMediaResolvedEditorial } from "../../civic-media-center/civic-media-canonical-editorial";
import { buildCanonicalCivicMediaEditorial } from "../../civic-media-center/civic-media-canonical-editorial";
import type { MediaPlpResolvedPresentation } from "./presentation";
import { readMediaPlpStringField } from "./presentation";
import {
  isMediaPlpLiveTruthProbeEnabled,
  recordMediaPlpLiveTruthProjected,
} from "./media-plp-live-truth-probe";

function mayApplyMediaPlpPresentation(input: {
  readonly resolved: MediaPlpResolvedPresentation | undefined;
  readonly requestedLocale: string;
}): boolean {
  if (!input.resolved) {
    return false;
  }
  return mayApplyPersistedLocalizedPresentation({
    presentationLocale: input.resolved.locale,
    requestedLocale: input.requestedLocale,
    mode: input.resolved.mode,
  });
}

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
): CivicMediaResolvedEditorial["overview"]["points"] | null {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) {
    return null;
  }
  const raw = (presentation as Record<string, unknown>).overviewPoints;
  if (!Array.isArray(raw)) {
    return null;
  }
  const next: CivicMediaResolvedEditorial["overview"]["points"] = [];
  for (let index = 0; index < canonical.length; index += 1) {
    const point = canonical[index]!;
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
      return null;
    }
    const heading = readRowString(row, "heading");
    const body = readRowString(row, "body");
    // Whole-entity: every canonical point must be fully localized — no hybrid.
    if (!heading || !body) {
      return null;
    }
    next.push({
      ...point,
      heading,
      body,
    });
  }
  return next;
}

function readFaqItems(
  presentation: MediaPlpResolvedPresentation["presentation"],
  canonical: readonly CivicMediaFaqItem[],
): CivicMediaFaqItem[] | null {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) {
    return null;
  }
  const raw = (presentation as Record<string, unknown>).faq;
  if (!Array.isArray(raw)) {
    return null;
  }
  const next: CivicMediaFaqItem[] = [];
  for (let index = 0; index < canonical.length; index += 1) {
    const item = canonical[index]!;
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
      return null;
    }
    const question = readRowString(row, "question");
    const answer = readRowString(row, "answer");
    if (!question || !answer) {
      return null;
    }
    next.push({
      ...item,
      question,
      answer,
    });
  }
  return next;
}

function applyPrincipleFromPlp(
  principle: CivicMediaSelectionPrinciple,
  resolved: MediaPlpResolvedPresentation | undefined,
  requestedLocale: string,
): CivicMediaSelectionPrinciple {
  if (
    !mayApplyMediaPlpPresentation({
      resolved,
      requestedLocale,
    })
  ) {
    return principle;
  }
  const title = readMediaPlpStringField(resolved!.presentation, "title");
  const description = readMediaPlpStringField(resolved!.presentation, "description");
  const whyItMatters = readMediaPlpStringField(resolved!.presentation, "whyItMatters");
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

/** Apply fact-check mission/coverage from PLP — whole-entity only (no field hybrid). */
export function applyMediaPlpFactCheckMaps(input: {
  readonly resources: readonly FactCheckResource[];
  readonly factCheckById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  /** Document / participant requested locale — never inferred from PLP. */
  readonly requestedLocale: string;
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
    if (
      !resolved ||
      !mayApplyMediaPlpPresentation({
        resolved,
        requestedLocale: input.requestedLocale,
      })
    ) {
      continue;
    }
    const mission = readMediaPlpStringField(resolved.presentation, "mission");
    const coverage = readMediaPlpStringField(resolved.presentation, "coverage");
    if (mission.trim() && coverage.trim()) {
      missionsById[resource.id] = mission;
      coverageById[resource.id] = coverage;
    }
  }
  return { missionsById, coverageById };
}

/** Apply propaganda focus/explanation from PLP — whole-entity only (no field hybrid). */
export function applyMediaPlpPropagandaMaps(input: {
  readonly resources: readonly PropagandaAnalysisResource[];
  readonly propagandaById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  /** Document / participant requested locale — never inferred from PLP. */
  readonly requestedLocale: string;
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
    if (
      !resolved ||
      !mayApplyMediaPlpPresentation({
        resolved,
        requestedLocale: input.requestedLocale,
      })
    ) {
      continue;
    }
    const focus = readMediaPlpStringField(resolved.presentation, "focus");
    const explanation = readMediaPlpStringField(resolved.presentation, "explanation");
    if (focus.trim() && explanation.trim()) {
      focusById[resource.id] = focus;
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
  /** Document / participant requested locale — never inferred from PLP. */
  readonly requestedLocale: string;
}): CivicMediaResolvedEditorial {
  const canonical = buildCanonicalCivicMediaEditorial(input.media);

  const selectionPrinciples: CivicMediaSelectionPrinciple[] =
    canonical.selectionPrinciples.map((principle) =>
      applyPrincipleFromPlp(
        principle,
        input.principlesById[principle.id],
        input.requestedLocale,
      ),
    );

  const trustedExplanationsById: Record<string, string> = {
    ...canonical.trustedExplanationsById,
  };
  for (const resource of input.media.trustedMedia) {
    const resolved = input.trustedById[resource.id];
    if (
      !resolved ||
      !mayApplyMediaPlpPresentation({
        resolved,
        requestedLocale: input.requestedLocale,
      })
    ) {
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
    mayApplyMediaPlpPresentation({
      resolved: input.editorialPresentation,
      requestedLocale: input.requestedLocale,
    })
  ) {
    const presentation = input.editorialPresentation!.presentation;
    const overviewTitle = readMediaPlpStringField(presentation, "overviewTitle").trim();
    const overviewSummary = readMediaPlpStringField(presentation, "overviewSummary").trim();
    const localizedPoints = readOverviewPoints(presentation, canonical.overview.points);
    const localizedFaq = readFaqItems(presentation, canonical.faq);
    // Whole-entity editorial: title+summary+all points+all FAQ or keep complete canonical.
    if (overviewTitle && overviewSummary && localizedPoints && localizedFaq) {
      overview = {
        title: overviewTitle,
        summary: overviewSummary,
        points: localizedPoints,
      };
      faq = localizedFaq;
    }
  }

  recordEditorialProjectionProbe(overview, faq);

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

function recordEditorialProjectionProbe(
  overview: CivicMediaResolvedEditorial["overview"],
  faq: readonly CivicMediaFaqItem[],
): void {
  if (!isMediaPlpLiveTruthProbeEnabled()) {
    return;
  }
  recordMediaPlpLiveTruthProjected({
    overviewSummary: overview.summary,
    faq0Question: faq[0]?.question ?? "",
    faq0Answer: faq[0]?.answer ?? "",
  });
}

import type {
  CommunityInitiativeRelationshipProjection,
  CommunityInitiativeRelationshipType,
  CommunityIntelligenceReason,
  CommunitySimilarityCheckRequest,
} from "@hu/types";

import type {
  CommunityInitiativeSignalDocument,
  CommunitySimilarityMatchInput,
  CommunitySimilarityProvider,
} from "./community-similarity-provider.js";
import {
  detectComplementaryFocusLabels,
  jaccardSimilarity,
  sharedTokens,
  tokenizeCommunityText,
} from "./text-signals.js";

interface ScoredSignals {
  readonly titleOverlap: number;
  readonly descriptionOverlap: number;
  readonly sharedTitleTokens: readonly string[];
  readonly sharedDescriptionTokens: readonly string[];
  readonly sharedThemes: readonly string[];
  readonly sameActivityArea: boolean;
  readonly sameCategory: boolean;
  readonly sharedTags: readonly string[];
  readonly geoOverlap: "none" | "country" | "region" | "community";
  readonly complementaryFocus: readonly string[];
  readonly sourceFocus: readonly string[];
  readonly candidateFocus: readonly string[];
}

function normalizeArea(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function scorePair(
  source: CommunityInitiativeSignalDocument,
  candidate: CommunityInitiativeSignalDocument,
): ScoredSignals {
  const sourceTitle = tokenizeCommunityText(source.title);
  const candidateTitle = tokenizeCommunityText(candidate.title);
  const sourceDescription = tokenizeCommunityText(
    `${source.description} ${source.publicAnalysisThemes.join(" ")}`,
  );
  const candidateDescription = tokenizeCommunityText(
    `${candidate.description} ${candidate.publicAnalysisThemes.join(" ")}`,
  );
  const sourceTags = new Set(source.tags.map((tag) => tag.toLowerCase()));
  const candidateTags = new Set(candidate.tags.map((tag) => tag.toLowerCase()));
  const sharedTagList = sharedTokens(sourceTags, candidateTags, 6);
  const sourceFocus = detectComplementaryFocusLabels(
    new Set([...sourceTitle, ...sourceDescription]),
  );
  const candidateFocus = detectComplementaryFocusLabels(
    new Set([...candidateTitle, ...candidateDescription]),
  );
  const complementaryFocus = sourceFocus.filter((label) => !candidateFocus.includes(label));
  const sharedFocus = sourceFocus.filter((label) => candidateFocus.includes(label));

  let geoOverlap: ScoredSignals["geoOverlap"] = "none";
  if (
    source.communitySlug &&
    candidate.communitySlug &&
    source.communitySlug === candidate.communitySlug
  ) {
    geoOverlap = "community";
  } else if (
    source.regionSlug &&
    candidate.regionSlug &&
    source.regionSlug === candidate.regionSlug
  ) {
    geoOverlap = "region";
  } else if (
    source.countrySlug &&
    candidate.countrySlug &&
    source.countrySlug === candidate.countrySlug
  ) {
    geoOverlap = "country";
  }

  const sharedThemeTokens = sharedTokens(sourceDescription, candidateDescription, 8);

  return {
    titleOverlap: jaccardSimilarity(sourceTitle, candidateTitle),
    descriptionOverlap: jaccardSimilarity(sourceDescription, candidateDescription),
    sharedTitleTokens: sharedTokens(sourceTitle, candidateTitle, 6),
    sharedDescriptionTokens: sharedThemeTokens,
    sharedThemes: Array.from(new Set([...sharedThemeTokens, ...sharedFocus])).slice(0, 8),
    sameActivityArea: normalizeArea(source.activityArea) === normalizeArea(candidate.activityArea),
    sameCategory:
      Boolean(source.category && candidate.category) &&
      normalizeArea(source.category) === normalizeArea(candidate.category),
    sharedTags: sharedTagList,
    geoOverlap,
    complementaryFocus,
    sourceFocus,
    candidateFocus,
  };
}

function computeScore(signals: ScoredSignals): number {
  let score = 0;
  score += signals.titleOverlap * 0.42;
  score += signals.descriptionOverlap * 0.28;
  if (signals.sameActivityArea) {
    score += 0.16;
  }
  if (signals.sameCategory) {
    score += 0.04;
  }
  score += Math.min(0.08, signals.sharedTags.length * 0.02);
  if (signals.geoOverlap === "community") {
    score += 0.06;
  } else if (signals.geoOverlap === "region") {
    score += 0.04;
  } else if (signals.geoOverlap === "country") {
    score += 0.02;
  }
  return Math.min(1, Number(score.toFixed(4)));
}

function classify(
  score: number,
  signals: ScoredSignals,
): CommunityInitiativeRelationshipType | null {
  if (score < 0.18) {
    return null;
  }

  const strongTitle = signals.titleOverlap >= 0.55;
  const strongBody = signals.descriptionOverlap >= 0.35;
  if (
    score >= 0.55 &&
    signals.sameActivityArea &&
    (strongTitle || (signals.titleOverlap >= 0.35 && strongBody))
  ) {
    return "possible_duplicate";
  }

  const distinctComplement =
    signals.sameActivityArea &&
    signals.sourceFocus.length > 0 &&
    signals.candidateFocus.length > 0 &&
    signals.complementaryFocus.length > 0 &&
    !strongTitle;

  if (distinctComplement && score >= 0.22 && score < 0.7) {
    return "complementary";
  }

  if (score >= 0.22) {
    return "related";
  }

  return null;
}

function buildReasons(
  signals: ScoredSignals,
  relationshipType: CommunityInitiativeRelationshipType,
  source: CommunityInitiativeSignalDocument,
  candidate: CommunityInitiativeSignalDocument,
): CommunityIntelligenceReason[] {
  const reasons: CommunityIntelligenceReason[] = [];

  if (signals.sameActivityArea) {
    reasons.push({
      code: "same_activity_area",
      message: `Same Participation Area: ${source.activityArea}`,
    });
  }

  if (signals.sharedThemes.length > 0) {
    reasons.push({
      code: "shared_themes",
      message: `${signals.sharedThemes.length} overlapping theme${signals.sharedThemes.length === 1 ? "" : "s"} (${signals.sharedThemes.slice(0, 3).join(", ")})`,
    });
  }

  if (signals.sharedTitleTokens.length > 0) {
    reasons.push({
      code: "shared_title_terms",
      message: `Shared title terms: ${signals.sharedTitleTokens.slice(0, 4).join(", ")}`,
    });
  }

  if (signals.sharedTags.length > 0) {
    reasons.push({
      code: "shared_tags",
      message: `Shared keywords: ${signals.sharedTags.join(", ")}`,
    });
  }

  if (signals.geoOverlap !== "none") {
    reasons.push({
      code: `geo_${signals.geoOverlap}`,
      message: `Overlapping geographic scope (${signals.geoOverlap})`,
    });
  }

  if (relationshipType === "complementary") {
    const sourceLabel = signals.sourceFocus[0] ?? "one focus";
    const candidateLabel = signals.candidateFocus[0] ?? "another focus";
    reasons.push({
      code: "complementary_focus",
      message: `Complementary focus: ${sourceLabel} alongside ${candidateLabel}`,
    });
  }

  if (relationshipType === "possible_duplicate") {
    reasons.push({
      code: "possible_overlap",
      message: "Strong topical overlap — possible related or overlapping civic work",
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      code: "topical_affinity",
      message: `Topical affinity with “${candidate.title}”`,
    });
  }

  return reasons;
}

function buildDifferences(
  signals: ScoredSignals,
  source: CommunityInitiativeSignalDocument,
  candidate: CommunityInitiativeSignalDocument,
): string[] {
  const differences: string[] = [];

  if (!signals.sameActivityArea) {
    differences.push(
      `Different Participation Areas (${source.activityArea} vs ${candidate.activityArea})`,
    );
  }

  if (signals.sourceFocus.length > 0 && signals.candidateFocus.length > 0) {
    const onlySource = signals.sourceFocus.filter((label) => !signals.candidateFocus.includes(label));
    const onlyCandidate = signals.candidateFocus.filter(
      (label) => !signals.sourceFocus.includes(label),
    );
    if (onlySource.length > 0 || onlyCandidate.length > 0) {
      differences.push(
        `Different emphasis (${onlySource.join(", ") || "general"} vs ${onlyCandidate.join(", ") || "general"})`,
      );
    }
  }

  if (signals.titleOverlap < 0.35) {
    differences.push("Titles emphasize different primary terms");
  }

  return differences.slice(0, 4);
}

function toProjection(
  source: CommunityInitiativeSignalDocument,
  candidate: CommunityInitiativeSignalDocument,
  signals: ScoredSignals,
  relationshipType: CommunityInitiativeRelationshipType,
  score: number,
): CommunityInitiativeRelationshipProjection {
  return {
    initiativeId: candidate.initiativeId,
    title: candidate.title,
    relationshipType,
    score,
    reasons: buildReasons(signals, relationshipType, source, candidate),
    sharedTopics: signals.sharedThemes,
    sharedParticipationAreas: signals.sameActivityArea ? [source.activityArea] : [],
    sharedPriorities: signals.sharedTags,
    keyDifferences: buildDifferences(signals, source, candidate),
    publicUrl: candidate.publicUrl,
  };
}

function draftToSignal(draft: CommunitySimilarityCheckRequest): CommunityInitiativeSignalDocument {
  const activityArea =
    draft.activityArea === "Other" && draft.activityAreaOther
      ? draft.activityAreaOther
      : (draft.activityArea ?? "General");

  return {
    initiativeId: draft.excludeInitiativeId ?? "draft",
    title: draft.title,
    description: draft.description,
    activityArea,
    tags: draft.tags ?? [],
    category: activityArea,
    countrySlug: draft.countrySlug,
    regionSlug: draft.regionSlug,
    communitySlug: draft.communitySlug,
    participationScope: draft.participationScope,
    publicAnalysisThemes: [],
    publicUrl: "",
  };
}

function rankMatches(
  source: CommunityInitiativeSignalDocument,
  candidates: readonly CommunityInitiativeSignalDocument[],
  maxResults: number,
  minScore: number,
): CommunityInitiativeRelationshipProjection[] {
  const ranked: CommunityInitiativeRelationshipProjection[] = [];

  for (const candidate of candidates) {
    if (candidate.initiativeId === source.initiativeId) {
      continue;
    }

    const signals = scorePair(source, candidate);
    const score = computeScore(signals);
    if (score < minScore) {
      continue;
    }

    const relationshipType = classify(score, signals);
    if (!relationshipType) {
      continue;
    }

    ranked.push(toProjection(source, candidate, signals, relationshipType, score));
  }

  return ranked
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, maxResults);
}

export class DeterministicCommunitySimilarityProvider implements CommunitySimilarityProvider {
  readonly providerId = "deterministic" as const;

  match(input: CommunitySimilarityMatchInput): readonly CommunityInitiativeRelationshipProjection[] {
    return rankMatches(input.source, input.candidates, input.maxResults, input.minScore);
  }

  matchDraft(
    draft: CommunitySimilarityCheckRequest,
    candidates: readonly CommunityInitiativeSignalDocument[],
    options: { readonly maxResults: number; readonly minScore: number },
  ): readonly CommunityInitiativeRelationshipProjection[] {
    return rankMatches(
      draftToSignal(draft),
      candidates,
      options.maxResults,
      options.minScore,
    );
  }
}

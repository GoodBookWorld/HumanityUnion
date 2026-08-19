import type {
  InitiativeLifecycleAiAssistSuggestion,
  InitiativePublicImpactReportSection,
  InitiativePublicImpactReportSectionId,
} from "@hu/types";

import { getLifecycleAiStageApplyContract } from "./lifecycle-ai-stage-apply-contract";

/**
 * Lifecycle Staging Fix 03 / 03B — pure Apply contract for Author forms.
 *
 * Suggestions never auto-apply; the Author must invoke this after reviewing.
 * Field-level suggestions update only matching keys; whole-document mode
 * applies every known Section id present in the suggestion list (multiple
 * fields). Unscoped advisory without section ids lands on fallback only.
 */

export interface ApplyLifecycleAiSuggestionsResult<T extends { [K in keyof T]: string }> {
  readonly next: T;
  readonly applied: boolean;
  readonly changedKeys: readonly string[];
}

export function applyLifecycleAiSuggestionsToFields<T extends { [K in keyof T]: string }>(input: {
  readonly current: T;
  readonly suggestions: readonly Pick<
    InitiativeLifecycleAiAssistSuggestion,
    "targetSectionId" | "suggestedText"
  >[];
  readonly knownKeys: readonly (keyof T & string)[];
  readonly fallbackKey: keyof T & string;
  readonly forbiddenKeys?: readonly string[];
}): ApplyLifecycleAiSuggestionsResult<T> {
  const known = new Set<string>(input.knownKeys);
  const forbidden = new Set(input.forbiddenKeys ?? []);
  const next: T = { ...input.current };
  const changedKeys: string[] = [];
  let appliedSectioned = false;

  for (const suggestion of input.suggestions) {
    const text = suggestion.suggestedText?.trim();
    if (!text) {
      continue;
    }

    const sectionId = suggestion.targetSectionId?.trim();
    if (!sectionId || forbidden.has(sectionId) || !known.has(sectionId)) {
      continue;
    }

    const key = sectionId as keyof T & string;
    if (next[key] !== text) {
      (next as Record<string, string>)[key] = text;
      if (!changedKeys.includes(key)) {
        changedKeys.push(key);
      }
    }
    appliedSectioned = true;
  }

  if (appliedSectioned) {
    return { next, applied: changedKeys.length > 0, changedKeys };
  }

  const advisory = input.suggestions
    .map((item) => item.suggestedText.trim())
    .filter(Boolean)
    .join("\n\n");

  if (!advisory) {
    return { next: input.current, applied: false, changedKeys: [] };
  }

  const fallback = input.fallbackKey;
  if (forbidden.has(String(fallback))) {
    return { next: input.current, applied: false, changedKeys: [] };
  }

  const existing = String(next[fallback] ?? "").trim();
  const merged = existing ? `${existing}\n\n${advisory}` : advisory;
  if (merged === next[fallback]) {
    return { next: input.current, applied: false, changedKeys: [] };
  }

  (next as Record<string, string>)[fallback] = merged;
  return { next, applied: true, changedKeys: [fallback] };
}

export interface ApplyPublicImpactAiSuggestionsResult {
  readonly title: string;
  readonly sections: InitiativePublicImpactReportSection[];
  readonly applied: boolean;
  readonly changedSectionIds: readonly string[];
}

/**
 * Public Impact sections apply — only matching sectionIds update; unrelated
 * sections stay untouched. Whole-document mode fills every targeted section.
 * Unscoped advisory without section ids lands on executive_summary only.
 */
export function applyLifecycleAiSuggestionsToPublicImpactSections(input: {
  readonly sections: readonly InitiativePublicImpactReportSection[];
  readonly suggestions: readonly Pick<
    InitiativeLifecycleAiAssistSuggestion,
    "targetSectionId" | "suggestedText"
  >[];
  readonly title: string;
}): ApplyPublicImpactAiSuggestionsResult {
  const contract = getLifecycleAiStageApplyContract("public_impact");
  const knownIds = new Set(input.sections.map((section) => section.sectionId));
  let title = input.title;
  const sections: InitiativePublicImpactReportSection[] = input.sections.map((section) => ({
    ...section,
    evidenceReferences: [...section.evidenceReferences],
  }));
  const changedSectionIds: string[] = [];
  let appliedSectioned = false;

  for (const suggestion of input.suggestions) {
    const text = suggestion.suggestedText?.trim();
    if (!text) {
      continue;
    }

    const sectionId = suggestion.targetSectionId?.trim();
    if (sectionId === "title") {
      title = text;
      if (!changedSectionIds.includes("title")) {
        changedSectionIds.push("title");
      }
      appliedSectioned = true;
      continue;
    }

    if (sectionId && knownIds.has(sectionId as InitiativePublicImpactReportSectionId)) {
      const index = sections.findIndex((section) => section.sectionId === sectionId);
      if (index >= 0) {
        const current = sections[index]!;
        sections[index] = { ...current, body: text };
        if (!changedSectionIds.includes(sectionId)) {
          changedSectionIds.push(sectionId);
        }
        appliedSectioned = true;
      }
    }
  }

  if (appliedSectioned) {
    return {
      title,
      sections,
      applied: changedSectionIds.length > 0,
      changedSectionIds,
    };
  }

  const advisory = input.suggestions
    .map((item) => item.suggestedText.trim())
    .filter(Boolean)
    .join("\n\n");

  if (!advisory) {
    return {
      title: input.title,
      sections,
      applied: false,
      changedSectionIds: [],
    };
  }

  const fallback = contract?.fallbackKey ?? "executive_summary";
  const index = sections.findIndex((section) => section.sectionId === fallback);
  if (index >= 0) {
    const current = sections[index]!;
    const merged = current.body.trim() ? `${current.body.trim()}\n\n${advisory}` : advisory;
    sections[index] = { ...current, body: merged };
    return {
      title,
      sections,
      applied: true,
      changedSectionIds: [fallback],
    };
  }

  return {
    title,
    sections,
    applied: false,
    changedSectionIds: [],
  };
}

export interface ApplyCandidateCollectionResult<
  TPackage extends { [K in keyof TPackage]: string },
  TCandidate extends { [K in keyof TCandidate]: string },
> {
  readonly packageFields: TPackage;
  readonly candidates: TCandidate[];
  readonly applied: boolean;
  readonly changedKeys: readonly string[];
}

/**
 * Package + first-candidate Apply for Commitment / Tracking / Official Responses.
 * Never writes forbidden keys (assignees, verification, invented official body).
 */
export function applyLifecycleAiSuggestionsToCandidateCollection<
  TPackage extends { [K in keyof TPackage]: string },
  TCandidate extends { [K in keyof TCandidate]: string },
>(input: {
  readonly packageFields: TPackage;
  readonly candidates: readonly TCandidate[];
  readonly suggestions: readonly Pick<
    InitiativeLifecycleAiAssistSuggestion,
    "targetSectionId" | "suggestedText"
  >[];
  readonly packageKeys: readonly (keyof TPackage & string)[];
  readonly candidateKeys: readonly (keyof TCandidate & string)[];
  readonly forbiddenKeys?: readonly string[];
  readonly fallbackKey: keyof TPackage & string;
  /** Maps AI section id → candidate form key (e.g. milestoneTitle → title). */
  readonly candidateKeyAliases?: Readonly<Record<string, keyof TCandidate & string>>;
}): ApplyCandidateCollectionResult<TPackage, TCandidate> {
  const forbidden = new Set(input.forbiddenKeys ?? []);
  const packageKnown = new Set<string>(input.packageKeys);
  const candidateKnown = new Set<string>(input.candidateKeys);
  const aliases = input.candidateKeyAliases ?? {};
  const packageFields: TPackage = { ...input.packageFields };
  const candidates = input.candidates.map((candidate) => ({ ...candidate }));
  const changedKeys: string[] = [];
  let appliedSectioned = false;

  for (const suggestion of input.suggestions) {
    const text = suggestion.suggestedText?.trim();
    if (!text) {
      continue;
    }

    const sectionId = suggestion.targetSectionId?.trim();
    if (!sectionId || forbidden.has(sectionId)) {
      continue;
    }

    if (packageKnown.has(sectionId)) {
      const key = sectionId as keyof TPackage & string;
      if (packageFields[key] !== text) {
        (packageFields as Record<string, string>)[key] = text;
        if (!changedKeys.includes(key)) {
          changedKeys.push(key);
        }
      }
      appliedSectioned = true;
      continue;
    }

    const candidateKey =
      (aliases[sectionId] as keyof TCandidate & string | undefined) ??
      (candidateKnown.has(sectionId) ? (sectionId as keyof TCandidate & string) : null);

    if (candidateKey && candidates.length > 0) {
      const first = candidates[0]!;
      if (first[candidateKey] !== text) {
        (first as Record<string, string>)[candidateKey] = text;
        candidates[0] = first;
        const changed = `candidate.0.${String(candidateKey)}`;
        if (!changedKeys.includes(changed)) {
          changedKeys.push(changed);
        }
      }
      appliedSectioned = true;
    }
  }

  if (appliedSectioned) {
    return {
      packageFields,
      candidates,
      applied: changedKeys.length > 0,
      changedKeys,
    };
  }

  const advisory = input.suggestions
    .map((item) => item.suggestedText.trim())
    .filter(Boolean)
    .join("\n\n");

  if (!advisory || forbidden.has(String(input.fallbackKey))) {
    return {
      packageFields: input.packageFields,
      candidates: input.candidates.map((candidate) => ({ ...candidate })),
      applied: false,
      changedKeys: [],
    };
  }

  const fallback = input.fallbackKey;
  const existing = String(packageFields[fallback] ?? "").trim();
  const merged = existing ? `${existing}\n\n${advisory}` : advisory;
  (packageFields as Record<string, string>)[fallback] = merged;

  return {
    packageFields,
    candidates,
    applied: true,
    changedKeys: [fallback],
  };
}

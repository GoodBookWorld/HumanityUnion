"use client";

import type { LanguageCode, PetitionState } from "@hu/types";

import {
  useHuPersistedOrdinaryFields,
  type HuPersistedOrdinaryFieldsState,
} from "../language/use-hu-persisted-ordinary-fields";

/** Statuses the API serves Petition translations for (it re-checks the Initiative itself). */
const TRANSLATABLE_PETITION_STATES: ReadonlySet<PetitionState> = new Set([
  "Published",
  "Open",
  "Closed",
  "Archived",
]);

export function isTranslatablePetitionStatus(status: PetitionState): boolean {
  return TRANSLATABLE_PETITION_STATES.has(status);
}

/** Source id to resolve, or "" (no request) while the Petition is not publicly readable. */
export function petitionTranslationSourceId(petitionId: string, status?: PetitionState): string {
  return status === undefined || isTranslatablePetitionStatus(status) ? petitionId : "";
}

export interface PetitionReadingText {
  readonly title: string;
  readonly summary: string;
  /** Set only while translated text is shown; canonical text keeps the page language. */
  readonly lang: LanguageCode | undefined;
}

export function selectPetitionReadingText(
  state: Pick<HuPersistedOrdinaryFieldsState, "owner" | "presentationMode" | "fields" | "activeLanguage">,
  canonical: { readonly title: string; readonly summary: string },
): PetitionReadingText {
  const localized = state.owner === "hu-persisted" && state.presentationMode === "localized";
  const pick = (field: "title" | "summary"): string => {
    const value = state.fields[field];
    return localized && value?.trim() ? value : canonical[field];
  };
  return {
    title: pick("title"),
    summary: pick("summary"),
    lang: localized ? state.activeLanguage : undefined,
  };
}

/**
 * Read-only Petition title/summary in the reader's language through the V5
 * Content Translation hook (cache-only; canonical text when missing, stale or
 * not eligible). Editing, drafts and publication must keep canonical text.
 */
export function usePetitionReadingText(input: {
  readonly petitionId: string;
  readonly title: string;
  readonly summary?: string;
  readonly status?: PetitionState;
}): PetitionReadingText {
  const summary = input.summary ?? "";
  const state = useHuPersistedOrdinaryFields({
    sourceKind: "petition",
    sourceRecordId: petitionTranslationSourceId(input.petitionId, input.status),
    fallbackFields:
      input.summary === undefined ? { title: input.title } : { title: input.title, summary },
    fieldOrder: input.summary === undefined ? ["title"] : ["title", "summary"],
  });
  return selectPetitionReadingText(state, { title: input.title, summary });
}

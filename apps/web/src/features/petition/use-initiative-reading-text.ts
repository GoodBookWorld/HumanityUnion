"use client";

import {
  isInitiativeAdministrativelyBlocked,
  type Initiative,
  type LanguageCode,
  type PetitionState,
} from "@hu/types";

import {
  useHuPersistedOrdinaryFields,
  type HuPersistedOrdinaryFieldsState,
} from "../language/use-hu-persisted-ordinary-fields";
import { isTranslatablePetitionStatus } from "./use-petition-reading-text";

type InitiativeVisibilityFields = Pick<
  Initiative,
  "initiativeId" | "lifecyclePhase" | "visibility" | "administrativelyBlocked"
>;

/**
 * Source id to resolve, or "" (no request) unless both the Petition and its
 * Initiative are publicly readable — the API's public Initiative rule.
 */
export function initiativeTranslationSourceId(
  initiative: InitiativeVisibilityFields | null,
  petitionStatus: PetitionState,
): string {
  if (
    !initiative ||
    !isTranslatablePetitionStatus(petitionStatus) ||
    initiative.lifecyclePhase !== "projected" ||
    initiative.visibility?.policy !== "public" ||
    isInitiativeAdministrativelyBlocked(initiative)
  ) {
    return "";
  }
  return initiative.initiativeId;
}

export interface InitiativeReadingText {
  readonly title: string;
  readonly description: string;
  /** Set only while translated text is shown. */
  readonly lang: LanguageCode | undefined;
}

export function selectInitiativeReadingText(
  state: Pick<HuPersistedOrdinaryFieldsState, "owner" | "presentationMode" | "fields" | "activeLanguage">,
  canonical: { readonly title: string; readonly description: string },
): InitiativeReadingText {
  const localized = state.owner === "hu-persisted" && state.presentationMode === "localized";
  const pick = (field: "title" | "description"): string => {
    const value = state.fields[field];
    return localized && value?.trim() ? value : canonical[field];
  };
  return {
    title: pick("title"),
    description: pick("description"),
    lang: localized ? state.activeLanguage : undefined,
  };
}

/**
 * The Petition's Initiative title/description in the reader's language through
 * the V5 Content Translation hook (cache-only; canonical text when missing,
 * stale, incomplete or not public). null when the Initiative did not load.
 */
export function useInitiativeReadingText(input: {
  readonly initiative: Initiative | null;
  readonly petitionStatus: PetitionState;
}): InitiativeReadingText | null {
  const canonical = {
    title: input.initiative?.title ?? "",
    description: input.initiative?.description ?? "",
  };
  const state = useHuPersistedOrdinaryFields({
    sourceKind: "initiative",
    sourceRecordId: initiativeTranslationSourceId(input.initiative, input.petitionStatus),
    fallbackFields: canonical,
    fieldOrder: ["title", "description"],
  });
  return input.initiative ? selectInitiativeReadingText(state, canonical) : null;
}

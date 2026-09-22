import type { LanguageActivationAdminView } from "@hu/types";

export type LanguageActivationSlotValue =
  | LanguageActivationAdminView
  | "loading"
  | "error";

export type LanguageActivationSlot = LanguageActivationSlotValue | undefined;

/**
 * Apply a provider-free activation-status hydrate result.
 * Never call Activate from page load. Do not clobber an in-flight Activate
 * loading slot for the same language.
 */
export function nextActivationSlotAfterHydrate(input: {
  readonly current: LanguageActivationSlot;
  readonly view: LanguageActivationAdminView;
  readonly activateInFlight: boolean;
}): LanguageActivationSlotValue {
  if (input.activateInFlight && input.current === "loading") {
    return "loading";
  }
  return input.view;
}

export function nextActivationSlotAfterHydrateError(input: {
  readonly current: LanguageActivationSlot;
  readonly activateInFlight: boolean;
}): LanguageActivationSlotValue {
  if (input.activateInFlight && input.current === "loading") {
    return "loading";
  }
  if (typeof input.current === "object" && input.current != null) {
    return input.current;
  }
  return "error";
}

/** Languages whose activation slot should show Checking… during page hydrate. */
export function activationSlotsNeedingHydrateLoading(
  languageIds: readonly string[],
  current: Readonly<Record<string, LanguageActivationSlot>>,
): readonly string[] {
  return languageIds.filter((languageId) => {
    const slot = current[languageId];
    return slot === undefined || slot === "error";
  });
}

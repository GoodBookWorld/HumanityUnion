/**
 * One in-flight Admin activation-status request per language id.
 * Automatic hydration and polling share this guard. A skipped tick does not
 * cancel the request that is already running.
 */

import type {
  LanguageActivationAdminView,
  LanguageLocalizationReadinessReport,
} from "@hu/types";

const inFlight = new Map<string, Promise<unknown>>();

export type GuardedActivationStatus<T> = {
  /** False when this call joined an existing request instead of starting one. */
  readonly started: boolean;
  readonly promise: Promise<T>;
};

export function isActivationStatusInFlight(languageId: string): boolean {
  return inFlight.has(languageId);
}

/**
 * Start `load` unless this language id already has an activation-status
 * request in flight. The in-flight marker clears when that request settles,
 * including failure.
 */
export function runGuardedActivationStatus<T>(
  languageId: string,
  load: () => Promise<T>,
): GuardedActivationStatus<T> {
  const existing = inFlight.get(languageId);
  if (existing) {
    return { started: false, promise: existing as Promise<T> };
  }
  let startedPromise: Promise<T>;
  try {
    startedPromise = load();
  } catch (error) {
    startedPromise = Promise.reject(error);
  }
  const promise = startedPromise.finally(() => {
    if (inFlight.get(languageId) === promise) {
      inFlight.delete(languageId);
    }
  });
  inFlight.set(languageId, promise);
  return { started: true, promise };
}

/** Summary and detail must bind to one activation-status view. */
export function freshActivationReadinessBinding(view: LanguageActivationAdminView): {
  readonly activation: LanguageActivationAdminView;
  readonly readiness: LanguageLocalizationReadinessReport;
} {
  return { activation: view, readiness: view.readiness };
}

export function resetActivationStatusGuardForTests(): void {
  inFlight.clear();
}

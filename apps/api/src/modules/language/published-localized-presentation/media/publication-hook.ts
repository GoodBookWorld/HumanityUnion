/**
 * Reset 03 — future publication hook (INACTIVE).
 *
 * Later: Media canonical publish/update → LocalizationBuildRequested → worker.
 * This pack only defines the seam; it must not enqueue, warm, or call providers.
 */

export type MediaCanonicalLocalizationBuildHookInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly canonicalVersion: string;
  readonly contentRevision: number;
};

export const MEDIA_LOCALIZATION_BUILD_HOOK_STATUS = "INACTIVE" as const;

/**
 * Defined for Reset 04+ worker wiring. No-op by design in Reset 03.
 */
export function notifyMediaCanonicalPublishedForLocalizationBuild(
  _input: MediaCanonicalLocalizationBuildHookInput,
): void {
  // INACTIVE — do not enqueue LocalizationBuildRequested yet.
  void _input;
  void MEDIA_LOCALIZATION_BUILD_HOOK_STATUS;
}

/**
 * Pack 08I.15 — API-side localization ownership mirror (classification only).
 * Gemini never owns Brand/Legal. CIVIC_CONTENT uses content_translations.
 */

import type { LocalizationOwnershipClass } from "@hu/types";
import {
  DEFAULT_LOCALIZABLE_RULE,
  LOCALIZATION_OWNERSHIP_SYNONYMS,
  LOCALIZATION_RESOLUTION_PRIORITY,
} from "@hu/types";

export {
  DEFAULT_LOCALIZABLE_RULE,
  LOCALIZATION_OWNERSHIP_SYNONYMS,
  LOCALIZATION_RESOLUTION_PRIORITY,
};

export const ADMIN_MANAGED_LOCALIZATION_DOMAINS = [
  "BRAND_LOCALIZATION",
  "LEGAL_LOCALIZATION",
] as const satisfies readonly LocalizationOwnershipClass[];

/** Reportable: no Admin CIVIC write path for human|author-approved today. */
export const CIVIC_CONTENT_MANUAL_OVERRIDE_STATUS = {
  modelSupportsHumanAndAuthorApprovedKinds: true,
  displayCanPreferApprovedTranslations: true,
  adminWritePathExists: false,
} as const;

export function assertAdminDomainNotMachineTranslated(
  ownership: LocalizationOwnershipClass,
): void {
  if (
    ownership === "BRAND_LOCALIZATION" ||
    ownership === "LEGAL_LOCALIZATION"
  ) {
    return;
  }
}

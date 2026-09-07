/**
 * RESET 05 — Initiative public card field ownership (PLP adapter policy).
 *
 * activityArea = curated catalog (CONTROLLED_VOCABULARY → UI dictionary).
 * geography* = GEOGRAPHY authority (locale-aware labels from codes), not MACHINE.
 * title/summary = MACHINE_CONTENT (civic prose).
 */

import type { PlpFieldOwnershipClass } from "./plp-field-ownership.js";

export const INITIATIVE_CARD_FIELD_OWNERSHIP = {
  initiativeId: "PROTECTED_CANONICAL",
  title: "MACHINE_CONTENT",
  summary: "MACHINE_CONTENT",
  activityArea: "CONTROLLED_VOCABULARY",
  geographyLabel: "PROTECTED_CANONICAL",
  countryCode: "PROTECTED_CANONICAL",
  regionCode: "PROTECTED_CANONICAL",
  communitySlug: "PROTECTED_CANONICAL",
  publicInitiativeHref: "PROTECTED_CANONICAL",
  publishedAt: "PROTECTED_CANONICAL",
  publicStatus: "UI_DICTIONARY",
  currentStageLabel: "UI_DICTIONARY",
} as const satisfies Record<string, PlpFieldOwnershipClass>;

export const INITIATIVE_CARD_MACHINE_CONTENT_PATHS = ["title", "summary"] as const;

export type InitiativeCardMachineContentPath =
  (typeof INITIATIVE_CARD_MACHINE_CONTENT_PATHS)[number];

/**
 * TEMPORARY migration for one published admin timestamp label.
 *
 * Approved path: rrpApplication.admin.fields.consentAccepted
 * Canonical English: "Accepted on {at}"
 *
 * The ordinary Update selected translations lock stays in place. This module
 * is the only caller allowed to replace that leaf, and only when the published
 * value's sole structural defect is an unexpected `{version}` placeholder while
 * `{at}` remains. The replacement is the packaged catalog value.
 *
 * Removal, after every affected published locale has been repaired and a
 * read-only check returns action "noop" for this path:
 * 1. Delete this module.
 * 2. Delete previewAdminConsentAcceptedStatusMigration and
 *    applyAdminConsentAcceptedStatusMigration from web-ui-message-pack.service.ts.
 * 3. Delete the two admin routes whose paths end in
 *    repair-admin-consent-accepted-status.
 * 4. Delete web-ui-message-pack-consent-status-migration.unit.test.ts.
 * 5. Keep selectedTranslationProtectionError unchanged, and keep Update
 *    selected translations and Add missing translations unchanged.
 * Do not replace this operation with a generic protected-key editor or a
 * permanent repair screen.
 */

import type { LanguageWebUiReadinessSlice, WebUiMessageTree } from "@hu/types";

import { assessWebUiMessageTreeReadiness } from "../language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import { WebUiMessagePackValidationError } from "./web-ui-message-pack.errors.js";
import {
  collectStringPaths,
  describeStructureMismatch,
  loadBundledEnglishWebUiMessagePack,
} from "./web-ui-message-pack.validate.js";

export const ADMIN_CONSENT_ACCEPTED_STATUS_PATH =
  "rrpApplication.admin.fields.consentAccepted" as const;

/** The only leaf this migration may submit to compare-and-set. */
export const CONSENT_ACCEPTED_STATUS_MIGRATION_PATHS = [
  ADMIN_CONSENT_ACCEPTED_STATUS_PATH,
] as const;

const CANONICAL_ENGLISH_CONSENT_ACCEPTED = "Accepted on {at}";
const ONLY_PUBLISHED_DEFECT = "unexpected {version}";

type MessagePack = Record<string, unknown>;

export type ConsentAcceptedStatusMigrationDecision =
  | { readonly action: "repair"; readonly proposedValue: string }
  | { readonly action: "noop" }
  | { readonly action: "reject"; readonly reason: string };

export interface ConsentAcceptedStatusMigrationReadiness {
  readonly public: LanguageWebUiReadinessSlice;
  readonly participant: LanguageWebUiReadinessSlice;
  readonly full: LanguageWebUiReadinessSlice;
}

export function decideConsentAcceptedStatusMigration(input: {
  readonly englishValue: string;
  readonly publishedValue: string;
  readonly packagedValue: string;
}): ConsentAcceptedStatusMigrationDecision {
  if (input.englishValue !== CANONICAL_ENGLISH_CONSENT_ACCEPTED) {
    return {
      action: "reject",
      reason: "Canonical English consent status label is not Accepted on {at}.",
    };
  }

  const packagedMismatch = describeStructureMismatch(input.englishValue, input.packagedValue);
  if (packagedMismatch) {
    return {
      action: "reject",
      reason: `Packaged consent status label failed English structure: ${packagedMismatch}`,
    };
  }
  if (!input.packagedValue.includes("{at}")) {
    return {
      action: "reject",
      reason: "Packaged consent status label must retain {at}.",
    };
  }

  const publishedMismatch = describeStructureMismatch(input.englishValue, input.publishedValue);
  if (publishedMismatch == null) {
    if (!input.publishedValue.includes("{at}")) {
      return {
        action: "reject",
        reason: "Published consent status label must retain {at}.",
      };
    }
    return { action: "noop" };
  }

  if (publishedMismatch !== ONLY_PUBLISHED_DEFECT) {
    return {
      action: "reject",
      reason: `Protected consent status label cannot be changed (${publishedMismatch}).`,
    };
  }
  if (!input.publishedValue.includes("{at}")) {
    return {
      action: "reject",
      reason: "Published consent status label must retain {at}.",
    };
  }
  if (input.packagedValue === input.publishedValue) {
    return {
      action: "reject",
      reason: "Packaged consent status label does not repair the published value.",
    };
  }

  return { action: "repair", proposedValue: input.packagedValue };
}

/**
 * Copy the published tree and replace the one approved leaf.
 * The path is fixed; callers cannot supply a different target.
 */
export function replaceConsentAcceptedStatusLeaf(
  messages: WebUiMessageTree,
  proposedValue: string,
): WebUiMessageTree {
  const next = structuredClone(messages) as MessagePack;
  const segments = ADMIN_CONSENT_ACCEPTED_STATUS_PATH.split(".");
  let current: MessagePack = next;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index] ?? "";
    const child = current[segment];
    if (child == null || typeof child !== "object" || Array.isArray(child)) {
      throw new WebUiMessagePackValidationError(
        "Published consent status path is missing.",
      );
    }
    current = child as MessagePack;
  }
  const leaf = segments[segments.length - 1] ?? "";
  if (typeof current[leaf] !== "string") {
    throw new WebUiMessagePackValidationError("Published consent status path is missing.");
  }
  current[leaf] = proposedValue;
  return next as WebUiMessageTree;
}

/** Readiness uses the same structural validator as publication preparation. */
export function assessConsentAcceptedStatusMigrationReadiness(
  messages: WebUiMessageTree,
): ConsentAcceptedStatusMigrationReadiness {
  const englishPaths = collectStringPaths(loadBundledEnglishWebUiMessagePack());
  const shared = {
    messages,
    flagEnglishIdenticalAsFallback: false as const,
  };
  return {
    public: assessWebUiMessageTreeReadiness({ ...shared, scope: "public" }),
    participant: assessWebUiMessageTreeReadiness({ ...shared, scope: "participant" }),
    full: assessWebUiMessageTreeReadiness({
      ...shared,
      requiredPaths: englishPaths,
    }),
  };
}

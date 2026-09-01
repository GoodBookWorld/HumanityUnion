/**
 * Production Completion Pack 02F — Canonical Terminology Glossary contract.
 *
 * Presentation / search / provider vocabulary only.
 * Does not rename or fork domain entities, lifecycle stages, routes, or events.
 */

import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";

/** Stable code-seeded concept identity (never Admin-invented in Pack 02F). */
export type TerminologyConceptId = string;

export type TerminologyConceptCategory =
  | "domain"
  | "workflow_stage"
  | "brand"
  | "ui"
  | "auth";

export const TERMINOLOGY_CONCEPT_CATEGORIES: readonly TerminologyConceptCategory[] = [
  "domain",
  "workflow_stage",
  "brand",
  "ui",
  "auth",
] as const;

export type TerminologyConceptStatus = "draft" | "published" | "retired";

export const TERMINOLOGY_CONCEPT_STATUSES: readonly TerminologyConceptStatus[] = [
  "draft",
  "published",
  "retired",
] as const;

/**
 * Optional pointers to existing stable identifiers.
 * References only — never redefine stage ordering or entity behavior.
 */
export interface TerminologyConceptLinkedRefs {
  /** Existing `InitiativeLifecycleStageId` when the concept is a lifecycle stage label. */
  readonly stageId?: InitiativeLifecycleStageId;
  /**
   * Existing civic search / entity type token when applicable
   * (e.g. `initiative`, `petition`) — opaque string, not a new enum authority.
   */
  readonly civicEntityType?: string;
}

/** Per-locale preferred presentation + aliases (glossary term aliases, not Registry locale aliases). */
export interface TerminologyLocaleTranslation {
  readonly preferredTerm: string;
  readonly aliases: readonly string[];
  readonly guidance?: string;
}

/**
 * Canonical terminology glossary record.
 * Serialization-safe for Mongo / API (translations keyed by canonical Registry locale).
 */
export interface TerminologyConcept {
  readonly conceptId: TerminologyConceptId;
  readonly canonicalEnglishTerm: string;
  readonly category: TerminologyConceptCategory;
  readonly linkedRefs?: TerminologyConceptLinkedRefs;
  /**
   * Locale → translation. Keys are canonical Language Registry locales
   * (aliases such as zh-TW must be stored as zh-Hant).
   */
  readonly translations: Readonly<Record<string, TerminologyLocaleTranslation>>;
  readonly status: TerminologyConceptStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedByParticipantId?: string | null;
}

/**
 * Mutable presentation fields only.
 * conceptId / canonicalEnglishTerm / category / linkedRefs are code-owned.
 */
export interface TerminologyConceptUpdateInput {
  /**
   * Partial locale map — merged into existing translations by canonical locale.
   * Does not erase locales omitted from the patch.
   */
  readonly translations?: Readonly<Record<string, TerminologyLocaleTranslation>>;
  /**
   * Explicit locale translation removals (canonical Registry locales / aliases).
   * Deletes the entire locale entry. Must not be represented by preferredTerm="".
   * Aliases (e.g. zh-TW) canonicalize via Language Registry before delete.
   */
  readonly removeTranslationLocales?: readonly string[];
  readonly status?: TerminologyConceptStatus;
  readonly updatedByParticipantId?: string | null;
}

export interface TerminologyGlossaryAdminListResponse {
  readonly concepts: readonly TerminologyConcept[];
}

export function isTerminologyConceptCategory(
  value: unknown,
): value is TerminologyConceptCategory {
  return (
    typeof value === "string" &&
    (TERMINOLOGY_CONCEPT_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isTerminologyConceptStatus(value: unknown): value is TerminologyConceptStatus {
  return (
    typeof value === "string" &&
    (TERMINOLOGY_CONCEPT_STATUSES as readonly string[]).includes(value)
  );
}

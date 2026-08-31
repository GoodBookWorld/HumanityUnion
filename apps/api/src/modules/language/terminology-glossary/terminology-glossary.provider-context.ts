/**
 * Pack 02F Task 05 — locale-aware terminologyContext for TranslationProvider.
 *
 * Presentation vocabulary only. Never attaches private content or Initiative history.
 * Failure policy: unknown locale → TerminologyGlossaryValidationError (caller/locale
 * authority). Glossary persistence failures → English seed compatibility fallback.
 */

import type { TerminologyConcept } from "@hu/types";

import { resolveLanguageRegistryLocale } from "../language-registry/language-registry.repository.js";
import { HUMANITY_UNION_TRANSLATION_TERMINOLOGY } from "../hu-terminology-glossary.js";
import {
  TerminologyGlossaryPersistenceError,
  TerminologyGlossaryValidationError,
} from "./terminology-glossary.errors.js";
import { listTerminologyConcepts } from "./terminology-glossary.repository.js";
import { TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS } from "./terminology-glossary.seed.js";

export interface ProviderTerminologyConceptLine {
  readonly conceptId: string;
  readonly canonicalEnglishTerm: string;
  readonly preferredTerm: string;
  readonly usedEnglishFallback: boolean;
  readonly aliases: readonly string[];
  readonly guidance?: string;
}

/**
 * Pure formatter — published concepts only; deterministic seed order.
 */
export function formatProviderTerminologyContext(
  concepts: readonly TerminologyConcept[],
  targetLocale: string,
): string {
  const byId = new Map(concepts.map((concept) => [concept.conceptId, concept]));
  const lines: string[] = [];

  for (const definition of TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS) {
    const concept = byId.get(definition.conceptId);
    if (!concept || concept.status !== "published") {
      continue;
    }

    const translation = concept.translations[targetLocale];
    const preferredRaw = translation?.preferredTerm?.trim();
    const preferredTerm = preferredRaw || concept.canonicalEnglishTerm;
    const usedEnglishFallback = !preferredRaw;
    const aliases = (translation?.aliases ?? [])
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0);
    const guidance = translation?.guidance?.trim() || undefined;

    let line = `${concept.canonicalEnglishTerm} (${concept.conceptId}) => ${preferredTerm}`;
    if (aliases.length > 0) {
      line += ` | aliases: ${aliases.join(", ")}`;
    }
    if (guidance) {
      line += ` | guidance: ${guidance}`;
    }
    if (usedEnglishFallback && targetLocale !== "en") {
      line += " | fallback: en";
    }
    lines.push(line);
  }

  return lines.join("\n");
}

export function listPublishedProviderTerminologyLines(
  concepts: readonly TerminologyConcept[],
  targetLocale: string,
): ProviderTerminologyConceptLine[] {
  const byId = new Map(concepts.map((concept) => [concept.conceptId, concept]));
  const lines: ProviderTerminologyConceptLine[] = [];

  for (const definition of TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS) {
    const concept = byId.get(definition.conceptId);
    if (!concept || concept.status !== "published") {
      continue;
    }
    const translation = concept.translations[targetLocale];
    const preferredRaw = translation?.preferredTerm?.trim();
    lines.push({
      conceptId: concept.conceptId,
      canonicalEnglishTerm: concept.canonicalEnglishTerm,
      preferredTerm: preferredRaw || concept.canonicalEnglishTerm,
      usedEnglishFallback: !preferredRaw,
      aliases: (translation?.aliases ?? [])
        .map((alias) => alias.trim())
        .filter((alias) => alias.length > 0),
      ...(translation?.guidance?.trim()
        ? { guidance: translation.guidance.trim() }
        : {}),
    });
  }

  return lines;
}

/**
 * Resolve Registry locale (incl. aliases) and build published glossary context.
 */
export async function buildProviderTerminologyContext(
  targetLocaleOrAlias: string,
): Promise<string> {
  const trimmed = targetLocaleOrAlias.trim();
  if (!trimmed) {
    throw new TerminologyGlossaryValidationError("Target locale is required.");
  }

  const record = await resolveLanguageRegistryLocale(trimmed);
  if (!record) {
    throw new TerminologyGlossaryValidationError(
      `Unknown glossary target locale: ${trimmed}`,
    );
  }

  const concepts = await listTerminologyConcepts();
  const context = formatProviderTerminologyContext(concepts, record.locale);
  if (!context.trim()) {
    // Published set empty — keep English seed list rather than empty contract.
    return HUMANITY_UNION_TRANSLATION_TERMINOLOGY;
  }
  return context;
}

/**
 * Canonical call-site helper: locale-aware context with English fallback on
 * glossary persistence failure only (not on unknown locale).
 */
export async function resolveProviderTerminologyContext(
  targetLocaleOrAlias: string,
): Promise<string> {
  try {
    return await buildProviderTerminologyContext(targetLocaleOrAlias);
  } catch (error) {
    if (error instanceof TerminologyGlossaryValidationError) {
      throw error;
    }
    if (error instanceof TerminologyGlossaryPersistenceError) {
      return HUMANITY_UNION_TRANSLATION_TERMINOLOGY;
    }
    throw error;
  }
}

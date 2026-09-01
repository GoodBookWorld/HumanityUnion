/**
 * Pack 02F — Admin Terminology Glossary PATCH wire helpers.
 *
 * Remove and Save are separate operations:
 * - Remove sends only `removeTranslationLocales` (never draft translations).
 * - Save sends only `translations` / `status` (never removeTranslationLocales).
 * - preferredTerm="" is not a delete path; Save rejects it client-side.
 */

import type {
  TerminologyConceptStatus,
  TerminologyConceptUpdateInput,
  TerminologyLocaleTranslation,
} from "@hu/types";

export interface GlossaryLocaleDraft {
  preferredTerm: string;
  aliasesText: string;
  guidance: string;
}

export function parseGlossaryAliasesText(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function glossaryLocaleDraftsEqual(
  a: GlossaryLocaleDraft,
  b: GlossaryLocaleDraft,
): boolean {
  return (
    a.preferredTerm.trim() === b.preferredTerm.trim() &&
    a.guidance.trim() === b.guidance.trim() &&
    JSON.stringify(parseGlossaryAliasesText(a.aliasesText)) ===
      JSON.stringify(parseGlossaryAliasesText(b.aliasesText))
  );
}

/**
 * Minimal Remove translation PATCH — must not include `translations`.
 */
export function buildTerminologyRemoveLocalePatch(
  locale: string,
): Pick<TerminologyConceptUpdateInput, "removeTranslationLocales"> {
  return {
    removeTranslationLocales: [locale],
  };
}

export type GlossarySavePatchBuildResult =
  | { readonly ok: true; readonly patch: TerminologyConceptUpdateInput }
  | { readonly ok: false; readonly error: string }
  | { readonly ok: true; readonly patch: null; readonly noop: true };

/**
 * Ordinary Save PATCH. Rejects blank preferredTerm for dirty locales.
 * Never emits removeTranslationLocales.
 */
export function buildTerminologySavePatch(input: {
  readonly languages: readonly { readonly locale: string }[];
  readonly localeDrafts: Readonly<Record<string, GlossaryLocaleDraft>>;
  readonly baselineLocales: Readonly<Record<string, GlossaryLocaleDraft>>;
  readonly statusDraft: TerminologyConceptStatus;
  readonly baselineStatus: TerminologyConceptStatus;
}): GlossarySavePatchBuildResult {
  const translationsPatch: Record<string, TerminologyLocaleTranslation> = {};

  for (const language of input.languages) {
    const draft = input.localeDrafts[language.locale];
    const baseline = input.baselineLocales[language.locale];
    if (!draft || !baseline || glossaryLocaleDraftsEqual(draft, baseline)) {
      continue;
    }
    const preferredTerm = draft.preferredTerm.trim();
    if (!preferredTerm) {
      return {
        ok: false,
        error: `Preferred term for ${language.locale} cannot be cleared. Each stored locale translation requires a preferredTerm; leave or restore a term before saving, or use Remove translation to delete the entire ${language.locale} entry. English remains the runtime fallback when no target translation exists.`,
      };
    }
    translationsPatch[language.locale] = {
      preferredTerm,
      aliases: parseGlossaryAliasesText(draft.aliasesText),
      ...(draft.guidance.trim() ? { guidance: draft.guidance.trim() } : {}),
    };
  }

  const statusChanged = input.statusDraft !== input.baselineStatus;
  if (!statusChanged && Object.keys(translationsPatch).length === 0) {
    return { ok: true, patch: null, noop: true };
  }

  const patch: TerminologyConceptUpdateInput = {
    ...(statusChanged ? { status: input.statusDraft } : {}),
    ...(Object.keys(translationsPatch).length > 0
      ? { translations: translationsPatch }
      : {}),
  };

  return { ok: true, patch };
}

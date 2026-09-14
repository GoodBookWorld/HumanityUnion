/**
 * Pack 02I — localized public metadata title/description (cache/read-only).
 *
 * Accepts optional translated copy already resolved by the caller.
 * Falls back to canonical title/description.
 * NEVER calls Gemini or any translation generation provider.
 * Does not change canonicalPath — callers keep path-based canonicals.
 */

export interface ResolveLocalizedPublicMetadataCopyInput {
  readonly title: string;
  readonly description?: string | null;
  /** Document/reading locale hint for diagnostics only — not used to invent URLs. */
  readonly locale?: string | null;
  readonly translatedTitle?: string | null;
  readonly translatedDescription?: string | null;
}

export interface LocalizedPublicMetadataCopy {
  readonly title: string;
  readonly description: string | null;
  /** True when at least one translated field was applied. */
  readonly usedTranslation: boolean;
  readonly locale: string | null;
}

export function resolveLocalizedPublicMetadataCopy(
  input: ResolveLocalizedPublicMetadataCopyInput,
): LocalizedPublicMetadataCopy {
  const translatedTitle = input.translatedTitle?.trim() || null;
  const translatedDescription = input.translatedDescription?.trim() || null;
  const canonicalTitle = input.title.trim();
  const canonicalDescription =
    typeof input.description === "string" ? input.description.trim() || null : null;

  const title = translatedTitle || canonicalTitle;
  const description = translatedDescription || canonicalDescription;
  const usedTranslation = Boolean(
    (translatedTitle && translatedTitle !== canonicalTitle) ||
      (translatedDescription && translatedDescription !== canonicalDescription),
  );

  return {
    title,
    description,
    usedTranslation,
    locale: input.locale?.trim() || null,
  };
}

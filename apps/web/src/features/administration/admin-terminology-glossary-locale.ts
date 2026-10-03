/**
 * Admin Terminology Glossary — which registry locale the editor shows.
 * Display and selection only. Does not change glossary persistence.
 */

export function formatGlossaryLanguageOptionLabel(language: {
  readonly englishName: string;
  readonly nativeName: string;
  readonly locale: string;
}): string {
  const englishName = language.englishName.trim();
  const nativeName = language.nativeName.trim();
  const locale = language.locale.trim();
  if (englishName && nativeName && englishName !== nativeName) {
    return `${englishName} — ${nativeName} (${locale})`;
  }
  const name = englishName || nativeName;
  return name ? `${name} (${locale})` : locale;
}

/**
 * Keep a prior selection when that locale is still in the registry.
 * Otherwise use the first registry language. Empty registry selects nothing.
 */
export function resolveGlossaryEditorLocale(input: {
  readonly languages: readonly { readonly locale: string }[];
  readonly selectedLocale: string | null;
}): string | null {
  if (input.languages.length === 0) {
    return null;
  }
  if (
    input.selectedLocale &&
    input.languages.some((language) => language.locale === input.selectedLocale)
  ) {
    return input.selectedLocale;
  }
  return input.languages[0]!.locale;
}

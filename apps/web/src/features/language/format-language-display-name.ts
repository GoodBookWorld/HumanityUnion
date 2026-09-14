/**
 * Locale-aware language display name (no catalog dependency).
 */
export function formatLanguageDisplayName(
  interfaceLocale: string,
  languageCode: string,
): string {
  const trimmed = languageCode.trim();
  if (!trimmed) {
    return languageCode;
  }
  try {
    const name = new Intl.DisplayNames([interfaceLocale], { type: "language" }).of(trimmed);
    return name || trimmed;
  } catch {
    return trimmed;
  }
}

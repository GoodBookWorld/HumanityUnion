/**
 * Version 5.0 — one Participant Reading Language preference.
 *
 * Header and Preferences → Preferred Reading Language both write this patch.
 * `readingLanguages[0]` is authoritative. `interfaceLanguage` stays aligned
 * with the existing Preferences contract. Do not persist Header-only state.
 */

export function buildParticipantReadingLanguagePatch(locale: string): {
  readonly readingLanguages: string[];
  readonly interfaceLanguage: string;
} {
  const selected = locale.trim();
  return {
    readingLanguages: [selected],
    interfaceLanguage: selected,
  };
}

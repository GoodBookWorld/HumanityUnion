/**
 * HU-LC-05C.4C.7E.9D — user-authored content stays in its original language.
 * Mirrors the API default (CONTENT_TRANSLATION_FROZEN): frozen unless explicitly "false".
 */
export function isContentTranslationFrozen(): boolean {
  return process.env.NEXT_PUBLIC_CONTENT_TRANSLATION_FROZEN !== "false";
}

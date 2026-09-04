/**
 * Pack 08J — Web-side presentation walker (no Gemini during SSR/render).
 *
 * Applies already-resolved translated field bags onto presentation shapes while
 * preserving NON_TRANSLATABLE identity/technical keys. Does not call providers.
 */

import { isRegisteredNonTranslatableFieldKey } from "./localization-ownership";

export function isNonTranslatableFieldKey(key: string): boolean {
  if (isRegisteredNonTranslatableFieldKey(key)) {
    return true;
  }
  return /Id$|Email$|Phone$|Url$|UUID$|Slug$|Token$|Secret$|Name$/.test(key);
}

export type PresentationProjectionValue =
  | string
  | null
  | undefined
  | PresentationProjectionValue[]
  | { readonly [key: string]: PresentationProjectionValue };

/**
 * Merge CURRENT translated strings onto a presentation projection.
 * Preserves NON_TRANSLATABLE keys and structural shape. No network I/O.
 */
export function applyTranslatedPresentationFields<T extends PresentationProjectionValue>(
  content: T,
  translated: Readonly<Record<string, string>>,
  keyPath = "",
): T {
  if (content === null || content === undefined) {
    return content;
  }
  if (typeof content === "string") {
    if (keyPath && Object.prototype.hasOwnProperty.call(translated, keyPath)) {
      return translated[keyPath] as T;
    }
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((entry, index) =>
      applyTranslatedPresentationFields(
        entry,
        translated,
        keyPath ? `${keyPath}[${index}]` : `[${index}]`,
      ),
    ) as T;
  }
  if (typeof content === "object") {
    const next: Record<string, PresentationProjectionValue> = {};
    for (const [key, value] of Object.entries(content)) {
      const childPath = keyPath ? `${keyPath}.${key}` : key;
      if (isNonTranslatableFieldKey(key)) {
        next[key] = value as PresentationProjectionValue;
        continue;
      }
      next[key] = applyTranslatedPresentationFields(
        value as PresentationProjectionValue,
        translated,
        childPath,
      );
    }
    return next as T;
  }
  return content;
}

/**
 * Pack 08J — generic recursive translation contract for participant-facing
 * presentation projections.
 *
 * Translates AUTO_TRANSLATABLE semantic strings while preserving structure,
 * NON_TRANSLATABLE keys, and identity/technical values.
 * Never mutates canonical domain aggregates — operate on sanitized bags only.
 */

import {
  isNonTranslatableFieldKey,
  looksLikeNonTranslatableValue,
} from "./non-translatable-policy.js";

export type PresentationProjectionValue =
  | string
  | null
  | undefined
  | PresentationProjectionValue[]
  | { readonly [key: string]: PresentationProjectionValue };

export type TranslatePresentationString = (input: {
  readonly keyPath: string;
  readonly value: string;
}) => string | Promise<string>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Walk a sanitized presentation projection and apply `translateString` to
 * AUTO_TRANSLATABLE leaf strings. Preserves keys and structural shape.
 */
export async function walkTranslatablePresentation<T extends PresentationProjectionValue>(
  content: T,
  translateString: TranslatePresentationString,
  keyPath = "",
): Promise<T> {
  if (content === null || content === undefined) {
    return content;
  }

  if (typeof content === "string") {
    const leafKey = keyPath.includes(".") ? keyPath.slice(keyPath.lastIndexOf(".") + 1) : keyPath;
    if (leafKey && isNonTranslatableFieldKey(leafKey)) {
      return content;
    }
    if (looksLikeNonTranslatableValue(content)) {
      return content;
    }
    if (!content.trim()) {
      return content;
    }
    const translated = await translateString({ keyPath, value: content });
    return translated as T;
  }

  if (Array.isArray(content)) {
    const next: PresentationProjectionValue[] = [];
    for (let index = 0; index < content.length; index += 1) {
      next.push(
        await walkTranslatablePresentation(
          content[index] as PresentationProjectionValue,
          translateString,
          keyPath ? `${keyPath}[${index}]` : `[${index}]`,
        ),
      );
    }
    return next as T;
  }

  if (isPlainObject(content)) {
    const next: Record<string, PresentationProjectionValue> = {};
    for (const [key, value] of Object.entries(content)) {
      const childPath = keyPath ? `${keyPath}.${key}` : key;
      if (isNonTranslatableFieldKey(key)) {
        next[key] = value as PresentationProjectionValue;
        continue;
      }
      next[key] = await walkTranslatablePresentation(
        value as PresentationProjectionValue,
        translateString,
        childPath,
      );
    }
    return next as T;
  }

  // Reject ambiguous structural types rather than corrupt data.
  throw new Error(
    `translatePresentation rejected unsupported structural value at "${keyPath || "<root>"}".`,
  );
}

/**
 * Flatten a presentation projection to a Record<string, string> of
 * AUTO_TRANSLATABLE leaves (dot paths for nested keys). Used for provider
 * structured_json payloads.
 */
export function flattenTranslatablePresentationFields(
  content: PresentationProjectionValue,
  keyPath = "",
  out: Record<string, string> = {},
): Record<string, string> {
  if (content === null || content === undefined) {
    return out;
  }
  if (typeof content === "string") {
    const leafKey = keyPath.includes(".") ? keyPath.slice(keyPath.lastIndexOf(".") + 1) : keyPath;
    if (!keyPath || isNonTranslatableFieldKey(leafKey) || looksLikeNonTranslatableValue(content)) {
      return out;
    }
    if (content.trim()) {
      out[keyPath] = content;
    }
    return out;
  }
  if (Array.isArray(content)) {
    content.forEach((entry, index) => {
      flattenTranslatablePresentationFields(
        entry,
        keyPath ? `${keyPath}[${index}]` : `[${index}]`,
        out,
      );
    });
    return out;
  }
  if (isPlainObject(content)) {
    for (const [key, value] of Object.entries(content)) {
      if (isNonTranslatableFieldKey(key)) {
        continue;
      }
      flattenTranslatablePresentationFields(
        value as PresentationProjectionValue,
        keyPath ? `${keyPath}.${key}` : key,
        out,
      );
    }
  }
  return out;
}

/**
 * Apply a flat translated map back onto a presentation projection shape.
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
  if (isPlainObject(content)) {
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

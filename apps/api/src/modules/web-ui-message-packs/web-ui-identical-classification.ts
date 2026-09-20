/**
 * Generic English-identical WEB_UI classification.
 * No locale-specific path lists or language word lists.
 */

export type WebUiIdenticalKind = "accepted-technical" | "suspicious-human";

export type WebUiIdenticalClassification = {
  readonly path: string;
  readonly english: string;
  readonly localized: string;
  readonly kind: WebUiIdenticalKind;
  readonly reason: string;
};

const CURRENCY_RE = /^\d+(?:[.,]\d+)?\s*[A-Z]{3}$|^[€$£¥]\s*\d+(?:[.,]\d+)?$/;
const URL_RE = /^(https?:\/\/\S+|www\.\S+)$/i;
const KEBAB_CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const ACRONYM_RE = /^[A-Z0-9]{2,6}$/;
const PURE_NUMBER_RE = /^\d+$/;
const PLACEHOLDER_ONLY_RE = /^(?:[\s←→.|·•,\-_/]|\{[A-Za-z][A-Za-z0-9_]*\})+$/;

/**
 * Prefer live preferred terms when classifying canonical leftovers as suspicious.
 * Keys are exact English surfaces (case-sensitive); values are target preferred terms.
 */
export function classifyEnglishIdenticalWebUiValue(input: {
  readonly path: string;
  readonly english: string;
  readonly localized: string;
  readonly preferredEnglishSurfaces?: ReadonlyMap<string, string>;
}): WebUiIdenticalClassification | null {
  if (input.english !== input.localized) {
    return null;
  }
  const value = input.english;
  const technical = classifyAcceptedTechnical(value);
  if (technical) {
    return {
      path: input.path,
      english: value,
      localized: value,
      kind: "accepted-technical",
      reason: technical,
    };
  }
  const preferred = input.preferredEnglishSurfaces?.get(value.trim());
  if (preferred && preferred !== value.trim()) {
    return {
      path: input.path,
      english: value,
      localized: value,
      kind: "suspicious-human",
      reason: "canonical-term-remained-english-despite-preferred-term",
    };
  }
  return {
    path: input.path,
    english: value,
    localized: value,
    kind: "suspicious-human",
    reason: "human-facing-english-identical",
  };
}

export function classifyEnglishIdenticalWebUiTree(input: {
  readonly englishFlat: Readonly<Record<string, string>>;
  readonly localizedFlat: Readonly<Record<string, string>>;
  readonly preferredEnglishSurfaces?: ReadonlyMap<string, string>;
}): {
  readonly acceptedTechnical: readonly WebUiIdenticalClassification[];
  readonly suspiciousHuman: readonly WebUiIdenticalClassification[];
} {
  const acceptedTechnical: WebUiIdenticalClassification[] = [];
  const suspiciousHuman: WebUiIdenticalClassification[] = [];
  for (const pathKey of Object.keys(input.englishFlat).sort()) {
    const english = input.englishFlat[pathKey] ?? "";
    const localized = input.localizedFlat[pathKey] ?? "";
    const row = classifyEnglishIdenticalWebUiValue({
      path: pathKey,
      english,
      localized,
      preferredEnglishSurfaces: input.preferredEnglishSurfaces,
    });
    if (!row) {
      continue;
    }
    if (row.kind === "accepted-technical") {
      acceptedTechnical.push(row);
    } else {
      suspiciousHuman.push(row);
    }
  }
  return { acceptedTechnical, suspiciousHuman };
}

function classifyAcceptedTechnical(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "empty";
  }
  if (PURE_NUMBER_RE.test(trimmed)) {
    return "numeric-literal";
  }
  if (CURRENCY_RE.test(trimmed)) {
    return "currency-literal";
  }
  if (URL_RE.test(trimmed)) {
    return "url";
  }
  if (KEBAB_CODE_RE.test(trimmed)) {
    return "machine-code";
  }
  if (ACRONYM_RE.test(trimmed)) {
    return "acronym-or-identifier";
  }
  if (PLACEHOLDER_ONLY_RE.test(trimmed)) {
    return "placeholder-or-structural";
  }
  return null;
}

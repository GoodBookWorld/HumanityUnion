/**
 * Production Completion Pack 02C — deterministic Accept-Language parser.
 *
 * Shared by API request context and Web SSR. No third-party dependency.
 * Wildcard `*` never invents a locale or bypasses Registry policy.
 */

export interface AcceptLanguagePreference {
  /** Raw tag as presented (trimmed), or `*`. */
  readonly tag: string;
  /** Quality value in [0, 1]. Default 1 when omitted. */
  readonly q: number;
  /** Stable tie-break: earlier header tokens win when q is equal. */
  readonly order: number;
}

/**
 * Parse an Accept-Language header into ordered preferences (highest q first).
 * Malformed tokens are ignored. Empty / missing header → [].
 */
export function parseAcceptLanguageHeader(
  header: string | null | undefined,
): readonly AcceptLanguagePreference[] {
  if (typeof header !== "string") {
    return [];
  }

  const trimmed = header.trim();
  if (!trimmed) {
    return [];
  }

  const preferences: AcceptLanguagePreference[] = [];
  const parts = trimmed.split(",");

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!.trim();
    if (!part) {
      continue;
    }

    const segments = part.split(";").map((s) => s.trim());
    const tag = segments[0];
    if (!tag || !isAcceptableLanguageTag(tag)) {
      continue;
    }

    let q = 1;
    let qValid = true;
    for (let j = 1; j < segments.length; j += 1) {
      const param = segments[j]!;
      if (!param.toLowerCase().startsWith("q=")) {
        continue;
      }
      const rawQ = param.slice(2).trim();
      if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(rawQ)) {
        qValid = false;
        break;
      }
      const parsed = Number.parseFloat(rawQ);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        qValid = false;
        break;
      }
      q = parsed;
    }

    if (!qValid || q <= 0) {
      continue;
    }

    preferences.push({ tag, q, order: i });
  }

  return preferences.slice().sort((a, b) => {
    if (b.q !== a.q) {
      return b.q - a.q;
    }
    return a.order - b.order;
  });
}

/**
 * Ordered non-wildcard tags for Registry lookup (highest preference first).
 * `*` is intentionally excluded — it must not select an arbitrary enabled locale.
 */
export function listAcceptLanguageLookupTags(
  header: string | null | undefined,
): readonly string[] {
  return parseAcceptLanguageHeader(header)
    .filter((pref) => pref.tag !== "*")
    .map((pref) => pref.tag);
}

/**
 * BCP-47–ish lookup chain for one candidate tag.
 * Truncates subtags from the right: `zh-Hant-TW` → `zh-Hant` → `zh`.
 * Does not collapse a successful `zh-Hant` match into `zh` — callers stop at first enabled hit.
 * `*` yields no candidates.
 */
export function expandLocaleLookupCandidates(input: string): readonly string[] {
  const trimmed = input.trim();
  if (!trimmed || trimmed === "*") {
    return [];
  }

  if (/\s/.test(trimmed) || trimmed.includes("--") || trimmed.startsWith("-") || trimmed.endsWith("-")) {
    return [];
  }

  const parts = trimmed.split("-").filter((p) => p.length > 0);
  if (parts.length === 0) {
    return [];
  }

  const candidates: string[] = [];
  const seen = new Set<string>();
  for (let i = parts.length; i >= 1; i -= 1) {
    const candidate = parts.slice(0, i).join("-");
    const key = candidate.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push(candidate);
  }
  return candidates;
}

function isAcceptableLanguageTag(tag: string): boolean {
  if (tag === "*") {
    return true;
  }
  return /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/.test(tag);
}

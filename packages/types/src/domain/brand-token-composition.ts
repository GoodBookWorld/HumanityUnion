/**
 * RESET 05C / 05D.4 / 05D.6 — reusable Brand Localization token composition.
 *
 * Canonical participant-facing templates may embed `{siteName}` (same ICU shape
 * as Support / Membership catalogs). Brand Localization resolves the display
 * string at compose/render time.
 *
 * RESET 05D.6 — MACHINE provider receives only prose segments. Brand slots are
 * extracted before the provider hop and reassembled with canonical `{siteName}`
 * after. Gemini never receives Brand tokens or transport sentinels.
 *
 * Legacy protect/restore sentinels remain for reading old data / defensive
 * rejection of injected placeholders — not the normal build path.
 */

/** ICU-style placeholder for organization identity owned by Brand Localization. */
export const BRAND_SITE_NAME_TOKEN = "{siteName}" as const;

/**
 * ASCII transport sentinel (05D.4). Legacy only — normal 05D.6 build path does
 * not send this to the provider.
 * @deprecated Prefer Brand-slot extraction (`extractBrandSlotsForProvider`).
 */
export const BRAND_SITE_NAME_MACHINE_SENTINEL = "__HU_BRAND_SITE_NAME__" as const;

/**
 * Legacy Unicode sentinel (05C–05D.3).
 * @deprecated Prefer Brand-slot extraction.
 */
export const BRAND_SITE_NAME_MACHINE_SENTINEL_LEGACY =
  "⟦HU_BRAND_SITE_NAME⟧" as const;

export type BrandTokenValues = {
  readonly siteName: string;
};

export type BrandTokenPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "brand"; readonly token: typeof BRAND_SITE_NAME_TOKEN };

export type BrandTokenTransportState =
  | "PRESERVED"
  | "MISSING"
  | "ALTERED"
  | "MOVED_OR_UNMAPPABLE";

export type BrandTokenPathTransportReport = {
  readonly SEMANTIC_PATH: string;
  readonly EXPECTED_BRAND_TOKEN_COUNT: number;
  readonly RETURNED_BRAND_TOKEN_COUNT: number;
  readonly TOKEN_STATE: BrandTokenTransportState;
};

/** RESET 05D.6 — structural Brand slot plan for one semantic path. */
export type BrandSlotPlanPart =
  | {
      readonly kind: "machine";
      readonly segmentIndex: number;
      readonly sourceText: string;
    }
  | {
      readonly kind: "brand";
      readonly token: typeof BRAND_SITE_NAME_TOKEN;
    };

export type BrandSlotExtraction = {
  readonly path: string;
  readonly parts: readonly BrandSlotPlanPart[];
  readonly hasBrandSlots: boolean;
  /** Provider payload keys for this path (original path or path#mN). */
  readonly providerKeys: readonly string[];
};

const SITE_NAME_TOKEN_RE = /\{siteName\}/g;

/** Provider payload key for a MACHINE_TEXT segment of a Brand-bearing path. */
export function machineSegmentProviderKey(
  path: string,
  segmentIndex: number,
): string {
  return `${path}#m${segmentIndex}`;
}

export function isMachineSegmentProviderKey(key: string): boolean {
  return /#m\d+$/.test(key);
}

/**
 * Compose a template by substituting Brand values for structural tokens.
 * Leaves unknown braces untouched. Empty siteName leaves `{siteName}` intact
 * so callers can detect unresolved Brand (never silently blank identity).
 */
export function composeBrandTokens(
  template: string,
  values: BrandTokenValues,
): string {
  const siteName = values.siteName.trim();
  if (!siteName) {
    return template;
  }
  return template.replaceAll(BRAND_SITE_NAME_TOKEN, siteName);
}

/**
 * Split a template into text / brand parts for semantic rendering
 * (PLP_ENTITY prose + BRAND-owned organization spans).
 */
export function splitBrandTokenParts(template: string): readonly BrandTokenPart[] {
  const parts: BrandTokenPart[] = [];
  let lastIndex = 0;
  const re = new RegExp(SITE_NAME_TOKEN_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", text: template.slice(lastIndex, match.index) });
    }
    parts.push({ kind: "brand", token: BRAND_SITE_NAME_TOKEN });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < template.length) {
    parts.push({ kind: "text", text: template.slice(lastIndex) });
  }
  if (parts.length === 0) {
    return [{ kind: "text", text: template }];
  }
  return parts;
}

export function templateHasBrandSiteNameToken(template: string): boolean {
  return template.includes(BRAND_SITE_NAME_TOKEN);
}

export function countBrandSiteNameTokens(text: string): number {
  const matches = text.match(SITE_NAME_TOKEN_RE);
  return matches?.length ?? 0;
}

/**
 * RESET 05D.6 — extract Brand slots so the provider never receives `{siteName}`.
 */
export function extractBrandSlotsForProvider(
  path: string,
  canonical: string,
): BrandSlotExtraction {
  const split = splitBrandTokenParts(canonical);
  const hasBrandSlots = split.some((p) => p.kind === "brand");
  if (!hasBrandSlots) {
    return {
      path,
      parts: [{ kind: "machine", segmentIndex: 0, sourceText: canonical }],
      hasBrandSlots: false,
      providerKeys: [path],
    };
  }

  const parts: BrandSlotPlanPart[] = [];
  let segmentIndex = 0;
  for (const part of split) {
    if (part.kind === "brand") {
      parts.push({ kind: "brand", token: BRAND_SITE_NAME_TOKEN });
      continue;
    }
    parts.push({
      kind: "machine",
      segmentIndex,
      sourceText: part.text,
    });
    segmentIndex += 1;
  }

  const providerKeys = parts
    .filter(
      (p): p is Extract<BrandSlotPlanPart, { kind: "machine" }> =>
        p.kind === "machine" && p.sourceText.length > 0,
    )
    .map((p) => machineSegmentProviderKey(path, p.segmentIndex));

  return { path, parts, hasBrandSlots: true, providerKeys };
}

/**
 * Build provider-owned payload: MACHINE_TEXT only. Brand slots stay local.
 */
export function buildProviderOwnedMachinePayload(
  autoValues: Readonly<Record<string, string>>,
): {
  readonly payload: Readonly<Record<string, string>>;
  readonly plans: readonly BrandSlotExtraction[];
} {
  const payload: Record<string, string> = {};
  const plans: BrandSlotExtraction[] = [];
  for (const path of Object.keys(autoValues).sort()) {
    const value = autoValues[path]!;
    const plan = extractBrandSlotsForProvider(path, value);
    plans.push(plan);
    if (!plan.hasBrandSlots) {
      payload[path] = value;
      continue;
    }
    for (const part of plan.parts) {
      if (part.kind === "machine" && part.sourceText.length > 0) {
        payload[machineSegmentProviderKey(path, part.segmentIndex)] =
          part.sourceText;
      }
    }
  }
  return { payload, plans };
}

/**
 * Reassemble semantic-path templates from translated MACHINE segments + Brand slots.
 */
export function reassembleBrandSlotPlans(input: {
  readonly plans: readonly BrandSlotExtraction[];
  readonly translatedSegments: Readonly<Record<string, string>>;
}): {
  readonly values: Readonly<Record<string, string>>;
  readonly missingSegmentKeys: readonly string[];
} {
  const values: Record<string, string> = {};
  const missingSegmentKeys: string[] = [];

  for (const plan of input.plans) {
    if (!plan.hasBrandSlots) {
      const direct = input.translatedSegments[plan.path];
      if (typeof direct === "string") {
        values[plan.path] = direct;
      } else {
        missingSegmentKeys.push(plan.path);
      }
      continue;
    }

    let out = "";
    let complete = true;
    for (const part of plan.parts) {
      if (part.kind === "brand") {
        out += BRAND_SITE_NAME_TOKEN;
        continue;
      }
      if (part.sourceText.length === 0) {
        continue;
      }
      const key = machineSegmentProviderKey(plan.path, part.segmentIndex);
      const translated = input.translatedSegments[key];
      if (typeof translated !== "string") {
        missingSegmentKeys.push(key);
        complete = false;
        break;
      }
      out += translated;
    }
    if (complete) {
      values[plan.path] = out;
    }
  }

  return { values, missingSegmentKeys };
}

/** True if text contains canonical Brand token or any legacy transport sentinel. */
export function textContainsBrandTransportArtifact(text: string): boolean {
  return (
    text.includes(BRAND_SITE_NAME_TOKEN) ||
    text.includes(BRAND_SITE_NAME_MACHINE_SENTINEL) ||
    text.includes(BRAND_SITE_NAME_MACHINE_SENTINEL_LEGACY) ||
    /HU_BRAND_SITE_NAME/i.test(text)
  );
}

/** Assert provider payload has zero Brand tokens/sentinels (05D.6 invariant). */
export function assertProviderPayloadHasNoBrandArtifacts(
  payload: Readonly<Record<string, string>>,
): readonly string[] {
  const violators: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (textContainsBrandTransportArtifact(value)) {
      violators.push(key);
    }
  }
  return violators;
}

/**
 * Machine-prose-only view of a Brand-bearing template (Brand slots removed).
 * Used for MACHINE completeness / identical-prose checks.
 */
export function stripBrandSlotsForMachineCompare(template: string): string {
  return template
    .replaceAll(BRAND_SITE_NAME_TOKEN, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** @deprecated Prefer Brand-slot extraction — kept for legacy readers/tests. */
export function protectBrandTokensForMachineTranslation(text: string): string {
  return text.replaceAll(BRAND_SITE_NAME_TOKEN, BRAND_SITE_NAME_MACHINE_SENTINEL);
}

/**
 * Restore Brand tokens after machine translation (legacy hop).
 * @deprecated Prefer Brand-slot reassembly for the normal build path.
 */
export function restoreBrandTokensAfterMachineTranslation(text: string): string {
  return text
    .replaceAll(BRAND_SITE_NAME_MACHINE_SENTINEL, BRAND_SITE_NAME_TOKEN)
    .replaceAll(BRAND_SITE_NAME_MACHINE_SENTINEL_LEGACY, BRAND_SITE_NAME_TOKEN)
    .replace(/__\s*HU_BRAND_SITE_NAME\s*__/gi, BRAND_SITE_NAME_TOKEN)
    .replace(/⟦\s*HU_BRAND_SITE_NAME\s*⟧/g, BRAND_SITE_NAME_TOKEN);
}

/**
 * Classify Brand token survival for one semantic path (no prose logged).
 * Call after restore/reassembly.
 */
export function classifyBrandTokenPathTransport(input: {
  readonly path: string;
  readonly canonicalSource: string;
  readonly restoredTranslated: string;
}): BrandTokenPathTransportReport | null {
  const expected = countBrandSiteNameTokens(input.canonicalSource);
  if (expected === 0) {
    return null;
  }
  const returned = countBrandSiteNameTokens(input.restoredTranslated);
  let state: BrandTokenTransportState;
  if (returned === expected) {
    state = "PRESERVED";
  } else if (returned === 0) {
    state = "MISSING";
  } else if (returned !== expected) {
    state = "ALTERED";
  } else {
    state = "MOVED_OR_UNMAPPABLE";
  }
  if (
    returned === 0 &&
    (/HU_BRAND_SITE_NAME/i.test(input.restoredTranslated) ||
      input.restoredTranslated.includes("⟦") ||
      input.restoredTranslated.includes("__HU_"))
  ) {
    state = "MOVED_OR_UNMAPPABLE";
  }
  return {
    SEMANTIC_PATH: input.path,
    EXPECTED_BRAND_TOKEN_COUNT: expected,
    RETURNED_BRAND_TOKEN_COUNT: returned,
    TOKEN_STATE: state,
  };
}

/**
 * Apply protect → transform → restore around a translation function.
 * @deprecated Prefer Brand-slot extraction for provider hops.
 */
export function withPreservedBrandTokens(
  text: string,
  transform: (protectedText: string) => string,
): string {
  return restoreBrandTokensAfterMachineTranslation(
    transform(protectBrandTokensForMachineTranslation(text)),
  );
}

/**
 * Classify FAQ machine prose independently of Brand token substitution.
 * Brand-only localization of `{siteName}` must NOT count as localized FAQ.
 */
export function classifyFaqMachineProseLocalization(input: {
  readonly template: string;
  readonly canonicalTemplate: string;
  readonly editorialMode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | string;
}): {
  readonly hasBrandToken: boolean;
  readonly proseEqualsCanonical: boolean;
  readonly machineLocalized: boolean;
  readonly brandOnlyIllusion: boolean;
} {
  const hasBrandToken = templateHasBrandSiteNameToken(input.template);
  const stripTokens = (value: string) =>
    value.replaceAll(BRAND_SITE_NAME_TOKEN, "").replace(/\s+/g, " ").trim();
  const proseEqualsCanonical =
    stripTokens(input.template) === stripTokens(input.canonicalTemplate);
  const machineLocalized =
    input.editorialMode === "PUBLISHED_LOCALIZED" && !proseEqualsCanonical;
  const brandOnlyIllusion =
    hasBrandToken &&
    proseEqualsCanonical &&
    input.editorialMode !== "PUBLISHED_LOCALIZED";
  return {
    hasBrandToken,
    proseEqualsCanonical,
    machineLocalized,
    brandOnlyIllusion,
  };
}

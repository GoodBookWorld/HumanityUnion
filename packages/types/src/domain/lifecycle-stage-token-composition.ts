/**
 * Localization Closure 03C.5 — semantic lifecycle-stage slots for machine-
 * localized Collaborative Analysis civic content.
 *
 * Durable token form: `{lifecycleStage:<stageId>}` (e.g. `{lifecycleStage:discussion}`).
 * Mirrors Brand slot extraction: provider receives MACHINE prose only; slots are
 * reassembled after translation with controlled vocabulary labels.
 *
 * Authority:
 * - CT build-time labels → Terminology Glossary `workflow_stage.preferredTerm`
 * - Canonical English participant fallback → lifecycle registry `label`
 * - WEB_UI `initiativeExperience.stages.*` remains chrome-only (not used here)
 */

import {
  getInitiativeLifecycleStageDefinition,
  isInitiativeLifecycleStageId,
  type InitiativeLifecycleStageId,
} from "./initiative-lifecycle-stage.js";
import { machineSegmentProviderKey } from "./brand-token-composition.js";

/** ICU-style placeholder prefix for lifecycle stage identity. */
export const LIFECYCLE_STAGE_TOKEN_PREFIX = "{lifecycleStage:" as const;
export const LIFECYCLE_STAGE_TOKEN_SUFFIX = "}" as const;

const LIFECYCLE_STAGE_TOKEN_RE = /\{lifecycleStage:([a-z][a-z0-9_]*)\}/g;

export type LifecycleStageTokenPart =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "lifecycleStage";
      readonly stageId: InitiativeLifecycleStageId;
      readonly token: string;
    };

export type LifecycleStageSlotPlanPart =
  | {
      readonly kind: "machine";
      readonly segmentIndex: number;
      readonly sourceText: string;
    }
  | {
      readonly kind: "lifecycleStage";
      readonly stageId: InitiativeLifecycleStageId;
      readonly token: string;
    };

export type LifecycleStageSlotExtraction = {
  readonly path: string;
  readonly parts: readonly LifecycleStageSlotPlanPart[];
  readonly hasLifecycleStageSlots: boolean;
  readonly providerKeys: readonly string[];
  /** Stage ids referenced by this path (may repeat). */
  readonly stageIds: readonly InitiativeLifecycleStageId[];
};

export type LifecycleStageComposeResult =
  | { readonly ok: true; readonly text: string }
  | {
      readonly ok: false;
      readonly reason: "malformed_or_unknown_stage" | "unresolved_label";
      readonly stageId?: string;
    };

/** Build a durable semantic token for a known lifecycle stage id. */
export function lifecycleStageToken(stageId: InitiativeLifecycleStageId): string {
  return `${LIFECYCLE_STAGE_TOKEN_PREFIX}${stageId}${LIFECYCLE_STAGE_TOKEN_SUFFIX}`;
}

export function isLifecycleStageTokenShape(value: string): boolean {
  const match = /^\{lifecycleStage:([a-z][a-z0-9_]*)\}$/.exec(value);
  return match !== null && isInitiativeLifecycleStageId(match[1]);
}

export function parseLifecycleStageToken(
  value: string,
): InitiativeLifecycleStageId | null {
  const match = /^\{lifecycleStage:([a-z][a-z0-9_]*)\}$/.exec(value.trim());
  if (!match || !isInitiativeLifecycleStageId(match[1])) {
    return null;
  }
  return match[1];
}

export function templateHasLifecycleStageToken(template: string): boolean {
  return /\{lifecycleStage:[a-z][a-z0-9_]*\}/.test(template);
}

export function textContainsLifecycleStageToken(text: string): boolean {
  return /\{lifecycleStage:[a-z][a-z0-9_]*\}/.test(text);
}

export function countLifecycleStageTokens(text: string): number {
  const matches = text.match(/\{lifecycleStage:[a-z][a-z0-9_]*\}/g);
  return matches?.length ?? 0;
}

/**
 * Split a template into text / lifecycle-stage parts.
 * Fail-closed: any `{lifecycleStage:...}` with an unknown/malformed id throws.
 */
export function splitLifecycleStageTokenParts(
  template: string,
): readonly LifecycleStageTokenPart[] {
  const parts: LifecycleStageTokenPart[] = [];
  let lastIndex = 0;
  const re = new RegExp(LIFECYCLE_STAGE_TOKEN_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    const stageIdRaw = match[1]!;
    if (!isInitiativeLifecycleStageId(stageIdRaw)) {
      throw new Error(`Unknown lifecycle stage token id: ${stageIdRaw}`);
    }
    if (match.index > lastIndex) {
      parts.push({ kind: "text", text: template.slice(lastIndex, match.index) });
    }
    const stageId = stageIdRaw;
    parts.push({
      kind: "lifecycleStage",
      stageId,
      token: match[0],
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < template.length) {
    parts.push({ kind: "text", text: template.slice(lastIndex) });
  }
  if (parts.length === 0) {
    return [{ kind: "text", text: template }];
  }
  // Detect brace shapes that look like lifecycle tokens but failed the regex
  // (e.g. empty id, uppercase) — treat as malformed.
  if (/\{lifecycleStage:[^}]*\}/.test(template)) {
    const known = new Set(
      [...template.matchAll(/\{lifecycleStage:([a-z][a-z0-9_]*)\}/g)].map((m) => m[0]),
    );
    for (const raw of template.matchAll(/\{lifecycleStage:[^}]*\}/g)) {
      if (!known.has(raw[0])) {
        throw new Error(`Malformed lifecycle stage token: ${raw[0]}`);
      }
    }
  }
  return parts;
}

/**
 * Try to split without throwing — returns null on malformed/unknown tokens.
 */
export function trySplitLifecycleStageTokenParts(
  template: string,
): readonly LifecycleStageTokenPart[] | null {
  try {
    return splitLifecycleStageTokenParts(template);
  } catch {
    return null;
  }
}

export function extractLifecycleStageSlotsForProvider(
  path: string,
  canonical: string,
): LifecycleStageSlotExtraction {
  const split = splitLifecycleStageTokenParts(canonical);
  const hasLifecycleStageSlots = split.some((p) => p.kind === "lifecycleStage");
  if (!hasLifecycleStageSlots) {
    return {
      path,
      parts: [{ kind: "machine", segmentIndex: 0, sourceText: canonical }],
      hasLifecycleStageSlots: false,
      providerKeys: [path],
      stageIds: [],
    };
  }

  const parts: LifecycleStageSlotPlanPart[] = [];
  const stageIds: InitiativeLifecycleStageId[] = [];
  let segmentIndex = 0;
  for (const part of split) {
    if (part.kind === "lifecycleStage") {
      parts.push({
        kind: "lifecycleStage",
        stageId: part.stageId,
        token: part.token,
      });
      stageIds.push(part.stageId);
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
      (p): p is Extract<LifecycleStageSlotPlanPart, { kind: "machine" }> =>
        p.kind === "machine" && p.sourceText.length > 0,
    )
    .map((p) => machineSegmentProviderKey(path, p.segmentIndex));

  return { path, parts, hasLifecycleStageSlots: true, providerKeys, stageIds };
}

/**
 * Build provider-owned payload: MACHINE_TEXT only. Lifecycle slots stay local.
 */
export function buildProviderOwnedLifecycleMachinePayload(
  autoValues: Readonly<Record<string, string>>,
): {
  readonly payload: Readonly<Record<string, string>>;
  readonly plans: readonly LifecycleStageSlotExtraction[];
} {
  const payload: Record<string, string> = {};
  const plans: LifecycleStageSlotExtraction[] = [];
  for (const path of Object.keys(autoValues).sort()) {
    const value = autoValues[path]!;
    const plan = extractLifecycleStageSlotsForProvider(path, value);
    plans.push(plan);
    if (!plan.hasLifecycleStageSlots) {
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
 * Reassemble semantic-path templates from translated MACHINE segments +
 * resolved lifecycle stage labels (preferredTerm / registry English).
 */
export function reassembleLifecycleStageSlotPlans(input: {
  readonly plans: readonly LifecycleStageSlotExtraction[];
  readonly translatedSegments: Readonly<Record<string, string>>;
  readonly resolveStageLabel: (
    stageId: InitiativeLifecycleStageId,
  ) => string | null;
}): {
  readonly values: Readonly<Record<string, string>>;
  readonly missingSegmentKeys: readonly string[];
  readonly unresolvedStageIds: readonly InitiativeLifecycleStageId[];
} {
  const values: Record<string, string> = {};
  const missingSegmentKeys: string[] = [];
  const unresolvedStageIds: InitiativeLifecycleStageId[] = [];

  for (const plan of input.plans) {
    if (!plan.hasLifecycleStageSlots) {
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
      if (part.kind === "lifecycleStage") {
        const label = input.resolveStageLabel(part.stageId);
        if (!label || !label.trim()) {
          unresolvedStageIds.push(part.stageId);
          complete = false;
          break;
        }
        out += label.trim();
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

  return { values, missingSegmentKeys, unresolvedStageIds };
}

/**
 * Compose lifecycle tokens using a caller-supplied label resolver.
 * Fail-closed on malformed/unknown stage ids or missing labels.
 */
export function composeLifecycleStageTokens(
  template: string,
  resolveLabel: (stageId: InitiativeLifecycleStageId) => string | null,
): LifecycleStageComposeResult {
  const split = trySplitLifecycleStageTokenParts(template);
  if (!split) {
    return { ok: false, reason: "malformed_or_unknown_stage" };
  }
  let out = "";
  for (const part of split) {
    if (part.kind === "text") {
      out += part.text;
      continue;
    }
    const label = resolveLabel(part.stageId);
    if (!label || !label.trim()) {
      return {
        ok: false,
        reason: "unresolved_label",
        stageId: part.stageId,
      };
    }
    out += label.trim();
  }
  return { ok: true, text: out };
}

/** Code-owned English lifecycle registry labels for canonical participant fallback. */
export function composeLifecycleStageTokensToEnglishRegistry(
  template: string,
): LifecycleStageComposeResult {
  return composeLifecycleStageTokens(template, (stageId) => {
    return getInitiativeLifecycleStageDefinition(stageId)?.label ?? null;
  });
}

/**
 * Participant-facing English presentation: never returns raw lifecycle tokens.
 * Malformed/unknown tokens fail closed by stripping the token span (no braces left).
 */
export function presentLifecycleStageTokensAsEnglish(template: string): string {
  const composed = composeLifecycleStageTokensToEnglishRegistry(template);
  if (composed.ok) {
    return composed.text;
  }
  // Fail-closed strip: remove any lifecycle-stage-shaped braces so participants
  // never see `{lifecycleStage:...}`.
  return template.replace(/\{lifecycleStage:[^}]*\}/g, "").replace(/\s+/g, " ").trim();
}

export function presentLifecycleStageTokenFieldsAsEnglish(
  fields: Readonly<Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = presentLifecycleStageTokensAsEnglish(value);
  }
  return out;
}

/**
 * Localization 03C.5A–03C.5B.3 — Author Mode save merge.
 *
 * Editors display English-composed registry labels. On save, map the Author's
 * submitted presentation back onto the persisted semantic token plan:
 * - unchanged field → original canonical (fast path);
 * - never invent tokens from free-text words; stage ids come only from the
 *   persisted plan;
 * - per distinct registry English label (03C.5B.1 / 03C.5B.2):
 *   - found > persisted slots → fail closed to presentedEdit;
 *   - found == persisted slots → candidates may be considered;
 *   - found == 0 → all slots for that label overridden;
 *   - 0 < found < persisted slots → fail closed to presentedEdit;
 * - 03C.5B.3 — a matching English label is not proof by itself. Each preserved
 *   slot requires structural ownership via stable alphanumeric anchors from the
 *   nearest presentation text segments before/after that slot. Unproven or
 *   multi-candidate ownership → fail closed (slot override or whole field).
 */
export function preserveLifecycleStageTokensWhenPresentationUnchanged(input: {
  readonly canonicalField: string;
  readonly presentedEdit: string;
}): string {
  return mergeLifecycleStageTokensFromAuthorPresentation(input);
}

/**
 * Find the next whole-label occurrence of `label` in `haystack` at/after `from`.
 * Rejects alphanumeric-adjacent matches (e.g. "Discussion" inside "Discussions").
 */
function findWholeLifecycleLabelIndex(
  haystack: string,
  label: string,
  from: number,
): number {
  if (!label) {
    return -1;
  }
  const isWordChar = (c: string | undefined): boolean =>
    typeof c === "string" && /[A-Za-z0-9]/.test(c);

  let start = Math.max(0, from);
  while (start <= haystack.length - label.length) {
    const idx = haystack.indexOf(label, start);
    if (idx === -1) {
      return -1;
    }
    const before = idx === 0 ? undefined : haystack[idx - 1];
    const after =
      idx + label.length >= haystack.length
        ? undefined
        : haystack[idx + label.length];
    if (!isWordChar(before) && !isWordChar(after)) {
      return idx;
    }
    start = idx + 1;
  }
  return -1;
}

function findAllWholeLifecycleLabelIndices(
  haystack: string,
  label: string,
  from: number,
): number[] {
  const indices: number[] = [];
  let searchFrom = Math.max(0, from);
  while (searchFrom <= haystack.length) {
    const idx = findWholeLifecycleLabelIndex(haystack, label, searchFrom);
    if (idx === -1) {
      return indices;
    }
    indices.push(idx);
    searchFrom = idx + label.length;
  }
  return indices;
}

function countWholeLifecycleLabelOccurrences(
  haystack: string,
  label: string,
): number {
  return findAllWholeLifecycleLabelIndices(haystack, label, 0).length;
}

/** Stable deterministic anchors: lowercase alphanumeric runs from a text segment. */
function stableAlphanumericAnchorTokens(segment: string): string[] {
  return (segment.match(/[A-Za-z0-9]+/g) ?? []).map((token) =>
    token.toLowerCase(),
  );
}

function tokensBeforeIndex(edit: string, index: number): string[] {
  return stableAlphanumericAnchorTokens(edit.slice(0, Math.max(0, index)));
}

function tokensAfterIndex(edit: string, index: number): string[] {
  return stableAlphanumericAnchorTokens(edit.slice(Math.max(0, index)));
}

function leftAnchorProvesOwnership(
  edit: string,
  labelStart: number,
  leftSegment: string,
): boolean {
  const need = stableAlphanumericAnchorTokens(leftSegment);
  if (need.length === 0) {
    return true;
  }
  const before = tokensBeforeIndex(edit, labelStart);
  if (before.length < need.length) {
    return false;
  }
  const suffix = before.slice(-need.length);
  return suffix.every((token, i) => token === need[i]);
}

function rightAnchorProvesOwnership(
  edit: string,
  labelEnd: number,
  rightSegment: string,
): boolean {
  const need = stableAlphanumericAnchorTokens(rightSegment);
  if (need.length === 0) {
    return true;
  }
  const after = tokensAfterIndex(edit, labelEnd);
  if (after.length < need.length) {
    return false;
  }
  const prefix = after.slice(0, need.length);
  return prefix.every((token, i) => token === need[i]);
}

/**
 * 03C.5B.3 — prove a candidate label span owns a persisted slot using nearest
 * presentation text segments (alphanumeric token sequences), not the label alone.
 */
function candidateHasStructuralOwnership(input: {
  readonly edit: string;
  readonly labelStart: number;
  readonly labelEnd: number;
  readonly leftSegment: string;
  readonly rightSegment: string;
}): boolean {
  const leftNeed = stableAlphanumericAnchorTokens(input.leftSegment);
  const rightNeed = stableAlphanumericAnchorTokens(input.rightSegment);

  // No structural anchors → label match alone is insufficient.
  if (leftNeed.length === 0 && rightNeed.length === 0) {
    const onlyLabel =
      input.edit.slice(0, input.labelStart).trim() === "" &&
      input.edit.slice(input.labelEnd).trim() === "";
    return onlyLabel;
  }

  if (leftNeed.length === 0) {
    return rightAnchorProvesOwnership(
      input.edit,
      input.labelEnd,
      input.rightSegment,
    );
  }
  if (rightNeed.length === 0) {
    return leftAnchorProvesOwnership(
      input.edit,
      input.labelStart,
      input.leftSegment,
    );
  }

  // Either adjacent segment still matching is enough when the other was rewritten.
  return (
    leftAnchorProvesOwnership(input.edit, input.labelStart, input.leftSegment) ||
    rightAnchorProvesOwnership(input.edit, input.labelEnd, input.rightSegment)
  );
}

type AuthorLifecycleSlotMatch =
  | {
      readonly kind: "preserved";
      readonly start: number;
      readonly end: number;
      readonly token: string;
    }
  | {
      readonly kind: "overridden";
    };

type PersistedAuthorLifecycleSlot = {
  readonly token: string;
  readonly label: string;
  readonly leftSegment: string;
  readonly rightSegment: string;
};

/**
 * Build presentation-plan slots with immediate neighboring text segments.
 */
function buildPersistedAuthorLifecycleSlots(
  parts: readonly LifecycleStageTokenPart[],
): PersistedAuthorLifecycleSlot[] | null {
  const slots: PersistedAuthorLifecycleSlot[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    if (part.kind !== "lifecycleStage") {
      continue;
    }
    const label = getInitiativeLifecycleStageDefinition(part.stageId)?.label?.trim();
    if (!label) {
      return null;
    }
    const leftPart = i > 0 ? parts[i - 1] : undefined;
    const rightPart = i + 1 < parts.length ? parts[i + 1] : undefined;
    slots.push({
      token: part.token,
      label,
      leftSegment: leftPart?.kind === "text" ? leftPart.text : "",
      rightSegment: rightPart?.kind === "text" ? rightPart.text : "",
    });
  }
  return slots;
}

/**
 * Slot-aware merge with cardinality gates (03C.5B.1/B.2) plus structural
 * ownership proof (03C.5B.3). Stage ids come only from the persisted plan.
 */
export function mergeLifecycleStageTokensFromAuthorPresentation(input: {
  readonly canonicalField: string;
  readonly presentedEdit: string;
}): string {
  const presentedCanonical = presentLifecycleStageTokensAsEnglish(
    input.canonicalField,
  );
  if (input.presentedEdit === presentedCanonical) {
    return input.canonicalField;
  }

  const parts = trySplitLifecycleStageTokenParts(input.canonicalField);
  if (!parts) {
    return input.presentedEdit;
  }

  const slots = buildPersistedAuthorLifecycleSlots(parts);
  if (!slots) {
    return input.presentedEdit;
  }
  if (slots.length === 0) {
    return input.presentedEdit;
  }

  const slotsNeededByLabel = new Map<string, number>();
  for (const slot of slots) {
    slotsNeededByLabel.set(
      slot.label,
      (slotsNeededByLabel.get(slot.label) ?? 0) + 1,
    );
  }
  for (const [label, needed] of slotsNeededByLabel) {
    const found = countWholeLifecycleLabelOccurrences(input.presentedEdit, label);
    if (found > needed) {
      return input.presentedEdit;
    }
    if (found > 0 && found < needed) {
      return input.presentedEdit;
    }
  }

  const matches: AuthorLifecycleSlotMatch[] = [];
  let searchFrom = 0;
  for (const slot of slots) {
    const candidates = findAllWholeLifecycleLabelIndices(
      input.presentedEdit,
      slot.label,
      searchFrom,
    );
    const proven = candidates.filter((idx) =>
      candidateHasStructuralOwnership({
        edit: input.presentedEdit,
        labelStart: idx,
        labelEnd: idx + slot.label.length,
        leftSegment: slot.leftSegment,
        rightSegment: slot.rightSegment,
      }),
    );

    if (proven.length > 1) {
      // Multiple structurally plausible owners — do not guess.
      return input.presentedEdit;
    }
    if (proven.length === 0) {
      matches.push({ kind: "overridden" });
      continue;
    }

    const idx = proven[0]!;
    const end = idx + slot.label.length;
    if (idx < searchFrom) {
      return input.presentedEdit;
    }
    matches.push({
      kind: "preserved",
      start: idx,
      end,
      token: slot.token,
    });
    searchFrom = end;
  }

  // Rebuild: Author prose between anchors + tokens for preserved labels.
  let out = "";
  let cursor = 0;
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]!;
    if (match.kind === "overridden") {
      if (i > 0 && matches[i - 1]?.kind === "overridden") {
        continue;
      }
      let j = i + 1;
      while (j < matches.length && matches[j]?.kind === "overridden") {
        j += 1;
      }
      const regionEnd =
        j < matches.length && matches[j]?.kind === "preserved"
          ? (matches[j] as Extract<AuthorLifecycleSlotMatch, { kind: "preserved" }>)
              .start
          : input.presentedEdit.length;
      if (regionEnd < cursor) {
        return input.presentedEdit;
      }
      out += input.presentedEdit.slice(cursor, regionEnd);
      cursor = regionEnd;
      continue;
    }

    if (match.start < cursor) {
      return input.presentedEdit;
    }
    out += input.presentedEdit.slice(cursor, match.start);
    out += match.token;
    cursor = match.end;
  }
  out += input.presentedEdit.slice(cursor);

  if (
    textContainsLifecycleStageToken(input.presentedEdit) &&
    input.presentedEdit !== presentedCanonical
  ) {
    return input.presentedEdit;
  }

  return out;
}

export function mergeCollaborativeAnalysisAuthorSaveFields(input: {
  readonly canonical: Readonly<Record<string, string>>;
  readonly presented: Readonly<Record<string, string>>;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(input.presented)) {
    out[key] = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: input.canonical[key] ?? "",
      presentedEdit: input.presented[key] ?? "",
    });
  }
  return out;
}

/** Assert provider payload has zero lifecycle-stage tokens. */
export function assertProviderPayloadHasNoLifecycleStageTokens(
  payload: Readonly<Record<string, string>>,
): readonly string[] {
  const violators: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (textContainsLifecycleStageToken(value)) {
      violators.push(key);
    }
  }
  return violators;
}

export { machineSegmentProviderKey };

/**
 * Pack 08I.11 — shared Initiative card semantic label presentation.
 *
 * World / latest projections Title-Case Initiative **status** into publicStatus
 * and often reuse that string as currentStageLabel — that is NOT a lifecycle
 * stage id. Cards must resolve status via statuses.* catalogs.
 */

import type {
  InitiativeExperienceMessages,
  InitiativeExperienceTranslator,
} from "../public-initiative-experience/initiative-experience-i18n";
import {
  resolveInitiativeStatusDisplayLabel,
  resolveLifecycleStageDisplayLabel,
} from "../public-initiative-experience/initiative-experience-i18n";
import {
  isKnownInitiativeStageCode,
  normalizeInitiativeStageCode,
} from "../public-initiative-experience/normalize-initiative-stage-code";
import {
  looksLikeRawI18nKey,
  normalizeInitiativeStatusCode,
} from "../public-initiative-experience/normalize-initiative-status-code";

export function humanizeInitiativeSemanticCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Reject unresolved catalog key shapes before they reach participant DOM.
 */
export function sanitizeInitiativeCardLabel(
  value: string,
  safeFallback: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return safeFallback;
  }
  if (looksLikeRawI18nKey(trimmed)) {
    return safeFallback;
  }
  if (/\.(stages|statuses|states|phases)\./i.test(trimmed)) {
    return safeFallback;
  }
  if (/^(initiativeExperience|publicInitiative|publicGeo)\./i.test(trimmed)) {
    return safeFallback;
  }
  return trimmed;
}

type MessagesOrT = InitiativeExperienceMessages | InitiativeExperienceTranslator;

/**
 * Resolve Initiative **status** for public cards (proposal / discussion / …).
 * Accepts Title-Case API transport (`Proposal`) and raw codes.
 */
export function resolveInitiativeCardStatusLabel(
  status: string | undefined | null,
  messagesOrT: MessagesOrT,
): string {
  const raw = typeof status === "string" ? status.trim() : "";
  if (!raw) {
    return "";
  }
  // If a key-shaped string was already passed as a value, never re-prefix.
  if (looksLikeRawI18nKey(raw) || /\.(statuses|stages)\./i.test(raw)) {
    const maybeCode = raw.split(".").pop() || raw;
    const code = normalizeInitiativeStatusCode(maybeCode);
    return sanitizeInitiativeCardLabel(
      resolveInitiativeStatusDisplayLabel(code, messagesOrT),
      humanizeInitiativeSemanticCode(code),
    );
  }

  const code = normalizeInitiativeStatusCode(raw);
  const localized = resolveInitiativeStatusDisplayLabel(code, messagesOrT);
  return sanitizeInitiativeCardLabel(localized, humanizeInitiativeSemanticCode(code));
}

/**
 * Resolve lifecycle **stage** labels only when the input is a real stage id/label.
 * Do not call this with world-card `currentStageLabel` (Title-Cased status).
 *
 * Ambiguous single-token codes that overlap InitiativeStatus (proposal, discussion,
 * petition) are only accepted when already snake_case stage ids from the lifecycle
 * contract — Title-Case status transport must use the status resolver instead.
 */
export function resolveInitiativeCardStageLabel(
  stageIdOrLabel: string | undefined | null,
  messagesOrT: MessagesOrT,
): string {
  const raw = typeof stageIdOrLabel === "string" ? stageIdOrLabel.trim() : "";
  if (!raw) {
    return "";
  }
  if (looksLikeRawI18nKey(raw) || /\.(statuses|stages)\./i.test(raw)) {
    const maybeCode = raw.split(".").pop() || raw;
    const code = normalizeInitiativeStageCode(maybeCode);
    if (!isKnownInitiativeStageCode(code)) {
      return humanizeInitiativeSemanticCode(code);
    }
    return sanitizeInitiativeCardLabel(
      resolveLifecycleStageDisplayLabel(code, messagesOrT),
      humanizeInitiativeSemanticCode(code),
    );
  }

  // Title-Case single tokens like "Proposal" are status transport — refuse stage lookup.
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(raw) && !raw.includes("_")) {
    const lower = raw.toLowerCase();
    const multiWordStage = normalizeInitiativeStageCode(raw);
    // Allow multi-word English stage labels ("Collaborative Analysis", "Improvement Proposals").
    if (raw.includes(" ") && isKnownInitiativeStageCode(multiWordStage)) {
      return sanitizeInitiativeCardLabel(
        resolveLifecycleStageDisplayLabel(multiWordStage, messagesOrT),
        humanizeInitiativeSemanticCode(multiWordStage),
      );
    }
    // Single Title-Case word that matches a status code → not a stage for cards.
    if (
      ["proposal", "discussion", "petition", "draft", "revision", "poll", "implementation"].includes(
        lower,
      )
    ) {
      return "";
    }
  }

  const code = normalizeInitiativeStageCode(raw);
  if (!isKnownInitiativeStageCode(code)) {
    return "";
  }
  const localized = resolveLifecycleStageDisplayLabel(code, messagesOrT);
  return sanitizeInitiativeCardLabel(localized, humanizeInitiativeSemanticCode(code));
}

/**
 * Prefer status for world/latest card badges.
 * World projections Title-Case Initiative status into publicStatus / currentStageLabel —
 * never treat those as lifecycle stage ids (avoids stages.Proposal key leak and
 * stages.proposal → "Improvement Proposals" false positive).
 */
export function resolveInitiativeCardBadgeLabel(input: {
  readonly publicStatus?: string | null;
  readonly currentStageLabel?: string | null;
  readonly currentStageId?: string | null;
  readonly participationStage?: string | null;
  readonly messagesOrT: MessagesOrT;
}): string {
  const { messagesOrT } = input;

  // Explicit lifecycle stage id only (snake_case from experience, not Title-Case status).
  if (input.currentStageId?.trim() && /^[a-z][a-z0-9_]*$/.test(input.currentStageId.trim())) {
    const stage = resolveInitiativeCardStageLabel(input.currentStageId, messagesOrT);
    if (stage) {
      return stage;
    }
  }

  const status = resolveInitiativeCardStatusLabel(
    input.publicStatus || input.currentStageLabel,
    messagesOrT,
  );
  if (status) {
    return status;
  }

  if (input.participationStage?.trim()) {
    const stage = resolveInitiativeCardStageLabel(input.participationStage, messagesOrT);
    if (stage) {
      return stage;
    }
    return sanitizeInitiativeCardLabel(
      input.participationStage,
      humanizeInitiativeSemanticCode(input.participationStage),
    );
  }

  return "";
}

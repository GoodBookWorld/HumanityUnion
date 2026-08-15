import type { InitiativeLifecycleStageId } from "./initiative-lifecycle-stage.js";

/**
 * Safety Architecture Pack 01 — canonical moderation categories for
 * Lifecycle text / prompt content. Provider-independent: concrete models
 * (e.g. Gemini Safety) map into these ids; UI never invents its own.
 */
export type LifecycleSafetyCategoryId =
  | "violence"
  | "terrorism"
  | "illegal_activity"
  | "child_exploitation"
  | "harassment"
  | "hate"
  | "self_harm_encouragement"
  | "malware"
  | "spam"
  | "prompt_injection"
  | "ai_manipulation"
  | "private_credential_leakage"
  | "other_harmful";

export const LIFECYCLE_SAFETY_CATEGORY_IDS: readonly LifecycleSafetyCategoryId[] = [
  "violence",
  "terrorism",
  "illegal_activity",
  "child_exploitation",
  "harassment",
  "hate",
  "self_harm_encouragement",
  "malware",
  "spam",
  "prompt_injection",
  "ai_manipulation",
  "private_credential_leakage",
  "other_harmful",
] as const;

/**
 * Safety Architecture Pack 01 Part 3 — exactly three moderation outcomes.
 * Rejected content never enters Stage Intelligence or Lifecycle storage
 * that feeds Intelligence / future AI.
 */
export type LifecycleSafetyOutcome = "accepted" | "needs_review" | "rejected";

export const LIFECYCLE_SAFETY_OUTCOMES: readonly LifecycleSafetyOutcome[] = [
  "accepted",
  "needs_review",
  "rejected",
] as const;

/**
 * Every Initiative Lifecycle stage surface that must pass through the
 * Safety Pipeline before content is stored or handed to Stage Intelligence.
 */
export type LifecycleSafetySurfaceId =
  | "discussion"
  | InitiativeLifecycleStageId
  | "ai_prompt"
  | "ai_system_context"
  /** Blog Publishing Domain — text of BlogPost body/title/excerpt. */
  | "blog_post"
  /** Reserved for Blog Comments Pack — registered so surfaces stay known. */
  | "blog_comment";

export const LIFECYCLE_SAFETY_PROTECTED_SURFACES: readonly LifecycleSafetySurfaceId[] = [
  "discussion",
  "initiative",
  "analysis",
  "proposal",
  "revision",
  "petition",
  "decision_session",
  "collective_decision",
  "commitment",
  "tracking",
  "official_response",
  "public_impact",
  "archive",
  "ai_prompt",
  "ai_system_context",
  "blog_post",
  "blog_comment",
] as const;

/** Why a provider flagged content — advisory metadata, never shown as UI censorship copy by default. */
export interface LifecycleSafetyCategoryHit {
  readonly categoryId: LifecycleSafetyCategoryId;
  readonly confidence: "low" | "medium" | "high";
  readonly detail: string;
}

/**
 * Provider-independent signal from a SafetyProvider. The central Safety
 * Service maps this into {@link LifecycleSafetyOutcome} — providers never
 * write to storage or send notifications.
 */
export type LifecycleSafetyProviderSignal = "safe" | "uncertain" | "unsafe";

export interface LifecycleSafetyProviderResult {
  readonly signal: LifecycleSafetyProviderSignal;
  readonly categories: readonly LifecycleSafetyCategoryHit[];
  readonly providerId: string;
  /** Opaque provider diagnostics — never forwarded to other Participants. */
  readonly providerNotes?: string;
}

export interface LifecycleSafetyEvaluationInput {
  readonly surfaceId: LifecycleSafetySurfaceId;
  readonly initiativeId: string | null;
  readonly actorParticipantId: string | null;
  /** Plain text being validated (user input, draft field, or AI prompt). */
  readonly text: string;
  readonly fieldName?: string;
  readonly correlationId?: string;
}

/**
 * Canonical decision from the central Safety Service.
 */
export interface LifecycleSafetyDecision {
  readonly outcome: LifecycleSafetyOutcome;
  readonly categories: readonly LifecycleSafetyCategoryHit[];
  readonly providerId: string;
  readonly evaluatedAt: string;
  readonly surfaceId: LifecycleSafetySurfaceId;
  /**
   * Part 8 — Rejected content must never notify other users. Callers must
   * consult this before any notification fan-out.
   */
  readonly mayNotifyOtherParticipants: boolean;
  /**
   * Part 1 — false when outcome is rejected. Needs-review content may be
   * held outside Intelligence until human resolution.
   */
  readonly mayEnterLifecycleStorage: boolean;
  readonly mayEnterStageIntelligence: boolean;
  readonly summary: string;
}

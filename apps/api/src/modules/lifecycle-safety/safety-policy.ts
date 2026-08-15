import type { LifecycleSafetyOutcome, LifecycleSafetyProviderSignal } from "@hu/types";

/**
 * Safety Architecture Pack 01 Part 3 — Decision Engine.
 * Maps provider signals to the three platform outcomes. Providers never
 * decide storage or notifications directly.
 */
export function mapProviderSignalToOutcome(signal: LifecycleSafetyProviderSignal): LifecycleSafetyOutcome {
  if (signal === "unsafe") {
    return "rejected";
  }

  if (signal === "uncertain") {
    return "needs_review";
  }

  return "accepted";
}

export function mayNotifyOtherParticipants(outcome: LifecycleSafetyOutcome): boolean {
  // Part 8 — Rejected content should never notify other users.
  // Needs Review also stays quiet until a human resolves the case.
  return outcome === "accepted";
}

export function mayEnterLifecycleStorage(outcome: LifecycleSafetyOutcome): boolean {
  return outcome === "accepted";
}

export function mayEnterStageIntelligence(outcome: LifecycleSafetyOutcome): boolean {
  // Part 1 — no unsafe content may enter the Intelligence Layer.
  // Needs Review is held outside Intelligence until accepted.
  return outcome === "accepted";
}

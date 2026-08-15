/**
 * Communication UX Pack 03.7 Part 4 — Stage 2 (AI Moderation) and Stage 3
 * (Decision Engine) of `AI_MEDIA_MODERATION_ARCHITECTURE_v1.0`, scoped to
 * the image subtypes of a Shared Document (PNG/JPG/WEBP). Documents
 * (PDF/TXT/DOCX/XLSX/PPTX/ODT/ODS/ODP) never reach this stage at all —
 * "Documents: Metadata validation only" (Part 4) — Stage 1's technical
 * validation is their entire moderation pipeline.
 *
 * This module is deliberately provider-independent (blueprint §2/§6): the
 * `MediaModerationProvider` role is the architectural contract; a
 * concrete Gemini-backed implementation is a future adapter (mirrors the
 * "future adapters" language Part 5 already uses for malware scanning),
 * never a hard dependency of the pipeline shape itself.
 */

export type MediaModerationSignal = "safe" | "uncertain" | "unsafe";

export interface MediaModerationProvider {
  moderate(input: { buffer: Buffer; mimeType: string }): Promise<{ signal: MediaModerationSignal }>;
}

/**
 * The current concrete provider. No AI vision backend is wired into this
 * platform yet (no Gemini/GPT/Claude client, no API key infrastructure),
 * so this provider can never confidently classify anything — it always
 * returns `"uncertain"`. This is not a stub that "always approves"; per
 * blueprint §8, "uncertainty is not a reason to reject. It is the specific
 * condition REVIEW_REQUIRED exists to hold" — so an always-uncertain
 * signal correctly and safely routes every image to `review_required`
 * (Part 4: "If AI cannot confidently classify an image: Status:
 * review_required... Never silently publish uncertain media").
 *
 * A future concrete provider (Gemini, per blueprint §6/§17 Phase 2) can
 * be swapped in behind this exact `MediaModerationProvider` contract
 * without any change to the pipeline, the Decision Engine, or the stored
 * `SharedDocument` shape.
 */
export class UnavailableMediaModerationProvider implements MediaModerationProvider {
  moderate(): Promise<{ signal: MediaModerationSignal }> {
    return Promise.resolve({ signal: "uncertain" });
  }
}

export type MediaModerationDecision = "approved" | "review_required" | "rejected";

/**
 * Stage 3 — the Decision Engine (blueprint §4/§7): converts the AI signal
 * into exactly one of the three platform-defined outcomes. The signal
 * alone is never wired directly to publication or rejection (blueprint
 * §2 "AI Assists — Not Governs").
 */
export function decideMediaModerationOutcome(signal: MediaModerationSignal): MediaModerationDecision {
  if (signal === "safe") {
    return "approved";
  }

  if (signal === "unsafe") {
    return "rejected";
  }

  return "review_required";
}

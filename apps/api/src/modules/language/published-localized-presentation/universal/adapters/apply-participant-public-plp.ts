/**
 * STEP 15D.14.B.2.1 — public Participant profile presentation is SOURCE_ORIGINAL.
 *
 * Biography and free-text skills are displayed exactly as authored.
 * Historical participant_public PLP rows are not applied — they must not
 * override canonical source-original fields.
 *
 * Provider-free. Locale changes do not require translated copies.
 */

import type { PublicMemberProfile } from "@hu/types";

/**
 * Identity no-op for localization overlay.
 * Kept as the shared apply boundary so call sites stay stable.
 */
export async function applyParticipantPublicPlpToProjection(input: {
  readonly projection: PublicMemberProfile;
  readonly locale: string | null | undefined;
}): Promise<PublicMemberProfile> {
  void input.locale;
  return input.projection;
}

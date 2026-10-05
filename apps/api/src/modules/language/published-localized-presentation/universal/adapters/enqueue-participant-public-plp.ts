/**
 * STEP 15D.14.B.2.1 — participant_public has no machine-localization obligation.
 *
 * Biography / free-text skills are SOURCE_ORIGINAL. Do not enqueue provider
 * builds for interface-language changes or prose edits.
 *
 * Kept as a stable call-site so profile mutations remain safe to invoke.
 */

import type { MemberProfile } from "@hu/types";

/**
 * Fire-and-forget no-op — translation obligation retired.
 */
export async function enqueueParticipantPublicPlpBuilds(
  _profile: MemberProfile,
): Promise<void> {
  return;
}

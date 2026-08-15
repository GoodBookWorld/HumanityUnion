import type { InitiativeActiveAlliesProjection } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export type { InitiativeActiveAlliesProjection, InitiativeActiveAllyEntry } from "@hu/types";

/**
 * Communication UX Pack 03.3 Part 19 — the Initiative Active Allies
 * widget's one read. Public (a guest receives the Author + active Allies
 * with no `participantId`/`canMessage`/`hasUnreadMessages`); an
 * authenticated request additionally receives those viewer-scoped action
 * fields. Never a second Ally list fetch alongside Discussion →
 * Collaboration — this is the widget's own single, dedicated call.
 */
export async function getInitiativeActiveAlliesTeam(
  initiativeId: string,
): Promise<InitiativeActiveAlliesProjection> {
  return apiRequest<InitiativeActiveAlliesProjection>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/active-allies-team`,
  );
}

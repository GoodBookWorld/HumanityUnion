/**
 * Pack 12B2 — Initiative cover media upload may be performed by steward,
 * PUBLIC_CHOICE participant (existing Fix 08A), or ACTIVE Editor with INITIATIVE_EDIT.
 */
import type { Initiative } from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

import { assertEditorCanMutate } from "../editor-grants/editor-grant.authorization.js";
import { initiativeContentGeography } from "../editor-grants/editor-content-geography.js";
import type { RequestIdentity } from "./identity/request-identity.types.js";
import { isInitiativeOwnedBy } from "./initiative-ownership.js";

export async function assertCanUploadInitiativeCoverMedia(input: {
  initiative: Initiative;
  identity: RequestIdentity;
  actorUserId: string;
}): Promise<void> {
  if (isInitiativeOwnedBy(input.initiative, input.identity)) {
    return;
  }

  const participantId = input.identity.participantId?.trim();
  if (
    resolveInitiativeLifecycleProfile(input.initiative.lifecycleProfile) === "PUBLIC_CHOICE" &&
    participantId
  ) {
    // Fix 08A — any authenticated Participant may upload candidate/cover media for Public Choice.
    return;
  }

  await assertEditorCanMutate({
    actorUserId: input.actorUserId,
    capability: "INITIATIVE_EDIT",
    content: initiativeContentGeography({
      countrySlug: input.initiative.metadata.countrySlug,
      regionSlug: input.initiative.metadata.regionSlug,
      communitySlug: input.initiative.metadata.communitySlug,
    }),
  });
}

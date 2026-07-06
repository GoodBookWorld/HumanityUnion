import type { ParticipationAreaVerificationStatus } from "@hu/types";

import { getActiveParticipationAreaForParticipant } from "../modules/participation-area/participation-area.store.js";

const participantId = process.argv[2];
const expectedCountrySlug = process.argv[3];
const expectedVerificationStatus = process.argv[4] as
  ParticipationAreaVerificationStatus | undefined;

if (!participantId || !expectedCountrySlug || !expectedVerificationStatus) {
  process.exit(1);
}

const area = getActiveParticipationAreaForParticipant(participantId);

if (
  !area ||
  area.countrySlug !== expectedCountrySlug ||
  area.verificationStatus !== expectedVerificationStatus
) {
  process.exit(1);
}

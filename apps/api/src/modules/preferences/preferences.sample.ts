import type { MemberPreferences } from "@hu/types";

import { buildDefaultMemberPreferences } from "./preferences.defaults.js";

export const samplePreferences: MemberPreferences = buildDefaultMemberPreferences({
  memberId: "member-bootstrap-001",
  userId: "auth-bootstrap-001",
});

samplePreferences.experiencePreferences.interfaceLanguage = "en";
samplePreferences.experiencePreferences.timeZone = "America/Vancouver";
samplePreferences.participationPreferences.interestedTopics = ["Local Community"];
samplePreferences.participationPreferences.preferredActivityAreas = ["Environment and Climate"];
samplePreferences.communicationPreferences.messageCategories = ["Announcements"];

import type {
  AccessibilityPreferences,
  CommunicationPreferences,
  ExperiencePreferences,
  MemberPreferences,
  ParticipationPreferences,
  WorkspacePreferences,
} from "@hu/types";

import { samplePreferences } from "./preferences.sample.js";

export interface PreferencesUpdate {
  experiencePreferences?: Partial<ExperiencePreferences>;
  participationPreferences?: Partial<ParticipationPreferences>;
  communicationPreferences?: Partial<CommunicationPreferences>;
  accessibilityPreferences?: Partial<AccessibilityPreferences>;
  workspacePreferences?: Partial<WorkspacePreferences>;
}

const preferences = new Map<string, MemberPreferences>([
  [samplePreferences.memberId, structuredClone(samplePreferences)],
]);

export function getPreferencesByMemberId(memberId: string): MemberPreferences | null {
  const memberPreferences = preferences.get(memberId);

  return memberPreferences ? structuredClone(memberPreferences) : null;
}

export function updatePreferences(
  memberId: string,
  update: PreferencesUpdate,
): MemberPreferences | null {
  const memberPreferences = preferences.get(memberId);

  if (!memberPreferences) {
    return null;
  }

  if (update.experiencePreferences) {
    Object.assign(memberPreferences.experiencePreferences, update.experiencePreferences);
  }

  if (update.participationPreferences) {
    Object.assign(memberPreferences.participationPreferences, update.participationPreferences);
  }

  if (update.communicationPreferences) {
    Object.assign(memberPreferences.communicationPreferences, update.communicationPreferences);
  }

  if (update.accessibilityPreferences) {
    Object.assign(memberPreferences.accessibilityPreferences, update.accessibilityPreferences);
  }

  if (update.workspacePreferences) {
    Object.assign(memberPreferences.workspacePreferences, update.workspacePreferences);
  }

  return structuredClone(memberPreferences);
}

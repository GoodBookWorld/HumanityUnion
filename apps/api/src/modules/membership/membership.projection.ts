import type {
  MembershipApplicationView,
  MembershipMePayload,
  MembershipRecord,
  MembershipStatusPayload,
  MembershipSummary,
  MembershipTimelineStep,
} from "@hu/types";

import { MEMBERSHIP_COHORT_MEMBER, MEMBERSHIP_COHORT_PARTICIPANT } from "./membership.constants.js";
import { resolveMembershipParticipationCountryCodes } from "./membership-participation-countries.js";

export function resolveMembershipCohortLabel(
  status: MembershipRecord["status"],
): MembershipSummary["cohortLabel"] {
  return status === "active_member" ? MEMBERSHIP_COHORT_MEMBER : MEMBERSHIP_COHORT_PARTICIPANT;
}

export function toMembershipSummary(record: MembershipRecord): MembershipSummary {
  const participationCountryCodes = resolveMembershipParticipationCountryCodes(record);

  return {
    cohortLabel: resolveMembershipCohortLabel(record.status),
    status: record.status,
    applicationStatus: record.applicationStatus,
    memberNumber: record.memberNumber,
    memberSince: record.memberGrantedAt,
    countryCode: participationCountryCodes[0] ?? record.countryCode,
    participationCountryCodes:
      participationCountryCodes.length > 0 ? participationCountryCodes : null,
  };
}

export function toMembershipApplicationView(record: MembershipRecord): MembershipApplicationView {
  const participationCountryCodes = resolveMembershipParticipationCountryCodes(record);

  return {
    countryCode: participationCountryCodes[0] ?? record.countryCode,
    participationCountryCodes:
      participationCountryCodes.length > 0 ? participationCountryCodes : null,
    displayNameConfirmed: record.displayNameConfirmed,
    termsVersion: record.termsVersion,
    termsAcceptedAt: record.termsAcceptedAt,
    applicationSubmittedAt: record.applicationSubmittedAt,
  };
}

export function toMembershipStatusPayload(record: MembershipRecord): MembershipStatusPayload {
  const summary = toMembershipSummary(record);

  return {
    cohortLabel: summary.cohortLabel,
    status: summary.status,
    applicationStatus: summary.applicationStatus,
    memberNumber: summary.memberNumber,
  };
}

export function buildMembershipTimeline(input: {
  emailConfirmed: boolean;
  membership: MembershipRecord;
}): MembershipTimelineStep[] {
  const { emailConfirmed, membership } = input;
  const applicationComplete =
    membership.applicationStatus === "submitted" || membership.applicationStatus === "approved";
  const isMember = membership.status === "active_member";

  return [
    {
      id: "registration",
      label: "Registration",
      state: "complete",
      detail: "Account created",
    },
    {
      id: "email_confirmed",
      label: "Email confirmed",
      state: emailConfirmed ? "complete" : "current",
      detail: emailConfirmed ? "Email address confirmed" : "Confirm your email to apply",
    },
    {
      id: "application",
      label: "Membership application",
      state: applicationComplete ? "complete" : emailConfirmed ? "current" : "upcoming",
      detail: applicationComplete ? "Application submitted" : "Complete the application form",
    },
    {
      id: "contribution",
      label: "Contribution",
      state: isMember ? "complete" : applicationComplete ? "current" : "upcoming",
      detail: isMember
        ? "Membership Contribution completed"
        : membership.status === "pending_payment"
          ? "Complete your one-time Membership Contribution"
          : "One-time 1 CAD Membership Contribution",
    },
    {
      id: "member",
      label: "Member",
      state: isMember ? "complete" : "upcoming",
      detail: isMember ? "Membership active" : "Assigned after confirmed contribution",
    },
  ];
}

export function toMembershipMePayload(input: {
  record: MembershipRecord;
  emailConfirmed: boolean;
}): MembershipMePayload {
  return {
    membership: toMembershipSummary(input.record),
    application: toMembershipApplicationView(input.record),
    timeline: buildMembershipTimeline({
      emailConfirmed: input.emailConfirmed,
      membership: input.record,
    }),
    emailConfirmed: input.emailConfirmed,
  };
}

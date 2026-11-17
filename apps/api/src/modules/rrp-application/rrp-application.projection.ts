import type {
  AdminRrpApplicationDetail,
  AdminRrpApplicationListItem,
  RrpApplicationDetail,
  RrpApplicationRecord,
} from "@hu/types";

/** Owner detail — includes DOB for the applicant only. */
export function toRrpApplicationDetail(record: RrpApplicationRecord): RrpApplicationDetail {
  return {
    applicationId: record.applicationId,
    participantId: record.participantId,
    legalFirstName: record.legalFirstName,
    legalLastName: record.legalLastName,
    profession: record.profession,
    residenceCountryCode: record.residenceCountryCode,
    representCountryCode: record.representCountryCode,
    dateOfBirth: record.dateOfBirth,
    fundingModel: record.fundingModel,
    annualRequestedAmountCad: record.annualRequestedAmountCad,
    teamMemberCount: record.teamMemberCount,
    relevantExperience: record.relevantExperience,
    motivation: record.motivation,
    consentAcceptedAt: record.consentAcceptedAt,
    consentVersion: record.consentVersion,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    submittedAt: record.submittedAt,
    reviewedAt: record.reviewedAt,
    revision: record.revision,
    decisionHistory: record.decisionHistory,
  };
}

/** Admin list row — never includes dateOfBirth. */
export function toAdminRrpApplicationListItem(
  record: RrpApplicationRecord,
): AdminRrpApplicationListItem {
  return {
    applicationId: record.applicationId,
    participantId: record.participantId,
    userId: record.userId,
    legalFirstName: record.legalFirstName,
    legalLastName: record.legalLastName,
    profession: record.profession,
    residenceCountryCode: record.residenceCountryCode,
    representCountryCode: record.representCountryCode,
    fundingModel: record.fundingModel,
    annualRequestedAmountCad: record.annualRequestedAmountCad,
    teamMemberCount: record.teamMemberCount,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    submittedAt: record.submittedAt,
    reviewedAt: record.reviewedAt,
    revision: record.revision,
  };
}

/** Admin detail — DOB only on this authorized surface. */
export function toAdminRrpApplicationDetail(
  record: RrpApplicationRecord,
): AdminRrpApplicationDetail {
  return {
    ...toAdminRrpApplicationListItem(record),
    dateOfBirth: record.dateOfBirth,
    relevantExperience: record.relevantExperience,
    motivation: record.motivation,
    consentAcceptedAt: record.consentAcceptedAt,
    consentVersion: record.consentVersion,
    reviewerAdminUserId: record.reviewerAdminUserId,
    decisionHistory: record.decisionHistory,
  };
}

/** Status-only audit summary — never includes DOB or free-text PII payloads. */
export function buildRrpApplicationAuditSummary(record: RrpApplicationRecord): string {
  return `status=${record.status};revision=${record.revision};country=${record.representCountryCode}`;
}

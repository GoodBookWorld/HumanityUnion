import type { CivicNomination } from "@hu/types";
import { canTransitionCivicNomination } from "@hu/types";
import { randomUUID } from "node:crypto";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  findMemberProfileByProfileId,
  findMemberProfileByUserId,
} from "../member-profile/member-profile.repository.js";
import { emitCivicNotificationEvent } from "../notifications/notification.service.js";
import { resetGlobalSearchIndexForTests } from "../global-search/global-search.index.js";

import {
  civicNominationToSearchMetadata,
  toPublicCivicNominationListItem,
  toPublicCivicNominationProjection,
} from "./civic-nomination.projection.js";
import {
  createCivicNominationRecord,
  getCivicNominationById,
  listCivicNominationsByNominator,
  listPublishedCivicNominations,
  updateCivicNominationRecord,
} from "./civic-nomination.store.js";
import {
  type CivicNominationDraftInput,
  type CivicNominationUpdateInput,
  validateCivicNominationDraftInput,
  validateCivicNominationForSubmission,
  validateCivicNominationUpdateInput,
} from "./civic-nomination.validation.js";

export interface CivicNominationAuthContext {
  userId: string;
  profileId: string;
  memberId: string;
}

function invalidateSearchIndex(): void {
  resetGlobalSearchIndexForTests();
}

function assertNominatorOwnership(nomination: CivicNomination, profileId: string): void {
  if (nomination.nominatedByProfileId !== profileId) {
    throw new Error("You do not have access to this civic nomination.");
  }
}

function assertInstitutionModerator(identity: RequestIdentity): void {
  if (identity.role !== "admin" && identity.role !== "moderator") {
    throw new Error("Institution moderation privileges are required.");
  }
}

function assertEditableStatus(nomination: CivicNomination): void {
  if (nomination.status !== "draft") {
    throw new Error("Only draft civic nominations can be edited.");
  }
}

function transitionNomination(
  nomination: CivicNomination,
  toStatus: CivicNomination["status"],
  timestamps: Partial<
    Pick<CivicNomination, "submittedAt" | "publishedAt" | "withdrawnAt" | "archivedAt">
  >,
): CivicNomination {
  if (!canTransitionCivicNomination(nomination.status, toStatus)) {
    throw new Error(`Cannot transition civic nomination from ${nomination.status} to ${toStatus}.`);
  }

  const now = new Date().toISOString();

  return {
    ...nomination,
    status: toStatus,
    updatedAt: now,
    nominationVersion: nomination.nominationVersion + 1,
    ...timestamps,
  };
}

export async function resolveCivicNominationAuthContext(
  userId: string,
): Promise<CivicNominationAuthContext> {
  const profile = await findMemberProfileByUserId(userId);

  if (!profile) {
    throw new Error("Member profile is required to create civic nominations.");
  }

  const authUser = await findAuthUserById(userId);

  if (!authUser?.memberId) {
    throw new Error("Member identity is required to create civic nominations.");
  }

  return {
    userId,
    profileId: profile.profileId,
    memberId: authUser.memberId,
  };
}

export function listMyCivicNominations(profileId: string): CivicNomination[] {
  return listCivicNominationsByNominator(profileId);
}

export function getMyCivicNomination(nominationId: string, profileId: string): CivicNomination {
  const nomination = getCivicNominationById(nominationId);

  if (!nomination) {
    throw new Error("Civic nomination not found.");
  }

  assertNominatorOwnership(nomination, profileId);

  return nomination;
}

export function createCivicNominationDraft(
  auth: CivicNominationAuthContext,
  input: Record<string, unknown>,
): CivicNomination {
  const validated = validateCivicNominationDraftInput(input);
  const now = new Date().toISOString();
  const nominationId = `civic-nomination-${randomUUID()}`;

  const nomination: CivicNomination = {
    nominationId,
    institutionRole: validated.institutionRole,
    nominationType: validated.nominationType,
    nomineeName: validated.nomineeName,
    nomineeProfileId: validated.nomineeProfileId,
    nominatedByProfileId: auth.profileId,
    nominatedByUserId: auth.userId,
    countrySlug: validated.countrySlug,
    regionSlug: validated.regionSlug,
    communitySlug: validated.communitySlug,
    expertiseAreas: validated.expertiseAreas,
    experienceSummary: validated.experienceSummary,
    confirmedAchievements: validated.confirmedAchievements,
    evidenceLinks: validated.evidenceLinks,
    visionStatement: validated.visionStatement,
    conflictOfInterest: validated.conflictOfInterest,
    declarations: validated.declarations,
    status: "draft",
    nominationVersion: 1,
    createdAt: now,
    updatedAt: now,
  };

  return createCivicNominationRecord(nomination);
}

export function updateCivicNominationDraft(
  nominationId: string,
  profileId: string,
  input: Record<string, unknown>,
): CivicNomination {
  const nomination = getCivicNominationById(nominationId);

  if (!nomination) {
    throw new Error("Civic nomination not found.");
  }

  assertNominatorOwnership(nomination, profileId);
  assertEditableStatus(nomination);

  const validated = validateCivicNominationUpdateInput(input);

  return updateCivicNominationRecord(nominationId, (current) => ({
    ...current,
    ...validated,
    conflictOfInterest: validated.conflictOfInterest ?? current.conflictOfInterest,
    declarations: validated.declarations ?? current.declarations,
    updatedAt: new Date().toISOString(),
    nominationVersion: current.nominationVersion + 1,
  }));
}

export function submitCivicNomination(
  nominationId: string,
  auth: CivicNominationAuthContext,
): CivicNomination {
  const nomination = getCivicNominationById(nominationId);

  if (!nomination) {
    throw new Error("Civic nomination not found.");
  }

  assertNominatorOwnership(nomination, auth.profileId);
  validateCivicNominationForSubmission(nomination);

  const updated = updateCivicNominationRecord(nominationId, (current) =>
    transitionNomination(current, "submitted", {
      submittedAt: new Date().toISOString(),
    }),
  );

  emitCivicNotificationEvent({
    eventType: "civic_nomination_submitted",
    entityType: "civic_nomination",
    entityId: updated.nominationId,
    actorMemberId: auth.memberId,
  });

  return updated;
}

export function withdrawCivicNomination(
  nominationId: string,
  auth: CivicNominationAuthContext,
): CivicNomination {
  const nomination = getCivicNominationById(nominationId);

  if (!nomination) {
    throw new Error("Civic nomination not found.");
  }

  assertNominatorOwnership(nomination, auth.profileId);

  if (nomination.status !== "draft" && nomination.status !== "submitted") {
    throw new Error("Only draft or submitted civic nominations can be withdrawn.");
  }

  const updated = updateCivicNominationRecord(nominationId, (current) =>
    transitionNomination(current, "withdrawn", {
      withdrawnAt: new Date().toISOString(),
    }),
  );

  emitCivicNotificationEvent({
    eventType: "civic_nomination_withdrawn",
    entityType: "civic_nomination",
    entityId: updated.nominationId,
    actorMemberId: auth.memberId,
  });

  invalidateSearchIndex();

  return updated;
}

export async function publishCivicNomination(
  nominationId: string,
  identity: RequestIdentity,
): Promise<CivicNomination> {
  assertInstitutionModerator(identity);

  const nomination = getCivicNominationById(nominationId);

  if (!nomination) {
    throw new Error("Civic nomination not found.");
  }

  validateCivicNominationForSubmission(nomination);

  const updated = updateCivicNominationRecord(nominationId, (current) =>
    transitionNomination(current, "published", {
      publishedAt: new Date().toISOString(),
    }),
  );

  const nominatorProfile = await findMemberProfileByProfileId(nomination.nominatedByProfileId);
  const nominatorUser = nominatorProfile ? await findAuthUserById(nominatorProfile.userId) : null;

  emitCivicNotificationEvent({
    eventType: "civic_nomination_published",
    entityType: "civic_nomination",
    entityId: updated.nominationId,
    actorMemberId: nominatorUser?.memberId,
  });

  invalidateSearchIndex();

  return updated;
}

export function archiveCivicNomination(
  nominationId: string,
  identity: RequestIdentity,
): CivicNomination {
  assertInstitutionModerator(identity);

  const nomination = getCivicNominationById(nominationId);

  if (!nomination) {
    throw new Error("Civic nomination not found.");
  }

  const updated = updateCivicNominationRecord(nominationId, (current) =>
    transitionNomination(current, "archived", {
      archivedAt: new Date().toISOString(),
    }),
  );

  invalidateSearchIndex();

  return updated;
}

export async function getPublicCivicNominationProjection(nominationId: string) {
  const nomination = getCivicNominationById(nominationId);

  if (!nomination || nomination.status !== "published") {
    return null;
  }

  return toPublicCivicNominationProjection(nomination);
}

export async function listPublicCivicNominationProjections(filters?: {
  institutionRole?: string;
  countrySlug?: string;
}) {
  const nominations = listPublishedCivicNominations(filters);
  const items = await Promise.all(
    nominations.map((nomination) => toPublicCivicNominationListItem(nomination)),
  );

  return items.filter((item): item is NonNullable<typeof item> => item !== null);
}

export function getPublishedCivicNominationSearchMetadata(nominationId: string) {
  const nomination = getCivicNominationById(nominationId);
  return nomination ? civicNominationToSearchMetadata(nomination) : null;
}

export type { CivicNominationDraftInput, CivicNominationUpdateInput };

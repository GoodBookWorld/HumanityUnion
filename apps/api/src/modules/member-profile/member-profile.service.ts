import type { MemberProfile, MemberProfilePrivacySettings, PublicMemberProfile } from "@hu/types";

import { findMembershipByUserId } from "../membership/membership.repository.js";
import {
  MemberProfileAccessDeniedError,
  MemberProfileNotFoundError,
  MemberProfileValidationError,
  mapMemberProfilePersistenceError,
} from "./member-profile.errors.js";
import {
  toMemberProfilePrivacySettings,
  toPublicMemberProfile,
  toWorkspaceMemberIdentity,
} from "./member-profile.projection.js";
import {
  buildDefaultMemberProfile,
  findMemberProfileByProfileId,
  findMemberProfileByUserId,
  insertMemberProfile,
  updateMemberProfileRecord,
} from "./member-profile.repository.js";
import {
  validateMemberProfilePatch,
  validateMemberProfilePrivacyPatch,
} from "./member-profile.validators.js";

export async function createMemberProfileForUser(input: {
  userId: string;
  displayName: string;
  language?: string;
}): Promise<MemberProfile> {
  try {
    const existing = await findMemberProfileByUserId(input.userId);

    if (existing) {
      return existing;
    }

    const profile = buildDefaultMemberProfile(input);
    return await insertMemberProfile(profile);
  } catch (error) {
    mapMemberProfilePersistenceError(error);
  }
}

export async function getOrCreateMemberProfileForUser(input: {
  userId: string;
  displayName: string;
  language?: string;
}): Promise<MemberProfile> {
  try {
    const existing = await findMemberProfileByUserId(input.userId);

    if (existing) {
      return existing;
    }

    return await createMemberProfileForUser(input);
  } catch (error) {
    mapMemberProfilePersistenceError(error);
  }
}

export async function getMemberProfileForAuthUser(userId: string): Promise<MemberProfile> {
  try {
    const profile = await findMemberProfileByUserId(userId);

    if (!profile) {
      throw new MemberProfileNotFoundError();
    }

    return profile;
  } catch (error) {
    mapMemberProfilePersistenceError(error);
  }
}

export async function updateMemberProfileForUser(
  userId: string,
  body: unknown,
): Promise<MemberProfile> {
  const patch = validateMemberProfilePatch(body);

  try {
    const updated = await updateMemberProfileRecord(userId, patch);

    if (!updated) {
      throw new MemberProfileNotFoundError();
    }

    return updated;
  } catch (error) {
    mapMemberProfilePersistenceError(error);
  }
}

export async function updateMemberProfilePrivacyForUser(
  userId: string,
  body: unknown,
): Promise<MemberProfilePrivacySettings> {
  const patch = validateMemberProfilePrivacyPatch(body);

  if (patch.membershipPubliclyVisible === true) {
    const membership = await findMembershipByUserId(userId);

    if (!membership || membership.status !== "active_member") {
      throw new MemberProfileValidationError(
        "Only active Members can enable public Membership visibility.",
      );
    }
  }

  try {
    const updated = await updateMemberProfileRecord(userId, patch);

    if (!updated) {
      throw new MemberProfileNotFoundError();
    }

    return toMemberProfilePrivacySettings(updated);
  } catch (error) {
    mapMemberProfilePersistenceError(error);
  }
}

export async function getMemberProfilePrivacyForUser(
  userId: string,
): Promise<MemberProfilePrivacySettings> {
  const profile = await getMemberProfileForAuthUser(userId);
  return toMemberProfilePrivacySettings(profile);
}

export async function getPublicMemberProfileById(
  profileId: string,
  options: {
    viewerIsAuthenticated: boolean;
    viewerUserId?: string;
  },
): Promise<PublicMemberProfile> {
  try {
    const profile = await findMemberProfileByProfileId(profileId);

    if (!profile) {
      throw new MemberProfileNotFoundError();
    }

    const membership = await findMembershipByUserId(profile.userId);

    const projection = toPublicMemberProfile(profile, {
      viewerIsAuthenticated: options.viewerIsAuthenticated,
      viewerIsOwner: options.viewerUserId === profile.userId,
      membership,
    });

    if (!projection) {
      throw new MemberProfileAccessDeniedError();
    }

    return projection;
  } catch (error) {
    if (
      error instanceof MemberProfileNotFoundError ||
      error instanceof MemberProfileAccessDeniedError
    ) {
      throw error;
    }

    mapMemberProfilePersistenceError(error);
  }
}

export async function getWorkspaceMemberIdentityForUser(userId: string) {
  const profile = await getMemberProfileForAuthUser(userId);
  return toWorkspaceMemberIdentity(profile);
}

export { toPublicMemberProfile, toWorkspaceMemberIdentity };

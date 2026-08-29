import type { Db, Document } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { normalizeEmail } from "../production-steward-bootstrap/redact.js";
import { ProductionAdminBootstrapError } from "./errors.js";
import type { AdminPreparedDocuments } from "./types.js";

export interface AdminCollisionHit {
  field: string;
  label: string;
  detail: string;
}

function hitDetail(doc: Document | null | undefined): string {
  if (!doc) return "none";
  const bits = [
    doc.memberId ? `memberId=${String(doc.memberId)}` : null,
    doc.userId ? `userId=${String(doc.userId)}` : null,
    doc.profileId ? `profileId=${String(doc.profileId)}` : null,
    doc.identityId ? `identityId=${String(doc.identityId)}` : null,
    doc.publicName ? `publicName=${String(doc.publicName)}` : null,
    doc.uniqueName ? `uniqueName=${String(doc.uniqueName)}` : null,
  ].filter(Boolean);
  return bits.join(", ") || "document present";
}

/**
 * Abort if ANY identity document exists for Volody, or if email/publicName/uniqueName collide.
 * Partial graphs are never repaired or merged.
 */
export async function assertNoAdminBootstrapCollisions(
  db: Db,
  prepared: AdminPreparedDocuments,
): Promise<void> {
  const memberIds = [prepared.memberId];
  const userIds = [prepared.userId];
  const profileIds = [prepared.profileId];
  const emails = [normalizeEmail(prepared.auth.email)];
  const publicNames = [prepared.publicName];
  const uniqueNames = [prepared.uniqueName];

  const [
    authByMember,
    authByUser,
    authByEmail,
    membersById,
    membersByIdentity,
    membersByUnique,
    profilesByUser,
    profilesById,
    profilesByPublic,
  ] = await Promise.all([
    db
      .collection(MONGO_COLLECTIONS.authUsers)
      .find({ memberId: { $in: memberIds } }, { projection: { memberId: 1, userId: 1, email: 1 } })
      .toArray(),
    db
      .collection(MONGO_COLLECTIONS.authUsers)
      .find({ userId: { $in: userIds } }, { projection: { memberId: 1, userId: 1, email: 1 } })
      .toArray(),
    db
      .collection(MONGO_COLLECTIONS.authUsers)
      .find({ email: { $in: emails } }, { projection: { memberId: 1, userId: 1, email: 1 } })
      .toArray(),
    db
      .collection(MONGO_COLLECTIONS.members)
      .find(
        { memberId: { $in: memberIds } },
        { projection: { memberId: 1, identityId: 1, uniqueName: 1 } },
      )
      .toArray(),
    db
      .collection(MONGO_COLLECTIONS.members)
      .find(
        { identityId: { $in: userIds } },
        { projection: { memberId: 1, identityId: 1, uniqueName: 1 } },
      )
      .toArray(),
    db
      .collection(MONGO_COLLECTIONS.members)
      .find(
        { uniqueName: { $in: uniqueNames } },
        { projection: { memberId: 1, identityId: 1, uniqueName: 1 } },
      )
      .toArray(),
    db
      .collection(MONGO_COLLECTIONS.memberProfiles)
      .find(
        { userId: { $in: userIds } },
        { projection: { profileId: 1, userId: 1, publicName: 1 } },
      )
      .toArray(),
    db
      .collection(MONGO_COLLECTIONS.memberProfiles)
      .find(
        { profileId: { $in: profileIds } },
        { projection: { profileId: 1, userId: 1, publicName: 1 } },
      )
      .toArray(),
    db
      .collection(MONGO_COLLECTIONS.memberProfiles)
      .find(
        { publicName: { $in: publicNames } },
        { projection: { profileId: 1, userId: 1, publicName: 1 } },
      )
      .toArray(),
  ]);

  const hits: AdminCollisionHit[] = [];
  const email = normalizeEmail(prepared.auth.email);

  const authMemberHit = authByMember.find((doc) => doc.memberId === prepared.memberId);
  const authUserHit = authByUser.find((doc) => doc.userId === prepared.userId);
  const authEmailHit = authByEmail.find(
    (doc) => normalizeEmail(String(doc.email ?? "")) === email,
  );
  const memberHit = membersById.find((doc) => doc.memberId === prepared.memberId);
  const memberIdentityHit = membersByIdentity.find((doc) => doc.identityId === prepared.userId);
  const uniqueHit = membersByUnique.find((doc) => doc.uniqueName === prepared.uniqueName);
  const profileUserHit = profilesByUser.find((doc) => doc.userId === prepared.userId);
  const profileIdHit = profilesById.find((doc) => doc.profileId === prepared.profileId);
  const publicHit = profilesByPublic.find((doc) => doc.publicName === prepared.publicName);

  const authPresent = Boolean(authMemberHit || authUserHit || authEmailHit);
  const memberPresent = Boolean(memberHit || memberIdentityHit);
  const profilePresent = Boolean(profileUserHit || profileIdHit);
  const presentCount = [authPresent, memberPresent, profilePresent].filter(Boolean).length;

  if (presentCount === 1 || presentCount === 2) {
    hits.push({
      field: "partial_graph",
      label: prepared.label,
      detail: `Partial identity graph already present; refuse automatic repair. auth=${hitDetail(
        authMemberHit ?? authUserHit ?? authEmailHit,
      )}; member=${hitDetail(memberHit ?? memberIdentityHit)}; profile=${hitDetail(
        profileUserHit ?? profileIdHit,
      )}`,
    });
  }

  if (authMemberHit || authUserHit) {
    hits.push({
      field: "memberId_or_userId",
      label: prepared.label,
      detail: `auth_users already exists (${hitDetail(authMemberHit ?? authUserHit)})`,
    });
  }
  if (authEmailHit) {
    hits.push({
      field: "email",
      label: prepared.label,
      detail: `email collision (${hitDetail(authEmailHit)})`,
    });
  }
  if (memberHit || memberIdentityHit) {
    hits.push({
      field: "memberId_or_identityId",
      label: prepared.label,
      detail: `members already exists (${hitDetail(memberHit ?? memberIdentityHit)})`,
    });
  }
  if (uniqueHit) {
    hits.push({
      field: "uniqueName",
      label: prepared.label,
      detail: `uniqueName collision (${hitDetail(uniqueHit)})`,
    });
  }
  if (profileUserHit || profileIdHit) {
    hits.push({
      field: "profileId_or_userId",
      label: prepared.label,
      detail: `member_profiles already exists (${hitDetail(profileUserHit ?? profileIdHit)})`,
    });
  }
  if (publicHit) {
    hits.push({
      field: "publicName",
      label: prepared.label,
      detail: `publicName collision (${hitDetail(publicHit)})`,
    });
  }

  if (hits.length > 0) {
    const summary = hits.map((hit) => `${hit.label}/${hit.field}: ${hit.detail}`).join(" | ");
    throw new ProductionAdminBootstrapError(
      `Aborting Admin bootstrap due to collisions or partial graphs: ${summary}`,
      "COLLISION",
    );
  }
}

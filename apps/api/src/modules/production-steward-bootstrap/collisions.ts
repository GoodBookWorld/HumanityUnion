import type { Db, Document } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { ProductionStewardBootstrapError } from "./errors.js";
import { normalizeEmail } from "./redact.js";
import type { StewardPreparedDocuments } from "./types.js";

export interface CollisionHit {
  field: string;
  stewardLabel: string;
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
 * Abort if ANY identity document exists for ANY steward, or if email/publicName/uniqueName collide.
 * Partial graphs are never repaired.
 */
export async function assertNoBootstrapCollisions(
  db: Db,
  prepared: StewardPreparedDocuments[],
): Promise<void> {
  const memberIds = prepared.map((row) => row.memberId);
  const userIds = prepared.map((row) => row.userId);
  const profileIds = prepared.map((row) => row.profileId);
  const emails = prepared.map((row) => normalizeEmail(row.auth.email));
  const publicNames = prepared.map((row) => row.publicName);
  const uniqueNames = prepared.map((row) => row.uniqueName);

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

  const hits: CollisionHit[] = [];

  for (const steward of prepared) {
    const email = normalizeEmail(steward.auth.email);

    const authMemberHit = authByMember.find((doc) => doc.memberId === steward.memberId);
    const authUserHit = authByUser.find((doc) => doc.userId === steward.userId);
    const authEmailHit = authByEmail.find(
      (doc) => normalizeEmail(String(doc.email ?? "")) === email,
    );
    const memberHit = membersById.find((doc) => doc.memberId === steward.memberId);
    const memberIdentityHit = membersByIdentity.find((doc) => doc.identityId === steward.userId);
    const uniqueHit = membersByUnique.find((doc) => doc.uniqueName === steward.uniqueName);
    const profileUserHit = profilesByUser.find((doc) => doc.userId === steward.userId);
    const profileIdHit = profilesById.find((doc) => doc.profileId === steward.profileId);
    const publicHit = profilesByPublic.find((doc) => doc.publicName === steward.publicName);

    const authPresent = Boolean(authMemberHit || authUserHit || authEmailHit);
    const memberPresent = Boolean(memberHit || memberIdentityHit);
    const profilePresent = Boolean(profileUserHit || profileIdHit);
    const presentCount = [authPresent, memberPresent, profilePresent].filter(Boolean).length;

    if (presentCount === 1 || presentCount === 2) {
      hits.push({
        field: "partial_graph",
        stewardLabel: steward.label,
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
        stewardLabel: steward.label,
        detail: `auth_users already exists (${hitDetail(authMemberHit ?? authUserHit)})`,
      });
    }
    if (authEmailHit && !(authMemberHit || authUserHit)) {
      hits.push({
        field: "email",
        stewardLabel: steward.label,
        detail: `email collision (${hitDetail(authEmailHit)})`,
      });
    } else if (authEmailHit && (authMemberHit || authUserHit)) {
      // Same graph already exists — still a hard abort (idempotent fail).
      hits.push({
        field: "email",
        stewardLabel: steward.label,
        detail: `email already present for existing graph (${hitDetail(authEmailHit)})`,
      });
    }
    if (memberHit || memberIdentityHit) {
      hits.push({
        field: "memberId_or_identityId",
        stewardLabel: steward.label,
        detail: `members already exists (${hitDetail(memberHit ?? memberIdentityHit)})`,
      });
    }
    if (uniqueHit && !(memberHit || memberIdentityHit)) {
      hits.push({
        field: "uniqueName",
        stewardLabel: steward.label,
        detail: `uniqueName collision (${hitDetail(uniqueHit)})`,
      });
    } else if (uniqueHit) {
      hits.push({
        field: "uniqueName",
        stewardLabel: steward.label,
        detail: `uniqueName already present (${hitDetail(uniqueHit)})`,
      });
    }
    if (profileUserHit || profileIdHit) {
      hits.push({
        field: "profileId_or_userId",
        stewardLabel: steward.label,
        detail: `member_profiles already exists (${hitDetail(profileUserHit ?? profileIdHit)})`,
      });
    }
    if (publicHit && !(profileUserHit || profileIdHit)) {
      hits.push({
        field: "publicName",
        stewardLabel: steward.label,
        detail: `publicName collision (${hitDetail(publicHit)})`,
      });
    } else if (publicHit) {
      hits.push({
        field: "publicName",
        stewardLabel: steward.label,
        detail: `publicName already present (${hitDetail(publicHit)})`,
      });
    }
  }

  if (hits.length > 0) {
    const summary = hits
      .map((hit) => `${hit.stewardLabel}/${hit.field}: ${hit.detail}`)
      .join(" | ");
    throw new ProductionStewardBootstrapError(
      `Aborting bootstrap due to collisions or partial graphs: ${summary}`,
      "COLLISION",
    );
  }
}

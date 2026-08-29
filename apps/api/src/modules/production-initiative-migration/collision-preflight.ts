import type { Db, Document } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import {
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
} from "./constants.js";
import { CIVIC_COLLECTION_CATALOG } from "./collection-plan.js";
import type { ProductionCollisionPreflightReport, PreflightVerdict } from "./types.js";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function runProductionCollisionPreflight(input: {
  db: Db;
  databaseName: string;
  /** Optional known child primary IDs from staging inventory to check for collisions. */
  stagedChildIdsByCollection?: Record<string, string[]>;
  stagedMemberNumbers?: string[];
  stagedBadgeApplicationIds?: string[];
}): Promise<ProductionCollisionPreflightReport> {
  const blockers: string[] = [];
  const ids = [...CANONICAL_PRODUCTION_INITIATIVE_IDS];

  const initiativeCollisions: ProductionCollisionPreflightReport["initiativeCollisions"] = [];
  for (const initiativeId of ids) {
    const present = Boolean(
      await input.db.collection(MONGO_COLLECTIONS.initiatives).findOne({
        $or: [{ _id: initiativeId as unknown as string }, { initiativeId }],
      } as Document),
    );
    initiativeCollisions.push({ initiativeId, present });
    if (present) {
      blockers.push(`Initiative root collision: ${initiativeId}`);
    }
  }

  const childCollisions: ProductionCollisionPreflightReport["childCollisions"] = [];
  const staged = input.stagedChildIdsByCollection ?? {};
  for (const entry of CIVIC_COLLECTION_CATALOG) {
    if (
      entry.classification !== "MUST_MIGRATE" &&
      entry.classification !== "CONDITIONAL_MIGRATE" &&
      entry.classification !== "MUST_MIGRATE_IF_PRESENT"
    ) {
      continue;
    }
    if (entry.collection.includes(".")) continue;
    if (entry.ancestryMethod === "participant-scoped") continue;

    const stagedIds = staged[entry.collection] ?? [];
    const collidingIds: string[] = [];

    // Always check direct initiativeId presence for Initiative-scoped collections.
    const byInitiative = await input.db
      .collection(entry.collection)
      .find(
        {
          $or: [
            { initiativeId: { $in: ids } },
            { "subject.initiativeId": { $in: ids } },
            { _id: { $in: ids as unknown as string[] } },
          ],
        } as Document,
        { projection: { _id: 1, initiativeId: 1 } },
      )
      .limit(50)
      .toArray();

    if (byInitiative.length > 0) {
      collidingIds.push(
        ...byInitiative.map(
          (doc) => asString(doc.initiativeId) ?? asString(doc._id) ?? "unknown",
        ),
      );
    }

    if (stagedIds.length > 0 && entry.primaryIdFields?.length) {
      const field = entry.primaryIdFields[0]!;
      const hits = await input.db
        .collection(entry.collection)
        .find({ [field]: { $in: stagedIds } }, { projection: { [field]: 1 } })
        .limit(50)
        .toArray();
      for (const hit of hits) {
        const id = asString(hit[field]);
        if (id) collidingIds.push(id);
      }
    }

    const unique = [...new Set(collidingIds)];
    if (unique.length > 0) {
      childCollisions.push({
        collection: entry.collection,
        collidingIds: unique.slice(0, 20),
        count: unique.length,
      });
      blockers.push(
        `Child collision in ${entry.collection}: ${unique.length} id(s)`,
      );
    }
  }

  // Partial graph: children without roots (already flagged) or roots without expected identity prep
  const identityChecks: ProductionCollisionPreflightReport["identityChecks"] = [];
  for (const participant of APPROVED_PRODUCTION_PARTICIPANTS) {
    const auth = await input.db.collection(MONGO_COLLECTIONS.authUsers).findOne({
      memberId: participant.memberId,
    });
    const member = await input.db.collection(MONGO_COLLECTIONS.members).findOne({
      memberId: participant.memberId,
    });
    const profile = await input.db.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
      profileId: participant.profileId,
    });
    const present = Boolean(auth && member && profile);
    const authRole = asString(auth?.role);
    const rolesOk =
      present &&
      authRole === participant.authRole &&
      Array.isArray(member?.roles) &&
      member.roles.length === 1 &&
      member.roles[0] === "member";

    identityChecks.push({
      label: participant.label,
      memberId: participant.memberId,
      present,
      authRole,
      expectedAuthRole: participant.authRole,
      rolesOk: Boolean(rolesOk),
    });

    if (!present) {
      blockers.push(`Required identity graph missing: ${participant.label}`);
    } else if (!rolesOk) {
      blockers.push(
        `Identity role check failed for ${participant.label}: auth.role=${authRole} expected=${participant.authRole}`,
      );
    }
  }

  const membershipCollisions: ProductionCollisionPreflightReport["membershipCollisions"] = [];
  for (const participant of APPROVED_PRODUCTION_PARTICIPANTS) {
    const membership = await input.db.collection(MONGO_COLLECTIONS.memberships).findOne({
      userId: participant.userId,
    });
    membershipCollisions.push({
      userId: participant.userId,
      label: participant.label,
      present: Boolean(membership),
      status: asString(membership?.status),
    });
    // Existing Vlad active_member in production is a collision for re-insert — report, fail closed for migrate-of-same-id.
    if (membership && participant.label === "Vlad Shapran") {
      blockers.push(
        "Production already has Vlad membership row — fail closed on membershipId/userId collision (no merge in v1)",
      );
    }
  }

  const memberNumberCollisions: ProductionCollisionPreflightReport["memberNumberCollisions"] =
    [];
  for (const memberNumber of input.stagedMemberNumbers ?? []) {
    const hit = await input.db.collection(MONGO_COLLECTIONS.memberships).findOne({
      memberNumber,
    });
    memberNumberCollisions.push({ memberNumber, present: Boolean(hit) });
    if (hit) {
      blockers.push(`Member Number collision: ${memberNumber}`);
    }
  }

  const badgeOrderCollisions: ProductionCollisionPreflightReport["badgeOrderCollisions"] = [];
  for (const applicationId of input.stagedBadgeApplicationIds ?? []) {
    const hit = await input.db
      .collection(MONGO_COLLECTIONS.memberBadgeApplications)
      .findOne({ applicationId });
    badgeOrderCollisions.push({ applicationId, present: Boolean(hit) });
    if (hit) {
      blockers.push(`Badge application/order collision: ${applicationId}`);
    }
  }

  // Partial: if any child collision but no root — already covered. Extra: root absent + child present.
  for (const child of childCollisions) {
    const anyRootPresent = initiativeCollisions.some((r) => r.present);
    if (!anyRootPresent && child.count > 0) {
      blockers.push(
        `Partial migration graph: children in ${child.collection} without allow-listed Initiative roots`,
      );
    }
  }

  const collisionVerdict: PreflightVerdict = blockers.length === 0 ? "PASS" : "FAIL";

  return {
    tool: "preflight-production-initiative-migration-collisions",
    mode: "read-only",
    database: input.databaseName,
    initiativeCollisions,
    childCollisions,
    identityChecks,
    membershipCollisions,
    memberNumberCollisions,
    badgeOrderCollisions,
    blockers,
    collisionVerdict,
    writePathPresent: false,
  };
}

/** Pure helper for unit tests: root collision fails closed. */
export function evaluateRootCollisionVerdict(
  presentById: Record<string, boolean>,
): PreflightVerdict {
  return Object.values(presentById).some(Boolean) ? "FAIL" : "PASS";
}

export function evaluatePartialChildCollision(input: {
  rootsPresent: boolean;
  childHits: number;
}): PreflightVerdict {
  if (input.childHits > 0) return "FAIL";
  if (input.rootsPresent) return "FAIL";
  return "PASS";
}

export type { Document };

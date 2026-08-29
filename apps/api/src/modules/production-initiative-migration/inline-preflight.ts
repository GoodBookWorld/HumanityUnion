import type { Db, Document } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { assertSourceIntraBatchPrimaryIdentitiesUnique } from "./civic-inventory.js";
import {
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
} from "./constants.js";
import { ProductionInitiativeMigrationError } from "./errors.js";

export interface InlineExecutionPreflightResult {
  sourceDatabase: string;
  destinationDatabase: string;
  allowList: string[];
  sourceRootsPresent: number;
  destinationRootsAbsent: number;
  identityGraphsOk: number;
  destinationMembershipCollisions: number;
  plannedCivicChildren: number;
  intraBatchPrimaryCollisionCheck: "PASS" | "FAIL";
  verdict: "PASS" | "FAIL";
  blockers: string[];
  checkedAt: string;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Immediate read-only authorization checks bound to the exact dual DB handles
 * and the canonical 9-ID allow-list. Replaces stale env-flag-only gates.
 */
export async function runInlineExecutionPreflight(input: {
  sourceDb: Db;
  destinationDb: Db;
  sourceDatabase: string;
  destinationDatabase: string;
}): Promise<InlineExecutionPreflightResult> {
  const blockers: string[] = [];
  const allowList = [...CANONICAL_PRODUCTION_INITIATIVE_IDS];
  const checkedAt = new Date().toISOString();

  let sourceRootsPresent = 0;
  let destinationRootsAbsent = 0;

  for (const initiativeId of allowList) {
    const source = await input.sourceDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
      $or: [
        { _id: initiativeId as unknown as string },
        { initiativeId },
      ],
    } as Document);
    if (!source) {
      blockers.push(`Source missing Initiative root ${initiativeId}`);
    } else {
      sourceRootsPresent += 1;
      const storedId = asString(source.initiativeId) ?? asString(source._id);
      if (storedId !== initiativeId) {
        blockers.push(`Source Initiative id mismatch for ${initiativeId}`);
      }
    }

    const dest = await input.destinationDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
      $or: [
        { _id: initiativeId as unknown as string },
        { initiativeId },
      ],
    } as Document);
    if (dest) {
      blockers.push(`Destination already has Initiative root ${initiativeId}`);
    } else {
      destinationRootsAbsent += 1;
    }
  }

  let identityGraphsOk = 0;
  for (const participant of APPROVED_PRODUCTION_PARTICIPANTS) {
    const auth = await input.destinationDb.collection(MONGO_COLLECTIONS.authUsers).findOne({
      memberId: participant.memberId,
    });
    const member = await input.destinationDb.collection(MONGO_COLLECTIONS.members).findOne({
      memberId: participant.memberId,
    });
    const profile = await input.destinationDb.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
      profileId: participant.profileId,
    });
    if (!auth || !member || !profile) {
      blockers.push(`Destination identity graph incomplete: ${participant.label}`);
      continue;
    }
    if (asString(auth.role) !== participant.authRole) {
      blockers.push(`Destination auth.role mismatch: ${participant.label}`);
      continue;
    }
    if (
      !Array.isArray(member.roles) ||
      member.roles.length !== 1 ||
      member.roles[0] !== "member"
    ) {
      blockers.push(`Destination members.roles mismatch: ${participant.label}`);
      continue;
    }
    identityGraphsOk += 1;
  }

  let destinationMembershipCollisions = 0;
  for (const participant of APPROVED_PRODUCTION_PARTICIPANTS) {
    const membership = await input.destinationDb.collection(MONGO_COLLECTIONS.memberships).findOne({
      userId: participant.userId,
    });
    if (membership) {
      destinationMembershipCollisions += 1;
      blockers.push(
        `Destination membership collision for ${participant.label} (userId present)`,
      );
    }
  }

  let plannedCivicChildren = 0;
  let intraBatchPrimaryCollisionCheck: "PASS" | "FAIL" = "FAIL";
  try {
    const intra = await assertSourceIntraBatchPrimaryIdentitiesUnique(input.sourceDb);
    plannedCivicChildren = intra.plannedCount;
    intraBatchPrimaryCollisionCheck = "PASS";
  } catch (error) {
    intraBatchPrimaryCollisionCheck = "FAIL";
    blockers.push(
      error instanceof Error ? error.message : `Intra-batch primary collision: ${String(error)}`,
    );
  }

  const verdict =
    blockers.length === 0 &&
    sourceRootsPresent === 9 &&
    destinationRootsAbsent === 9 &&
    identityGraphsOk === 5 &&
    intraBatchPrimaryCollisionCheck === "PASS"
      ? "PASS"
      : "FAIL";

  if (verdict === "FAIL" && blockers.length === 0) {
    blockers.push("Inline execution preflight failed closed");
  }

  return {
    sourceDatabase: input.sourceDatabase,
    destinationDatabase: input.destinationDatabase,
    allowList,
    sourceRootsPresent,
    destinationRootsAbsent,
    identityGraphsOk,
    destinationMembershipCollisions,
    plannedCivicChildren,
    intraBatchPrimaryCollisionCheck,
    verdict,
    blockers,
    checkedAt,
  };
}

export function assertInlineExecutionPreflightPass(
  result: InlineExecutionPreflightResult,
): void {
  if (result.verdict !== "PASS") {
    throw new ProductionInitiativeMigrationError(
      `Inline execution preflight FAIL: ${result.blockers.slice(0, 5).join(" | ")}`,
      "INLINE_PREFLIGHT_FAIL",
    );
  }
}

import type { PlatformCapabilityGrant, PlatformCapabilityId } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";

interface PlatformCapabilityGrantMongoDocument extends PlatformCapabilityGrant {
  _id?: string;
}

const memoryGrants: PlatformCapabilityGrant[] = [];

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<PlatformCapabilityGrantMongoDocument>(
    MONGO_COLLECTIONS.platformCapabilityGrants,
  );
}

function fromDoc(doc: PlatformCapabilityGrantMongoDocument): PlatformCapabilityGrant {
  const { _id: _ignored, ...grant } = doc;
  return { ...grant };
}

export async function insertPlatformCapabilityGrant(
  grant: PlatformCapabilityGrant,
): Promise<PlatformCapabilityGrant> {
  await ensureReady();
  if (!isMongoConfigured()) {
    memoryGrants.push({ ...grant });
    return { ...grant };
  }
  await collection().insertOne({ ...grant });
  return { ...grant };
}

export async function replacePlatformCapabilityGrant(
  grant: PlatformCapabilityGrant,
): Promise<void> {
  await ensureReady();
  if (!isMongoConfigured()) {
    const index = memoryGrants.findIndex((entry) => entry.grantId === grant.grantId);
    if (index >= 0) {
      memoryGrants[index] = { ...grant };
    } else {
      memoryGrants.push({ ...grant });
    }
    return;
  }
  await collection().replaceOne({ grantId: grant.grantId }, { ...grant }, { upsert: true });
}

/** Active (non-revoked, non-expired) grants for a Participant — dual-read source. */
export async function listActivePlatformCapabilityGrants(
  participantId: string,
): Promise<PlatformCapabilityGrant[]> {
  await ensureReady();
  const now = Date.now();

  const isActive = (grant: PlatformCapabilityGrant): boolean => {
    if (grant.revokedAt) {
      return false;
    }
    if (grant.expiresAt && Date.parse(grant.expiresAt) <= now) {
      return false;
    }
    return true;
  };

  if (!isMongoConfigured()) {
    return memoryGrants
      .filter((grant) => grant.participantId === participantId && isActive(grant))
      .map((grant) => ({ ...grant }));
  }

  const docs = await collection().find({ participantId, revokedAt: { $exists: false } }).toArray();
  return docs.map(fromDoc).filter(isActive);
}

export async function collectActivePlatformCapabilityIds(
  participantId: string,
): Promise<Set<PlatformCapabilityId>> {
  const grants = await listActivePlatformCapabilityGrants(participantId);
  const ids = new Set<PlatformCapabilityId>();
  for (const grant of grants) {
    ids.add(grant.capability);
  }
  return ids;
}

export function resetPlatformCapabilityGrantsMemoryForTests(): void {
  memoryGrants.length = 0;
}

export async function deletePlatformCapabilityGrantsByParticipantIdsForTests(
  participantIds: readonly string[],
): Promise<void> {
  if (participantIds.length === 0) {
    return;
  }
  const idSet = new Set(participantIds);
  for (let index = memoryGrants.length - 1; index >= 0; index -= 1) {
    if (idSet.has(memoryGrants[index]!.participantId)) {
      memoryGrants.splice(index, 1);
    }
  }
  if (!isMongoConfigured()) {
    return;
  }
  await ensureReady();
  await collection().deleteMany({ participantId: { $in: [...participantIds] } });
}

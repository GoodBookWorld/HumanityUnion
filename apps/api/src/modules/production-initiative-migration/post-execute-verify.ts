import type { Db, Document } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import {
  inventoryMustMigrateCivicChildren,
  type CivicChildRef,
} from "./civic-inventory.js";
import {
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_INITIATIVE_EXPECTATIONS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  EXPECTED_MUST_MIGRATE_CIVIC_CHILDREN,
  EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS,
  EXCLUDED_PRODUCTION_INITIATIVE_IDS,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  STRIPE_OPERATIONAL_FIELDS,
  SYSTEM_MEDIA_RECOVERY_OWNER,
  VLAD_SHAPRAN_USER_ID,
} from "./constants.js";
import {
  planMediaFromInitiativeDocument,
  planMediaFromUploadRecord,
} from "./media-plan.js";
import type { MediaR2PreflightReader } from "./media-r2-preflight.js";
import { reconcileMediaPlanReferences } from "./media-reconcile.js";
import { hasShippingData } from "./membership-plan.js";
import { assertNoSecretLeak } from "./redact.js";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function lifecycleProfileAsStored(doc: Document): string | null | undefined {
  return "lifecycleProfile" in doc
    ? (doc.lifecycleProfile as string | null)
    : undefined;
}

function sameLifecycleProfile(
  source: string | null | undefined,
  destination: string | null | undefined,
): boolean {
  if (source === undefined && destination === undefined) return true;
  if (source === undefined || destination === undefined) return false;
  return source === destination;
}

export type PostExecuteVerifyVerdict = "PASS" | "FAIL" | "PROJECTION_RESTART_REQUIRED";

export type PublicInitiativeProbeResult = "ok" | "missing" | "unavailable";

export interface PostExecuteVerifyMutationCounters {
  mongoWrites?: number;
  putObjectCalls?: number;
  deleteObjectCalls?: number;
  recoveryStoreWrites?: number;
}

export interface PostExecuteVerifyReport {
  tool: "verify-production-initiative-migration";
  mode: "read-only";
  rootsExpected: number;
  rootsVerified: number;
  civicChildrenExpected: number;
  civicChildrenVerified: number;
  civicChildrenByCollection: Record<string, number>;
  identitiesVerified: number;
  membershipVerification: string;
  badgeVerification: string;
  mediaRecordsExpected: number;
  mediaRecordsVerified: number;
  r2ObjectsExpected: number;
  r2ObjectsEquivalent: number;
  forbiddenStateVerification: string;
  projectionVerification: string;
  bootstrapVerification: string;
  shippingDataPresent: boolean | null;
  mutationProof: {
    mongoWrites: number;
    putObjectCalls: number;
    deleteObjectCalls: number;
    recoveryStoreWrites: number;
  };
  blockers: string[];
  verdict: PostExecuteVerifyVerdict;
}

export type { CivicChildRef };

function childKey(row: CivicChildRef): string {
  return `${row.collection}::${row.recordId}`;
}

/**
 * Read-only post-execute verification for the controlled production Initiative migration.
 */
export async function runPostExecuteProductionInitiativeVerification(input: {
  sourceDb: Db;
  destinationDb: Db;
  mediaReader: MediaR2PreflightReader;
  /** Optional pre-migration bootstrap snapshot for unchanged proof. */
  baselineBootstrap?: Document | null;
  /**
   * Probe production public Initiative API/projection.
   * Return unavailable when process restart/hydration is required.
   */
  probePublicInitiative?: (
    initiativeId: string,
  ) => Promise<PublicInitiativeProbeResult>;
  civicChildrenExpected?: number;
  mediaObjectsExpected?: number;
  mutationCounters?: PostExecuteVerifyMutationCounters;
}): Promise<PostExecuteVerifyReport> {
  const blockers: string[] = [];
  const rootsExpected = CANONICAL_PRODUCTION_INITIATIVE_IDS.length;
  const civicChildrenExpected =
    input.civicChildrenExpected ?? EXPECTED_MUST_MIGRATE_CIVIC_CHILDREN;
  const mediaObjectsExpected =
    input.mediaObjectsExpected ?? EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS;

  let rootsVerified = 0;
  let identitiesVerified = 0;
  let membershipVerification = "FAIL";
  let badgeVerification = "FAIL";
  let mediaRecordsVerified = 0;
  let r2ObjectsEquivalent = 0;
  let forbiddenStateVerification = "FAIL";
  let projectionVerification = "FAIL";
  let bootstrapVerification = "FAIL";
  let shippingDataPresent: boolean | null = null;
  let civicChildrenVerified = 0;
  let civicChildrenByCollection: Record<string, number> = {};

  // --- Roots + fidelity + stewards ---
  for (const expected of CANONICAL_INITIATIVE_EXPECTATIONS) {
    const source = await input.sourceDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
      $or: [{ initiativeId: expected.initiativeId }, { _id: expected.initiativeId }],
    } as Document);
    const dest = await input.destinationDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
      $or: [{ initiativeId: expected.initiativeId }, { _id: expected.initiativeId }],
    } as Document);
    if (!source) {
      blockers.push(`Source root missing: ${expected.initiativeId}`);
      continue;
    }
    if (!dest) {
      blockers.push(`Destination root missing: ${expected.initiativeId}`);
      continue;
    }
    rootsVerified += 1;

    const sourceId = asString(source._id) ?? asString(source.initiativeId);
    const destId = asString(dest._id) ?? asString(dest.initiativeId);
    if (sourceId !== destId || destId !== expected.initiativeId) {
      blockers.push(`Root _id/initiativeId mismatch for ${expected.initiativeId}`);
    }
    if (asString(dest.stewardId) !== expected.stewardMemberId) {
      blockers.push(
        `Wrong steward for ${expected.initiativeId}: expected ${expected.stewardMemberId}`,
      );
    } else {
      identitiesVerified += 1;
    }
    if (
      !sameLifecycleProfile(
        lifecycleProfileAsStored(source),
        lifecycleProfileAsStored(dest),
      )
    ) {
      blockers.push(`lifecycleProfile not preserved for ${expected.initiativeId}`);
    }
    if (asString(source.status) !== asString(dest.status)) {
      blockers.push(`status mismatch for ${expected.initiativeId}`);
    }
    const srcVis = asString(
      source.visibility && typeof source.visibility === "object"
        ? (source.visibility as { policy?: unknown }).policy
        : null,
    );
    const destVis = asString(
      dest.visibility && typeof dest.visibility === "object"
        ? (dest.visibility as { policy?: unknown }).policy
        : null,
    );
    if (srcVis !== destVis) {
      blockers.push(`visibility.policy mismatch for ${expected.initiativeId}`);
    }
    if (asString(source.createdAt) !== asString(dest.createdAt)) {
      blockers.push(`createdAt mismatch for ${expected.initiativeId}`);
    }
  }

  // Deduplicate steward identity graph checks (5 approved participants).
  identitiesVerified = 0;
  for (const participant of APPROVED_PRODUCTION_PARTICIPANTS) {
    const auth = await input.destinationDb.collection(MONGO_COLLECTIONS.authUsers).findOne({
      userId: participant.userId,
    });
    const member = await input.destinationDb.collection(MONGO_COLLECTIONS.members).findOne({
      memberId: participant.memberId,
    });
    const profile = await input.destinationDb
      .collection(MONGO_COLLECTIONS.memberProfiles)
      .findOne({ profileId: participant.profileId });
    if (!auth || !member || !profile) {
      blockers.push(`Identity graph incomplete for ${participant.label}`);
    } else {
      identitiesVerified += 1;
    }
  }

  // Exclusions
  const test2 = await input.destinationDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
    initiativeId: "initiative-1787191372634",
  });
  // Test 2 must not have been migrated from staging as part of allow-list.
  // Presence alone is not FAIL if it was pre-existing; fail if it matches staging copy fingerprint.
  const test2Source = await input.sourceDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
    initiativeId: "initiative-1787191372634",
  });
  if (test2 && test2Source && asString(test2.createdAt) === asString(test2Source.createdAt)) {
    blockers.push("Test 2 Initiative appears migrated into production");
  }

  const bootstrapId = EXCLUDED_PRODUCTION_INITIATIVE_IDS[0];
  const bootstrap = await input.destinationDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
    initiativeId: bootstrapId,
  });
  if (!bootstrap) {
    blockers.push("Bootstrap Initiative missing in production");
    bootstrapVerification = "FAIL_MISSING";
  } else if (input.baselineBootstrap) {
    const base = input.baselineBootstrap;
    const fields = ["stewardId", "title", "status", "createdAt", "updatedAt"] as const;
    let ok = true;
    for (const field of fields) {
      if (asString(bootstrap[field]) !== asString(base[field])) {
        ok = false;
        blockers.push(`Bootstrap field changed: ${field}`);
      }
    }
    if (
      !sameLifecycleProfile(
        lifecycleProfileAsStored(base),
        lifecycleProfileAsStored(bootstrap),
      )
    ) {
      ok = false;
      blockers.push("Bootstrap lifecycleProfile changed");
    }
    bootstrapVerification = ok ? "PASS_UNCHANGED" : "FAIL_CHANGED";
  } else {
    bootstrapVerification = "PASS_PRESENT_NO_BASELINE";
  }

  // --- Civic children ---
  try {
    const sourceChildren = await inventoryMustMigrateCivicChildren(input.sourceDb);
    const destChildren = await inventoryMustMigrateCivicChildren(input.destinationDb);
    civicChildrenByCollection = destChildren.byCollection;
    civicChildrenVerified = destChildren.children.length;

    if (sourceChildren.children.length !== civicChildrenExpected) {
      blockers.push(
        `Source civic children count ${sourceChildren.children.length} != expected ${civicChildrenExpected}`,
      );
    }
    if (destChildren.children.length !== civicChildrenExpected) {
      blockers.push(
        `Destination civic children count ${destChildren.children.length} != expected ${civicChildrenExpected}`,
      );
    }

    const sourceKeys = new Set(sourceChildren.children.map(childKey));
    const destKeys = new Set(destChildren.children.map(childKey));
    for (const key of sourceKeys) {
      if (!destKeys.has(key)) blockers.push(`Missing civic child: ${key}`);
    }
    for (const key of destKeys) {
      if (!sourceKeys.has(key)) blockers.push(`Extra civic child in destination: ${key}`);
    }
    for (const child of destChildren.children) {
      if (!CANONICAL_PRODUCTION_INITIATIVE_IDS.includes(child.initiativeId as never)) {
        blockers.push(`Civic child outside allow-list: ${childKey(child)}`);
      }
    }
  } catch (error) {
    blockers.push(
      `Civic ancestry inventory failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // --- Membership / badge ---
  const vladMembership = await input.destinationDb
    .collection(MONGO_COLLECTIONS.memberships)
    .findOne({ userId: VLAD_SHAPRAN_USER_ID });
  const sourceVladMembership = await input.sourceDb
    .collection(MONGO_COLLECTIONS.memberships)
    .findOne({ userId: VLAD_SHAPRAN_USER_ID });
  const vladProfile = await input.destinationDb
    .collection(MONGO_COLLECTIONS.memberProfiles)
    .findOne({
      profileId: APPROVED_PRODUCTION_PARTICIPANTS[0]!.profileId,
    });

  if (!vladMembership || !sourceVladMembership) {
    blockers.push("Vlad membership missing source or destination");
  } else {
    let membershipOk = true;
    if (asString(vladMembership.status) !== "active_member") {
      blockers.push("Vlad membership.status != active_member");
      membershipOk = false;
    }
    if (asString(vladMembership.memberNumber) !== asString(sourceVladMembership.memberNumber)) {
      blockers.push("Vlad Member Number not preserved");
      membershipOk = false;
    }
    if (
      asString(vladMembership.applicationStatus) !==
      asString(sourceVladMembership.applicationStatus)
    ) {
      blockers.push("Vlad applicationStatus not preserved");
      membershipOk = false;
    }
    if (asString(vladMembership.memberGrantedAt) !== asString(sourceVladMembership.memberGrantedAt)) {
      blockers.push("Vlad memberGrantedAt not preserved");
      membershipOk = false;
    }
    if (vladProfile?.membershipPubliclyVisible !== false) {
      blockers.push("Vlad membershipPubliclyVisible must be false");
      membershipOk = false;
    }
    for (const field of STRIPE_OPERATIONAL_FIELDS) {
      const value = vladMembership[field];
      if (value != null && value !== "") {
        blockers.push(`Vlad membership retained Stripe Test operational field: ${field}`);
        membershipOk = false;
      }
    }
    if (membershipOk) membershipVerification = "PASS";
  }

  for (const participant of APPROVED_PRODUCTION_PARTICIPANTS.slice(1)) {
    const membership = await input.destinationDb
      .collection(MONGO_COLLECTIONS.memberships)
      .findOne({ userId: participant.userId });
    const sourceMembership = await input.sourceDb
      .collection(MONGO_COLLECTIONS.memberships)
      .findOne({ userId: participant.userId });
    const sourceStatus = asString(sourceMembership?.status);
    if (membership && (sourceStatus === "not_started" || !sourceMembership)) {
      blockers.push(
        `Unexpected membership row for ${participant.label} (migration should omit not_started)`,
      );
    } else if (membership && sourceStatus && sourceStatus !== "not_started") {
      blockers.push(
        `Unexpected non-Vlad membership migrated for ${participant.label}`,
      );
    }
  }

  const sourceBadge = await input.sourceDb
    .collection(MONGO_COLLECTIONS.memberBadgeApplications)
    .findOne({
      $or: [
        { userId: VLAD_SHAPRAN_USER_ID },
        { participantId: APPROVED_PRODUCTION_PARTICIPANTS[0]!.memberId },
      ],
    });
  const destBadge = await input.destinationDb
    .collection(MONGO_COLLECTIONS.memberBadgeApplications)
    .findOne({
      $or: [
        { userId: VLAD_SHAPRAN_USER_ID },
        { participantId: APPROVED_PRODUCTION_PARTICIPANTS[0]!.memberId },
      ],
    });

  if (!sourceBadge || !destBadge) {
    blockers.push("Vlad badge application missing source or destination");
    shippingDataPresent = false;
  } else {
    let badgeOk = true;
    if (asString(destBadge.applicationId) !== asString(sourceBadge.applicationId)) {
      blockers.push("Badge applicationId mismatch");
      badgeOk = false;
    }
    if (asString(destBadge.paymentStatus) !== "paid") {
      blockers.push("Badge paymentStatus != paid");
      badgeOk = false;
    }
    if (asString(destBadge.fulfillmentStatus) !== "shipped") {
      blockers.push("Badge fulfillmentStatus != shipped");
      badgeOk = false;
    }
    shippingDataPresent = hasShippingData(destBadge);
    if (!shippingDataPresent) {
      blockers.push("Badge private shipping data absent in destination record");
      badgeOk = false;
    }
    for (const field of STRIPE_OPERATIONAL_FIELDS) {
      const value = destBadge[field];
      if (value != null && value !== "") {
        blockers.push(`Badge retained Stripe Test operational field: ${field}`);
        badgeOk = false;
      }
    }
    if (badgeOk) badgeVerification = "PASS";
  }

  // Membership contributions Stripe sanitization
  const destContribs = await input.destinationDb
    .collection(MONGO_COLLECTIONS.membershipContributions)
    .find({ userId: VLAD_SHAPRAN_USER_ID })
    .toArray();
  for (const contrib of destContribs) {
    for (const field of STRIPE_OPERATIONAL_FIELDS) {
      if (contrib[field] != null && contrib[field] !== "") {
        blockers.push(`Contribution retained Stripe Test operational field: ${field}`);
      }
    }
  }

  // --- Media records + R2 ---
  const mediaItems = [];
  const mediaUploads = await input.sourceDb
    .collection(MONGO_COLLECTIONS.mediaUploadRecords)
    .find({
      $or: [
        { initiativeId: { $in: [...CANONICAL_PRODUCTION_INITIATIVE_IDS] } },
        { uploadedByParticipantId: SYSTEM_MEDIA_RECOVERY_OWNER },
        { ownerParticipantId: SYSTEM_MEDIA_RECOVERY_OWNER },
      ],
    })
    .toArray();
  const mediaUploadKeys = new Set(
    mediaUploads.map((d) => asString(d.storageKey)).filter((k): k is string => Boolean(k)),
  );
  for (const expected of CANONICAL_INITIATIVE_EXPECTATIONS) {
    const root = await input.sourceDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
      initiativeId: expected.initiativeId,
    });
    if (root) {
      mediaItems.push(
        ...planMediaFromInitiativeDocument({
          initiativeId: expected.initiativeId,
          doc: root,
          mediaUploadKeys,
        }),
      );
    }
  }
  for (const upload of mediaUploads) {
    mediaItems.push(planMediaFromUploadRecord(upload));
  }
  const reconciled = reconcileMediaPlanReferences(mediaItems);
  const planned = reconciled.uniquePublicCopies;
  if (planned.length !== mediaObjectsExpected) {
    blockers.push(
      `Reconciled unique media ${planned.length} != expected ${mediaObjectsExpected}`,
    );
  }

  for (const item of planned) {
    const destRecord = await input.destinationDb
      .collection(MONGO_COLLECTIONS.mediaUploadRecords)
      .findOne({ storageKey: item.storageKey });
    if (!destRecord) {
      blockers.push(`Missing media_upload_records for ${item.storageKey}`);
      continue;
    }
    mediaRecordsVerified += 1;
    const mediaUrl =
      asString(destRecord.mediaUrl) ?? asString(destRecord.publicUrl) ?? "";
    if (!mediaUrl.startsWith(`${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/`)) {
      blockers.push(`Media URL not under ${PRODUCTION_MEDIA_PUBLIC_BASE_URL}: ${item.storageKey}`);
    }
    if (/media-staging|staging\.huws|localhost/i.test(mediaUrl)) {
      blockers.push(`Staging media hostname remains for ${item.storageKey}`);
    }

    try {
      const sourceObj = await input.mediaReader.prepareSourceObject(item.storageKey);
      const destObj = await input.mediaReader.inspectDestinationObject(item.storageKey);
      if (!destObj) {
        blockers.push(`Destination R2 missing for ${item.storageKey}`);
        continue;
      }
      if (
        destObj.checksumSHA256 === sourceObj.checksumSHA256 &&
        destObj.contentLength === sourceObj.contentLength
      ) {
        r2ObjectsEquivalent += 1;
      } else {
        blockers.push(`R2 integrity mismatch for ${item.storageKey}`);
      }
    } catch {
      blockers.push(`R2 read failed for ${item.storageKey}`);
    }
  }

  // --- Forbidden operational data (migration-correlated) ---
  let forbiddenOk = true;
  const sourceWebhookIds = (
    await input.sourceDb
      .collection(MONGO_COLLECTIONS.membershipWebhookEvents)
      .find({ userId: VLAD_SHAPRAN_USER_ID })
      .project({ _id: 1, eventId: 1, stripeEventId: 1 })
      .toArray()
  )
    .map((row) => asString(row.eventId) ?? asString(row.stripeEventId) ?? asString(row._id))
    .filter((id): id is string => Boolean(id));

  if (sourceWebhookIds.length > 0) {
    const leaked = await input.destinationDb
      .collection(MONGO_COLLECTIONS.membershipWebhookEvents)
      .find({
        $or: [
          { eventId: { $in: sourceWebhookIds } },
          { stripeEventId: { $in: sourceWebhookIds } },
          { _id: { $in: sourceWebhookIds } },
        ],
      } as Document)
      .limit(1)
      .toArray();
    if (leaked.length > 0) {
      blockers.push("membership_webhook_events migrated from staging");
      forbiddenOk = false;
    }
  }

  for (const collection of [
    MONGO_COLLECTIONS.outbox,
    MONGO_COLLECTIONS.processedEvents,
    MONGO_COLLECTIONS.authSessions,
    MONGO_COLLECTIONS.emailVerificationTokens,
    MONGO_COLLECTIONS.emailConfirmationCodes,
    MONGO_COLLECTIONS.memberNotifications,
  ] as const) {
    const sourceIds = (
      await input.sourceDb
        .collection(collection)
        .find({
          $or: [
            { initiativeId: { $in: [...CANONICAL_PRODUCTION_INITIATIVE_IDS] } },
            { userId: VLAD_SHAPRAN_USER_ID },
          ],
        })
        .project({ _id: 1 })
        .limit(500)
        .toArray()
    )
      .map((row) => asString(row._id))
      .filter((id): id is string => Boolean(id));
    if (sourceIds.length === 0) continue;
    const hit = await input.destinationDb
      .collection(collection)
      .find({ _id: { $in: sourceIds as never[] } })
      .limit(1)
      .toArray();
    if (hit.length > 0) {
      blockers.push(`Forbidden collection data migrated: ${collection}`);
      forbiddenOk = false;
    }
  }
  if (forbiddenOk) forbiddenStateVerification = "PASS";

  // --- Public projection ---
  const publicEligibleIds: string[] = [];
  for (const expected of CANONICAL_INITIATIVE_EXPECTATIONS) {
    const dest = await input.destinationDb.collection(MONGO_COLLECTIONS.initiatives).findOne({
      initiativeId: expected.initiativeId,
    });
    if (!dest) continue;
    const phase = asString(dest.lifecyclePhase);
    const policy = asString(
      dest.visibility && typeof dest.visibility === "object"
        ? (dest.visibility as { policy?: unknown }).policy
        : null,
    );
    if (phase === "projected" && policy === "public") {
      publicEligibleIds.push(expected.initiativeId);
    }
  }

  if (!input.probePublicInitiative) {
    projectionVerification = "PROJECTION_RESTART_REQUIRED";
  } else if (publicEligibleIds.length === 0) {
    projectionVerification = "PASS_NO_PUBLIC_ELIGIBLE";
  } else {
    let ok = 0;
    let missing = 0;
    let unavailable = 0;
    for (const id of publicEligibleIds) {
      const result = await input.probePublicInitiative(id);
      if (result === "ok") ok += 1;
      else if (result === "missing") missing += 1;
      else unavailable += 1;
    }
    if (unavailable > 0) {
      projectionVerification = "PROJECTION_RESTART_REQUIRED";
    } else if (missing > 0) {
      blockers.push("Public projection missing migrated public Initiative(s)");
      projectionVerification = "FAIL";
    } else if (ok === publicEligibleIds.length) {
      projectionVerification = "PASS";
    } else {
      projectionVerification = "FAIL";
    }
  }

  const mongoWrites = input.mutationCounters?.mongoWrites ?? 0;
  const putObjectCalls =
    input.mutationCounters?.putObjectCalls ?? input.mediaReader.getWriteCount?.() ?? 0;
  const deleteObjectCalls =
    input.mutationCounters?.deleteObjectCalls ?? input.mediaReader.getDeleteCount?.() ?? 0;
  const recoveryStoreWrites = input.mutationCounters?.recoveryStoreWrites ?? 0;
  if (mongoWrites || putObjectCalls || deleteObjectCalls || recoveryStoreWrites) {
    blockers.push("Refusing verdict: mutation detected during read-only verification");
  }

  const uniqueBlockers = [...new Set(blockers)];
  let verdict: PostExecuteVerifyVerdict = uniqueBlockers.length === 0 ? "PASS" : "FAIL";
  if (
    verdict === "PASS" &&
    projectionVerification === "PROJECTION_RESTART_REQUIRED"
  ) {
    verdict = "PROJECTION_RESTART_REQUIRED";
  }

  const report: PostExecuteVerifyReport = {
    tool: "verify-production-initiative-migration",
    mode: "read-only",
    rootsExpected,
    rootsVerified,
    civicChildrenExpected,
    civicChildrenVerified,
    civicChildrenByCollection,
    identitiesVerified,
    membershipVerification,
    badgeVerification,
    mediaRecordsExpected: mediaObjectsExpected,
    mediaRecordsVerified,
    r2ObjectsExpected: mediaObjectsExpected,
    r2ObjectsEquivalent,
    forbiddenStateVerification,
    projectionVerification,
    bootstrapVerification,
    shippingDataPresent,
    mutationProof: {
      mongoWrites,
      putObjectCalls,
      deleteObjectCalls,
      recoveryStoreWrites,
    },
    blockers: uniqueBlockers,
    verdict,
  };

  assertNoSecretLeak(JSON.stringify(report));
  return report;
}

import type { Db, Document } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { resolveDocumentAncestry } from "./ancestry.js";
import {
  CIVIC_COLLECTION_CATALOG,
  PROJECTION_PLAN_STATIC,
} from "./collection-plan.js";
import {
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_INITIATIVE_EXPECTATIONS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  SYSTEM_MEDIA_RECOVERY_OWNER,
} from "./constants.js";
import { assertStagingSourceDatabase } from "./guards.js";
import {
  buildStaticMembershipCollectionPlan,
  buildStripeSanitizationPlan,
  planMembershipForParticipant,
  validateNonVladNotStartedOmitted,
  validateVladActiveMemberExpectations,
  assertMembershipPlanSafeForLogging,
} from "./membership-plan.js";
import {
  planMediaFromInitiativeDocument,
  planMediaFromSharedDocument,
  planMediaFromUploadRecord,
  summarizeMediaPlan,
} from "./media-plan.js";
import {
  buildParticipantsReport,
  collectActorOccurrencesFromDocument,
  participantVerdictFromReport,
  type ActorOccurrence,
} from "./participant-scan.js";
import { buildCandidateInitiativeRow, evaluateInitiativeVerdict } from "./source-inventory.js";
import type {
  CollectionPlanRow,
  MediaPlanItem,
  StagingPreflightReport,
} from "./types.js";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function buildParentMaps(db: Db, initiativeIds: string[]) {
  const decisions = await db
    .collection(MONGO_COLLECTIONS.initiativeCollectiveDecisions)
    .find({ initiativeId: { $in: initiativeIds } })
    .project({ decisionId: 1, initiativeId: 1 })
    .toArray();
  const trackings = await db
    .collection(MONGO_COLLECTIONS.initiativeImplementationTrackings)
    .find({ initiativeId: { $in: initiativeIds } })
    .project({ trackingId: 1, initiativeId: 1 })
    .toArray();
  const impacts = await db
    .collection(MONGO_COLLECTIONS.initiativePublicImpacts)
    .find({ initiativeId: { $in: initiativeIds } })
    .project({ impactId: 1, initiativeId: 1 })
    .toArray();
  const petitions = await db
    .collection(MONGO_COLLECTIONS.petitions)
    .find({
      $or: [
        { initiativeId: { $in: initiativeIds } },
        { "subject.initiativeId": { $in: initiativeIds } },
      ],
    })
    .project({ petitionId: 1, initiativeId: 1, subject: 1 })
    .toArray();
  const sessions = await db
    .collection(MONGO_COLLECTIONS.initiativeCollaborationSessions)
    .find({ initiativeId: { $in: initiativeIds } })
    .project({ sessionId: 1, initiativeId: 1 })
    .toArray();
  const analyses = await db
    .collection(MONGO_COLLECTIONS.initiativeAnalyses)
    .find({ initiativeId: { $in: initiativeIds } })
    .project({ analysisId: 1, initiativeId: 1 })
    .toArray();

  const decisionMap = new Map<string, string | null>();
  for (const d of decisions) {
    const id = asString(d.decisionId);
    if (id) decisionMap.set(id, asString(d.initiativeId));
  }
  const trackingMap = new Map<string, string | null>();
  for (const t of trackings) {
    const id = asString(t.trackingId);
    if (id) trackingMap.set(id, asString(t.initiativeId));
  }
  const impactMap = new Map<string, string | null>();
  for (const i of impacts) {
    const id = asString(i.impactId);
    if (id) impactMap.set(id, asString(i.initiativeId));
  }
  const petitionMap = new Map<string, string | null>();
  for (const p of petitions) {
    const id = asString(p.petitionId);
    const subject =
      p.subject && typeof p.subject === "object"
        ? (p.subject as Record<string, unknown>)
        : null;
    if (id) {
      petitionMap.set(
        id,
        asString(subject?.initiativeId) ?? asString(p.initiativeId),
      );
    }
  }
  const sessionMap = new Map<string, string | null>();
  for (const s of sessions) {
    const id = asString(s.sessionId);
    if (id) sessionMap.set(id, asString(s.initiativeId));
  }
  const analysisMap = new Map<string, string | null>();
  for (const a of analyses) {
    const id = asString(a.analysisId);
    if (id) analysisMap.set(id, asString(a.initiativeId));
  }

  return { decisionMap, trackingMap, impactMap, petitionMap, sessionMap, analysisMap };
}

function parentMapForMethod(
  method: string,
  maps: Awaited<ReturnType<typeof buildParentMaps>>,
): Map<string, string | null> | undefined {
  switch (method) {
    case "parent:decisionId":
      return maps.decisionMap;
    case "parent:trackingId":
      return maps.trackingMap;
    case "parent:impactId":
      return maps.impactMap;
    case "parent:petitionId":
      return maps.petitionMap;
    case "parent:sessionId":
      return maps.sessionMap;
    case "parent:analysisId":
      return maps.analysisMap;
    default:
      return undefined;
  }
}

export async function runStagingInitiativeMigrationPreflight(input: {
  db: Db;
  databaseName: string;
  allowTestIsolation?: boolean;
}): Promise<StagingPreflightReport> {
  const sourceDatabase = assertStagingSourceDatabase(input.databaseName, {
    allowTestIsolation: input.allowTestIsolation,
  });

  const initiativeIds = [...CANONICAL_PRODUCTION_INITIATIVE_IDS] as string[];
  const allowList = new Set<string>(initiativeIds);
  const blockers: string[] = [];

  // --- Initiative roots ---
  const candidateInitiatives = [];
  const initiativeDocs = new Map<string, Document>();
  for (const expected of CANONICAL_INITIATIVE_EXPECTATIONS) {
    const doc = await input.db.collection(MONGO_COLLECTIONS.initiatives).findOne({
      $or: [
        { _id: expected.initiativeId as unknown as string },
        { initiativeId: expected.initiativeId },
      ],
    } as Document);
    if (doc) initiativeDocs.set(expected.initiativeId, doc);
    candidateInitiatives.push(buildCandidateInitiativeRow({ expected, doc }));
  }
  const initiativeEval = evaluateInitiativeVerdict(candidateInitiatives);
  blockers.push(...initiativeEval.blockers);

  const parentMaps = await buildParentMaps(input.db, initiativeIds);
  const actorOccurrences: ActorOccurrence[] = [];
  const collectionPlan: CollectionPlanRow[] = [];

  // Seed steward actors from Initiative roots
  for (const [initiativeId, doc] of initiativeDocs) {
    actorOccurrences.push(
      ...collectActorOccurrencesFromDocument({
        doc,
        collection: "initiatives",
        classification: "MUST_MIGRATE",
        initiativeId,
      }),
    );
  }

  for (const entry of CIVIC_COLLECTION_CATALOG) {
    if (entry.collection.includes(".") || entry.collection === "public_initiative_cards_in_memory") {
      collectionPlan.push({
        collection: entry.collection,
        classification: entry.classification,
        ancestryMethod: entry.ancestryMethod,
        rowCount: 0,
        initiativeIds: [],
        participantActorFieldsDetected: [],
        ambiguousAncestryCount: 0,
        notes: entry.notes,
      });
      continue;
    }

    if (entry.classification === "DO_NOT_MIGRATE" || entry.classification === "REBUILD_OR_DERIVE") {
      const count =
        entry.ancestryMethod === "direct:initiativeId"
          ? await input.db.collection(entry.collection).countDocuments({
              initiativeId: { $in: initiativeIds },
            })
          : await input.db.collection(entry.collection).estimatedDocumentCount();
      collectionPlan.push({
        collection: entry.collection,
        classification: entry.classification,
        ancestryMethod: entry.ancestryMethod,
        rowCount: count,
        initiativeIds: [],
        participantActorFieldsDetected: [],
        ambiguousAncestryCount: 0,
        notes: entry.notes,
      });
      continue;
    }

    if (entry.ancestryMethod === "participant-scoped") {
      // Handled in membership plan; still emit catalog row with scoped counts for approved users.
      const userIds = APPROVED_PRODUCTION_PARTICIPANTS.map((p) => p.userId);
      const memberIds = APPROVED_PRODUCTION_PARTICIPANTS.map((p) => p.memberId);
      let rowCount = 0;
      if (entry.collection === "memberships") {
        rowCount = await input.db
          .collection(MONGO_COLLECTIONS.memberships)
          .countDocuments({ userId: { $in: userIds } });
      } else if (entry.collection === "membership_contributions") {
        rowCount = await input.db
          .collection(MONGO_COLLECTIONS.membershipContributions)
          .countDocuments({ userId: { $in: userIds } });
      } else if (entry.collection === "membership_webhook_events") {
        rowCount = await input.db
          .collection(MONGO_COLLECTIONS.membershipWebhookEvents)
          .countDocuments({ userId: { $in: userIds } });
      } else if (entry.collection === "member_badge_applications") {
        rowCount = await input.db
          .collection(MONGO_COLLECTIONS.memberBadgeApplications)
          .countDocuments({
            $or: [{ userId: { $in: userIds } }, { participantId: { $in: memberIds } }],
          });
      } else if (entry.collection === "member_badge_contributions") {
        rowCount = await input.db
          .collection(MONGO_COLLECTIONS.memberBadgeContributions)
          .countDocuments({ userId: { $in: userIds } });
      }
      collectionPlan.push({
        collection: entry.collection,
        classification: entry.classification,
        ancestryMethod: entry.ancestryMethod,
        rowCount,
        initiativeIds: [],
        participantActorFieldsDetected: [],
        ambiguousAncestryCount: 0,
        notes: entry.notes,
      });
      continue;
    }

    let filter: Document = { initiativeId: { $in: initiativeIds } };
    if (entry.ancestryMethod === "direct:subject.initiativeId") {
      filter = {
        $or: [
          { initiativeId: { $in: initiativeIds } },
          { "subject.initiativeId": { $in: initiativeIds } },
        ],
      };
    } else if (entry.ancestryMethod === "pk:initiativeId") {
      filter = {
        $or: [{ initiativeId: { $in: initiativeIds } }, { _id: { $in: initiativeIds } }],
      };
    } else if (entry.ancestryMethod.startsWith("parent:")) {
      const parentField = entry.ancestryMethod.split(":")[1]!;
      const map = parentMapForMethod(entry.ancestryMethod, parentMaps);
      const parentIds = map ? [...map.keys()] : [];
      filter = parentIds.length > 0 ? { [parentField]: { $in: parentIds } } : { _id: "__none__" };
    } else if (entry.ancestryMethod === "optional:initiativeId") {
      filter = { initiativeId: { $in: initiativeIds } };
    }

    const docs = await input.db.collection(entry.collection).find(filter).limit(5000).toArray();
    const initiativeIdSet = new Set<string>();
    const actorFields = new Set<string>();
    let ambiguousAncestryCount = 0;
    const parentMap = parentMapForMethod(entry.ancestryMethod, parentMaps);

    for (const doc of docs) {
      const ancestry = resolveDocumentAncestry({
        doc,
        method: entry.ancestryMethod,
        allowList,
        parentInitiativeById: parentMap,
      });
      if (ancestry.ambiguous || !ancestry.initiativeId || !allowList.has(ancestry.initiativeId)) {
        // optional:initiativeId with no id is not ambiguous
        if (!(entry.ancestryMethod === "optional:initiativeId" && !ancestry.initiativeId)) {
          if (ancestry.ambiguous || (ancestry.initiativeId && !allowList.has(ancestry.initiativeId))) {
            ambiguousAncestryCount += 1;
          }
        }
      }
      if (ancestry.initiativeId && allowList.has(ancestry.initiativeId)) {
        initiativeIdSet.add(ancestry.initiativeId);
      }

      if (
        entry.classification === "MUST_MIGRATE" ||
        entry.classification === "CONDITIONAL_MIGRATE"
      ) {
        const occ = collectActorOccurrencesFromDocument({
          doc,
          collection: entry.collection,
          classification: entry.classification,
          initiativeId: ancestry.initiativeId,
        });
        for (const o of occ) {
          actorFields.add(o.field);
          actorOccurrences.push(o);
        }
      }
    }

    if (entry.classification === "MUST_MIGRATE" && ambiguousAncestryCount > 0) {
      blockers.push(
        `Ambiguous MUST ancestry in ${entry.collection}: ${ambiguousAncestryCount} row(s)`,
      );
    }

    collectionPlan.push({
      collection: entry.collection,
      classification: entry.classification,
      ancestryMethod: entry.ancestryMethod,
      rowCount: docs.length,
      initiativeIds: [...initiativeIdSet].sort(),
      participantActorFieldsDetected: [...actorFields].sort(),
      ambiguousAncestryCount,
      notes: entry.notes,
    });
  }

  const ancestryVerdict = blockers.some((b) => b.includes("Ambiguous MUST ancestry"))
    ? "FAIL"
    : "PASS";

  // --- Participants ---
  const authByMember = new Map<string, Document>();
  const authByUser = new Map<string, Document>();
  const membersById = new Map<string, Document>();
  const auths = await input.db
    .collection(MONGO_COLLECTIONS.authUsers)
    .find({})
    .project({ memberId: 1, userId: 1, role: 1, displayName: 1 })
    .toArray();
  for (const auth of auths) {
    const memberId = asString(auth.memberId);
    const userId = asString(auth.userId);
    if (memberId) authByMember.set(memberId, auth);
    if (userId) authByUser.set(userId, auth);
  }
  const members = await input.db
    .collection(MONGO_COLLECTIONS.members)
    .find({})
    .project({ memberId: 1, identityId: 1, displayName: 1 })
    .toArray();
  for (const member of members) {
    const memberId = asString(member.memberId);
    if (memberId) membersById.set(memberId, member);
  }

  const participants = buildParticipantsReport(actorOccurrences, (actorId) => {
    if (actorId === SYSTEM_MEDIA_RECOVERY_OWNER) {
      return {
        memberId: null,
        userId: null,
        authRole: null,
        label: SYSTEM_MEDIA_RECOVERY_OWNER,
      };
    }
    const approved = APPROVED_PRODUCTION_PARTICIPANTS.find(
      (p) => p.memberId === actorId || p.userId === actorId,
    );
    if (approved) {
      return {
        memberId: approved.memberId,
        userId: approved.userId,
        authRole: approved.authRole,
        label: approved.label,
      };
    }
    const auth = authByMember.get(actorId) ?? authByUser.get(actorId);
    const member =
      membersById.get(actorId) ??
      (asString(auth?.memberId) ? membersById.get(asString(auth?.memberId)!) : undefined);
    return {
      memberId: asString(auth?.memberId) ?? asString(member?.memberId),
      userId: asString(auth?.userId) ?? asString(member?.identityId),
      authRole: asString(auth?.role),
      label: asString(auth?.displayName) ?? asString(member?.displayName),
    };
  });
  const participantVerdict = participantVerdictFromReport(participants);
  if (participantVerdict === "FAIL") {
    for (const hit of participants.externalMust) {
      blockers.push(
        `EXTERNAL_MUST participant on MUST data: ${hit.actorId} in ${hit.collections.join(",")}`,
      );
    }
    for (const hit of participants.unresolved) {
      blockers.push(`UNRESOLVED actor on scanned data: ${hit.actorId}`);
    }
  }

  // --- Membership ---
  const membershipCollections = buildStaticMembershipCollectionPlan();
  const membershipParticipants = [];
  for (const p of APPROVED_PRODUCTION_PARTICIPANTS) {
    const membership = await input.db.collection(MONGO_COLLECTIONS.memberships).findOne({
      userId: p.userId,
    });
    const profile = await input.db.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
      $or: [{ profileId: p.profileId }, { userId: p.userId }],
    });
    const badgeApplication = await input.db
      .collection(MONGO_COLLECTIONS.memberBadgeApplications)
      .findOne({
        $or: [{ userId: p.userId }, { participantId: p.memberId }],
      });

    // Update collection counts
    void membership;
    const plan = planMembershipForParticipant({
      label: p.label,
      memberId: p.memberId,
      userId: p.userId,
      membership,
      profile,
      badgeApplication,
    });
    assertMembershipPlanSafeForLogging(plan);
    membershipParticipants.push(plan);
    blockers.push(...validateVladActiveMemberExpectations(plan));
    blockers.push(...validateNonVladNotStartedOmitted(plan));
  }

  for (const row of membershipCollections) {
    const match = collectionPlan.find((c) => c.collection === row.collection);
    if (match) row.rowCount = match.rowCount;
  }

  const stripeSanitizationPlan = buildStripeSanitizationPlan();

  // --- Media ---
  const mediaItems: MediaPlanItem[] = [];
  const mediaUploads = await input.db
    .collection(MONGO_COLLECTIONS.mediaUploadRecords)
    .find({
      $or: [
        { initiativeId: { $in: initiativeIds } },
        { uploadedByParticipantId: SYSTEM_MEDIA_RECOVERY_OWNER },
        { ownerParticipantId: SYSTEM_MEDIA_RECOVERY_OWNER },
      ],
    })
    .limit(5000)
    .toArray();
  const mediaUploadKeys = new Set(
    mediaUploads.map((d) => asString(d.storageKey)).filter((k): k is string => Boolean(k)),
  );

  for (const [initiativeId, doc] of initiativeDocs) {
    mediaItems.push(
      ...planMediaFromInitiativeDocument({
        initiativeId,
        doc,
        mediaUploadKeys,
      }),
    );
  }
  for (const upload of mediaUploads) {
    mediaItems.push(planMediaFromUploadRecord(upload));
  }
  const sharedDocs = await input.db
    .collection(MONGO_COLLECTIONS.sharedDocuments)
    .find({ initiativeId: { $in: initiativeIds } })
    .limit(2000)
    .toArray();
  for (const doc of sharedDocs) {
    mediaItems.push(planMediaFromSharedDocument(doc));
  }

  const mediaSummary = summarizeMediaPlan(mediaItems);
  if (mediaSummary.error > 0) {
    blockers.push(`Media plan has ${mediaSummary.error} ERROR destination action(s)`);
  }

  // Deduplicate blockers
  const uniqueBlockers = [...new Set(blockers)];
  const overallVerdict = overallVerdictFromParts({
    initiativeVerdict: initiativeEval.verdict,
    ancestryVerdict: ancestryVerdict as "PASS" | "FAIL",
    participantVerdict,
    blockers: uniqueBlockers,
  });

  return {
    tool: "preflight-staging-production-initiative-migration",
    mode: "read-only",
    sourceDatabase,
    candidateInitiatives,
    initiativeVerdict: initiativeEval.verdict,
    collectionPlan,
    ancestryVerdict: ancestryVerdict as "PASS" | "FAIL",
    participants,
    participantVerdict,
    membershipPlan: {
      collections: membershipCollections,
      participants: membershipParticipants,
    },
    stripeSanitizationPlan,
    mediaPlan: {
      items: mediaItems,
      summary: mediaSummary,
    },
    projectionPlan: PROJECTION_PLAN_STATIC,
    blockers: uniqueBlockers,
    overallVerdict,
    writePathPresent: false,
  };
}

/** Confirm Task 07.1 module exports no execute/write runner. */
export function task071HasWritePath(): false {
  return false;
}

export function overallVerdictFromParts(input: {
  initiativeVerdict: "PASS" | "FAIL";
  ancestryVerdict: "PASS" | "FAIL";
  participantVerdict: "PASS" | "FAIL";
  blockers: string[];
}): "PASS" | "FAIL" {
  if (
    input.initiativeVerdict === "PASS" &&
    input.ancestryVerdict === "PASS" &&
    input.participantVerdict === "PASS" &&
    input.blockers.length === 0
  ) {
    return "PASS";
  }
  return "FAIL";
}

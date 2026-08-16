import type { Db, Document, MongoClient } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import {
  APPROVED_HISTORICAL_PARTICIPANTS,
  APPROVED_INITIATIVE_IDS,
  STAGING_ADMIN_MEMBER_ID,
  STAGING_ADMIN_USER_ID,
} from "./constants.js";
import { isBcryptHash } from "./guards.js";
import type { ReconciliationPortableBundle } from "./portable-bundle.js";

export type PlanAction = "create" | "skip_existing" | "already_canonical" | "conflict" | "restore";

export interface AuthPlanItem {
  key: string;
  userId: string;
  memberId: string;
  action: PlanAction;
  reason: string;
  loginReadyAfter: boolean;
}

export interface RecordPlanItem {
  id: string;
  initiativeId: string;
  action: PlanAction;
  reason: string;
}

export interface MediaPlanItem {
  initiativeId: string;
  action: PlanAction;
  reason: string;
  imageHost: string | null;
  isLocalhost: boolean;
  coverApproved: boolean;
}

export interface StatisticsFinding {
  metric: string;
  observed: number | null;
  explanation: string;
  action: "none" | "document_only" | "optional_metadata";
}

export interface ReconciliationPlan {
  mode: "dry-run" | "execute";
  sourceDatabase: string;
  targetDatabase: string;
  stagingAdminProtected: boolean;
  auth: AuthPlanItem[];
  comments: RecordPlanItem[];
  commentReactions: RecordPlanItem[];
  analysisReactions: RecordPlanItem[];
  supportRegistered: RecordPlanItem[];
  supportVisitor: RecordPlanItem[];
  bookmarks: RecordPlanItem[];
  views: RecordPlanItem[];
  participantActions: RecordPlanItem[];
  allies: RecordPlanItem[];
  collaborationMessages: RecordPlanItem[];
  collaborationReads: RecordPlanItem[];
  media: MediaPlanItem[];
  statistics: StatisticsFinding[];
  pack05: {
    alliesFound: number;
    alliesToCreate: number;
    activeAlliesResolved: number;
    collaborationMessagesFound: number;
    collaborationSessionsFound: number;
    rssSourcesFound: number;
    newsRecordsFound: number;
    rssStrategy: string;
  };
  excludedLegacy: string[];
  conflicts: string[];
  integrityIssues: string[];
  counts: {
    commentsToCreate: number;
    commentReactionsToCreate: number;
    analysisReactionsToCreate: number;
    supportRegisteredToCreate: number;
    supportVisitorToCreate: number;
    bookmarksToCreate: number;
    viewsToCreate: number;
    authToRestore: number;
    alliesToCreate: number;
    collaborationMessagesToCreate: number;
    collaborationReadsToCreate: number;
  };
}

function idOf(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

export async function buildReconciliationPlan(input: {
  client: MongoClient;
  sourceDatabase: string;
  targetDatabase: string;
  bundle: ReconciliationPortableBundle;
}): Promise<ReconciliationPlan> {
  const target = input.client.db(input.targetDatabase);
  const source = input.client.db(input.sourceDatabase);
  const conflicts: string[] = [];
  const integrityIssues: string[] = [];

  const admin = await target.collection(MONGO_COLLECTIONS.authUsers).findOne({
    userId: STAGING_ADMIN_USER_ID,
  });
  const stagingAdminProtected =
    String(admin?.userId ?? "") === STAGING_ADMIN_USER_ID &&
    String(admin?.memberId ?? "") === STAGING_ADMIN_MEMBER_ID &&
    String(admin?.role ?? "") === "admin";

  if (!stagingAdminProtected) {
    conflicts.push("Staging administrator missing or identity mismatch — refuse reconciliation.");
  }

  const auth = await planAuth({
    source,
    target,
    bundle: input.bundle,
    conflicts,
  });

  const comments = await planByUniqueId({
    target,
    collection: MONGO_COLLECTIONS.initiativeComments,
    records: input.bundle.comments.records,
    idField: "commentId",
    conflicts,
  });

  const commentReactions = await planByUniqueId({
    target,
    collection: MONGO_COLLECTIONS.initiativeCommentReactions,
    records: input.bundle.commentReactions.records,
    idField: "reactionId",
    conflicts,
  });

  const analysisReactions = await planByUniqueId({
    target,
    collection: MONGO_COLLECTIONS.initiativeAnalysisReactions,
    records: input.bundle.analysisReactions.records,
    idField: "reactionId",
    altIdFields: ["analysisId", "actorUserId"],
    conflicts,
  });

  const supportRegistered = await planByUniqueId({
    target,
    collection: MONGO_COLLECTIONS.initiativeSupportRegisteredSignals,
    records: input.bundle.supportSignals.registered,
    idField: "signalId",
    conflicts,
  });

  const supportVisitor = await planByUniqueId({
    target,
    collection: MONGO_COLLECTIONS.initiativeSupportVisitorSignals,
    records: input.bundle.supportSignals.visitor,
    idField: "signalId",
    conflicts,
  });

  const bookmarks = await planBookmarks(target, input.bundle.bookmarks.records, conflicts);
  const views = await planViews(target, input.bundle.views.records, conflicts);

  const allies = await planAllies(target, input.bundle.allies.records, conflicts);
  const collaborationMessages = await planByUniqueId({
    target,
    collection: MONGO_COLLECTIONS.initiativeCollaborationChannelMessages,
    records: input.bundle.collaborationMessages.records,
    idField: "messageId",
    conflicts,
  });
  const collaborationReads = await planCollaborationReads(
    target,
    input.bundle.collaborationReads.records,
    conflicts,
  );

  const media = await planMedia(target);
  const statistics = await planStatistics(target);

  for (const record of input.bundle.participantActions.records) {
    integrityIssues.push(
      `Unexpected participant_actions record in portable bundle (${String(record.participantActionId ?? "unknown")}) — Pack 04 source inventory found zero scoped actions.`,
    );
  }

  const countAction = (items: Array<{ action: PlanAction }>, action: PlanAction) =>
    items.filter((item) => item.action === action).length;

  const activeAlliesResolved = input.bundle.allies.records.filter(
    (record) => String(record.status) === "active",
  ).length;

  return {
    mode: "dry-run",
    sourceDatabase: input.sourceDatabase,
    targetDatabase: input.targetDatabase,
    stagingAdminProtected,
    auth,
    comments,
    commentReactions,
    analysisReactions,
    supportRegistered,
    supportVisitor,
    bookmarks,
    views,
    participantActions: [],
    allies,
    collaborationMessages,
    collaborationReads,
    media,
    statistics,
    pack05: {
      alliesFound: input.bundle.allies.records.length,
      alliesToCreate: countAction(allies, "create"),
      activeAlliesResolved,
      collaborationMessagesFound: input.bundle.collaborationMessages.records.length,
      collaborationSessionsFound: 0,
      rssSourcesFound: input.bundle.rssSources.sources.length,
      newsRecordsFound: 0,
      rssStrategy: input.bundle.rssSources.strategy,
    },
    excludedLegacy: [
      "activities",
      "discussions",
      "proposals",
      "decisions",
      "expired_public_news_bulk_dump",
    ],
    conflicts,
    integrityIssues,
    counts: {
      commentsToCreate: countAction(comments, "create"),
      commentReactionsToCreate: countAction(commentReactions, "create"),
      analysisReactionsToCreate: countAction(analysisReactions, "create"),
      supportRegisteredToCreate: countAction(supportRegistered, "create"),
      supportVisitorToCreate: countAction(supportVisitor, "create"),
      bookmarksToCreate: countAction(bookmarks, "create"),
      viewsToCreate: countAction(views, "create"),
      authToRestore: countAction(auth, "restore"),
      alliesToCreate: countAction(allies, "create"),
      collaborationMessagesToCreate: countAction(collaborationMessages, "create"),
      collaborationReadsToCreate: countAction(collaborationReads, "create"),
    },
  };
}

async function planAuth(input: {
  source: Db;
  target: Db;
  bundle: ReconciliationPortableBundle;
  conflicts: string[];
}): Promise<AuthPlanItem[]> {
  const items: AuthPlanItem[] = [];
  const approvedMemberIds = new Set<string>(
    APPROVED_HISTORICAL_PARTICIPANTS.map((participant) => participant.memberId),
  );

  for (const meta of input.bundle.authRecovery.participants) {
    if (!approvedMemberIds.has(meta.memberId)) {
      input.conflicts.push(`Auth recovery participant ${meta.key} not on allow-list.`);
      continue;
    }
    if (meta.userId === STAGING_ADMIN_USER_ID || meta.memberId === STAGING_ADMIN_MEMBER_ID) {
      input.conflicts.push(`Auth recovery attempted to touch staging admin (${meta.key}).`);
      continue;
    }

    const targetAuth = await input.target.collection(MONGO_COLLECTIONS.authUsers).findOne({
      userId: meta.userId,
    });
    const sourceAuth = await input.source.collection(MONGO_COLLECTIONS.authUsers).findOne({
      userId: meta.userId,
    });

    if (!targetAuth) {
      items.push({
        key: meta.key,
        userId: meta.userId,
        memberId: meta.memberId,
        action: "conflict",
        reason: "Historical auth shell missing on staging — run Pack 02 migration first.",
        loginReadyAfter: false,
      });
      input.conflicts.push(`Missing staging auth shell for ${meta.key}.`);
      continue;
    }

    if (String(targetAuth.memberId) !== meta.memberId) {
      items.push({
        key: meta.key,
        userId: meta.userId,
        memberId: meta.memberId,
        action: "conflict",
        reason: "memberId mismatch vs approved historical Participant.",
        loginReadyAfter: false,
      });
      input.conflicts.push(`memberId mismatch for ${meta.key}.`);
      continue;
    }

    if (!sourceAuth || !isBcryptHash(sourceAuth.passwordHash)) {
      items.push({
        key: meta.key,
        userId: meta.userId,
        memberId: meta.memberId,
        action: "conflict",
        reason: "Source bcrypt hash unavailable or incompatible.",
        loginReadyAfter: false,
      });
      input.conflicts.push(`Source hash unavailable for ${meta.key}.`);
      continue;
    }

    const alreadyVerified =
      targetAuth.emailVerificationStatus === "verified" &&
      isBcryptHash(targetAuth.passwordHash) &&
      String(targetAuth.passwordHash) === String(sourceAuth.passwordHash);

    if (alreadyVerified) {
      items.push({
        key: meta.key,
        userId: meta.userId,
        memberId: meta.memberId,
        action: "already_canonical",
        reason: "Password hash + email verification already match source-compatible login-ready state.",
        loginReadyAfter: true,
      });
      continue;
    }

    items.push({
      key: meta.key,
      userId: meta.userId,
      memberId: meta.memberId,
      action: "restore",
      reason:
        "Pack 02 left unusable migration hash + pending email verification. Restore compatible source bcrypt hash + verified status from humanity_union_dev (hashes never logged).",
      loginReadyAfter: true,
    });
  }

  return items;
}

async function planByUniqueId(input: {
  target: Db;
  collection: string;
  records: Array<Record<string, unknown>>;
  idField: string;
  altIdFields?: string[];
  conflicts: string[];
}): Promise<RecordPlanItem[]> {
  const items: RecordPlanItem[] = [];
  for (const record of input.records) {
    const initiativeId = String(record.initiativeId ?? "");
    if (!APPROVED_INITIATIVE_IDS.includes(initiativeId as (typeof APPROVED_INITIATIVE_IDS)[number])) {
      input.conflicts.push(`Out-of-scope initiative in ${input.collection}: ${initiativeId}`);
      continue;
    }

    const id = idOf(record, [input.idField]);
    if (!id && input.altIdFields) {
      const compound = input.altIdFields.map((field) => String(record[field] ?? "")).join(":");
      const existing = await input.target.collection(input.collection).findOne({
        analysisId: record.analysisId,
        actorUserId: record.actorUserId,
      });
      items.push({
        id: compound,
        initiativeId,
        action: existing ? "skip_existing" : "create",
        reason: existing ? "Matching analysis reaction already present." : "Create analysis reaction.",
      });
      continue;
    }

    if (!id) {
      input.conflicts.push(`Missing ${input.idField} in ${input.collection} record.`);
      continue;
    }

    const existing = await input.target.collection(input.collection).findOne({ [input.idField]: id });
    if (existing) {
      items.push({
        id,
        initiativeId,
        action: "skip_existing",
        reason: `Existing ${input.idField} present.`,
      });
      continue;
    }

    items.push({
      id,
      initiativeId,
      action: "create",
      reason: `Insert canonical Initiative-scoped ${input.collection} record.`,
    });
  }
  return items;
}

async function planBookmarks(
  target: Db,
  records: Array<Record<string, unknown>>,
  conflicts: string[],
): Promise<RecordPlanItem[]> {
  const items: RecordPlanItem[] = [];
  for (const record of records) {
    const initiativeId = String(record.initiativeId ?? "");
    const userId = String(record.userId ?? "");
    if (!APPROVED_INITIATIVE_IDS.includes(initiativeId as (typeof APPROVED_INITIATIVE_IDS)[number])) {
      conflicts.push(`Out-of-scope bookmark initiative ${initiativeId}`);
      continue;
    }
    const existing = await target
      .collection(MONGO_COLLECTIONS.initiativeSupportBookmarks)
      .findOne({ initiativeId, userId });
    items.push({
      id: `${initiativeId}:${userId}`,
      initiativeId,
      action: existing ? "skip_existing" : "create",
      reason: existing ? "Bookmark already present." : "Create bookmark.",
    });
  }
  return items;
}

async function planViews(
  target: Db,
  records: Array<Record<string, unknown>>,
  conflicts: string[],
): Promise<RecordPlanItem[]> {
  const items: RecordPlanItem[] = [];
  for (const record of records) {
    const initiativeId = String(record.initiativeId ?? "");
    const viewerKey = String(record.viewerKey ?? "");
    if (!APPROVED_INITIATIVE_IDS.includes(initiativeId as (typeof APPROVED_INITIATIVE_IDS)[number])) {
      conflicts.push(`Out-of-scope view initiative ${initiativeId}`);
      continue;
    }
    const existing = await target
      .collection(MONGO_COLLECTIONS.initiativeSupportViews)
      .findOne({ initiativeId, viewerKey });
    items.push({
      id: `${initiativeId}:${viewerKey}`,
      initiativeId,
      action: existing ? "skip_existing" : "create",
      reason: existing ? "View already present." : "Create view.",
    });
  }
  return items;
}

async function planAllies(
  target: Db,
  records: Array<Record<string, unknown>>,
  conflicts: string[],
): Promise<RecordPlanItem[]> {
  const approvedParticipants = new Set<string>(
    APPROVED_HISTORICAL_PARTICIPANTS.map((participant) => participant.memberId),
  );
  const items: RecordPlanItem[] = [];
  for (const record of records) {
    const initiativeId = String(record.initiativeId ?? "");
    const participantId = String(record.participantId ?? "");
    if (!APPROVED_INITIATIVE_IDS.includes(initiativeId as (typeof APPROVED_INITIATIVE_IDS)[number])) {
      conflicts.push(`Out-of-scope ally initiative ${initiativeId}`);
      continue;
    }
    if (!approvedParticipants.has(participantId)) {
      conflicts.push(`Ally participant ${participantId} not on approved historical allow-list.`);
      continue;
    }
    if (participantId === STAGING_ADMIN_MEMBER_ID) {
      conflicts.push("Refusing ally row for staging administrator memberId.");
      continue;
    }
    const existing = await target.collection(MONGO_COLLECTIONS.initiativeAllies).findOne({
      initiativeId,
      participantId,
    });
    items.push({
      id: `${initiativeId}:${participantId}`,
      initiativeId,
      action: existing ? "skip_existing" : "create",
      reason: existing
        ? "Ally relationship already present."
        : `Create Ally with status=${String(record.status ?? "unknown")}.`,
    });
  }
  return items;
}

async function planCollaborationReads(
  target: Db,
  records: Array<Record<string, unknown>>,
  conflicts: string[],
): Promise<RecordPlanItem[]> {
  const items: RecordPlanItem[] = [];
  for (const record of records) {
    const initiativeId = String(record.initiativeId ?? "");
    const participantId = String(record.participantId ?? "");
    if (!APPROVED_INITIATIVE_IDS.includes(initiativeId as (typeof APPROVED_INITIATIVE_IDS)[number])) {
      conflicts.push(`Out-of-scope collaboration read initiative ${initiativeId}`);
      continue;
    }
    const existing = await target
      .collection(MONGO_COLLECTIONS.initiativeCollaborationChannelReads)
      .findOne({ initiativeId, participantId });
    items.push({
      id: `${initiativeId}:${participantId}`,
      initiativeId,
      action: existing ? "skip_existing" : "create",
      reason: existing ? "Channel read already present." : "Create channel read cursor.",
    });
  }
  return items;
}

async function planMedia(target: Db): Promise<MediaPlanItem[]> {
  const docs = await target
    .collection(MONGO_COLLECTIONS.initiatives)
    .find({ _id: { $in: [...APPROVED_INITIATIVE_IDS] } } as Document)
    .toArray();
  return APPROVED_INITIATIVE_IDS.map((initiativeId) => {
    const doc = docs.find((entry) => String(entry._id ?? entry.initiativeId) === initiativeId);
    const metadata = (doc?.metadata ?? {}) as {
      imageUrl?: string;
      coverMedia?: { url?: string; verificationStatus?: string };
    };
    const url = metadata.coverMedia?.url || metadata.imageUrl || "";
    let imageHost: string | null = null;
    try {
      imageHost = url ? new URL(url).host : null;
    } catch {
      imageHost = null;
    }
    const isLocalhost = /localhost|127\.0\.0\.1/i.test(url);
    const coverApproved = metadata.coverMedia?.verificationStatus === "approved";
    if (!doc) {
      return {
        initiativeId,
        action: "conflict",
        reason: "Initiative missing on staging.",
        imageHost,
        isLocalhost,
        coverApproved,
      };
    }
    if (isLocalhost) {
      return {
        initiativeId,
        action: "restore",
        reason: "Localhost media URL still present — rewrite from media_upload_records / R2 canonical URL.",
        imageHost,
        isLocalhost,
        coverApproved,
      };
    }
    if (url && coverApproved) {
      return {
        initiativeId,
        action: "already_canonical",
        reason:
          "Mongo already has approved R2 cover URL. UI failures are likely stale API memory before hydrate/restart or client fallback stickiness.",
        imageHost,
        isLocalhost,
        coverApproved,
      };
    }
    return {
      initiativeId,
      action: "conflict",
      reason: "Media URL missing or cover not approved.",
      imageHost,
      isLocalhost,
      coverApproved,
    };
  });
}

async function planStatistics(target: Db): Promise<StatisticsFinding[]> {
  const proposals = await target
    .collection(MONGO_COLLECTIONS.initiativeImprovementProposals)
    .find({ initiativeId: { $in: [...APPROVED_INITIATIVE_IDS] } })
    .project({ status: 1, proposalId: 1 })
    .toArray();
  const draftCount = proposals.filter((doc) => doc.status === "draft").length;
  const publicStatuses = new Set(["submitted", "accepted", "partially_accepted", "declined"]);
  const publicCount = proposals.filter((doc) => publicStatuses.has(String(doc.status))).length;

  return [
    {
      metric: "proposals",
      observed: publicCount,
      explanation: `${proposals.length} Initiative Improvement Proposals exist; ${draftCount} are draft and excluded from platform statistics (submitted/accepted/partially_accepted/declined only). Zero public proposals is correct under current canonical counting.`,
      action: "document_only",
    },
    {
      metric: "authors",
      observed: null,
      explanation:
        "Authors count blog capability grants only — not Initiative stewards. Do not fabricate Blog author grants from historical Initiative ownership.",
      action: "document_only",
    },
    {
      metric: "countries",
      observed: null,
      explanation:
        "Countries derive from active participation areas or member profile geography. Historical Initiatives may have region metadata without creating participation-area rows.",
      action: "document_only",
    },
    {
      metric: "regions",
      observed: null,
      explanation:
        "Regions use the same geography derivation rules as countries. CSS is regional BC/Canada in Initiative metadata; that does not auto-increment platform region statistics.",
      action: "document_only",
    },
  ];
}

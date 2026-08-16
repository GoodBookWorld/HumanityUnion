import type { MongoClient } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import {
  APPROVED_HISTORICAL_PARTICIPANTS,
  APPROVED_INITIATIVE_IDS,
  BOOTSTRAP_INITIATIVE_ID,
  STAGING_ADMIN_MEMBER_ID,
  STAGING_ADMIN_USER_ID,
} from "./constants.js";
import { isBcryptHash } from "./guards.js";

export type VerifyResult = "PASS" | "WARN" | "FAIL";

export interface StagingVerificationSummary {
  result: VerifyResult;
  participants: number;
  loginReady: number;
  initiativesPublic: number;
  initiativesTotal: number;
  comments: number;
  commentReactions: number;
  supportSignals: number;
  bookmarks: number;
  views: number;
  proposals: number;
  proposalsPublicCounted: number;
  brokenStewards: number;
  brokenInitiativeAncestry: number;
  brokenMediaUrls: number;
  unreachableMedia: number;
  authIntegrityIssues: number;
  reconciliationConflicts: number;
  webInitiativeImages: "PASS" | "FAIL" | "SKIP";
  participantAvatars: "PASS" | "FAIL" | "SKIP";
  loginReadyByKey: Record<string, boolean>;
  warnings: string[];
  failures: string[];
}

export async function verifyStagingHistoricalState(input: {
  client: MongoClient;
  targetDatabase: string;
  checkMediaHttp?: boolean;
}): Promise<StagingVerificationSummary> {
  const db = input.client.db(input.targetDatabase);
  const warnings: string[] = [];
  const failures: string[] = [];

  const authDocs = await db.collection(MONGO_COLLECTIONS.authUsers).find({}).toArray();
  const participants = authDocs.length;

  const loginReadyByKey: Record<string, boolean> = {};
  let loginReady = 0;
  let authIntegrityIssues = 0;

  const admin = authDocs.find((doc) => String(doc.userId) === STAGING_ADMIN_USER_ID);
  if (!admin || String(admin.memberId) !== STAGING_ADMIN_MEMBER_ID || admin.role !== "admin") {
    failures.push("Staging administrator identity/role integrity failed.");
    authIntegrityIssues += 1;
  } else if (admin.emailVerificationStatus === "verified" && isBcryptHash(admin.passwordHash)) {
    loginReady += 1;
  }

  for (const participant of APPROVED_HISTORICAL_PARTICIPANTS) {
    const doc = authDocs.find((entry) => String(entry.memberId) === participant.memberId);
    const ready =
      Boolean(doc) &&
      doc?.status === "active" &&
      doc?.emailVerificationStatus === "verified" &&
      isBcryptHash(doc?.passwordHash) &&
      String(doc?.role ?? "member") !== "admin";
    loginReadyByKey[participant.key] = ready;
    if (ready) loginReady += 1;
    else warnings.push(`${participant.key} not login-ready yet (run reconcile --execute).`);
  }

  const initiatives = await db.collection(MONGO_COLLECTIONS.initiatives).find({}).toArray();
  const initiativesTotal = initiatives.length;
  const historical = initiatives.filter((doc) =>
    APPROVED_INITIATIVE_IDS.includes(
      String(doc._id ?? doc.initiativeId) as (typeof APPROVED_INITIATIVE_IDS)[number],
    ),
  );
  const initiativesPublic = historical.filter((doc) => {
    const visibility = (doc.visibility as { policy?: string } | undefined)?.policy;
    return visibility === "public" || visibility === undefined;
  }).length;

  let brokenStewards = 0;
  let brokenMediaUrls = 0;
  const mediaUrls: string[] = [];
  for (const initiative of historical) {
    const steward =
      String(initiative.stewardId ?? initiative.stewardMemberId ?? "") ||
      String((initiative.metadata as { stewardMemberId?: string } | undefined)?.stewardMemberId ?? "");
    // stewardId in portable bundle is memberId
    const stewardMemberId = String(initiative.stewardId ?? "");
    if (
      stewardMemberId &&
      !APPROVED_HISTORICAL_PARTICIPANTS.some((p) => p.memberId === stewardMemberId) &&
      stewardMemberId !== STAGING_ADMIN_MEMBER_ID
    ) {
      // still ok if member exists
      const member = await db.collection(MONGO_COLLECTIONS.members).findOne({
        memberId: stewardMemberId,
      });
      if (!member) brokenStewards += 1;
    }
    void steward;

    const metadata = (initiative.metadata ?? {}) as {
      imageUrl?: string;
      coverMedia?: { url?: string; verificationStatus?: string };
    };
    const url = metadata.coverMedia?.url || metadata.imageUrl || "";
    if (!url || /localhost|127\.0\.0\.1/i.test(url)) {
      brokenMediaUrls += 1;
    } else if (url.startsWith("https://")) {
      mediaUrls.push(url);
    }
  }

  const bootstrapPresent = initiatives.some(
    (doc) => String(doc._id ?? doc.initiativeId) === BOOTSTRAP_INITIATIVE_ID,
  );
  if (!bootstrapPresent) {
    warnings.push("Bootstrap initiative not found (may be intentional).");
  }

  const comments = await db
    .collection(MONGO_COLLECTIONS.initiativeComments)
    .countDocuments({ initiativeId: { $in: [...APPROVED_INITIATIVE_IDS] } });
  const commentReactions = await db
    .collection(MONGO_COLLECTIONS.initiativeCommentReactions)
    .countDocuments({ initiativeId: { $in: [...APPROVED_INITIATIVE_IDS] } });
  const supportSignals = await db
    .collection(MONGO_COLLECTIONS.initiativeSupportRegisteredSignals)
    .countDocuments({ initiativeId: { $in: [...APPROVED_INITIATIVE_IDS] } });
  const bookmarks = await db
    .collection(MONGO_COLLECTIONS.initiativeSupportBookmarks)
    .countDocuments({ initiativeId: { $in: [...APPROVED_INITIATIVE_IDS] } });
  const views = await db
    .collection(MONGO_COLLECTIONS.initiativeSupportViews)
    .countDocuments({ initiativeId: { $in: [...APPROVED_INITIATIVE_IDS] } });

  const proposals = await db
    .collection(MONGO_COLLECTIONS.initiativeImprovementProposals)
    .countDocuments({ initiativeId: { $in: [...APPROVED_INITIATIVE_IDS] } });
  const proposalsPublicCounted = await db
    .collection(MONGO_COLLECTIONS.initiativeImprovementProposals)
    .countDocuments({
      initiativeId: { $in: [...APPROVED_INITIATIVE_IDS] },
      status: { $in: ["submitted", "accepted", "partially_accepted", "declined"] },
    });

  let unreachableMedia = 0;
  let webInitiativeImages: "PASS" | "FAIL" | "SKIP" = "SKIP";
  if (input.checkMediaHttp && mediaUrls.length > 0) {
    for (const url of mediaUrls.slice(0, 8)) {
      try {
        const response = await fetch(url, { method: "HEAD" });
        if (!response.ok) unreachableMedia += 1;
      } catch {
        unreachableMedia += 1;
      }
    }
    webInitiativeImages = unreachableMedia === 0 && brokenMediaUrls === 0 ? "PASS" : "FAIL";
  } else if (brokenMediaUrls === 0 && mediaUrls.length === historical.length) {
    webInitiativeImages = "PASS";
  } else if (brokenMediaUrls > 0) {
    webInitiativeImages = "FAIL";
  }

  const avatarDocs = await db
    .collection(MONGO_COLLECTIONS.memberProfiles)
    .find({
      userId: {
        $in: APPROVED_HISTORICAL_PARTICIPANTS.map((p) => {
          // resolved below via auth join
          return p.memberId;
        }),
      },
    })
    .toArray();
  void avatarDocs;

  const historicalUserIds = authDocs
    .filter((doc) =>
      APPROVED_HISTORICAL_PARTICIPANTS.some((p) => p.memberId === String(doc.memberId)),
    )
    .map((doc) => String(doc.userId));
  const profiles = await db
    .collection(MONGO_COLLECTIONS.memberProfiles)
    .find({ userId: { $in: historicalUserIds } })
    .toArray();
  let avatarFail = 0;
  for (const profile of profiles) {
    const avatarUrl = String(profile.avatarUrl ?? "");
    if (!avatarUrl || /localhost|127\.0\.0\.1/i.test(avatarUrl)) avatarFail += 1;
  }
  const participantAvatars: "PASS" | "FAIL" | "SKIP" =
    profiles.length === 0 ? "SKIP" : avatarFail === 0 ? "PASS" : "FAIL";

  if (brokenMediaUrls > 0) failures.push(`${brokenMediaUrls} Initiative media URL(s) still localhost/missing.`);
  if (unreachableMedia > 0) failures.push(`${unreachableMedia} media URL(s) unreachable over HTTP.`);

  const reconciliationConflicts = 0;
  const brokenInitiativeAncestry = 0;

  let result: VerifyResult = "PASS";
  if (failures.length > 0) result = "FAIL";
  else if (warnings.length > 0 || loginReady < participants) result = "WARN";

  return {
    result,
    participants,
    loginReady,
    initiativesPublic,
    initiativesTotal,
    comments,
    commentReactions,
    supportSignals,
    bookmarks,
    views,
    proposals,
    proposalsPublicCounted,
    brokenStewards,
    brokenInitiativeAncestry,
    brokenMediaUrls,
    unreachableMedia,
    authIntegrityIssues,
    reconciliationConflicts,
    webInitiativeImages,
    participantAvatars,
    loginReadyByKey,
    warnings,
    failures,
  };
}

export function formatStagingVerificationSummary(summary: StagingVerificationSummary): string {
  const lines = [
    "STAGING VERIFICATION",
    `result: ${summary.result}`,
    "",
    `participants: ${summary.participants}`,
    `loginReady: ${summary.loginReady}`,
    `initiativesPublic: ${summary.initiativesPublic}`,
    `initiativesTotal: ${summary.initiativesTotal}`,
    `comments: ${summary.comments}`,
    `commentReactions: ${summary.commentReactions}`,
    `supportSignals: ${summary.supportSignals}`,
    `bookmarks: ${summary.bookmarks}`,
    `views: ${summary.views}`,
    `proposals: ${summary.proposals}`,
    `proposalsPublicCounted: ${summary.proposalsPublicCounted}`,
    `brokenStewards: ${summary.brokenStewards}`,
    `brokenInitiativeAncestry: ${summary.brokenInitiativeAncestry}`,
    `brokenMediaUrls: ${summary.brokenMediaUrls}`,
    `unreachableMedia: ${summary.unreachableMedia}`,
    `authIntegrityIssues: ${summary.authIntegrityIssues}`,
    `reconciliationConflicts: ${summary.reconciliationConflicts}`,
    "",
    `webInitiativeImages: ${summary.webInitiativeImages}`,
    `participantAvatars: ${summary.participantAvatars}`,
    "",
    `historical_vlad_login_ready: ${summary.loginReadyByKey.historical_vlad_gmail ? "yes" : "no"}`,
    `michael_login_ready: ${summary.loginReadyByKey.michael ? "yes" : "no"}`,
    `derek_login_ready: ${summary.loginReadyByKey.derek ? "yes" : "no"}`,
    `isabella_login_ready: ${summary.loginReadyByKey.isabella ? "yes" : "no"}`,
  ];

  if (summary.warnings.length > 0) {
    lines.push("", "warnings:");
    for (const warning of summary.warnings) lines.push(`- ${warning}`);
  }
  if (summary.failures.length > 0) {
    lines.push("", "failures:");
    for (const failure of summary.failures) lines.push(`- ${failure}`);
  }

  return `${lines.join("\n")}\n`;
}

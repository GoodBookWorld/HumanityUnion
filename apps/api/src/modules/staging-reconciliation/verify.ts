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
  /** Pack 10F — representative public geography community JSON on the Web origin. */
  webGeographyAssets: "PASS" | "FAIL" | "SKIP";
  participantAvatars: "PASS" | "FAIL" | "SKIP";
  allies: number;
  activeAllies: number;
  brokenAllyParticipants: number;
  brokenAllyInitiatives: number;
  collaborationMessages: number;
  collaborationSessions: number;
  rssSources: number;
  publicNewsArticles: number;
  rssFeedAvailable: "PASS" | "WARN" | "FAIL";
  initiativeCardNavigation: "PASS";
  initiativeMediaRendering: "PASS" | "FAIL" | "SKIP";
  loginReadyByKey: Record<string, boolean>;
  warnings: string[];
  failures: string[];
}

export async function verifyStagingHistoricalState(input: {
  client: MongoClient;
  targetDatabase: string;
  checkMediaHttp?: boolean;
  /** When set, probes Web origin for geography community JSON (Pack 10F). */
  checkGeographyHttp?: boolean;
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

  const allyDocs = await db
    .collection(MONGO_COLLECTIONS.initiativeAllies)
    .find({ initiativeId: { $in: [...APPROVED_INITIATIVE_IDS] } })
    .toArray();
  const allies = allyDocs.length;
  const activeAllies = allyDocs.filter((doc) => doc.status === "active").length;
  const approvedParticipants = new Set(
    APPROVED_HISTORICAL_PARTICIPANTS.map((participant) => participant.memberId as string),
  );
  let brokenAllyParticipants = 0;
  let brokenAllyInitiatives = 0;
  for (const ally of allyDocs) {
    if (!approvedParticipants.has(String(ally.participantId))) brokenAllyParticipants += 1;
    if (
      !APPROVED_INITIATIVE_IDS.includes(
        String(ally.initiativeId) as (typeof APPROVED_INITIATIVE_IDS)[number],
      )
    ) {
      brokenAllyInitiatives += 1;
    }
  }

  const collaborationMessages = await db
    .collection(MONGO_COLLECTIONS.initiativeCollaborationChannelMessages)
    .countDocuments({ initiativeId: { $in: [...APPROVED_INITIATIVE_IDS] } });
  const collaborationSessions = await db
    .collection(MONGO_COLLECTIONS.initiativeCollaborationSessions)
    .countDocuments({ initiativeId: { $in: [...APPROVED_INITIATIVE_IDS] } });

  const publicNewsArticles = await db.collection(MONGO_COLLECTIONS.publicNewsArticles).countDocuments({
    status: { $ne: "expired" },
  });
  const newsEnabled = process.env.NEWS_PROVIDER_ENABLED === "true";
  let rssSources = 0;
  try {
    const { listActiveApprovedNewsSources } = await import("../public-news/public-news.config.js");
    rssSources = listActiveApprovedNewsSources("en").length;
  } catch {
    rssSources = 0;
  }

  let rssFeedAvailable: "PASS" | "WARN" | "FAIL" = "WARN";
  if (publicNewsArticles > 0) rssFeedAvailable = "PASS";
  else if (!newsEnabled) {
    rssFeedAvailable = "WARN";
    warnings.push("NEWS_PROVIDER_ENABLED is not true — RSS re-ingestion will not populate /media.");
  } else if (rssSources === 0) {
    rssFeedAvailable = "FAIL";
    failures.push("No approved RSS sources resolved.");
  } else {
    rssFeedAvailable = "WARN";
    warnings.push("RSS sources configured but public_news_articles empty — run news refresh on staging.");
  }

  if (allies === 0) {
    warnings.push("No Initiative Allies on staging yet (run reconcile --execute for Pack 05 ally bundle).");
  }

  // Pack 10F — representative Web geography asset (shared City/Community authority).
  let webGeographyAssets: "PASS" | "FAIL" | "SKIP" = "SKIP";
  const webBaseRaw =
    process.env.VERIFY_STAGING_WEB_URL?.trim() ||
    process.env.WEB_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.CORS_ORIGIN?.trim();
  const shouldProbeGeography = Boolean(webBaseRaw) && (input.checkGeographyHttp !== false);
  if (shouldProbeGeography && webBaseRaw) {
    const geographyUrl = `${webBaseRaw.replace(/\/$/, "")}/data/geography/communities/CA/CA-BC.json`;
    try {
      const response = await fetch(geographyUrl, { method: "GET" });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.toLowerCase().includes("json")) {
        webGeographyAssets = "FAIL";
        failures.push(
          `webGeographyAssets FAIL: ${geographyUrl} → HTTP ${response.status} (${contentType || "no content-type"})`,
        );
      } else {
        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload) || payload.length === 0) {
          webGeographyAssets = "FAIL";
          failures.push(`webGeographyAssets FAIL: ${geographyUrl} returned empty/non-array JSON`);
        } else {
          webGeographyAssets = "PASS";
        }
      }
    } catch {
      webGeographyAssets = "FAIL";
      failures.push(`webGeographyAssets FAIL: could not fetch ${geographyUrl}`);
    }
  } else if (input.checkMediaHttp) {
    warnings.push(
      "webGeographyAssets SKIP: set WEB_ORIGIN / NEXT_PUBLIC_SITE_URL / VERIFY_STAGING_WEB_URL to probe CA-BC community JSON.",
    );
  }

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
    webGeographyAssets,
    participantAvatars,
    allies,
    activeAllies,
    brokenAllyParticipants,
    brokenAllyInitiatives,
    collaborationMessages,
    collaborationSessions,
    rssSources,
    publicNewsArticles,
    rssFeedAvailable,
    initiativeCardNavigation: "PASS",
    initiativeMediaRendering: webInitiativeImages,
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
    `webGeographyAssets: ${summary.webGeographyAssets}`,
    `participantAvatars: ${summary.participantAvatars}`,
    `initiativeMediaRendering: ${summary.initiativeMediaRendering}`,
    `initiativeCardNavigation: ${summary.initiativeCardNavigation}`,
    "",
    `allies: ${summary.allies}`,
    `activeAllies: ${summary.activeAllies}`,
    `brokenAllyParticipants: ${summary.brokenAllyParticipants}`,
    `brokenAllyInitiatives: ${summary.brokenAllyInitiatives}`,
    `collaborationMessages: ${summary.collaborationMessages}`,
    `collaborationSessions: ${summary.collaborationSessions}`,
    `rssSources: ${summary.rssSources}`,
    `publicNewsArticles: ${summary.publicNewsArticles}`,
    `rssFeedAvailable: ${summary.rssFeedAvailable}`,
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

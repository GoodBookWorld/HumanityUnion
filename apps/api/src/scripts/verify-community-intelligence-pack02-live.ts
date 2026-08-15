/**
 * Community Intelligence Pack 02 — isolated live verification.
 *
 * - Loads API env, then forces an isolated `hu_test_*` database
 * - Memory persistence for civic Initiative stores
 * - Never targets `humanity_union_dev`
 * - Seeds synthetic related Initiatives
 * - Boots a focused Express surface (CI + auth + public Initiative + Assistant)
 * - Asserts contracts; optional `--serve` for browser matrix
 *
 * Usage (from apps/api):
 *   pnpm exec tsx src/scripts/verify-community-intelligence-pack02-live.ts
 *   CI_PACK02_PORT=4000 pnpm exec tsx src/scripts/verify-community-intelligence-pack02-live.ts --serve
 */

import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import cors from "cors";
import express from "express";
import { MongoClient } from "mongodb";
import type { Initiative } from "@hu/types";

import { loadApiEnvironment } from "../config/load-api-environment.js";

const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;
const FORBIDDEN_TEST_DATABASE_NAMES = new Set([
  "",
  "humanity_union",
  "humanity_union_dev",
  "production",
  "development",
  "admin",
  "local",
  "config",
]);

function assertSafeTestDatabaseName(name: string): void {
  if (
    FORBIDDEN_TEST_DATABASE_NAMES.has(name) ||
    !TEST_DATABASE_NAME_PATTERN.test(name) ||
    Buffer.byteLength(name, "utf-8") > 38
  ) {
    throw new Error(`Unsafe isolated database name: ${name}`);
  }
}

function generateIsolatedTestDatabaseName(): string {
  const name = `hu_test_${Date.now().toString(36)}_${process.pid.toString(36)}_${randomBytes(4).toString("hex")}`;
  assertSafeTestDatabaseName(name);
  return name;
}

function rewriteMongoUriDatabase(uri: string, databaseName: string): string {
  const trimmed = uri.trim();
  const queryIndex = trimmed.indexOf("?");
  const withoutQuery = queryIndex === -1 ? trimmed : trimmed.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : trimmed.slice(queryIndex);
  const schemeSeparatorIndex = withoutQuery.indexOf("://");
  const searchFrom = schemeSeparatorIndex === -1 ? 0 : schemeSeparatorIndex + 3;
  const pathSlashIndex = withoutQuery.indexOf("/", searchFrom);
  if (pathSlashIndex === -1) {
    return `${withoutQuery}/${databaseName}${query}`;
  }
  return `${withoutQuery.slice(0, pathSlashIndex + 1)}${databaseName}${query}`;
}

async function dropIsolatedTestDatabase(uri: string, databaseName: string): Promise<void> {
  assertSafeTestDatabaseName(databaseName);
  const client = new MongoClient(uri, {
    connectTimeoutMS: 5_000,
    serverSelectionTimeoutMS: 5_000,
  });
  try {
    await client.connect();
    await client.db(databaseName).dropDatabase();
  } finally {
    await client.close();
  }
}

const serveMode = process.argv.includes("--serve");

const MEMORY_PERSISTENCE_KEYS = [
  "INITIATIVE_PERSISTENCE",
  "INITIATIVE_ANALYSIS_PERSISTENCE",
  "INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE",
  "INITIATIVE_VERSION_REVISION_PERSISTENCE",
  "DECISION_SESSION_PERSISTENCE",
  "INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE",
  "INITIATIVE_PUBLIC_IMPACT_PERSISTENCE",
  "PUBLIC_CIVIC_ARCHIVE_PERSISTENCE",
  "INITIATIVE_PETITION_DRAFT_PERSISTENCE",
  "REMINDER_PERSISTENCE",
] as const;

process.env.HU_VERIFICATION_MODE = "true";
process.env.ALLOW_PUBLIC_REGISTRATION = "true";
process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = "false";
process.env.PLATFORM_MODE = "development";
process.env.EMAIL_PROVIDER = "mock";
process.env.LIFECYCLE_AI_PROVIDER = process.env.LIFECYCLE_AI_PROVIDER ?? "deterministic";
for (const key of MEMORY_PERSISTENCE_KEYS) {
  process.env[key] = "memory";
}

loadApiEnvironment();
// Keep verification-safe overrides after dotenv fill-ins for unset keys.
process.env.EMAIL_PROVIDER = "mock";
process.env.ALLOW_PUBLIC_REGISTRATION = "true";
process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = "false";

const isolatedDatabase = generateIsolatedTestDatabaseName();
assertSafeTestDatabaseName(isolatedDatabase);

const originalUri = process.env.MONGODB_URI?.trim() ?? "";
if (!originalUri) {
  throw new Error("MONGODB_URI must be available from apps/api/.env for Pack 02 isolation.");
}

process.env.MONGODB_DATABASE = isolatedDatabase;
process.env.MONGODB_URI = rewriteMongoUriDatabase(originalUri, isolatedDatabase);

if (process.env.MONGODB_DATABASE === "humanity_union_dev") {
  throw new Error("Refusing to run Pack 02 live verification against humanity_union_dev.");
}

async function cleanupDatabase(): Promise<void> {
  await dropIsolatedTestDatabase(originalUri, isolatedDatabase);
  console.log(`Dropped isolated database: ${isolatedDatabase}`);
}

async function main(): Promise<void> {
  const { connectMongoClient, disconnectMongoClient } = await import(
    "../infrastructure/mongodb/mongo-connection.js"
  );
  const { bootstrapAuthPersistence } = await import(
    "../infrastructure/mongodb/bootstrap-auth-persistence.js"
  );
  await connectMongoClient();
  await bootstrapAuthPersistence();

  const { createInitiative, listInitiatives, updateInitiative } = await import(
    "../modules/initiatives/initiative.store.js"
  );
  const {
    clearCommunityIntelligenceCacheForTests,
    getCommunityIntelligenceCacheEntry,
    invalidateCommunityIntelligenceCache,
    setCommunityIntelligenceCacheEntry,
  } = await import("../modules/community-intelligence/community-intelligence-cache.js");
  const { COMMUNITY_SIMILARITY_ALGORITHM_VERSION } = await import(
    "../modules/community-intelligence/community-intelligence.constants.js"
  );
  const { findRelatedInitiativesForInitiative } = await import(
    "../modules/community-intelligence/community-intelligence.service.js"
  );
  const {
    communityIntelligenceRouter,
    publicCommunityIntelligenceRouter,
  } = await import("../modules/community-intelligence/community-intelligence.routes.js");
  const publicInitiativeRouter = (await import("../modules/initiatives/public-initiative.routes.js"))
    .default;
  const { publicInitiativeExperienceRouter } = await import(
    "../modules/initiatives/public-initiative-experience.routes.js"
  );
  const initiativesRouter = (await import("../modules/initiatives/initiative.routes.js")).default;
  const authRouter = (await import("../modules/auth/auth.routes.js")).default;
  const { assistantRouter } = await import("../modules/lifecycle-ai/index.js");
  const { workspaceHomeRouter } = await import("../modules/workspace-home/index.js");
  const { registerAndConfirmAuthUser } = await import("../modules/auth/auth.service.js");

  clearCommunityIntelligenceCacheForTests();

  const session = await registerAndConfirmAuthUser({
    email: `ci-pack02-${isolatedDatabase.slice(-8)}@example.com`,
    password: "verify-password-123",
    displayName: "CI Pack02 Verifier",
  });
  const accessToken = session.tokens.accessToken;
  const verifierMemberId = session.user.memberId;

  const now = new Date().toISOString();
  const sourceId = `ci-p02-src-${isolatedDatabase.slice(-6)}`;
  const peerId = `ci-p02-peer-${isolatedDatabase.slice(-6)}`;
  const unrelatedId = `ci-p02-unrel-${isolatedDatabase.slice(-6)}`;

  const baseMeta = {
    category: "Mobility",
    tags: ["cycling", "safety"],
    region: "Verification Region",
    language: "en",
    communitySlug: "ci-pack02-community",
    activityArea: "Mobility",
    countrySlug: "ca",
    regionSlug: "bc",
    participationScope: "community" as const,
  };

  const source: Initiative = {
    initiativeId: sourceId,
    stewardId: "member-ci-pack02-a",
    createdAt: now,
    updatedAt: now,
    title: "Increase cycling infrastructure lanes downtown",
    description:
      "Build protected bicycle infrastructure across arterial roads to expand safe cycling access.",
    status: "proposal",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: baseMeta,
    revisions: [],
    contributions: [],
    timeline: [],
  };

  // Verifier owns the peer Initiative so Workspace Collaboration Opportunities surface.
  const peer: Initiative = {
    initiativeId: peerId,
    stewardId: verifierMemberId,
    createdAt: now,
    updatedAt: now,
    title: "Improve cycling safety education programs",
    description:
      "Expand cycling safety education in schools and workplaces alongside infrastructure awareness.",
    status: "proposal",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: { ...baseMeta },
    revisions: [],
    contributions: [],
    timeline: [],
  };

  const unrelated: Initiative = {
    initiativeId: unrelatedId,
    stewardId: "member-ci-pack02-c",
    createdAt: now,
    updatedAt: now,
    title: "Library after-hours reading club expansion",
    description: "Extend library reading club hours for families and seniors.",
    status: "proposal",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "Education",
      tags: ["library", "literacy"],
      region: "Verification Region",
      language: "en",
      communitySlug: "ci-pack02-community",
      activityArea: "Education",
      countrySlug: "ca",
      regionSlug: "bc",
      participationScope: "community",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };

  createInitiative(source);
  createInitiative(peer);
  createInitiative(unrelated);

  if (
    listInitiatives().filter((item) =>
      [sourceId, peerId, unrelatedId].includes(item.initiativeId),
    ).length < 3
  ) {
    throw new Error("Failed to seed synthetic Initiatives for Pack 02 verification.");
  }

  setCommunityIntelligenceCacheEntry(peerId, {
    expiresAt: Date.now() + 60_000,
    items: [
      {
        initiativeId: sourceId,
        title: source.title,
        relationshipType: "related",
        score: 0.5,
        reasons: [{ code: "stale", message: "stale reason" }],
        sharedTopics: ["stale"],
        sharedParticipationAreas: ["Mobility"],
        sharedPriorities: [],
        keyDifferences: [],
        publicUrl: `/initiatives/public/${sourceId}`,
      },
    ],
    providerId: "deterministic",
    algorithmVersion: COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
  });
  invalidateCommunityIntelligenceCache(sourceId);
  if (getCommunityIntelligenceCacheEntry(peerId)) {
    throw new Error("Peer cache entry must invalidate when related Initiative updates.");
  }

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.get("/api/v1/health", (_req, res) => {
    res.status(200).json({
      success: true,
      data: { ok: true, database: isolatedDatabase },
    });
  });
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/assistant", assistantRouter);
  app.use("/api/v1/initiatives", initiativesRouter);
  app.use("/api/v1/workspace", workspaceHomeRouter);
  app.use("/api/v1/community-intelligence", communityIntelligenceRouter);
  app.use("/api/v1/public", publicCommunityIntelligenceRouter);
  app.use("/api/v1/public/initiatives", publicInitiativeExperienceRouter);
  app.use("/api/v1/public/initiatives", publicInitiativeRouter);

  const preferredPort = Number(process.env.CI_PACK02_PORT ?? (serveMode ? 4000 : 0));
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(preferredPort, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const relatedResponse = await fetch(
      `${baseUrl}/api/v1/public/community-intelligence/initiatives/${encodeURIComponent(sourceId)}/related`,
    );
    const relatedEnvelope = (await relatedResponse.json()) as {
      success: boolean;
      data: {
        items: Array<{
          initiativeId: string;
          relationshipType: string;
          reasons: Array<{ message: string }>;
          title: string;
        }>;
        audience: string;
        algorithmVersion: string;
      };
    };

    if (!relatedResponse.ok || !relatedEnvelope.success) {
      throw new Error(`Related Initiatives endpoint failed: ${relatedResponse.status}`);
    }
    if (relatedEnvelope.data.audience !== "public") {
      throw new Error("Public related endpoint must remain non-personalized.");
    }
    if (!relatedEnvelope.data.algorithmVersion) {
      throw new Error("algorithmVersion missing from related response.");
    }
    if (relatedEnvelope.data.items.length > 5) {
      throw new Error("Related Initiatives exceeded bounded max of 5.");
    }

    const peerHit = relatedEnvelope.data.items.find((item) => item.initiativeId === peerId);
    if (!peerHit) {
      throw new Error("Expected seeded complementary/related peer Initiative in results.");
    }
    if (!peerHit.reasons?.length) {
      throw new Error("Related result missing explainable reasons.");
    }
    if (peerHit.relationshipType === "duplicate") {
      throw new Error("Must never classify as authoritative duplicate.");
    }

    const publicInitiativeResponse = await fetch(
      `${baseUrl}/api/v1/public/initiatives/${encodeURIComponent(sourceId)}`,
    );
    if (!publicInitiativeResponse.ok) {
      throw new Error(`Public Initiative projection failed: ${publicInitiativeResponse.status}`);
    }

    const overlapUnauth = await fetch(`${baseUrl}/api/v1/community-intelligence/similarity-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: source.title,
        description: source.description,
        activityArea: "Mobility",
      }),
    });
    if (overlapUnauth.status !== 401 && overlapUnauth.status !== 403) {
      throw new Error(
        `Expected auth requirement for similarity-check, got ${overlapUnauth.status}`,
      );
    }

    // Near-duplicate of the seeded source so creation-check strong-overlap fires
    // (score >= COMMUNITY_INTELLIGENCE_STRONG_OVERLAP_SCORE) without blocking create.
    const overlapAuth = await fetch(`${baseUrl}/api/v1/community-intelligence/similarity-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: source.title,
        description: source.description,
        activityArea: "Mobility",
        tags: source.metadata.tags,
        region: source.metadata.region,
        participationScope: source.metadata.participationScope,
      }),
    });
    const overlapEnvelope = (await overlapAuth.json()) as {
      success: boolean;
      data: {
        hasStrongOverlap: boolean;
        items: Array<{ initiativeId: string; score?: number }>;
      };
    };
    if (!overlapAuth.ok || !overlapEnvelope.success) {
      throw new Error(`Authenticated similarity-check failed: ${overlapAuth.status}`);
    }
    if (
      !overlapEnvelope.data.items.some(
        (item) => item.initiativeId === sourceId || item.initiativeId === peerId,
      )
    ) {
      throw new Error("Strong-overlap draft check must surface seeded cycling Initiatives.");
    }
    if (!overlapEnvelope.data.hasStrongOverlap) {
      throw new Error(
        `Near-duplicate draft must set hasStrongOverlap=true (got items=${JSON.stringify(overlapEnvelope.data.items).slice(0, 400)})`,
      );
    }

    const weakOverlap = await fetch(`${baseUrl}/api/v1/community-intelligence/similarity-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: "Community pottery workshop nights",
        description: "Host monthly pottery workshops for residents.",
        activityArea: "Arts and Culture",
      }),
    });
    const weakEnvelope = (await weakOverlap.json()) as {
      success: boolean;
      data: { hasStrongOverlap: boolean };
    };
    if (weakEnvelope.data.hasStrongOverlap) {
      throw new Error("Unrelated draft must not trigger strong-overlap warning.");
    }

    const workspaceResponse = await fetch(
      `${baseUrl}/api/v1/community-intelligence/workspace-opportunities`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const workspaceEnvelope = (await workspaceResponse.json()) as {
      success: boolean;
      data: { items: unknown[] };
    };
    if (!workspaceResponse.ok || !workspaceEnvelope.success) {
      throw new Error(`Workspace opportunities failed: ${workspaceResponse.status}`);
    }
    if (workspaceEnvelope.data.items.length > 5) {
      throw new Error("Workspace opportunities must remain bounded to 5.");
    }

    const assistantResponse = await fetch(`${baseUrl}/api/v1/assistant/assist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        surfaceId: "initiative",
        operation: "answer_question",
        initiativeId: sourceId,
        instructions: "Are there similar Initiatives?",
      }),
    });
    const assistantEnvelope = (await assistantResponse.json()) as {
      success: boolean;
      data?: { suggestionText?: string; message?: string };
      message?: string;
    };
    if (!assistantResponse.ok) {
      throw new Error(
        `Assistant request failed: ${assistantResponse.status} ${JSON.stringify(assistantEnvelope)}`,
      );
    }
    const assistantText = JSON.stringify(assistantEnvelope).toLowerCase();
    // Deterministic grounding intentionally says "not a confirmed duplicate".
    // Only reject affirmative confirmed-duplicate claims.
    const claimsConfirmedDuplicate =
      /\b(is|are|as)\s+a?\s*confirmed\s+duplicates?\b/.test(assistantText) ||
      /\bconfirmed\s+duplicates?\b/.test(assistantText.replace(/not\s+a\s+confirmed\s+duplicate/g, " "));
    if (claimsConfirmedDuplicate) {
      throw new Error(
        `Assistant must not claim confirmed duplicate. Got: ${JSON.stringify(assistantEnvelope).slice(0, 500)}`,
      );
    }
    if (
      !assistantText.includes("possible") &&
      !assistantText.includes("related") &&
      !assistantText.includes("community intelligence")
    ) {
      throw new Error("Assistant response should reference Community Intelligence signals.");
    }

    updateInitiative(sourceId, {
      title: "Expand downtown protected cycling corridor network",
    });
    invalidateCommunityIntelligenceCache(sourceId);
    const refreshed = await findRelatedInitiativesForInitiative(sourceId, { bypassCache: true });
    if (!refreshed.items.some((item) => item.initiativeId === peerId)) {
      throw new Error("After update, peer relationship must still recompute.");
    }

    const report = {
      ok: true,
      baseUrl,
      database: isolatedDatabase,
      sourceInitiativeId: sourceId,
      peerInitiativeId: peerId,
      unrelatedInitiativeId: unrelatedId,
      relatedCount: relatedEnvelope.data.items.length,
      peerRelationshipType: peerHit.relationshipType,
      peerReasons: peerHit.reasons.map((reason) => reason.message),
      algorithmVersion: relatedEnvelope.data.algorithmVersion,
      audience: relatedEnvelope.data.audience,
      similarityCheckRequiresAuth: true,
      strongOverlapDetected: overlapEnvelope.data.hasStrongOverlap,
      weakOverlapHasStrong: weakEnvelope.data.hasStrongOverlap,
      workspaceItemCount: workspaceEnvelope.data.items.length,
      assistantHttpOk: true,
      serveMode,
      verifierEmail: `ci-pack02-${isolatedDatabase.slice(-8)}@example.com`,
      verifierPassword: "verify-password-123",
      guestPublicPath: `/initiatives/public/${sourceId}`,
    };

    console.log(JSON.stringify(report, null, 2));

    if (serveMode) {
      console.log(
        [
          "",
          "Pack 02 isolated API serving for browser matrix.",
          `  API: ${baseUrl}`,
          `  DB:  ${isolatedDatabase} (not humanity_union_dev)`,
          `  Guest page (Web): http://localhost:3000/initiatives/public/${sourceId}`,
          `  Workspace: http://localhost:3000/workspace`,
          `  Create: http://localhost:3000/initiatives/create`,
          `  Login: ${report.verifierEmail} / ${report.verifierPassword}`,
          "  Web must use NEXT_PUBLIC_API_BASE_URL=" + baseUrl,
          "  Ctrl+C to stop and drop isolated DB.",
          "",
        ].join("\n"),
      );

      await new Promise<void>((resolve) => {
        const shutdown = () => resolve();
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
      });
    }
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await disconnectMongoClient().catch(() => undefined);
    await cleanupDatabase().catch((error) => {
      console.error("Isolated DB cleanup failed:", error);
    });
  }
}

main().catch(async (error) => {
  console.error(error);
  try {
    await cleanupDatabase();
  } catch {
    // best-effort
  }
  process.exit(1);
});

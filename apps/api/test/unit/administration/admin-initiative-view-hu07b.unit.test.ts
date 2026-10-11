/**
 * HU-INIT-07B — administrator experience read.
 * Public endpoints stay closed. Auth lookups are injected so this test
 * does not connect to Mongo.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";
delete process.env.MONGODB_URI;

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

import express from "express";
import type { Initiative, PublicInitiativeExperienceProjection } from "@hu/types";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../../../src/modules/administration/administration.errors.js";
import { getAdminInitiativeExperience } from "../../../src/modules/administration/admin-initiative-directory.service.js";
import adminInitiativeDirectoryRouter from "../../../src/modules/administration/admin-initiative-directory.routes.js";
import { listDecisionsByInitiative } from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";
import publicInitiativeExperienceRouter from "../../../src/modules/initiatives/public-initiative-experience.routes.js";
import publicInitiativeRouter from "../../../src/modules/initiatives/public-initiative.routes.js";
import {
  createInitiative,
  deleteInitiative,
  getInitiativeById,
} from "../../../src/modules/initiatives/initiative.store.js";
import { publicInitiativeCollectiveDecisionsByInitiativeRouter } from "../../../src/modules/initiative-collective-decision/public-initiative-collective-decision.routes.js";
import { publicChoiceCandidatesByInitiativeRouter } from "../../../src/modules/public-choice-candidate/public-choice-candidate.routes.js";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");
const createdIds: string[] = [];
const FULL_DESCRIPTION = `${"The stored administrator description remains complete. ".repeat(12)}End.`;
const BLOCK_REASON = "HU07B internal block reason";

function initiative(initiativeId: string, overrides: Partial<Initiative> = {}): Initiative {
  const now = "2026-10-11T00:00:00.000Z";
  return {
    initiativeId,
    stewardId: "hu07b-steward",
    createdAt: now,
    updatedAt: now,
    title: `HU07B ${initiativeId}`,
    description: FULL_DESCRIPTION,
    status: "discussion",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "Governance",
      tags: [],
      region: "Ontario",
      language: "en",
      communitySlug: "",
      activityArea: "Governance",
      countrySlug: "ca",
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...overrides,
  };
}

function track(record: Initiative): Initiative {
  createdIds.push(record.initiativeId);
  return createInitiative(record);
}

function account(role: "admin" | "member"): AuthUserRecord {
  const now = "2026-10-11T00:00:00.000Z";
  return {
    userId: `hu07b-${role}`,
    email: `${role}@hu07b.test`,
    passwordHash: "unused",
    displayName: role,
    role,
    status: "active",
    memberId: `hu07b-${role}-member`,
    emailVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
  };
}

function findUser(userId: string): Promise<AuthUserRecord | null> {
  if (userId === "hu07b-admin") {
    return Promise.resolve(account("admin"));
  }
  if (userId === "hu07b-member") {
    return Promise.resolve(account("member"));
  }
  return Promise.resolve(null);
}

function experienceStub(
  record: Initiative,
): Promise<PublicInitiativeExperienceProjection> {
  return Promise.resolve({
    initiativeId: record.initiativeId,
    initiative: {
      initiativeId: record.initiativeId,
      title: record.title,
      description: record.description,
    },
  } as PublicInitiativeExperienceProjection);
}

after(() => {
  for (const initiativeId of createdIds) {
    deleteInitiative(initiativeId);
  }
});

describe("HU-INIT-07B admin Initiative experience", () => {
  it("returns the full experience and stored block reason for a blocked Initiative", async () => {
    const record = track(
      initiative("hu07b-blocked", {
        administrativelyBlocked: true,
        administrativeBlockReason: `  ${BLOCK_REASON}  `,
      }),
    );
    const before = JSON.stringify(getInitiativeById(record.initiativeId));
    const decisionsBefore = listDecisionsByInitiative(record.initiativeId);

    const view = await getAdminInitiativeExperience(
      { actorUserId: "hu07b-admin", initiativeId: record.initiativeId },
      { findAuthUserById: findUser, buildExperience: experienceStub },
    );

    assert.equal(view.administrativelyBlocked, true);
    assert.equal(view.administrativeBlockReason, BLOCK_REASON);
    assert.equal(view.experience.initiative.description, FULL_DESCRIPTION);
    assert.equal(JSON.stringify(getInitiativeById(record.initiativeId)), before);
    assert.deepEqual(listDecisionsByInitiative(record.initiativeId), decisionsBefore);
  });

  it("reports that no block reason was stored", async () => {
    const record = track(
      initiative("hu07b-blocked-no-reason", {
        administrativelyBlocked: true,
        lifecycleProfile: "PUBLIC_CHOICE",
      }),
    );
    const view = await getAdminInitiativeExperience(
      { actorUserId: "hu07b-admin", initiativeId: record.initiativeId },
      { findAuthUserById: findUser, buildExperience: experienceStub },
    );
    assert.equal(view.administrativelyBlocked, true);
    assert.equal(view.administrativeBlockReason, null);
    assert.equal(view.experience.initiative.description, FULL_DESCRIPTION);
  });

  it("rejects anonymous and non-admin callers", async () => {
    const record = track(initiative("hu07b-auth"));
    await assert.rejects(
      () =>
        getAdminInitiativeExperience(
          { actorUserId: "", initiativeId: record.initiativeId },
          { findAuthUserById: findUser, buildExperience: experienceStub },
        ),
      AdministrationUnauthorizedError,
    );
    await assert.rejects(
      () =>
        getAdminInitiativeExperience(
          { actorUserId: "hu07b-member", initiativeId: record.initiativeId },
          { findAuthUserById: findUser, buildExperience: experienceStub },
        ),
      AdministrationForbiddenError,
    );
  });

  it("does not modify the record when the canonical experience builder runs", async () => {
    const record = track(
      initiative("hu07b-canonical", {
        administrativelyBlocked: true,
        administrativeBlockReason: BLOCK_REASON,
        lifecycleProfile: "PUBLIC_CHOICE",
      }),
    );
    const before = JSON.stringify(getInitiativeById(record.initiativeId));
    const decisionsBefore = listDecisionsByInitiative(record.initiativeId);
    try {
      await getAdminInitiativeExperience(
        { actorUserId: "hu07b-admin", initiativeId: record.initiativeId },
        { findAuthUserById: findUser },
      );
    } catch {
      // Steward identity lookup requires Mongo. The read must still be side-effect free.
    }
    assert.equal(JSON.stringify(getInitiativeById(record.initiativeId)), before);
    assert.deepEqual(listDecisionsByInitiative(record.initiativeId), decisionsBefore);
  });

  it("rejects anonymous and non-admin HTTP callers and keeps public routes closed", async () => {
    track(
      initiative("hu07b-public-blocked", {
        administrativelyBlocked: true,
        administrativeBlockReason: BLOCK_REASON,
        title: "HU07B Secret Title",
        description: "HU07B Secret Description",
        lifecycleProfile: "PUBLIC_CHOICE",
      }),
    );
    const adminToken = createAccessToken({
      sub: "hu07b-admin",
      memberId: "hu07b-admin-member",
      role: "admin",
      displayName: "HU07B Admin",
      email: "hu07b-admin@example.test",
    });
    const memberToken = createAccessToken({
      sub: "hu07b-member",
      memberId: "hu07b-member-member",
      role: "member",
      displayName: "HU07B Member",
      email: "hu07b-member@example.test",
    });
    const app = express();
    app.use(express.json());
    app.use("/api/v1/initiatives", publicInitiativeRouter);
    app.use("/api/v1/public/initiatives", publicInitiativeExperienceRouter);
    app.use("/api/v1/public/initiatives", publicChoiceCandidatesByInitiativeRouter);
    app.use("/api/v1/public/initiatives", publicInitiativeCollectiveDecisionsByInitiativeRouter);
    app.use("/api/v1/admin/initiatives", adminInitiativeDirectoryRouter);
    const server: Server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      const paths = [
        "/api/v1/initiatives/hu07b-public-blocked",
        "/api/v1/public/initiatives/hu07b-public-blocked/experience",
        "/api/v1/public/initiatives/hu07b-public-blocked/candidates",
        "/api/v1/public/initiatives/hu07b-public-blocked/collective-decisions",
      ];
      for (const publicPath of paths) {
        const anonymous = await fetch(`${base}${publicPath}`);
        const asAdmin = await fetch(`${base}${publicPath}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const anonymousText = await anonymous.text();
        const adminText = await asAdmin.text();
        assert.equal(anonymous.status, 404, publicPath);
        assert.equal(asAdmin.status, 404, publicPath);
        assert.equal(anonymousText.includes(BLOCK_REASON), false);
        assert.equal(adminText.includes(BLOCK_REASON), false);
        assert.equal(anonymousText.includes("HU07B Secret"), false);
        assert.equal(adminText.includes("HU07B Secret"), false);
      }

      const anonymousAdmin = await fetch(
        `${base}/api/v1/admin/initiatives/hu07b-public-blocked/experience`,
      );
      const memberAdmin = await fetch(
        `${base}/api/v1/admin/initiatives/hu07b-public-blocked/experience`,
        { headers: { Authorization: `Bearer ${memberToken}` } },
      );
      const anonymousText = await anonymousAdmin.text();
      const memberText = await memberAdmin.text();
      assert.equal(anonymousAdmin.status, 401);
      assert.equal(anonymousText.includes(BLOCK_REASON), false);
      assert.equal(anonymousText.includes("HU07B Secret"), false);
      // Role rejection is AdministrationForbiddenError → 403 once the user
      // record can be read. This harness has no auth user store, so the
      // member request fails before that check and must not return the record.
      assert.notEqual(memberAdmin.status, 200);
      assert.notEqual(memberAdmin.status, 404);
      assert.equal(memberText.includes(BLOCK_REASON), false);
      assert.equal(memberText.includes("HU07B Secret"), false);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("does not add an admin bypass or a public block reason", () => {
    const projection = readFileSync(
      path.join(apiSrc, "modules/initiatives/public-initiative.projection.ts"),
      "utf8",
    );
    const eligibility = readFileSync(
      path.join(apiSrc, "modules/initiatives/initiative-public-projection.access.ts"),
      "utf8",
    );
    const routes = readFileSync(
      path.join(apiSrc, "modules/administration/admin-initiative-directory.routes.ts"),
      "utf8",
    );
    const service = readFileSync(
      path.join(apiSrc, "modules/administration/admin-initiative-directory.service.ts"),
      "utf8",
    );
    assert.match(routes, /instanceof AdministrationForbiddenError/);
    assert.match(routes, /return 403/);
    const experienceFn = service.slice(service.indexOf("export async function getAdminInitiativeExperience"));
    assert.doesNotMatch(projection, /administrativeBlockReason/);
    assert.match(eligibility, /!isInitiativeAdministrativelyBlocked\(initiative\)/);
    assert.match(experienceFn, /buildPublicInitiativeExperienceProjection\(\{\s*initiative: record \}\)/);
    assert.doesNotMatch(experienceFn, /viewerKey/);
    assert.doesNotMatch(experienceFn, /listPublicChoiceCandidatesForInitiative/);
    assert.doesNotMatch(experienceFn, /ensurePublicChoiceElectionVotingDecision/);
    assert.doesNotMatch(experienceFn, /updateInitiative/);
    assert.match(service, /administrativeBlockReason/);
  });
});

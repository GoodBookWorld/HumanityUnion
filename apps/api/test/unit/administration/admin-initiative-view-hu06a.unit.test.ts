/**
 * HU-INIT-06A — administrator-only Initiative detail.
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
import type { Initiative } from "@hu/types";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../../../src/modules/administration/administration.errors.js";
import { getAdminInitiativeDetail } from "../../../src/modules/administration/admin-initiative-directory.service.js";
import adminInitiativeDirectoryRouter from "../../../src/modules/administration/admin-initiative-directory.routes.js";
import publicInitiativeRouter from "../../../src/modules/initiatives/public-initiative.routes.js";
import {
  createInitiative,
  deleteInitiative,
  getInitiativeById,
} from "../../../src/modules/initiatives/initiative.store.js";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");
const createdIds: string[] = [];
const FULL_DESCRIPTION = `${"The stored administrator description remains complete. ".repeat(12)}End.`;

function initiative(
  initiativeId: string,
  overrides: Partial<Initiative> = {},
): Initiative {
  const now = "2026-10-11T00:00:00.000Z";
  return {
    initiativeId,
    stewardId: "hu06a-steward",
    createdAt: now,
    updatedAt: now,
    title: `HU06A ${initiativeId}`,
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
    userId: `hu06a-${role}`,
    email: `hu06a-${role}@example.test`,
    passwordHash: "not-used",
    displayName: role,
    role,
    status: "active",
    memberId: `hu06a-${role}-member`,
    emailVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
  };
}

const deps = {
  findAuthUserById: async (userId: string) => {
    if (userId === "hu06a-admin") {
      return account("admin");
    }
    if (userId === "hu06a-member") {
      return account("member");
    }
    return null;
  },
  findAuthUserByMemberId: async () => null,
  getPetitionByInitiativeId: async () => null,
};

async function view(initiativeId: string, actorUserId = "hu06a-admin") {
  return getAdminInitiativeDetail({ actorUserId, initiativeId }, deps);
}

after(() => {
  for (const initiativeId of createdIds) {
    deleteInitiative(initiativeId);
  }
});

describe("HU-INIT-06A admin Initiative view", () => {
  it("returns the full description for blocked, archived, steward-only, draft, and election records", async () => {
    assert.ok(FULL_DESCRIPTION.length > 280);
    track(
      initiative("hu06a-blocked", {
        administrativelyBlocked: true,
        administrativeBlockAuthority: "ADMIN",
      }),
    );
    track(
      initiative("hu06a-election", {
        lifecycleProfile: "PUBLIC_CHOICE",
        administrativelyBlocked: true,
        administrativeBlockAuthority: "ADMIN",
        title: "Blocked election",
      }),
    );
    track(initiative("hu06a-archived", { lifecyclePhase: "archived", status: "archived" }));
    track(
      initiative("hu06a-steward", {
        visibility: { policy: "steward_only" },
      }),
    );
    track(initiative("hu06a-draft", { lifecyclePhase: "draft", status: "draft" }));

    for (const initiativeId of [
      "hu06a-blocked",
      "hu06a-election",
      "hu06a-archived",
      "hu06a-steward",
      "hu06a-draft",
    ]) {
      const before = JSON.stringify(getInitiativeById(initiativeId));
      const detail = await view(initiativeId);
      assert.equal(detail.description, FULL_DESCRIPTION);
      assert.equal(detail.descriptionPreview, FULL_DESCRIPTION);
      assert.equal(detail.description.includes("…"), false);
      assert.equal(JSON.stringify(getInitiativeById(initiativeId)), before);
    }

    const election = await view("hu06a-election");
    assert.equal(election.lifecycleProfile, "PUBLIC_CHOICE");
    assert.equal(election.administrativelyBlocked, true);
    assert.equal(election.publicUrl, null);

    const archived = await view("hu06a-archived");
    assert.equal(archived.lifecyclePhase, "archived");
    const stewardOnly = await view("hu06a-steward");
    assert.equal(stewardOnly.visibility, "steward_only");
    const draft = await view("hu06a-draft");
    assert.equal(draft.lifecyclePhase, "draft");
    assert.equal(draft.status, "draft");
  });

  it("rejects a non-admin and an anonymous actor", async () => {
    track(initiative("hu06a-closed"));
    await assert.rejects(() => view("hu06a-closed", "hu06a-member"), AdministrationForbiddenError);
    await assert.rejects(() => view("hu06a-closed", "   "), AdministrationUnauthorizedError);
    await assert.rejects(() => view("hu06a-closed", "missing-user"), AdministrationForbiddenError);
  });

  it("keeps blocked public detail at 404 for anonymous and admin credentials", async () => {
    track(
      initiative("hu06a-public-blocked", {
        administrativelyBlocked: true,
        title: "HU06A Secret Title",
        description: "HU06A Secret Description",
      }),
    );
    const adminToken = createAccessToken({
      sub: "hu06a-admin",
      memberId: "hu06a-admin-member",
      role: "admin",
      displayName: "HU06A Admin",
      email: "hu06a-admin@example.test",
    });
    const app = express();
    app.use("/api/v1/initiatives", publicInitiativeRouter);
    app.use("/api/v1/admin/initiatives", adminInitiativeDirectoryRouter);
    const server: Server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const port = (server.address() as AddressInfo).port;

    try {
      const anonymous = await fetch(
        `http://127.0.0.1:${port}/api/v1/initiatives/hu06a-public-blocked`,
      );
      const adminPublic = await fetch(
        `http://127.0.0.1:${port}/api/v1/initiatives/hu06a-public-blocked`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      const anonymousAdmin = await fetch(
        `http://127.0.0.1:${port}/api/v1/admin/initiatives/hu06a-public-blocked`,
      );
      const anonymousText = await anonymous.text();
      const adminPublicText = await adminPublic.text();
      const anonymousAdminText = await anonymousAdmin.text();

      assert.equal(anonymous.status, 404);
      assert.equal(adminPublic.status, 404);
      assert.equal(anonymousText.includes("HU06A Secret"), false);
      assert.equal(adminPublicText.includes("HU06A Secret"), false);
      assert.equal(anonymousAdmin.status, 401);
      assert.equal(anonymousAdminText.includes("HU06A Secret"), false);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("does not add an admin bypass to the ordinary public Initiative route", () => {
    const route = readFileSync(
      path.join(apiSrc, "modules/initiatives/public-initiative.routes.ts"),
      "utf8",
    );
    assert.match(route, /canExposePublicInitiativeProjection/);
    assert.match(route, /Initiative not found\./);
    assert.doesNotMatch(route, /role === "admin"|req\.auth/);
    const service = readFileSync(
      path.join(apiSrc, "modules/administration/admin-initiative-directory.service.ts"),
      "utf8",
    );
    assert.match(service, /role !== "admin"/);
    assert.match(service, /description,/);
    assert.doesNotMatch(service, /description\.slice\(0,\s*277\)|description\.slice\(0,\s*280\)/);
    assert.doesNotMatch(service, /updateInitiative\(/);
  });
});

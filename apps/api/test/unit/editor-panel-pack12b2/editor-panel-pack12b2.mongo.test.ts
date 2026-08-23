/**
 * Pack 12B2 — Initiative Editor mutations with real Editor grants (isolated hu_test_*).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  dropIsolatedTestDatabase,
  TEST_DATABASE_ENV_VAR,
} from "../../../scripts/test-mongo-isolation.js";
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  AdministrationForbiddenError,
  AdministrationInsufficientCapabilityError,
  AdministrationScopeMismatchError,
} from "../../../src/modules/administration/administration.errors.js";
import {
  assignEditorGrant,
  deactivateEditorGrant,
  deleteEditorGrantsByParticipantIds,
  updateEditorGrant,
} from "../../../src/modules/editor-grants/index.js";
import {
  getInitiativeForEditor,
  updateInitiativeAsEditor,
} from "../../../src/modules/initiatives/initiative-editor.service.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const emailPrefix = `pack12b2-${testRunId}`;

function buildInitiative(input: {
  initiativeId: string;
  stewardId: string;
  countrySlug?: string;
  blocked?: boolean;
}): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: input.initiativeId,
    stewardId: input.stewardId,
    createdAt: now,
    updatedAt: now,
    title: "Scoped Initiative",
    description: "Original description",
    status: "proposal",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: {
      category: "civic",
      tags: [],
      region: "",
      language: "en",
      countrySlug: input.countrySlug ?? "CA",
      regionSlug: "BC",
      communitySlug: "vancouver",
      communityAssociation: "Test Association",
      participationScope: "community",
      activityArea: "civic",
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...(input.blocked
      ? {
          administrativelyBlocked: true,
          administrativelyBlockedAt: now,
          administrativelyBlockedByParticipantId: "admin-block",
        }
      : {}),
  };
}

describe("Pack 12B2 — Initiative Editor Mongo", () => {
  let adminUserId = "";
  let editorUserId = "";
  let editorParticipantId = "";
  let stewardParticipantId = "";
  let editorGrantId = "";
  let cleanupSucceeded = false;
  const initiativeIds: string[] = [];

  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    await ensureMongoIndexes();

    const admin = await insertAuthUser(
      {
        email: `${emailPrefix}-admin@example.com`,
        password: "Password123!",
        displayName: "12B2 Admin",
        role: "admin",
      },
      `member-admin-${testRunId}`,
    );
    adminUserId = admin.userId;

    const editor = await insertAuthUser(
      {
        email: `${emailPrefix}-editor@example.com`,
        password: "Password123!",
        displayName: "12B2 Editor",
        role: "member",
      },
      `member-editor-${testRunId}`,
    );
    editorUserId = editor.userId;
    editorParticipantId = editor.memberId;

    const steward = await insertAuthUser(
      {
        email: `${emailPrefix}-steward@example.com`,
        password: "Password123!",
        displayName: "12B2 Steward",
        role: "member",
      },
      `member-steward-${testRunId}`,
    );
    stewardParticipantId = steward.memberId;

    const grant = await assignEditorGrant({
      actorUserId: adminUserId,
      body: {
        participantId: editorParticipantId,
        capabilities: ["INITIATIVE_EDIT"],
        geographicScope: { level: "COUNTRY", countryCode: "CA" },
        status: "ACTIVE",
      },
    });
    editorGrantId = grant.editorGrantId;
  });

  after(async () => {
    for (const initiativeId of initiativeIds) {
      try {
        deleteInitiative(initiativeId);
      } catch {
        // ignore
      }
    }
    try {
      await deleteEditorGrantsByParticipantIds([editorParticipantId, stewardParticipantId]);
      await deleteAuthUsersByEmailPrefix(emailPrefix);
    } catch {
      // best effort before DB drop
    }

    const isolatedName = process.env[TEST_DATABASE_ENV_VAR]?.trim();
    const uri = process.env.MONGODB_URI?.trim();
    if (isolatedName?.startsWith("hu_test_") && uri) {
      try {
        await dropIsolatedTestDatabase({ databaseName: isolatedName, uri });
        cleanupSucceeded = true;
      } catch {
        cleanupSucceeded = false;
      }
    } else {
      cleanupSucceeded = false;
    }
    await disconnectMongoClient();
    assert.equal(cleanupSucceeded, true, "isolated hu_test_* database must be dropped");
  });

  it("updates in-scope Initiative; denies out-of-scope, blocked, and mid-session deactivation", async () => {
    const inScopeId = `initiative-12b2-ca-${testRunId}`;
    const outScopeId = `initiative-12b2-ua-${testRunId}`;
    const blockedId = `initiative-12b2-blocked-${testRunId}`;
    initiativeIds.push(inScopeId, outScopeId, blockedId);

    createInitiative(
      buildInitiative({
        initiativeId: inScopeId,
        stewardId: stewardParticipantId,
        countrySlug: "CA",
      }),
    );
    createInitiative(
      buildInitiative({
        initiativeId: outScopeId,
        stewardId: stewardParticipantId,
        countrySlug: "UA",
      }),
    );
    createInitiative(
      buildInitiative({
        initiativeId: blockedId,
        stewardId: stewardParticipantId,
        countrySlug: "CA",
        blocked: true,
      }),
    );

    const loaded = await getInitiativeForEditor({
      actorUserId: editorUserId,
      initiativeId: inScopeId,
    });
    assert.equal(loaded.stewardId, stewardParticipantId);

    const updated = await updateInitiativeAsEditor({
      actorUserId: editorUserId,
      initiativeId: inScopeId,
      body: { title: "Editor revised title", description: "Editor revised description" },
    });
    assert.equal(updated.title, "Editor revised title");
    assert.equal(updated.stewardId, stewardParticipantId);

    await assert.rejects(
      () =>
        updateInitiativeAsEditor({
          actorUserId: editorUserId,
          initiativeId: outScopeId,
          body: { title: "Should fail" },
        }),
      AdministrationScopeMismatchError,
    );

    await assert.rejects(
      () =>
        updateInitiativeAsEditor({
          actorUserId: editorUserId,
          initiativeId: blockedId,
          body: { title: "Should fail blocked" },
        }),
      /blocked by an administrator/i,
    );

    await updateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId,
      body: { capabilities: ["PUBLIC_CHOICE_EDIT"] },
    });
    await assert.rejects(
      () =>
        updateInitiativeAsEditor({
          actorUserId: editorUserId,
          initiativeId: inScopeId,
          body: { title: "No capability" },
        }),
      AdministrationInsufficientCapabilityError,
    );

    await updateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId,
      body: { capabilities: ["INITIATIVE_EDIT"] },
    });
    await deactivateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId,
    });
    await assert.rejects(
      () =>
        updateInitiativeAsEditor({
          actorUserId: editorUserId,
          initiativeId: inScopeId,
          body: { title: "Inactive editor" },
        }),
      AdministrationForbiddenError,
    );
  });
});

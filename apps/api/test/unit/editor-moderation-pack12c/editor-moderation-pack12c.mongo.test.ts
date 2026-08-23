/**
 * Pack 12C — Editor moderation Mongo: block/unblock precedence (isolated hu_test_*).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { Initiative } from "@hu/types";
import { resolveEffectiveModerationBlock } from "@hu/types";

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
} from "../../../src/modules/administration/administration.errors.js";
import {
  blockAdminInitiative,
  unblockAdminInitiative,
} from "../../../src/modules/administration/admin-initiative-moderation.service.js";
import {
  assignEditorGrant,
  deactivateEditorGrant,
  deleteEditorGrantsByParticipantIds,
  updateEditorGrant,
} from "../../../src/modules/editor-grants/index.js";
import {
  blockInitiativeAsEditor,
  unblockInitiativeAsEditor,
} from "../../../src/modules/editor-grants/editor-moderation.service.js";
import {
  createInitiative,
  deleteInitiative,
  getInitiativeById,
} from "../../../src/modules/initiatives/initiative.store.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const emailPrefix = `pack12c-${testRunId}`;

function buildInitiative(input: {
  initiativeId: string;
  stewardId: string;
  countrySlug?: string;
}): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: input.initiativeId,
    stewardId: input.stewardId,
    createdAt: now,
    updatedAt: now,
    title: "Moderation Target",
    description: "Original",
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
      communityAssociation: "Assoc",
      participationScope: "community",
      activityArea: "civic",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

describe("Pack 12C — Editor moderation Mongo", () => {
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
        displayName: "12C Admin",
        role: "admin",
      },
      `member-admin-${testRunId}`,
    );
    adminUserId = admin.userId;

    const editor = await insertAuthUser(
      {
        email: `${emailPrefix}-editor@example.com`,
        password: "Password123!",
        displayName: "12C Editor",
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
        displayName: "12C Steward",
        role: "member",
      },
      `member-steward-${testRunId}`,
    );
    stewardParticipantId = steward.memberId;

    const grant = await assignEditorGrant({
      actorUserId: adminUserId,
      body: {
        participantId: editorParticipantId,
        capabilities: ["INITIATIVE_EDIT", "INITIATIVE_MODERATE"],
        geographicScope: { level: "COUNTRY", countryCode: "CA" },
        status: "ACTIVE",
      },
    });
    editorGrantId = grant.editorGrantId;
  });

  after(async () => {
    for (const id of initiativeIds) {
      try {
        deleteInitiative(id);
      } catch {
        // ignore
      }
    }
    try {
      await deleteEditorGrantsByParticipantIds([editorParticipantId, stewardParticipantId]);
      await deleteAuthUsersByEmailPrefix(emailPrefix);
    } catch {
      // best effort
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
    }
    await disconnectMongoClient();
    assert.equal(cleanupSucceeded, true, "isolated hu_test_* database must be dropped");
  });

  it("Editor block/unblock; Admin supersedes; edit-only denied; inactive denied", async () => {
    const initiativeId = `initiative-12c-${testRunId}`;
    initiativeIds.push(initiativeId);
    createInitiative(
      buildInitiative({
        initiativeId,
        stewardId: stewardParticipantId,
        countrySlug: "CA",
      }),
    );

    await blockInitiativeAsEditor({
      actorUserId: editorUserId,
      initiativeId,
    });
    let current = getInitiativeById(initiativeId)!;
    let resolved = resolveEffectiveModerationBlock(current);
    assert.equal(resolved.isBlocked, true);
    if (resolved.isBlocked) {
      assert.equal(resolved.authority, "EDITOR");
    }

    await unblockInitiativeAsEditor({
      actorUserId: editorUserId,
      initiativeId,
    });
    current = getInitiativeById(initiativeId)!;
    assert.equal(resolveEffectiveModerationBlock(current).isBlocked, false);

    await blockInitiativeAsEditor({ actorUserId: editorUserId, initiativeId });
    await blockAdminInitiative({ actorUserId: adminUserId, initiativeId });
    current = getInitiativeById(initiativeId)!;
    resolved = resolveEffectiveModerationBlock(current);
    assert.equal(resolved.isBlocked, true);
    if (resolved.isBlocked) {
      assert.equal(resolved.authority, "ADMIN");
    }

    await assert.rejects(
      () => unblockInitiativeAsEditor({ actorUserId: editorUserId, initiativeId }),
      AdministrationForbiddenError,
    );

    await unblockAdminInitiative({ actorUserId: adminUserId, initiativeId });
    assert.equal(resolveEffectiveModerationBlock(getInitiativeById(initiativeId)!).isBlocked, false);

    await updateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId,
      body: { capabilities: ["INITIATIVE_EDIT"] },
    });
    await assert.rejects(
      () => blockInitiativeAsEditor({ actorUserId: editorUserId, initiativeId }),
      AdministrationInsufficientCapabilityError,
    );

    await updateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId,
      body: { capabilities: ["INITIATIVE_EDIT", "INITIATIVE_MODERATE"] },
    });
    await deactivateEditorGrant({ actorUserId: adminUserId, editorGrantId });
    await assert.rejects(
      () => blockInitiativeAsEditor({ actorUserId: editorUserId, initiativeId }),
      AdministrationForbiddenError,
    );
  });
});

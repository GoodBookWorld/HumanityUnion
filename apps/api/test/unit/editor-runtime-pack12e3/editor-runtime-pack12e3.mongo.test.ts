/**
 * Pack 12E3 — Editor assign + notification Mongo certification (isolated hu_test_*).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

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
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  activateEditorGrant,
  assignEditorGrant,
  deactivateEditorGrant,
  deleteEditorGrantsByParticipantIds,
  getAdminEditorSummary,
  listAdminEditors,
  resolveEditorViewerState,
  updateEditorGrant,
} from "../../../src/modules/editor-grants/index.js";
import { listMyNotifications } from "../../../src/modules/notifications/notification.service.js";
import { AdministrationValidationError } from "../../../src/modules/administration/administration.errors.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const emailPrefix = `pack12e3-${testRunId}`;

describe("Pack 12E3 — Editor runtime Mongo certification", () => {
  let adminUserId = "";
  let memberUserId = "";
  let memberParticipantId = "";
  let otherMemberUserId = "";
  let otherMemberParticipantId = "";
  let cleanupSucceeded = false;

  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    await ensureMongoIndexes();

    const admin = await insertAuthUser(
      {
        email: `${emailPrefix}-admin@example.com`,
        password: "Password123!",
        displayName: "12E3 Admin",
        role: "admin",
      },
      `member-admin-${testRunId}`,
    );
    adminUserId = admin.userId;

    const member = await insertAuthUser(
      {
        email: `${emailPrefix}-editor@example.com`,
        password: "Password123!",
        displayName: "12E3 Future Editor",
        role: "member",
      },
      `member-editor-${testRunId}`,
    );
    memberUserId = member.userId;
    memberParticipantId = member.memberId;

    const other = await insertAuthUser(
      {
        email: `${emailPrefix}-other@example.com`,
        password: "Password123!",
        displayName: "12E3 Other",
        role: "member",
      },
      `member-other-${testRunId}`,
    );
    otherMemberUserId = other.userId;
    otherMemberParticipantId = other.memberId;
  });

  after(async () => {
    try {
      await deleteEditorGrantsByParticipantIds([
        memberParticipantId,
        otherMemberParticipantId,
      ].filter(Boolean));
      await deleteAuthUsersByEmailPrefix(emailPrefix);
    } catch {
      // still drop DB
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

  it("assigns ACTIVE Editor, notifies once, lists grant, deactivates/reactivates", async () => {
    assert.equal(MONGO_COLLECTIONS.editorGrants, "editor_grants");
    assert.equal(MONGO_COLLECTIONS.memberNotifications, "member_notifications");

    const beforeViewer = await resolveEditorViewerState(memberParticipantId);
    assert.equal(beforeViewer.isEditor, false);

    const created = await assignEditorGrant({
      actorUserId: adminUserId,
      body: {
        participantId: memberParticipantId,
        capabilities: ["INITIATIVE_EDIT", "PUBLIC_CHOICE_EDIT"],
        geographicScope: { level: "COUNTRY", countryCode: "CA" },
        status: "ACTIVE",
      },
    });

    assert.equal(created.participantId, memberParticipantId);
    assert.equal(created.status, "ACTIVE");
    assert.deepEqual(created.capabilities, ["INITIATIVE_EDIT", "PUBLIC_CHOICE_EDIT"]);
    assert.equal(created.geographicScope.level, "COUNTRY");
    assert.equal(created.notificationDelivered, true);

    await assert.rejects(
      () =>
        assignEditorGrant({
          actorUserId: adminUserId,
          body: {
            participantId: memberParticipantId,
            capabilities: ["MEDIA_RESOURCE_EDIT"],
            geographicScope: { level: "WORLD" },
          },
        }),
      AdministrationValidationError,
    );

    const listed = await listAdminEditors({ actorUserId: adminUserId });
    assert.ok(listed.editors.some((row) => row.editorGrantId === created.editorGrantId));
    assert.ok(listed.activeCount >= 1);

    const summary = await getAdminEditorSummary({ actorUserId: adminUserId });
    assert.ok(summary.total >= 1);
    assert.ok(summary.activeCount >= 1);

    const viewer = await resolveEditorViewerState(memberParticipantId);
    assert.equal(viewer.isEditor, true);
    if (viewer.isEditor) {
      assert.equal(viewer.status, "ACTIVE");
    }

    const mine = await listMyNotifications({
      userId: memberUserId,
      status: "all",
      limit: 50,
      offset: 0,
    });
    const assignedNotes = mine.notifications.filter(
      (n) =>
        n.eventType === "editor_access_assigned" &&
        n.relatedEntityId === created.editorGrantId,
    );
    assert.equal(assignedNotes.length, 1);
    const note = assignedNotes[0]!;
    assert.equal(note.status, "unread");
    assert.equal(note.title, "Editor access assigned");
    assert.equal(note.relatedUrl, "/workspace/editor");
    assert.match(note.message, /Initiatives/);
    assert.match(note.message, /Public Choice/);
    assert.doesNotMatch(note.message, /INITIATIVE_EDIT/);
    assert.match(note.message, /Canada|CA|World/i);

    const otherMine = await listMyNotifications({
      userId: otherMemberUserId,
      status: "all",
      limit: 50,
      offset: 0,
    });
    assert.equal(
      otherMine.notifications.filter((n) => n.relatedEntityId === created.editorGrantId)
        .length,
      0,
    );

    const deactivated = await deactivateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId: created.editorGrantId,
    });
    assert.equal(deactivated.status, "INACTIVE");
    assert.equal(deactivated.notificationDelivered, true);

    const inactiveViewer = await resolveEditorViewerState(memberParticipantId);
    assert.equal(inactiveViewer.isEditor, true);
    if (inactiveViewer.isEditor) {
      assert.equal(inactiveViewer.status, "INACTIVE");
    }

    const afterDeactivate = await listMyNotifications({
      userId: memberUserId,
      status: "all",
      limit: 50,
      offset: 0,
    });
    assert.equal(
      afterDeactivate.notifications.filter((n) => n.eventType === "editor_access_deactivated")
        .length,
      1,
    );

    const reactivated = await activateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId: created.editorGrantId,
    });
    assert.equal(reactivated.status, "ACTIVE");
    assert.equal(reactivated.editorGrantId, created.editorGrantId);

    const afterActivate = await listMyNotifications({
      userId: memberUserId,
      status: "all",
      limit: 50,
      offset: 0,
    });
    assert.equal(
      afterActivate.notifications.filter((n) => n.eventType === "editor_access_activated")
        .length,
      1,
    );

    const noop = await updateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId: created.editorGrantId,
      body: {
        capabilities: ["INITIATIVE_EDIT", "PUBLIC_CHOICE_EDIT"],
        geographicScope: { level: "COUNTRY", countryCode: "CA" },
        status: "ACTIVE",
      },
    });
    assert.equal(noop.notificationDelivered, true);

    const afterNoop = await listMyNotifications({
      userId: memberUserId,
      status: "all",
      limit: 50,
      offset: 0,
    });
    assert.equal(
      afterNoop.notifications.filter((n) => n.eventType === "editor_permissions_updated")
        .length,
      0,
    );

    const capsChanged = await updateEditorGrant({
      actorUserId: adminUserId,
      editorGrantId: created.editorGrantId,
      body: {
        capabilities: ["INITIATIVE_EDIT", "MEDIA_RESOURCE_EDIT"],
      },
    });
    assert.equal(capsChanged.notificationDelivered, true);
    const afterCaps = await listMyNotifications({
      userId: memberUserId,
      status: "all",
      limit: 50,
      offset: 0,
    });
    assert.equal(
      afterCaps.notifications.filter((n) => n.eventType === "editor_permissions_updated")
        .length,
      1,
    );
  });
});

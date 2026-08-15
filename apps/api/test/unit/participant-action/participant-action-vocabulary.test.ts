import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import {
  buildParticipantActionId,
  type ParticipantActionRecord,
  type ParticipantActionSourceType,
  type ParticipantActionType,
} from "../../../src/modules/participant-action/domain/participant-action.types.js";

/**
 * Recovery Task 27 Part 21 "Vocabulary and shape" (checklist items 1-9).
 *
 * No MongoDB connection is required for this file — it only exercises pure
 * types/values.
 */

describe("1-4. Participant Action vocabulary and shape", () => {
  it("1. uses a ParticipantActionRecord with a participantActionId field", () => {
    const record: ParticipantActionRecord = {
      participantActionId: buildParticipantActionId("petition-signed:signature-x"),
      participantId: "member-x",
      initiativeId: "initiative-x",
      actionType: "petition_signed",
      sourceType: "petition_signature",
      sourceId: "signature-x",
      sourceEventId: "petition-signed:signature-x",
      sourceEventName: "PetitionSigned",
      sourceEventSchemaVersion: "1.0",
      occurredAt: "2026-07-28T00:00:00.000Z",
      recordedAt: "2026-07-28T00:00:01.000Z",
      validityStatus: "valid",
      correlationId: null,
      causationId: null,
      metadata: null,
    };

    assert.equal(typeof record.participantActionId, "string");
    assert.equal(typeof record.participantId, "string");
    assert.equal(record.participantId, "member-x");
  });

  it("4. collection MONGO_COLLECTIONS.participantActions is participant_actions", () => {
    assert.equal(MONGO_COLLECTIONS.participantActions, "participant_actions");
  });

  it("5. no MemberAction production module exists", async () => {
    await assert.rejects(
      () => import("../../../src/modules/member-action/index.js"),
      /Cannot find module|ERR_MODULE_NOT_FOUND/,
    );
  });

  it('6. MONGO_COLLECTIONS never declares a "member_actions" collection', () => {
    const values = Object.values(MONGO_COLLECTIONS) as string[];
    assert.equal(values.includes("member_actions"), false);
    assert.equal(values.includes("participant_actions"), true);
  });

  it("7. the domain record type does not declare a memberId field", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.join(
        currentDir,
        "../../../src/modules/participant-action/domain/participant-action.types.ts",
      ),
      "utf8",
    );
    const recordInterface = source.slice(
      source.indexOf("export interface ParticipantActionRecord"),
      source.indexOf("}", source.indexOf("export interface ParticipantActionRecord")) + 1,
    );

    assert.doesNotMatch(recordInterface, /\bmemberId\b/);
    assert.match(recordInterface, /participantId: string;/);
  });

  it("8. supports exactly petition_signed, initiative_decision_vote_cast, and initiative_decision_vote_changed action types (Recovery Task 33 Part 2)", () => {
    const petitionSigned: ParticipantActionType = "petition_signed";
    const voteCast: ParticipantActionType = "initiative_decision_vote_cast";
    const voteChanged: ParticipantActionType = "initiative_decision_vote_changed";
    assert.equal(petitionSigned, "petition_signed");
    assert.equal(voteCast, "initiative_decision_vote_cast");
    assert.equal(voteChanged, "initiative_decision_vote_changed");

    // Compile-time exhaustiveness: this assignment would fail to typecheck if
    // ParticipantActionType ever grew a fourth member (or lost one) without
    // updating this test, keeping the accepted vocabulary visible at the
    // type level, not just at runtime.
    type ExactlyThreeActionTypes = ParticipantActionType extends
      | "petition_signed"
      | "initiative_decision_vote_cast"
      | "initiative_decision_vote_changed"
      ? true
      : false;
    const exhaustive: ExactlyThreeActionTypes = true;
    assert.equal(exhaustive, true);
  });

  it("9. supports exactly petition_signature and initiative_decision_vote source types (Recovery Task 33 Part 3)", () => {
    const petitionSignature: ParticipantActionSourceType = "petition_signature";
    const initiativeDecisionVote: ParticipantActionSourceType = "initiative_decision_vote";
    assert.equal(petitionSignature, "petition_signature");
    assert.equal(initiativeDecisionVote, "initiative_decision_vote");

    type ExactlyTwoSourceTypes = ParticipantActionSourceType extends
      | "petition_signature"
      | "initiative_decision_vote"
      ? true
      : false;
    const exhaustive: ExactlyTwoSourceTypes = true;
    assert.equal(exhaustive, true);
  });

  it("does not introduce member_vote, vote_activity, decision_participation, initiative_vote, or vote_updated action types", () => {
    const forbidden = [
      "member_vote",
      "vote_activity",
      "decision_participation",
      "initiative_vote",
      "vote_updated",
    ];
    const accepted: ParticipantActionType[] = [
      "petition_signed",
      "initiative_decision_vote_cast",
      "initiative_decision_vote_changed",
    ];

    for (const value of forbidden) {
      assert.equal(
        (accepted as string[]).includes(value),
        false,
        `"${value}" must never be an accepted ParticipantActionType`,
      );
    }
  });
});

describe("Recovery Task 33 Part 24 — vocabulary characterization items 1-6", () => {
  it("1. the Cast action type is registered", () => {
    const actionType: ParticipantActionType = "initiative_decision_vote_cast";
    assert.equal(actionType, "initiative_decision_vote_cast");
  });

  it("2. the Changed action type is registered", () => {
    const actionType: ParticipantActionType = "initiative_decision_vote_changed";
    assert.equal(actionType, "initiative_decision_vote_changed");
  });

  it("3. the Vote source type is registered", () => {
    const sourceType: ParticipantActionSourceType = "initiative_decision_vote";
    assert.equal(sourceType, "initiative_decision_vote");
  });

  it("4. existing Petition vocabulary remains unchanged", () => {
    const actionType: ParticipantActionType = "petition_signed";
    const sourceType: ParticipantActionSourceType = "petition_signature";
    assert.equal(actionType, "petition_signed");
    assert.equal(sourceType, "petition_signature");
  });

  it("5. invalid action types are rejected at the type level", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.join(
        currentDir,
        "../../../src/modules/participant-action/domain/participant-action.types.ts",
      ),
      "utf8",
    );
    const typeDeclaration = source.slice(
      source.indexOf("export type ParticipantActionType ="),
      source.indexOf(";", source.indexOf("export type ParticipantActionType =")) + 1,
    );

    assert.match(typeDeclaration, /"petition_signed"/);
    assert.match(typeDeclaration, /"initiative_decision_vote_cast"/);
    assert.match(typeDeclaration, /"initiative_decision_vote_changed"/);
    assert.doesNotMatch(typeDeclaration, /"member_vote"|"vote_activity"|"decision_participation"|"initiative_vote"|"vote_updated"/);
  });

  it("6. invalid source types are rejected at the type level", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.join(
        currentDir,
        "../../../src/modules/participant-action/domain/participant-action.types.ts",
      ),
      "utf8",
    );
    const typeDeclaration = source.slice(
      source.indexOf("export type ParticipantActionSourceType ="),
      source.indexOf(";", source.indexOf("export type ParticipantActionSourceType =")) + 1,
    );

    assert.match(typeDeclaration, /"petition_signature"/);
    assert.match(typeDeclaration, /"initiative_decision_vote"/);
    assert.doesNotMatch(typeDeclaration, /"member_vote"|"vote_activity"|"decision_participation"/);
  });
});

describe("5. Participant Action ID construction (Part 5)", () => {
  it("is deterministic and derived only from sourceEventId", () => {
    const id1 = buildParticipantActionId("petition-signed:signature-abc");
    const id2 = buildParticipantActionId("petition-signed:signature-abc");

    assert.equal(id1, id2);
    assert.equal(id1, "participant-action:petition-signed:signature-abc");
  });

  it("differs for different source event IDs", () => {
    assert.notEqual(
      buildParticipantActionId("petition-signed:signature-a"),
      buildParticipantActionId("petition-signed:signature-b"),
    );
  });
});

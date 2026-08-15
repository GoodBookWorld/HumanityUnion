import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { toCanonicalEnvelope } from "../../../src/infrastructure/events/event-envelope.js";
import { createPetitionSignedEvent } from "../../../src/modules/petition/petition-signed.event.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { handlePetitionSignedForParticipantAction } from "../../../src/modules/participant-action/application/petition-signed.participant-action-handler.js";
import {
  countParticipantActionsBySourceEventId,
  deleteParticipantActionsBySourceEventIdForTests,
  findParticipantActionBySourceEventId,
  setForceParticipantActionInsertFailureForTests,
} from "../../../src/modules/participant-action/infrastructure/participant-action.repository.js";
import { getMemberById } from "../../../src/modules/member/member-access.js";
import { sampleMember } from "../../../src/modules/member/member.sample.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

/**
 * Recovery Task 27 Part 21 "Consumer" (checklist items 40-53).
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(currentDir, "../../..");
const apiSrcDir = path.join(apiRoot, "src");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdSourceEventIds: string[] = [];

function buildEnvelope(label: string, participantId = sampleMember.id) {
  const event = createPetitionSignedEvent({
    petitionId: `petition-consumer-${label}-${testRunId}`,
    signatureId: `signature-consumer-${label}-${testRunId}`,
    participantId,
    initiativeId: `initiative-consumer-${label}-${testRunId}`,
    participationMode: "Public",
    signedAt: "2026-07-28T12:00:00.000Z",
  });
  const envelope = toCanonicalEnvelope(event);
  createdSourceEventIds.push(envelope.eventId);

  return envelope;
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
  setForceParticipantActionInsertFailureForTests(false);
});

after(async () => {
  setForceParticipantActionInsertFailureForTests(false);

  for (const sourceEventId of createdSourceEventIds) {
    await deleteParticipantActionsBySourceEventIdForTests(sourceEventId);
  }

  await disconnectMongoClient();
});

describe("40. PetitionSigned creates one Participant Action", () => {
  it("handling a valid envelope inserts exactly one Participant Action", async () => {
    const envelope = buildEnvelope("valid-once");

    await handlePetitionSignedForParticipantAction(envelope);

    const count = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(count, 1);

    const record = await findParticipantActionBySourceEventId(envelope.eventId);
    assert.equal(record?.participantId, sampleMember.id);
  });
});

describe("41-45. Zero additional source lookups", () => {
  const handlerSource = readFileSync(
    path.join(
      apiSrcDir,
      "modules/participant-action/application/petition-signed.participant-action-handler.ts",
    ),
    "utf8",
  );
  const mapperSource = readFileSync(
    path.join(
      apiSrcDir,
      "modules/participant-action/application/petition-signed-to-participant-action.mapper.ts",
    ),
    "utf8",
  );
  const combinedSource = `${handlerSource}\n${mapperSource}`;

  it("41. zero Petition lookups", () => {
    assert.doesNotMatch(combinedSource, /getPetition\(/);
  });

  it("42. zero Signature lookups", () => {
    assert.doesNotMatch(
      combinedSource,
      /findSignatureByPetitionAndMember\(|listSignaturesByPetitionId\(/,
    );
  });

  it("43. zero Participant lookups", () => {
    assert.doesNotMatch(combinedSource, /getMemberById\(|getParticipantById\(/);
  });

  it("44. zero Initiative lookups", () => {
    assert.doesNotMatch(combinedSource, /getInitiativeById\(|validateDirectInitiativeAncestry\(/);
  });

  it("45. zero Member-status lookups", () => {
    assert.doesNotMatch(
      combinedSource,
      /getMembership|resolveMembershipCohortLabel|MembershipRecord/,
    );
  });

  it("the consumer imports nothing from the Petition, Member, Initiative, or Membership persistence modules", () => {
    assert.doesNotMatch(handlerSource, /from ".*\/petition\//);
    assert.doesNotMatch(handlerSource, /from ".*\/member\//);
    assert.doesNotMatch(handlerSource, /from ".*\/initiatives\//);
    assert.doesNotMatch(handlerSource, /from ".*\/membership\//);
  });
});

describe("46. Re-delivery does not duplicate", () => {
  it("handling the same envelope twice leaves exactly one row", async () => {
    const envelope = buildEnvelope("re-delivery");

    await handlePetitionSignedForParticipantAction(envelope);
    await handlePetitionSignedForParticipantAction(envelope);

    const count = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(count, 1);
  });
});

describe("47. Insert failure leaves event retryable", () => {
  it("a forced Mongo insert failure throws and inserts nothing", async () => {
    const envelope = buildEnvelope("insert-failure");

    setForceParticipantActionInsertFailureForTests(true);
    try {
      await assert.rejects(() => handlePetitionSignedForParticipantAction(envelope));
    } finally {
      setForceParticipantActionInsertFailureForTests(false);
    }

    const count = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(count, 0);

    // Retryable: a subsequent, non-forced-failure handling of the exact same
    // envelope now succeeds and inserts the record.
    await handlePetitionSignedForParticipantAction(envelope);
    const countAfterRetry = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(countAfterRetry, 1);
  });
});

describe("48. Malformed event inserts nothing", () => {
  it("a wrong-event-name envelope throws and inserts nothing", async () => {
    const envelope = buildEnvelope("malformed");
    const malformed = { ...envelope, eventName: "SomethingElseHappened" };

    await assert.rejects(() => handlePetitionSignedForParticipantAction(malformed));

    const count = await countParticipantActionsBySourceEventId(envelope.eventId);
    assert.equal(count, 0);
  });
});

describe("49. No Activity write occurs", () => {
  it("the activities collection gains no document from handling the event", async () => {
    const envelope = buildEnvelope("no-activity");

    const before = await getMongoCollection(MONGO_COLLECTIONS.activities).estimatedDocumentCount();
    await handlePetitionSignedForParticipantAction(envelope);
    const afterHandling = await getMongoCollection(
      MONGO_COLLECTIONS.activities,
    ).estimatedDocumentCount();

    assert.equal(afterHandling, before);
  });
});

describe("50. No Fair mutation occurs", () => {
  it("sampleMember.fair is unchanged after handling the event", async () => {
    const envelope = buildEnvelope("no-fair", sampleMember.id);

    const before = await getMemberById(sampleMember.id);
    await handlePetitionSignedForParticipantAction(envelope);
    const afterHandling = await getMemberById(sampleMember.id);

    assert.deepEqual(afterHandling?.fair, before?.fair);
  });
});

describe("51. No Membership status change occurs", () => {
  it("the consumer/mapper source performs no Membership write call", () => {
    assert.doesNotMatch(
      handlerSourceCombined(),
      /updateMembership|setMembershipStatus|promoteToMember/,
    );
  });
});

describe("52. No notification occurs", () => {
  it("the consumer imports no notification module", () => {
    assert.doesNotMatch(handlerSourceCombined(), /notifications\//);
  });
});

describe("53. No public API is created", () => {
  it("the participant-action module exports no Express router", async () => {
    const moduleExports = await import("../../../src/modules/participant-action/index.js");
    assert.equal("router" in moduleExports, false);
    assert.equal("participantActionRouter" in moduleExports, false);
  });

  it("no HTTP route file exists under the participant-action module", async () => {
    await assert.rejects(
      () => import("../../../src/modules/participant-action/api/participant-action.routes.js"),
      /Cannot find module|ERR_MODULE_NOT_FOUND/,
    );
  });
});

function handlerSourceCombined(): string {
  const handlerSource = readFileSync(
    path.join(
      apiSrcDir,
      "modules/participant-action/application/petition-signed.participant-action-handler.ts",
    ),
    "utf8",
  );
  const mapperSource = readFileSync(
    path.join(
      apiSrcDir,
      "modules/participant-action/application/petition-signed-to-participant-action.mapper.ts",
    ),
    "utf8",
  );
  const repositorySource = readFileSync(
    path.join(
      apiSrcDir,
      "modules/participant-action/infrastructure/participant-action.repository.ts",
    ),
    "utf8",
  );

  return `${handlerSource}\n${mapperSource}\n${repositorySource}`;
}

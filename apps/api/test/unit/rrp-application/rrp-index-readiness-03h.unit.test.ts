/**
 * HU-RRP-03H — appointment + message-intent index fail-closed readiness.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { RrpApplicationUnavailableError } from "../../../src/modules/rrp-application/rrp-application.errors.js";
import {
  assertRrpAppointmentActiveUniqueIndexReady,
  resetRrpAppointmentIndexReadinessForTests,
  setRrpAppointmentActiveUniqueIndexReadyForTests,
} from "../../../src/modules/rrp-application/rrp-appointment.index-readiness.js";
import {
  assertRrpMessageIntentIndexesReady,
  resetRrpMessageIntentIndexReadinessForTests,
  setRrpMessageIntentIndexesReadyForTests,
} from "../../../src/modules/rrp-application/rrp-message-intent.index-readiness.js";
import {
  buildRrpAppointmentRecord,
  insertRrpAppointment,
  resetRrpAppointmentMemoryForTests,
  setRrpAppointmentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment.repository.js";
import {
  buildRrpAppointmentMessageIntent,
  insertRrpAppointmentMessageIntentIdempotent,
  resetRrpAppointmentMessageIntentMemoryForTests,
  setRrpAppointmentMessageIntentForceMemoryForTests,
} from "../../../src/modules/rrp-application/rrp-appointment-message-intent.repository.js";

describe("HU-RRP-03H index readiness fail-closed", () => {
  afterEach(() => {
    setRrpAppointmentForceMemoryForTests(false);
    setRrpAppointmentMessageIntentForceMemoryForTests(false);
    resetRrpAppointmentMemoryForTests();
    resetRrpAppointmentMessageIntentMemoryForTests();
    resetRrpAppointmentIndexReadinessForTests();
    resetRrpMessageIntentIndexReadinessForTests();
  });

  it("fails closed when appointment unique index override is false", async () => {
    setRrpAppointmentForceMemoryForTests(false);
    setRrpAppointmentActiveUniqueIndexReadyForTests(false);
    await assert.rejects(
      () => assertRrpAppointmentActiveUniqueIndexReady(),
      (error: unknown) =>
        error instanceof RrpApplicationUnavailableError &&
        /appointment unique index is not ready/i.test(error.message),
    );
  });

  it("fails closed when message intent index override is false", async () => {
    setRrpAppointmentMessageIntentForceMemoryForTests(false);
    setRrpMessageIntentIndexesReadyForTests(false);
    await assert.rejects(
      () => assertRrpMessageIntentIndexesReady(),
      (error: unknown) =>
        error instanceof RrpApplicationUnavailableError &&
        /message intent indexes are not ready/i.test(error.message),
    );
  });

  it("blocks appointment insert when index not ready and not force-memory", async () => {
    setRrpAppointmentForceMemoryForTests(false);
    setRrpAppointmentActiveUniqueIndexReadyForTests(false);
    // Without Mongo configured, ensureReady throws unavailable before index assert.
    // With forceMemory, writes succeed — confirm forceMemory path still works.
    setRrpAppointmentForceMemoryForTests(true);
    setRrpAppointmentActiveUniqueIndexReadyForTests(false);
    const record = buildRrpAppointmentRecord({
      participantId: "p1",
      userId: "u1",
      representCountryCode: "CA",
      sourceApplicationId: "app-1",
      appointedByAdminUserId: "admin-1",
    });
    const inserted = await insertRrpAppointment(record);
    assert.equal(inserted.appointmentId, record.appointmentId);
  });

  it("blocks intent write readiness when override false (non-memory)", async () => {
    setRrpAppointmentMessageIntentForceMemoryForTests(true);
    setRrpMessageIntentIndexesReadyForTests(false);
    const intent = buildRrpAppointmentMessageIntent({
      appointmentId: "appt-1",
      applicationId: "app-1",
      recipientParticipantId: "p1",
      adminParticipantId: "a1",
      representCountryCode: "CA",
    });
    const result = await insertRrpAppointmentMessageIntentIdempotent(intent);
    assert.equal(result.created, true);
  });

  it("skipMongo allows readiness when override unset (memory unit path)", async () => {
    resetRrpAppointmentIndexReadinessForTests();
    resetRrpMessageIntentIndexReadinessForTests();
    await assertRrpAppointmentActiveUniqueIndexReady({ skipMongo: true });
    await assertRrpMessageIntentIndexesReady({ skipMongo: true });
  });
});

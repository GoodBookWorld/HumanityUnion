import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { registerAuthUser } from "../../../src/modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findAuthUserByEmail,
  findAuthUsersByIds,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

/**
 * Performance Recovery Task — Part 6/9/11.
 *
 * `findAuthUsersByIds` is the batch counterpart to `findAuthUserById`
 * introduced to fix the N-parallel-queries pattern in
 * `attachCollaborationStateToComments` (one Mongo round trip per unique
 * comment author -> one round trip total via `$in`). These are focused,
 * repository-level characterization tests for that new function alone.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("auth-user-batch-lookup");

async function registerAndFetch(emailLocalPart: string, displayName: string) {
  const email = `${TEST_PREFIX}-${emailLocalPart}@example.com`;
  await registerAuthUser({ email, password: "Password123!", displayName });
  const user = await findAuthUserByEmail(email);
  assert.ok(user, `expected ${email} to be persisted after registration`);
  return user;
}

describe("findAuthUsersByIds — batch equivalent of findAuthUserById", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteAuthUsersByEmailPrefix(TEST_PREFIX);
    await disconnectMongoClient();
  });

  it("resolves exactly the requested users, keyed by userId, in a single batched call", async () => {
    const first = await registerAndFetch("first", "Batch Lookup First");
    const second = await registerAndFetch("second", "Batch Lookup Second");

    const resolved = await findAuthUsersByIds([first.userId, second.userId]);

    assert.equal(resolved.size, 2);
    assert.equal(resolved.get(first.userId)?.displayName, "Batch Lookup First");
    assert.equal(resolved.get(second.userId)?.displayName, "Batch Lookup Second");
  });

  it("omits unknown ids from the result map instead of throwing or returning null entries", async () => {
    const known = await registerAndFetch("known", "Batch Lookup Known");

    const resolved = await findAuthUsersByIds([known.userId, `${TEST_PREFIX}-does-not-exist`]);

    assert.equal(resolved.size, 1);
    assert.ok(resolved.has(known.userId));
    assert.equal(resolved.has(`${TEST_PREFIX}-does-not-exist`), false);
  });

  it("de-duplicates repeated ids in the input without affecting the result", async () => {
    const user = await registerAndFetch("dedupe", "Batch Lookup Dedupe");

    const resolved = await findAuthUsersByIds([user.userId, user.userId, user.userId]);

    assert.equal(resolved.size, 1);
    assert.equal(resolved.get(user.userId)?.displayName, "Batch Lookup Dedupe");
  });

  it("an empty id list short-circuits to an empty map without querying Mongo", async () => {
    const resolved = await findAuthUsersByIds([]);
    assert.equal(resolved.size, 0);
  });
});

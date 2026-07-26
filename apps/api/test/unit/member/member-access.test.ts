import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  getMemberById,
  getMemberByIdSync,
  updateMemberProfile,
} from "../../../src/modules/member/member-access.js";
import { toMemberDomain } from "../../../src/modules/member/infrastructure/member.persistence.js";
import {
  deleteMembersByMemberIdPrefix,
  insertMember,
} from "../../../src/modules/member/infrastructure/member.repository.js";
import { clearMemberReadCacheForTests } from "../../../src/modules/member/infrastructure/member-read-cache.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("member-access");

describe("member access layer", () => {
  before(async () => {
    clearMemberReadCacheForTests();
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    clearMemberReadCacheForTests();
    await deleteMembersByMemberIdPrefix(TEST_PREFIX);
    await disconnectMongoClient();
  });

  it("returns Mongo Member through async access layer and sync cache", async () => {
    const memberId = `${TEST_PREFIX}-member`;
    const identityId = `${TEST_PREFIX}-identity`;

    await insertMember({
      memberId,
      identityId,
      displayName: "Access Layer Member",
      uniqueName: `${TEST_PREFIX}-unique`,
    });

    clearMemberReadCacheForTests();

    const member = await getMemberById(memberId);
    assert.ok(member);
    assert.equal(member.profile.displayName, "Access Layer Member");

    const cached = getMemberByIdSync(memberId);
    assert.ok(cached);
    assert.equal(cached.id, member.id);
    assert.equal(cached.profile.displayName, member.profile.displayName);
  });

  it("persists PATCH updates through access layer and returns updated Member on GET", async () => {
    const memberId = `${TEST_PREFIX}-patch-member`;
    const identityId = `${TEST_PREFIX}-patch-identity`;

    await insertMember({
      memberId,
      identityId,
      displayName: "Before Patch",
      uniqueName: `${TEST_PREFIX}-patch-unique`,
    });

    const updated = await updateMemberProfile(memberId, {
      displayName: "After Patch",
      country: "Canada",
      languages: ["en", "fr"],
    });

    assert.ok(updated);
    assert.equal(updated.profile.displayName, "After Patch");
    assert.equal(updated.profile.country, "Canada");
    assert.deepEqual(updated.profile.languages, ["en", "fr"]);

    const loaded = await getMemberById(memberId);
    assert.ok(loaded);
    assert.equal(loaded.profile.displayName, "After Patch");
    assert.equal(loaded.profile.country, "Canada");
    assert.equal(getMemberByIdSync(memberId)?.profile.displayName, "After Patch");
  });

  it("maps persisted record to identical Member domain model", async () => {
    const memberId = `${TEST_PREFIX}-domain`;
    const identityId = `${TEST_PREFIX}-domain-identity`;

    const persisted = await insertMember({
      memberId,
      identityId,
      displayName: "Domain Mapping",
      uniqueName: `${TEST_PREFIX}-domain-unique`,
    });

    const fromAccess = await getMemberById(memberId);
    const fromMapper = toMemberDomain(persisted);

    assert.deepEqual(fromAccess, fromMapper);
  });
});

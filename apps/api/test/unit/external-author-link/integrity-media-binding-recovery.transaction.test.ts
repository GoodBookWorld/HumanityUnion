import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import {
  IntegrityMediaBindingRecoveryIncompleteError,
  isBindingRecoveryMemberDuplicate,
  isMongoTransactionUnsupportedError,
  recoveryResultFromCommittedReceipt,
  resolveAbortedBindingRecovery,
  type BindingRecoveryApplyResult,
  type IntegrityMediaBindingRecoveryRequest,
} from "../../../src/modules/external-author-link/external-author-link.binding-recovery.js";
import {
  EXTERNAL_AUTHOR_LINK_INDEXES,
  EXTERNAL_AUTHOR_LINK_RECOVERY_RECEIPT_INDEXES,
} from "../../../src/modules/external-author-link/external-author-link.indexes.js";
import type { ExternalAuthorLinkRecoveryReceiptRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const storeSource = readFileSync(
  path.join(apiRoot, "src/modules/external-author-link/external-author-link.store.ts"),
  "utf8",
);
const indexesSource = readFileSync(
  path.join(apiRoot, "src/infrastructure/mongodb/mongo-indexes.ts"),
  "utf8",
);

const REQUEST: IntegrityMediaBindingRecoveryRequest = {
  resultCode: "recoveryResultCode_0123456789abcdefABCDEF",
  externalAuthorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  huTarget: "staging",
  expectedHuMemberId: "11111111-1111-4111-8111-111111111111",
  expectedHuLinkRevision: 4,
  expectedHuLinkInstanceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  recoveryId: "recovery-id-0001-abcdef",
};

describe("Integrity Media binding recovery Mongo transaction (static)", () => {
  it("runs the Mongo recovery in exactly one runMongoTransaction with the session persistence", () => {
    // Recovery and the author-activation guard are the only Mongo transactions in the store.
    assert.equal(countMatches(storeSource, /runMongoTransaction\(/g), 2);

    const apply = methodBody(mongoStoreBody(), "async applyBindingRecovery(input)");
    assert.equal(countMatches(apply, /runMongoTransaction\(/g), 1);
    assert.match(apply, /runMongoTransaction\(\(session\) =>\s*executeBindingRecovery\(createMongoBindingRecoveryPersistence\(session\), input\)/);
    assert.doesNotMatch(apply, /recoveryPersistence\b|createMemory|isMongoConfigured|\.insertOne\(|\.updateOne\(|\.findOneAndUpdate\(/);
  });

  it("holds the link with a real change in the author-activation transaction", () => {
    const guard = methodBody(mongoStoreBody(), "async runWithBoundAuthorLink(input, work)");
    assert.equal(countMatches(guard, /runMongoTransaction\(/g), 1);
    assert.match(guard, /findOneAndUpdate\(\s*boundAuthorLinkFilter\(input\),\s*\{ \$inc: \{ authorActivationGuard: 1 \} \},\s*\{ session, returnDocument: "after" \}/);
    assert.match(guard, /work\(session\)/);
    assert.doesNotMatch(guard, /"\$updatedAt"|catch\s*\(/);
  });

  it("holds the link with a real change in the author-reply transaction", () => {
    const hold = methodBody(mongoStoreBody(), "async holdAuthorReplyLink(input)");
    assert.match(hold, /findOneAndUpdate\(\s*authorReplyLinkFilter\(input\),\s*\{ \$inc: \{ linkWriteGuard: 1 \} \}/);
    assert.match(hold, /input\.session \? \{ session: input\.session \} : \{\}/);
    assert.doesNotMatch(hold, /"\$updatedAt"/);
    assert.doesNotMatch(storeSource, /\[\{ \$set: \{ updatedAt: "\$updatedAt" \} \}\]/);
  });

  it("requires a session for every Mongo recovery read and write", () => {
    assert.match(
      storeSource,
      /export function createMongoBindingRecoveryPersistence\(\s*session: ClientSession,\s*\)/,
    );

    const body = persistenceBody();
    const calls = collectionCalls(body);
    assert.ok(calls.length >= 12, `expected every persistence operation, found ${calls.length}`);
    for (const call of calls) {
      assert.match(call, /\bsession\b/, `session-less call: ${call}`);
    }
  });

  it("does not catch a duplicate key inside the Mongo recovery persistence", () => {
    const body = persistenceBody();
    assert.doesNotMatch(body, /catch\s*\(|isDuplicateKeyError|11000/);

    const apply = methodBody(mongoStoreBody(), "async applyBindingRecovery(input)");
    assert.equal(countMatches(apply, /catch\s*\(/g), 1);
    assert.match(apply, /catch \(error\) \{[\s\S]*return resolveAbortedBindingRecovery\(\{/);
    const reader = methodBody(apply, "readCommittedReceipt: async () =>");
    assert.match(reader, /recoveryReceipts\(\)\.findOne\(/);
    assert.doesNotMatch(reader, /session|insertOne|updateOne|replaceOne|findOneAndUpdate|delete/);
  });

  it("answers an aborted transaction from a committed receipt without writing", async () => {
    const outcome = {
      memberId: "22222222-2222-4222-8222-222222222222",
      linkRevision: 5,
      linkInstanceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      replacedMemberId: REQUEST.expectedHuMemberId,
      replacedLinkRevision: 4,
      replacedLinkInstanceId: REQUEST.expectedHuLinkInstanceId,
    };
    const memberDuplicate = duplicateKey({ source: 1, memberId: 1 });

    assert.deepEqual(
      await resolve(memberDuplicate, receipt({ status: "completed", outcome })),
      { kind: "recovered", outcome },
    );
    assert.deepEqual(
      await resolve(duplicateKey({ recoveryId: 1 }), receipt({ status: "rejected", rejectionCode: "link_provisional" })),
      { kind: "rejected", code: "link_provisional" },
    );
    assert.deepEqual(
      await resolve(memberDuplicate, receipt({ status: "completed", outcome, recoveryId: "recovery-id-other-abcdef" })),
      { kind: "conflict" },
    );
  });

  it("maps a member duplicate key without a committed receipt to member_already_linked", async () => {
    let reads = 0;
    const result = await resolveAbortedBindingRecovery({
      error: duplicateKey({ source: 1, memberId: 1 }),
      request: REQUEST,
      readCommittedReceipt: async () => {
        reads += 1;
        return null;
      },
    });

    assert.deepEqual(result, { kind: "rejected", code: "member_already_linked" });
    assert.equal(reads, 1);
    assert.equal(
      isBindingRecoveryMemberDuplicate(
        Object.assign(
          new Error(
            "E11000 duplicate key error collection: hu.external_author_links index: external_author_links_source_member_unique dup key",
          ),
          { code: 11000 },
        ),
      ),
      true,
    );
    assert.equal(
      await resolve(duplicateKey({ source: 1, memberId: 1 }), receipt({ status: "pending" })).then((value) => value.kind),
      "rejected",
    );
  });

  it("treats any other duplicate key as incomplete and rethrows other errors unchanged", async () => {
    await assert.rejects(
      resolve(duplicateKey({ recoveryId: 1 }), null),
      IntegrityMediaBindingRecoveryIncompleteError,
    );
    await assert.rejects(
      resolve(duplicateKey({ source: 1, externalAuthorId: 1 }), receipt({ status: "pending" })),
      IntegrityMediaBindingRecoveryIncompleteError,
    );

    const standalone = Object.assign(
      new Error("Transaction numbers are only allowed on a replica set member or mongos"),
      { code: 20 },
    );
    let reads = 0;
    await assert.rejects(
      resolveAbortedBindingRecovery({
        error: standalone,
        request: REQUEST,
        readCommittedReceipt: async () => {
          reads += 1;
          return null;
        },
      }),
      (error) => error === standalone,
    );
    assert.equal(reads, 0);
    assert.equal(isMongoTransactionUnsupportedError(standalone), true);
    assert.equal(isMongoTransactionUnsupportedError(new Error("connection reset")), false);
    assert.equal(isBindingRecoveryMemberDuplicate(standalone), false);
  });

  it("declares the unique recovery id index and keeps the link indexes", () => {
    assert.deepEqual(EXTERNAL_AUTHOR_LINK_RECOVERY_RECEIPT_INDEXES, [
      {
        key: { recoveryId: 1 },
        unique: true,
        name: "external_author_link_recovery_receipts_recovery_id_unique",
      },
    ]);
    assert.deepEqual(
      EXTERNAL_AUTHOR_LINK_INDEXES.map((index) => [index.name, index.unique, index.key]),
      [
        ["external_author_links_source_author_unique", true, { source: 1, externalAuthorId: 1 }],
        ["external_author_links_source_member_unique", true, { source: 1, memberId: 1 }],
      ],
    );
    assert.equal(
      MONGO_COLLECTIONS.externalAuthorLinkRecoveryReceipts,
      "external_author_link_recovery_receipts",
    );
    assert.match(
      indexesSource,
      /collectionName: MONGO_COLLECTIONS\.externalAuthorLinkRecoveryReceipts,\s*indexes: EXTERNAL_AUTHOR_LINK_RECOVERY_RECEIPT_INDEXES/,
    );
  });

  it("interprets a committed receipt without writing", () => {
    const outcome = {
      memberId: "22222222-2222-4222-8222-222222222222",
      linkRevision: 5,
      linkInstanceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      replacedMemberId: REQUEST.expectedHuMemberId,
      replacedLinkRevision: 4,
      replacedLinkInstanceId: REQUEST.expectedHuLinkInstanceId,
    };

    assert.deepEqual(
      recoveryResultFromCommittedReceipt(receipt({ status: "completed", outcome }), REQUEST),
      { kind: "recovered", outcome },
    );
    assert.deepEqual(
      recoveryResultFromCommittedReceipt(
        receipt({ status: "rejected", rejectionCode: "member_already_linked" }),
        REQUEST,
      ),
      { kind: "rejected", code: "member_already_linked" },
    );
    assert.deepEqual(
      recoveryResultFromCommittedReceipt(
        receipt({ status: "completed", outcome, expectedHuLinkRevision: 3 }),
        REQUEST,
      ),
      { kind: "conflict" },
    );
    assert.equal(recoveryResultFromCommittedReceipt(receipt({ status: "pending" }), REQUEST), null);
    assert.equal(recoveryResultFromCommittedReceipt(null, REQUEST), null);
    assert.equal(
      recoveryResultFromCommittedReceipt(
        receipt({ status: "rejected", rejectionCode: "not_a_stored_code" }),
        REQUEST,
      ),
      null,
    );
  });
});

function receipt(
  overrides: Partial<ExternalAuthorLinkRecoveryReceiptRecord>,
): ExternalAuthorLinkRecoveryReceiptRecord {
  return {
    ...REQUEST,
    source: "integrity-media",
    status: "pending",
    outcome: null,
    rejectionCode: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function duplicateKey(keyPattern: Record<string, number>): Error {
  return Object.assign(new Error("E11000 duplicate key error"), { code: 11000, keyPattern });
}

function resolve(
  error: unknown,
  committed: ExternalAuthorLinkRecoveryReceiptRecord | null,
): Promise<BindingRecoveryApplyResult> {
  return resolveAbortedBindingRecovery({
    error,
    request: REQUEST,
    readCommittedReceipt: async () => committed,
  });
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function mongoStoreBody(): string {
  return topLevelFunctionBody("export function createMongoExternalAuthorLinkStore(");
}

function persistenceBody(): string {
  return topLevelFunctionBody("export function createMongoBindingRecoveryPersistence(");
}

function topLevelFunctionBody(signature: string): string {
  const start = storeSource.indexOf(signature);
  assert.ok(start >= 0, `missing ${signature}`);
  const end = storeSource.indexOf("\n}\n", start);
  assert.ok(end > start, `unterminated ${signature}`);
  return storeSource.slice(start, end + 2);
}

function methodBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `missing ${signature}`);
  const open = source.indexOf("{", start + signature.length);
  return source.slice(start, matchingClose(source, open, "{", "}") + 1);
}

function collectionCalls(source: string): string[] {
  const calls: string[] = [];
  const pattern = /\.(findOne|find|insertOne|insertMany|replaceOne|updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany)\(/g;
  for (const match of source.matchAll(pattern)) {
    const open = (match.index ?? 0) + match[0].length - 1;
    calls.push(source.slice(match.index, matchingClose(source, open, "(", ")") + 1));
  }
  return calls;
}

function matchingClose(source: string, open: number, opener: string, closer: string): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === opener) {
      depth += 1;
    } else if (source[index] === closer) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  throw new Error(`unbalanced ${opener} at ${open}`);
}

/**
 * Pack 26A.1 — Mongo startup index DDL retry hardening.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isTransientMongoReplicaSetWriteError,
  withMongoStartupIndexRetry,
} from "../../../../src/infrastructure/mongodb/mongo-startup-index-retry.js";

function mongoError(input: {
  code?: number;
  codeName?: string;
  message?: string;
  errorLabels?: string[];
  writeConcernError?: { code?: number; codeName?: string; errmsg?: string };
  hasErrorLabel?: (label: string) => boolean;
}): Error {
  const error = new Error(input.message ?? input.codeName ?? "mongo error") as Error & {
    code?: number;
    codeName?: string;
    errorLabels?: string[];
    writeConcernError?: { code?: number; codeName?: string; errmsg?: string };
    hasErrorLabel?: (label: string) => boolean;
  };
  if (input.code !== undefined) {
    error.code = input.code;
  }
  if (input.codeName !== undefined) {
    error.codeName = input.codeName;
  }
  if (input.errorLabels) {
    error.errorLabels = input.errorLabels;
  }
  if (input.writeConcernError) {
    error.writeConcernError = input.writeConcernError;
  }
  if (input.hasErrorLabel) {
    error.hasErrorLabel = input.hasErrorLabel;
  }
  return error;
}

describe("Pack 26A.1 — transient Mongo replica-set classifier", () => {
  it("classifies NotWritablePrimary / code 10107 as retryable", () => {
    assert.equal(
      isTransientMongoReplicaSetWriteError(
        mongoError({ code: 10107, codeName: "NotWritablePrimary" }),
      ),
      true,
    );
  });

  it("classifies PrimarySteppedDown / code 189 as retryable", () => {
    assert.equal(
      isTransientMongoReplicaSetWriteError(
        mongoError({ code: 189, codeName: "PrimarySteppedDown" }),
      ),
      true,
    );
  });

  it("classifies writeConcernError code 189 as retryable", () => {
    assert.equal(
      isTransientMongoReplicaSetWriteError(
        mongoError({
          message: "waiting for replication timed out",
          writeConcernError: {
            code: 189,
            codeName: "PrimarySteppedDown",
            errmsg: "Primary stepped down while waiting for replication",
          },
        }),
      ),
      true,
    );
  });

  it("classifies RetryableWriteError label as retryable", () => {
    assert.equal(
      isTransientMongoReplicaSetWriteError(
        mongoError({
          code: 99999,
          hasErrorLabel: (label) => label === "RetryableWriteError",
        }),
      ),
      true,
    );
  });

  it("does not classify IndexNotFound / schema errors as retryable", () => {
    assert.equal(
      isTransientMongoReplicaSetWriteError(
        mongoError({ code: 27, codeName: "IndexNotFound" }),
      ),
      false,
    );
    assert.equal(
      isTransientMongoReplicaSetWriteError(
        mongoError({ code: 85, codeName: "IndexOptionsConflict" }),
      ),
      false,
    );
    assert.equal(
      isTransientMongoReplicaSetWriteError(new Error("something unrelated")),
      false,
    );
  });
});

describe("Pack 26A.1 — withMongoStartupIndexRetry", () => {
  it("successful first attempt runs once", async () => {
    let calls = 0;
    const logs: string[] = [];

    const result = await withMongoStartupIndexRetry(
      "once",
      async () => {
        calls += 1;
        return "ok";
      },
      {
        sleep: async () => undefined,
        log: (message) => logs.push(message),
      },
    );

    assert.equal(result, "ok");
    assert.equal(calls, 1);
    assert.equal(logs.length, 0);
  });

  it("retries NotWritablePrimary then succeeds", async () => {
    let calls = 0;
    const logs: string[] = [];
    const delays: number[] = [];

    const result = await withMongoStartupIndexRetry(
      "dropLegacyDecisionParticipantUniqueIndex",
      async () => {
        calls += 1;
        if (calls === 1) {
          throw mongoError({ code: 10107, codeName: "NotWritablePrimary" });
        }
        return "dropped";
      },
      {
        sleep: async (ms) => {
          delays.push(ms);
        },
        log: (message) => logs.push(message),
      },
    );

    assert.equal(result, "dropped");
    assert.equal(calls, 2);
    assert.equal(delays.length, 1);
    assert.match(logs[0] ?? "", /attempt 1\/5/);
    assert.match(logs[0] ?? "", /NotWritablePrimary/);
    assert.doesNotMatch(logs.join("\n"), /mongodb(\+srv)?:\/\//i);
  });

  it("retries PrimarySteppedDown transient error", async () => {
    let calls = 0;

    await withMongoStartupIndexRetry(
      "drop",
      async () => {
        calls += 1;
        if (calls < 3) {
          throw mongoError({ code: 189, codeName: "PrimarySteppedDown" });
        }
        return true;
      },
      {
        sleep: async () => undefined,
        log: () => undefined,
      },
    );

    assert.equal(calls, 3);
  });

  it("retries code 10107", async () => {
    let calls = 0;

    await withMongoStartupIndexRetry(
      "create",
      async () => {
        calls += 1;
        if (calls === 1) {
          throw mongoError({ code: 10107 });
        }
        return true;
      },
      { sleep: async () => undefined, log: () => undefined },
    );

    assert.equal(calls, 2);
  });

  it("retries code 189 write-concern stepdown form", async () => {
    let calls = 0;

    await withMongoStartupIndexRetry(
      "create",
      async () => {
        calls += 1;
        if (calls === 1) {
          throw mongoError({
            writeConcernError: { code: 189, codeName: "PrimarySteppedDown" },
          });
        }
        return true;
      },
      { sleep: async () => undefined, log: () => undefined },
    );

    assert.equal(calls, 2);
  });

  it("non-transient Mongo error does NOT retry", async () => {
    let calls = 0;
    const logs: string[] = [];

    await assert.rejects(
      () =>
        withMongoStartupIndexRetry(
          "create",
          async () => {
            calls += 1;
            throw mongoError({ code: 85, codeName: "IndexOptionsConflict" });
          },
          {
            sleep: async () => undefined,
            log: (message) => logs.push(message),
          },
        ),
      (error: unknown) => {
        assert.equal((error as { code?: number }).code, 85);
        return true;
      },
    );

    assert.equal(calls, 1);
    assert.equal(logs.length, 0);
  });

  it("retry exhaustion rethrows", async () => {
    let calls = 0;

    await assert.rejects(
      () =>
        withMongoStartupIndexRetry(
          "dropLegacyDecisionParticipantUniqueIndex",
          async () => {
            calls += 1;
            throw mongoError({ code: 10107, codeName: "NotWritablePrimary" });
          },
          {
            maxAttempts: 3,
            sleep: async () => undefined,
            log: () => undefined,
          },
        ),
      (error: unknown) => {
        assert.equal((error as { codeName?: string }).codeName, "NotWritablePrimary");
        return true;
      },
    );

    assert.equal(calls, 3);
  });

  it("already-missing legacy index remains safe (IndexNotFound does not retry)", async () => {
    let calls = 0;

    // Mirrors dropLegacyDecisionParticipantUniqueIndex: IndexNotFound is swallowed
    // by the drop helper before retry sees a failure. Here we assert the retry
    // wrapper itself does not treat IndexNotFound as transient.
    await assert.rejects(
      () =>
        withMongoStartupIndexRetry(
          "dropLegacyDecisionParticipantUniqueIndex",
          async () => {
            calls += 1;
            throw mongoError({ code: 27, codeName: "IndexNotFound" });
          },
          { sleep: async () => undefined, log: () => undefined },
        ),
      /IndexNotFound|mongo error/,
    );

    assert.equal(calls, 1);
  });
});

describe("Pack 26A.1 — ensureMongoIndexes wires startup retry", () => {
  it("mongo-indexes applies withMongoStartupIndexRetry around DDL", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.resolve(here, "../../../../src/infrastructure/mongodb/mongo-indexes.ts"),
      "utf8",
    );
    assert.match(source, /withMongoStartupIndexRetry/);
    assert.match(source, /dropLegacyDecisionParticipantUniqueIndex/);
    assert.match(source, /ensureCollectionIndexes:/);
  });

  it("dropLegacyDecisionParticipantUniqueIndex still treats IndexNotFound as success", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      path.resolve(here, "../../../../src/infrastructure/mongodb/mongo-indexes.ts"),
      "utf8",
    );
    const fnStart = source.indexOf("async function dropLegacyDecisionParticipantUniqueIndex");
    const fnBody = source.slice(fnStart, fnStart + 900);
    assert.match(fnBody, /IndexNotFound/);
    assert.match(fnBody, /code === 27/);
    assert.match(fnBody, /return;/);
  });
});

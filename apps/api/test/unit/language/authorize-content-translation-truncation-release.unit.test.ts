/**
 * Authorization CLI initialization. Injected MongoDB only — no live database or provider.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  runTruncationReleaseAuthorization,
  type TruncationReleaseAuthorizationDependencies,
  type TruncationReleaseCliFlags,
} from "../../../src/scripts/authorize-content-translation-truncation-release.js";

const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../src/scripts/authorize-content-translation-truncation-release.ts",
);

const FLAGS = [
  "--source-kind",
  "blog_post",
  "--source-record-id",
  "blog-57d5b2da-84f9-4ca4-96db-a02f8615ef09",
  "--target-locale",
  "he",
  "--source-version",
  "v-1-v-6268ff8ac13e5eea",
];

class CliExit extends Error {
  constructor(readonly code: number) {
    super(`cli exit ${code}`);
  }
}

function harness(): {
  deps: TruncationReleaseAuthorizationDependencies;
  calls: string[];
  enqueued: TruncationReleaseCliFlags[];
} {
  const calls: string[] = [];
  const enqueued: TruncationReleaseCliFlags[] = [];
  const deps: TruncationReleaseAuthorizationDependencies = {
    loadApiEnvironment: () => {
      calls.push("load");
    },
    connectMongoClient: async () => {
      calls.push("connect");
    },
    disconnectMongoClient: async () => {
      calls.push("disconnect");
    },
    enqueueTruncationReleaseOnce: async (flags) => {
      calls.push("enqueue");
      enqueued.push(flags);
      return { enqueued: true, deduped: false, eventId: "event-1" };
    },
  };
  return { deps, calls, enqueued };
}

describe("authorize content translation truncation release CLI", () => {
  it("connects before enqueue and disconnects after success", async () => {
    const { deps, calls, enqueued } = harness();
    let stdout = "";
    const code = await runTruncationReleaseAuthorization(FLAGS, deps, {
      stdout: (chunk) => {
        stdout += chunk;
      },
      stderr: () => undefined,
      exit: (exitCode) => {
        throw new CliExit(exitCode);
      },
    });

    assert.equal(code, 0);
    assert.deepEqual(calls, ["load", "connect", "enqueue", "disconnect"]);
    assert.equal(enqueued.length, 1);
    assert.equal(stdout.includes('"enqueued":true'), true);
    assert.equal(stdout.includes('"eventId":"event-1"'), true);
  });

  it("does not enqueue when MongoDB connection fails, and still disconnects", async () => {
    const { deps, calls, enqueued } = harness();
    deps.connectMongoClient = async () => {
      calls.push("connect");
      throw new Error("MongoDB client is not connected. Call connectMongoClient() first.");
    };
    let stderr = "";
    const code = await runTruncationReleaseAuthorization(FLAGS, deps, {
      stdout: () => undefined,
      stderr: (chunk) => {
        stderr += chunk;
      },
      exit: (exitCode) => {
        throw new CliExit(exitCode);
      },
    });

    assert.equal(code, 1);
    assert.deepEqual(calls, ["load", "connect", "disconnect"]);
    assert.equal(enqueued.length, 0);
    assert.equal(stderr, "content translation truncation release authorization failed\n");
  });

  it("disconnects when enqueue fails after a successful connection", async () => {
    const { deps, calls, enqueued } = harness();
    deps.enqueueTruncationReleaseOnce = async (flags) => {
      calls.push("enqueue");
      enqueued.push(flags);
      throw new Error("insert failed");
    };
    const code = await runTruncationReleaseAuthorization(FLAGS, deps, {
      stdout: () => undefined,
      stderr: () => undefined,
      exit: (exitCode) => {
        throw new CliExit(exitCode);
      },
    });

    assert.equal(code, 1);
    assert.deepEqual(calls, ["load", "connect", "enqueue", "disconnect"]);
  });

  it("rejects invalid arguments before MongoDB or enqueue", async () => {
    const { deps, calls } = harness();
    await assert.rejects(
      () =>
        runTruncationReleaseAuthorization(["--source-kind", "blog_post"], deps, {
          stdout: () => undefined,
          stderr: () => undefined,
          exit: (exitCode) => {
            throw new CliExit(exitCode);
          },
        }),
      (error: unknown) => error instanceof CliExit && error.code === 2,
    );
    assert.deepEqual(calls, []);
  });

  it("does not start the provider, dispatcher, or reconciliation", () => {
    const source = readFileSync(SCRIPT, "utf8");
    const connectAt = source.indexOf("await deps.connectMongoClient()");
    const enqueueAt = source.indexOf("await deps.enqueueTruncationReleaseOnce(flags)");
    const disconnectAt = source.lastIndexOf("await deps.disconnectMongoClient()");
    assert.equal(connectAt > 0 && connectAt < enqueueAt && enqueueAt < disconnectAt, true);
    assert.equal(source.includes("gemini-translation-provider"), false);
    assert.equal(source.includes("startOutboxDispatcher"), false);
    assert.equal(source.includes("resumeLocalizationReconciliationOnBoot"), false);
    assert.equal(source.includes("bootstrapEventInfrastructure"), false);
    assert.equal(source.includes("ensureMongoIndexes"), false);
  });
});

process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const mongod = process.env.HU_DISPOSABLE_MONGOD ?? "/tmp/hu-mongo-dist/bin/mongod";

describe("disposable MongoDB author-deletion cleanup", () => {
  it("runs cleanup against a private local mongod", (t) => {
    if (!existsSync(mongod)) {
      t.skip("A disposable local mongod binary is not available. Transaction rollback was not verified.");
      return;
    }

    const env = { ...process.env };
    delete env.MONGODB_URI;
    delete env.MONGODB_DATABASE;
    delete env.MONGODB_TEST_DATABASE;
    // node --test sets NODE_TEST_CONTEXT and then refuses a nested --test run.
    delete env.NODE_TEST_CONTEXT;
    delete env.NODE_CHANNEL_FD;
    delete env.WATCH_REPORT_DEPENDENCIES;
    env.NODE_TEST_ENV = "true";
    env.HU_DISPOSABLE_MONGOD = mongod;
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--test",
        "--test-concurrency=1",
        "test/integration/integrity-media-author-deletion.cleanup.mongo.worker.ts",
      ],
      {
        cwd: resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
        env,
        encoding: "utf8",
        timeout: 180_000,
      },
    );
    assert.equal(
      result.status,
      0,
      `Disposable MongoDB cleanup failed.\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
    assert.equal(result.stdout.includes("# fail 0"), true);
  });
});

/**
 * Explicit one-time authorization for one truncated content-translation identity.
 *
 * Enqueues a single warm. It does not call the provider, reset failure history,
 * activate a language, or start the API. Deploy the closed hold first. If a
 * pending warm already exists, this command dedupes; let the running consumer
 * acknowledge that row, then run this command again.
 *
 * Usage:
 *   node dist/scripts/authorize-content-translation-truncation-release.js \
 *     --source-kind blog_post \
 *     --source-record-id <id> \
 *     --target-locale <locale> \
 *     --source-version <version>
 */

import { pathToFileURL } from "node:url";

export type TruncationReleaseCliFlags = {
  sourceKind: string;
  sourceRecordId: string;
  targetLocale: string;
  sourceVersion: string;
};

export type TruncationReleaseAuthorizationDependencies = {
  loadApiEnvironment: () => void;
  connectMongoClient: () => Promise<unknown>;
  disconnectMongoClient: () => Promise<void>;
  enqueueTruncationReleaseOnce: (
    flags: TruncationReleaseCliFlags,
  ) => Promise<{
    enqueued: boolean;
    deduped: boolean;
    eventId: string | null;
  }>;
};

type CliIo = {
  stdout: (chunk: string) => void;
  stderr: (chunk: string) => void;
  exit: (code: number) => never;
};

function usage(io: CliIo): never {
  io.stderr(
    "usage: authorize-content-translation-truncation-release --source-kind <kind> --source-record-id <id> --target-locale <locale> --source-version <version>\n",
  );
  return io.exit(2);
}

function readFlags(argv: readonly string[], io: CliIo): TruncationReleaseCliFlags {
  const allowed = new Set([
    "--source-kind",
    "--source-record-id",
    "--target-locale",
    "--source-version",
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag || !allowed.has(flag) || !value || value.startsWith("--")) {
      usage(io);
    }
    if (values.has(flag)) {
      usage(io);
    }
    values.set(flag, value);
  }
  if (values.size !== allowed.size) {
    usage(io);
  }
  return {
    sourceKind: values.get("--source-kind") ?? "",
    sourceRecordId: values.get("--source-record-id") ?? "",
    targetLocale: values.get("--target-locale") ?? "",
    sourceVersion: values.get("--source-version") ?? "",
  };
}

function defaultIo(): CliIo {
  return {
    stdout: (chunk) => {
      process.stdout.write(chunk);
    },
    stderr: (chunk) => {
      process.stderr.write(chunk);
    },
    exit: (code) => process.exit(code),
  };
}

/**
 * Connects MongoDB, then enqueues one truncation release.
 * A connection failure is caught before enqueue. Disconnect always runs.
 */
export async function runTruncationReleaseAuthorization(
  argv: readonly string[],
  deps: TruncationReleaseAuthorizationDependencies,
  io: CliIo = defaultIo(),
): Promise<number> {
  const flags = readFlags(argv, io);

  const writeStdout = process.stdout.write.bind(process.stdout);
  process.stdout.write = (() => true) as typeof process.stdout.write;
  try {
    deps.loadApiEnvironment();
  } finally {
    process.stdout.write = writeStdout;
  }

  let exitCode = 0;
  try {
    await deps.connectMongoClient();
    const result = await deps.enqueueTruncationReleaseOnce(flags);
    io.stdout(
      `${JSON.stringify({
        enqueued: result.enqueued,
        deduped: result.deduped,
        eventId: result.eventId,
        sourceKind: flags.sourceKind,
        sourceRecordId: flags.sourceRecordId,
        targetLocale: flags.targetLocale,
        sourceVersion: flags.sourceVersion,
      })}\n`,
    );
  } catch {
    io.stderr("content translation truncation release authorization failed\n");
    exitCode = 1;
  } finally {
    await deps.disconnectMongoClient();
  }
  return exitCode;
}

async function productionDependencies(): Promise<TruncationReleaseAuthorizationDependencies> {
  const { loadApiEnvironment } = await import("../config/load-api-environment.js");
  const { connectMongoClient, disconnectMongoClient } = await import(
    "../infrastructure/mongodb/mongo-connection.js"
  );
  const { enqueueTruncationReleaseOnce } = await import(
    "../modules/language/content-translation-truncation-release.js"
  );
  return {
    loadApiEnvironment,
    connectMongoClient,
    disconnectMongoClient,
    enqueueTruncationReleaseOnce,
  };
}

function isDirectCliProcess(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectCliProcess()) {
  const code = await runTruncationReleaseAuthorization(
    process.argv.slice(2),
    await productionDependencies(),
  );
  if (code !== 0) {
    process.exitCode = code;
  }
}

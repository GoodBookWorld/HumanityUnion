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

export {};

function usage(): never {
  process.stderr.write(
    "usage: authorize-content-translation-truncation-release --source-kind <kind> --source-record-id <id> --target-locale <locale> --source-version <version>\n",
  );
  process.exit(2);
}

function readFlags(argv: readonly string[]): {
  sourceKind: string;
  sourceRecordId: string;
  targetLocale: string;
  sourceVersion: string;
} {
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
      usage();
    }
    if (values.has(flag)) {
      usage();
    }
    values.set(flag, value);
  }
  if (values.size !== allowed.size) {
    usage();
  }
  return {
    sourceKind: values.get("--source-kind") ?? "",
    sourceRecordId: values.get("--source-record-id") ?? "",
    targetLocale: values.get("--target-locale") ?? "",
    sourceVersion: values.get("--source-version") ?? "",
  };
}

const flags = readFlags(process.argv.slice(2));

const { loadApiEnvironment } = await import("../config/load-api-environment.js");
const writeStdout = process.stdout.write.bind(process.stdout);
process.stdout.write = (() => true) as typeof process.stdout.write;
try {
  loadApiEnvironment();
} finally {
  process.stdout.write = writeStdout;
}

const { disconnectMongoClient } = await import("../infrastructure/mongodb/mongo-connection.js");
const { enqueueTruncationReleaseOnce } = await import(
  "../modules/language/content-translation-truncation-release.js"
);

try {
  const result = await enqueueTruncationReleaseOnce(flags);
  process.stdout.write(
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
  process.stderr.write("content translation truncation release authorization failed\n");
  process.exitCode = 1;
} finally {
  await disconnectMongoClient();
}

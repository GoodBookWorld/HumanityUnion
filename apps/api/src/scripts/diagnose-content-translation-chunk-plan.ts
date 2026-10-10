/**
 * READ-ONLY chunk-plan compatibility diagnostic for one blog_post.
 *
 * Does not start the API, call a translation provider, queue translation work,
 * or write MongoDB. Prints metadata only.
 *
 * Usage:
 *   node dist/scripts/diagnose-content-translation-chunk-plan.js \
 *     --source-kind blog_post \
 *     --source-record-id <id> \
 *     --target-locale <locale> \
 *     --expected-source-version <version>
 */

export {};

process.env.HU_READ_ONLY_DIAGNOSTIC = "1";

const DIAGNOSTIC_TIMEOUT_MS = 20_000;

function usage(): never {
  process.stderr.write(
    "usage: diagnose-content-translation-chunk-plan --source-kind blog_post --source-record-id <id> --target-locale <locale> --expected-source-version <version>\n",
  );
  process.exit(2);
}

function readFlags(argv: readonly string[]): {
  sourceKind: string;
  sourceRecordId: string;
  targetLocale: string;
  expectedSourceVersion: string;
} {
  const allowed = new Set([
    "--source-kind",
    "--source-record-id",
    "--target-locale",
    "--expected-source-version",
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag || !allowed.has(flag)) {
      usage();
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      usage();
    }
    if (values.has(flag)) {
      usage();
    }
    values.set(flag, value);
    index += 1;
  }
  if (values.size !== allowed.size) {
    usage();
  }
  return {
    sourceKind: values.get("--source-kind") ?? "",
    sourceRecordId: values.get("--source-record-id") ?? "",
    targetLocale: values.get("--target-locale") ?? "",
    expectedSourceVersion: values.get("--expected-source-version") ?? "",
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
const { diagnoseBlogPostChunkPlan, ContentTranslationChunkPlanDiagnosticError } = await import(
  "../modules/language/content-translation-chunk-plan-diagnostic.js"
);

let timer: NodeJS.Timeout | undefined;
try {
  const result = await Promise.race([
    diagnoseBlogPostChunkPlan(flags),
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new ContentTranslationChunkPlanDiagnosticError("failed"));
      }, DIAGNOSTIC_TIMEOUT_MS);
    }),
  ]);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const code = error instanceof ContentTranslationChunkPlanDiagnosticError ? error.code : "failed";
  if (code === "usage") {
    usage();
  }
  process.stderr.write("content translation chunk plan diagnostic failed\n");
  process.exitCode = 1;
} finally {
  if (timer) {
    clearTimeout(timer);
  }
  await disconnectMongoClient();
}

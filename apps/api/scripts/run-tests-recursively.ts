/**
 * Recovery Task 29 — portable, shell-independent recursive API test discovery.
 * Recovery Task 30 — isolated, owned-cleanup Mongo test database per run.
 *
 * Discovery problem (Task 29):
 *
 *   The previous `test` script relied on the shell to expand
 *   `test/**\/*.test.ts` before Node ever started. Under `/bin/sh` (the shell
 *   npm/pnpm actually use to run package scripts on this platform), `**` is
 *   NOT recursive, so the pattern silently matched only shallow
 *   `test/integration/*.test.ts` files and skipped every file under
 *   `test/unit/**` entirely, while still exiting 0.
 *
 *   Fix: this script performs the recursive directory walk itself, in Node,
 *   using only `node:fs`. No shell glob of any kind is used or required.
 *
 * Isolation problem (Task 30):
 *
 *   `apps/api/.env` sets `MONGODB_DATABASE=humanity_union_dev`, and every
 *   Mongo-backed repository resolves its database through the same shared
 *   connection chokepoint. Without isolation, the test suite and any
 *   concurrently running `dev:api` process read and write the exact same
 *   database, causing the intermittent cross-process failures observed in
 *   Recovery Tasks 25–29.
 *
 *   Fix: generate one unique, disposable database name per `pnpm test`
 *   invocation, inject it into the test child process via
 *   `MONGODB_TEST_DATABASE` (enforced by `test/helpers/test-setup.ts`), and
 *   drop that one database — and only that one — once the child exits,
 *   regardless of whether it passed or failed.
 *
 * Usage (as the API package's `test` script):
 *
 *   tsx ./scripts/run-tests-recursively.ts
 *
 * Debug retention: set `KEEP_TEST_DATABASE=1` to skip the drop step and
 * inspect the isolated database after a failing run (see `test/README.md`).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import {
  dropIsolatedTestDatabase,
  ensureEphemeralTestDatabaseCreationAllowed,
  generateIsolatedTestDatabaseName,
  KEEP_TEST_DATABASE_ENV_VAR,
  TEST_DATABASE_ENV_VAR,
} from "./test-mongo-isolation.js";

/**
 * This parent runner process is a separate OS process from the test child
 * it spawns (which loads `.env` itself via `test/helpers/test-setup.ts`).
 * Env vars set by dotenv *inside* that child are local to the child and are
 * never visible back here — so, without loading `.env` here too, this
 * process would see `MONGODB_URI` as unset and silently skip owned cleanup
 * (Part 8) even though the child *did* connect to and use an isolated
 * database. Loaded with `override: false` (dotenv's default) so a real
 * shell-exported `MONGODB_URI` always wins over the file.
 */
function loadEnvForCleanupDecision(apiRoot: string): void {
  dotenv.config({ path: path.join(apiRoot, "../../.env") });
  dotenv.config({ path: path.join(apiRoot, ".env") });
}

const TEST_FILE_SUFFIX = ".test.ts";

export interface RunChildProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: "inherit" | "pipe";
}

export interface RunChildProcessResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

/**
 * Recursively walks `rootDir` and returns the absolute paths of every file
 * whose name ends exactly in `.test.ts`, in deterministic lexical order.
 *
 * Pure filesystem traversal only — no shell, no glob library, no cached or
 * hard-coded file list. Ordering is computed from POSIX-style (`/`-joined)
 * relative paths so the result is identical across platforms regardless of
 * the OS path separator.
 *
 * @throws {Error} If `rootDir` does not exist or is not a directory.
 * @throws {Error} If the walk completes but finds zero matching files.
 */
export function discoverTestFiles(rootDir: string): string[] {
  let rootStat: fs.Stats;
  try {
    rootStat = fs.statSync(rootDir);
  } catch {
    throw new Error(`Test discovery root does not exist: ${rootDir}`);
  }
  if (!rootStat.isDirectory()) {
    throw new Error(`Test discovery root is not a directory: ${rootDir}`);
  }

  const found: { absolutePath: string; posixRelativePath: string }[] = [];

  const walk = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (!entry.name.endsWith(TEST_FILE_SUFFIX)) {
        continue;
      }
      const relativeFromRoot = path.relative(rootDir, absolutePath);
      found.push({
        absolutePath,
        posixRelativePath: relativeFromRoot.split(path.sep).join("/"),
      });
    }
  };

  walk(rootDir);

  found.sort((a, b) =>
    a.posixRelativePath < b.posixRelativePath ? -1 : a.posixRelativePath > b.posixRelativePath ? 1 : 0,
  );

  if (found.length === 0) {
    throw new Error(
      `Test discovery found zero "${TEST_FILE_SUFFIX}" files under: ${rootDir}. Refusing to report a false-green empty run.`,
    );
  }

  return found.map((entry) => entry.absolutePath);
}

/**
 * Spawns `command` with `args`, forwards SIGINT/SIGTERM received by the
 * current process to the child, and resolves once the child exits.
 *
 * When `stdio` is `"inherit"` (the default, used by the CLI) the child's
 * output streams directly to the parent's stdout/stderr and `stdout`/`stderr`
 * resolve as empty strings. When `stdio` is `"pipe"` (used by tests) output
 * is captured and returned instead.
 */
export function runChildProcess(
  command: string,
  args: string[],
  options: RunChildProcessOptions = {},
): Promise<RunChildProcessResult> {
  const stdio = options.stdio ?? "inherit";

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio,
    });

    let stdout = "";
    let stderr = "";
    if (stdio === "pipe") {
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf-8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8");
      });
    }

    const onSigint = () => child.kill("SIGINT");
    const onSigterm = () => child.kill("SIGTERM");
    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);

    const cleanup = () => {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
    };

    child.on("error", (error) => {
      cleanup();
      reject(error);
    });

    child.on("exit", (code, signal) => {
      cleanup();
      resolve({ code, signal, stdout, stderr });
    });
  });
}

export interface RunIsolatedTestSuiteDeps {
  apiRoot: string;
  testRoot: string;
  env: NodeJS.ProcessEnv;
  /** Populates `env` with `.env` values (see {@link loadEnvForCleanupDecision}) before cleanup decides whether Mongo is configured. */
  loadEnv: () => void;
  discover: (root: string) => string[];
  spawnTests: (args: string[], env: NodeJS.ProcessEnv, cwd: string) => Promise<RunChildProcessResult>;
  generateDatabaseName: () => string;
  dropDatabase: (databaseName: string, uri: string) => Promise<void>;
  /** Collection-pressure gate before creating a new ephemeral test DB. */
  ensureCreationAllowed: (uri: string, env: NodeJS.ProcessEnv, log: (message: string) => void) => Promise<void>;
  log: (message: string) => void;
  logError: (message: string) => void;
}

export interface RunIsolatedTestSuiteResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  databaseName: string | null;
  cleanup: { attempted: boolean; succeeded: boolean; error: Error | null };
}

/**
 * Full Recovery Task 29 + 30 orchestration, expressed as a pure(-ish)
 * function over injectable dependencies so it can be exercised by focused
 * tests without spawning the real 500+-test suite or touching real Mongo.
 *
 * Conceptual flow (Task 30, Part 13):
 *
 *   generate isolated database name
 *           ↓
 *   spawn complete test suite with environment
 *           ↓
 *   wait for completion
 *           ↓
 *   drop owned database safely (unless KEEP_TEST_DATABASE=1)
 *           ↓
 *   return original test result — cleanup failure never overrides it
 */
export async function runIsolatedTestSuite(
  overrides: Partial<RunIsolatedTestSuiteDeps> = {},
): Promise<RunIsolatedTestSuiteResult> {
  const defaultApiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const deps: RunIsolatedTestSuiteDeps = {
    apiRoot: defaultApiRoot,
    testRoot: path.join(defaultApiRoot, "test"),
    env: process.env,
    loadEnv: () => loadEnvForCleanupDecision(defaultApiRoot),
    discover: discoverTestFiles,
    spawnTests: (args, env, cwd) => runChildProcess(process.execPath, args, { cwd, env, stdio: "inherit" }),
    generateDatabaseName: generateIsolatedTestDatabaseName,
    dropDatabase: (databaseName, uri) => dropIsolatedTestDatabase({ databaseName, uri }),
    ensureCreationAllowed: (uri, env, log) =>
      ensureEphemeralTestDatabaseCreationAllowed({ uri, env, log }),
    log: (message) => console.log(message),
    logError: (message) => console.error(message),
    ...overrides,
  };

  // Must happen before `performOwnedCleanup` reads `deps.env.MONGODB_URI` —
  // this process never otherwise sees the value the test child resolves for
  // itself (see `loadEnvForCleanupDecision`'s doc comment).
  deps.loadEnv();

  const absoluteFiles = deps.discover(deps.testRoot);
  const relativeFiles = absoluteFiles.map((absolutePath) =>
    path.relative(deps.apiRoot, absolutePath).split(path.sep).join("/"),
  );

  deps.log(`[run-tests-recursively] discovered ${relativeFiles.length} test file(s) under test/`);

  const mongoUri = deps.env.MONGODB_URI?.trim();
  if (mongoUri) {
    await deps.ensureCreationAllowed(mongoUri, deps.env, deps.log);
  }

  const databaseName = deps.generateDatabaseName();
  deps.log(`[run-tests-recursively] isolated Mongo test database for this run: ${databaseName}`);

  const childEnv: NodeJS.ProcessEnv = { ...deps.env, [TEST_DATABASE_ENV_VAR]: databaseName };

  const args = [
    "--import",
    "tsx",
    "--import",
    "./test/helpers/test-setup.ts",
    "--test",
    "--test-concurrency=1",
    "--test-force-exit",
    ...relativeFiles,
  ];

  let code: number | null = null;
  let signal: NodeJS.Signals | null = null;
  let cleanup: RunIsolatedTestSuiteResult["cleanup"] = {
    attempted: false,
    succeeded: true,
    error: null,
  };

  try {
    const childResult = await deps.spawnTests(args, childEnv, deps.apiRoot);
    code = childResult.code;
    signal = childResult.signal;
  } finally {
    // Owned cleanup always runs — pass, fail, or spawn throw — unless KEEP_TEST_DATABASE=1.
    cleanup = await performOwnedCleanup(deps, databaseName);
  }

  return { code, signal, databaseName, cleanup };
}

async function performOwnedCleanup(
  deps: RunIsolatedTestSuiteDeps,
  databaseName: string,
): Promise<RunIsolatedTestSuiteResult["cleanup"]> {
  const mongoUri = deps.env.MONGODB_URI?.trim();

  if (!mongoUri) {
    // Nothing was ever connected; nothing to drop.
    return { attempted: false, succeeded: true, error: null };
  }

  if (deps.env[KEEP_TEST_DATABASE_ENV_VAR] === "1") {
    deps.log(
      `[run-tests-recursively] ${KEEP_TEST_DATABASE_ENV_VAR}=1 set — keeping isolated test database "${databaseName}" for inspection.`,
    );
    return { attempted: false, succeeded: true, error: null };
  }

  try {
    await deps.dropDatabase(databaseName, mongoUri);
    deps.log(`[run-tests-recursively] dropped isolated test database: ${databaseName}`);
    return { attempted: true, succeeded: true, error: null };
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    // Reported separately, on its own line, and never allowed to change the
    // exit code below — a cleanup failure must never masquerade as, or
    // override, a test failure (or a test success).
    deps.logError(
      `[run-tests-recursively] WARNING: failed to drop isolated test database "${databaseName}": ${normalizedError.message}`,
    );
    return { attempted: true, succeeded: false, error: normalizedError };
  }
}

async function main(): Promise<void> {
  let result: RunIsolatedTestSuiteResult;
  try {
    result = await runIsolatedTestSuite();
  } catch (error) {
    console.error(`[run-tests-recursively] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  if (result.signal) {
    // Re-raise the same signal on this process so the parent shell/CI runner
    // observes the same termination reason the child experienced.
    process.kill(process.pid, result.signal);
    return;
  }
  // The child's exit code is authoritative regardless of cleanup outcome.
  process.exitCode = result.code ?? 1;
}

const invokedDirectly = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  void main();
}

import { spawnSync } from "node:child_process";

/**
 * Recovery Task 14 — shared, narrowly-scoped subprocess helper for
 * persistence-verification scripts that must prove state survives a fresh
 * process (module/global state is intentionally NOT reused).
 *
 * Two problems were found in the pre-existing ad hoc `spawnSync("npx", ...)`
 * call sites this helper replaces:
 *
 * 1. Nested package-manager overhead: `npx tsx <script>` resolves and
 *    launches `npm exec`, which launches `tsx`'s CLI, which finally runs the
 *    script — three extra process layers versus invoking the current Node
 *    executable directly with the repository-local `tsx` ESM loader.
 * 2. Unbounded hangs: some reload scripts perform a Member lookup that opens
 *    a MongoDB client (see `disconnectMongoClient`); if that connection is
 *    never closed, the child process's event loop never drains and
 *    `spawnSync` blocks forever waiting for it to exit. `finalizeVerificationResources`
 *    (via `runVerificationScript` in `verification-script-lifecycle.ts`) is
 *    the real fix for that, applied at each script's own entry point — this
 *    helper additionally guarantees the *parent* can never hang forever
 *    regardless of what a child does, by bounding every subprocess call with
 *    an explicit, generous timeout.
 */

export interface VerificationSubprocessResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Individual verification/reload scripts normally complete in well under a
 * second (no network calls beyond a single, already-open-or-fast MongoDB
 * lookup). 20 seconds is generous enough to absorb slow CI/sandbox
 * conditions while still failing fast — and with a clear, diagnosable
 * error — instead of hanging a whole verification run indefinitely.
 */
export const DEFAULT_VERIFICATION_SUBPROCESS_TIMEOUT_MS = 20_000;

/**
 * Runs a verification/reload script (a `.ts` file under `src/scripts`) in
 * its own OS process via the *current* Node executable
 * (`process.execPath`) with the repository-local `tsx` ESM loader — never
 * through `npx`/`npm exec`. This avoids nested package-manager processes,
 * uses whichever Node binary is already running (no hardcoded or
 * globally-installed-`tsx` assumption), and gives deterministic exit
 * behavior.
 *
 * Bounded by `timeoutMs`: if exceeded, the child is terminated with
 * `SIGKILL` (no detached orphan remains) and the result is reported as
 * `timedOut: true` rather than a plain non-zero exit, so callers can
 * distinguish "the script failed its assertions" from "the script hung."
 * stdout/stderr are always captured (even on timeout) so failures remain
 * diagnosable.
 */
export function runVerificationSubprocess(
  scriptPath: string,
  args: readonly string[],
  options: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    timeoutMs?: number;
  } = {},
): VerificationSubprocessResult {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", scriptPath, ...args],
    {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: "pipe",
      encoding: "utf-8",
      timeout: options.timeoutMs ?? DEFAULT_VERIFICATION_SUBPROCESS_TIMEOUT_MS,
      killSignal: "SIGKILL",
    },
  );

  const timedOut =
    result.error !== undefined &&
    typeof result.error === "object" &&
    (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT";

  return {
    status: result.status,
    signal: result.signal,
    timedOut,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/**
 * Throws a descriptive error — including captured stdout/stderr, exit
 * status, and signal — unless the subprocess exited with status 0. A
 * timeout is never treated as success and is reported with a distinct
 * message from an ordinary assertion failure, so a hang can never be
 * mistaken for a passing persistence check.
 */
export function assertVerificationSubprocessSucceeded(
  result: VerificationSubprocessResult,
  scriptLabel: string,
): void {
  if (result.timedOut) {
    throw new Error(
      `${scriptLabel} timed out and was forcibly terminated before completing ` +
        `(no result can be trusted as a passing persistence check).\n` +
        `--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`,
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `${scriptLabel} failed (status=${String(result.status)}, signal=${String(result.signal)}).\n` +
        `--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`,
    );
  }
}

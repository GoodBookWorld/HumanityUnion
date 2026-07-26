/**
 * TASK-082 — Initiative creation UX verification subset.
 * Run: npm run verify:initiative
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function main(): void {
  const createForm = readRepoFile(
    "apps/web/src/features/initiatives/components/StartNewInitiativeButton.tsx",
  );
  const draftEditor = readRepoFile(
    "apps/web/src/features/initiatives/components/InitiativeDraftEditor.tsx",
  );
  const lifecycle = readRepoFile("packages/types/src/domain/initiative-lifecycle.ts");

  assert(createForm.includes("Save Draft"), "Initiative create form must support Save Draft");
  assert(
    createForm.includes("Publish Initiative"),
    "Initiative create form must support Publish Initiative",
  );
  assert(
    draftEditor.includes("Publish Initiative"),
    "Draft editor must use Publish Initiative label",
  );
  assert(lifecycle.includes('"draft"'), "Canonical lifecycle must include draft phase");
  console.log("verify:initiative PASS");
}

main();

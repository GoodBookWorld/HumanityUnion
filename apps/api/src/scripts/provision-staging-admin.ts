/**
 * One-time explicit staging administrator provisioning.
 *
 * Does NOT run on API startup. Refuses anything except production + staging
 * platform mode + humanity_union_staging (or isolated hu_test_* under tests)
 * with ALLOW_STAGING_ADMIN_PROVISION=true.
 *
 * Run (from Render Shell / operator machine — not automatic):
 *   pnpm provision:staging-admin
 *
 * Required env:
 *   NODE_ENV=production
 *   PLATFORM_MODE=staging
 *   MONGODB_URI=...
 *   MONGODB_DATABASE=humanity_union_staging
 *   ALLOW_STAGING_ADMIN_PROVISION=true
 *   AUTH_BOOTSTRAP_FALLBACK=false
 *   STAGING_ADMIN_EMAIL=...
 *   STAGING_ADMIN_PASSWORD=...
 *   STAGING_ADMIN_DISPLAY_NAME=...
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { disconnectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import {
  formatStagingAdminProvisionSummary,
  provisionStagingAdmin,
  StagingAdminProvisionError,
} from "../modules/auth/staging-admin-provisioning.js";

async function main(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new StagingAdminProvisionError("MONGODB_URI must be configured for staging admin provision.");
  }

  try {
    const result = await provisionStagingAdmin();
    console.log(formatStagingAdminProvisionSummary(result));
  } finally {
    await disconnectMongoClient().catch(() => undefined);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  // Never print full error objects that might embed env/URI accidentally.
  console.error(message);
  process.exit(1);
});

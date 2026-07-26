/**
 * Marks existing auth users as email-confirmed for development migration.
 * Run: npm run migrate:email-confirmation-status
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { bootstrapAuthPersistence } from "../infrastructure/mongodb/bootstrap-auth-persistence.js";
import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { disconnectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import { markExistingAuthUsersEmailVerifiedForMigration } from "../modules/auth/auth-user.repository.js";

async function main(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI must be configured for migrate:email-confirmation-status.");
  }

  const allowMigration = process.env.EMAIL_CONFIRMATION_MIGRATE_EXISTING === "true";

  if (!allowMigration) {
    throw new Error(
      "Set EMAIL_CONFIRMATION_MIGRATE_EXISTING=true to confirm existing-account email migration.",
    );
  }

  if (process.env.NODE_ENV === "production" && process.env.PLATFORM_MODE === "production") {
    throw new Error("Refusing to auto-confirm existing accounts in production.");
  }

  await bootstrapAuthPersistence();
  const updatedCount = await markExistingAuthUsersEmailVerifiedForMigration();

  console.log(`Marked ${updatedCount} existing account(s) as email confirmed.`);
  await disconnectMongoClient().catch(() => undefined);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

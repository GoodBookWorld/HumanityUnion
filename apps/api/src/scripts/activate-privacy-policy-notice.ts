/**
 * HU-ACCOUNT-DELETE-01R — operator-only Privacy Policy v2 notice activation.
 *
 * This file is not imported by API startup.
 * Activation does not run unless invoked directly with both the confirmation
 * argument and the activation token. --dry-run returns before that path.
 *
 * Example:
 * PRIVACY_POLICY_NOTICE_ACTIVATION=privacy-2026-11-v2 \
 * NOTIFICATION_PERSISTENCE=mongodb \
 * npx tsx apps/api/src/scripts/activate-privacy-policy-notice.ts \
 *   --confirm privacy-2026-11-v2 \
 *   --published-before 2026-11-22T00:00:00.000Z \
 *   --batch-size 50 \
 *   --max-batches 1
 *
 * Read-only count, with no index creation and no notices sent:
 * npx tsx apps/api/src/scripts/activate-privacy-policy-notice.ts \
 *   --dry-run \
 *   --published-before <ISO timestamp> \
 *   --batch-size 50
 */

import { pathToFileURL } from "node:url";

import { listPrivacyPolicyNoticeAccountPage } from "../modules/notifications/privacy-policy-notice.directory.js";
import {
  activatePrivacyPolicyNotice,
  parsePrivacyPolicyNoticeArgs,
  previewPrivacyPolicyNotice,
} from "../modules/notifications/privacy-policy-notice.js";

export async function runPrivacyPolicyNoticeScript(argv: readonly string[]): Promise<number> {
  const parsed = parsePrivacyPolicyNoticeArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.reason);
    return 1;
  }

  if (parsed.dryRun) {
    if (!parsed.publishedBefore) {
      console.error("Dry-run requires --published-before. Nothing was sent.");
      return 1;
    }

    try {
      const result = await previewPrivacyPolicyNotice({
        publishedBefore: parsed.publishedBefore,
        batchSize: parsed.batchSize,
        fetchImpl: globalThis.fetch,
        directory: { listAccounts: listPrivacyPolicyNoticeAccountPage },
      });
      console.log(JSON.stringify(result));
      if (!result.publicationVerified || result.deniedReason) {
        return 1;
      }
      return 0;
    } catch {
      console.error("Privacy Policy notice dry-run could not be completed. Nothing was sent.");
      return 1;
    }
  }

  if (!parsed.confirmation || !parsed.publishedBefore || parsed.maxBatches === undefined) {
    console.error(
      "Activation requires --confirm, --published-before, and --max-batches. Nothing was sent.",
    );
    return 1;
  }

  const { ensurePrivacyPolicyNoticeUniqueIndex } = await import(
    "../modules/notifications/persistence/notification-mongo.persistence.js"
  );
  const { resolveNotificationPersistenceAdapter } = await import(
    "../modules/notifications/persistence/resolve-notification-persistence.js"
  );
  const persistence = resolveNotificationPersistenceAdapter();
  const result = await activatePrivacyPolicyNotice({
    confirmation: parsed.confirmation,
    activationToken: process.env.PRIVACY_POLICY_NOTICE_ACTIVATION,
    publishedBefore: parsed.publishedBefore,
    afterUserId: parsed.afterUserId ?? null,
    batchSize: parsed.batchSize,
    maxBatches: parsed.maxBatches,
    fetchImpl: globalThis.fetch,
    directory: { listAccounts: listPrivacyPolicyNoticeAccountPage },
    persistence,
    ensureUniqueIndex: ensurePrivacyPolicyNoticeUniqueIndex,
  });

  console.log(JSON.stringify(result));
  if (!result.authorized || !result.publicationVerified || result.failed > 0 || result.deniedReason) {
    return 1;
  }
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  runPrivacyPolicyNoticeScript(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Privacy Policy notice activation failed.");
      process.exitCode = 1;
    });
}

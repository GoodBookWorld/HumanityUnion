import { randomUUID } from "node:crypto";

import type { MemberNotification } from "@hu/types";

import type { NotificationPersistenceAdapter } from "./notification.types.js";
import {
  PRIVACY_POLICY_NOTICE_BATCH_DEFAULT,
  PRIVACY_POLICY_NOTICE_BATCH_MAX,
  PRIVACY_POLICY_NOTICE_EFFECTIVE_TEXT,
  PRIVACY_POLICY_NOTICE_ENTITY,
  PRIVACY_POLICY_NOTICE_MESSAGE,
  PRIVACY_POLICY_NOTICE_PATH,
  PRIVACY_POLICY_NOTICE_PREVIOUS_EFFECTIVE_TEXT,
  PRIVACY_POLICY_NOTICE_PUBLIC_MARKER,
  PRIVACY_POLICY_NOTICE_PUBLIC_URL,
  PRIVACY_POLICY_NOTICE_TITLE,
  PRIVACY_POLICY_NOTICE_VERSION,
} from "./privacy-policy-notice.constants.js";

export interface PrivacyPolicyNoticeAccount {
  userId: string;
  memberId: string;
  role: "member" | "admin";
  status: "active" | "disabled";
  createdAt: string;
  deletionPhase?: "awaiting_confirmation" | "pending" | "cancelled" | "finalized";
  suspensionActive: boolean;
}

export interface PrivacyPolicyNoticeAccountPage {
  accounts: readonly PrivacyPolicyNoticeAccount[];
  /** True when the directory may have further accounts after this page. */
  hasMore: boolean;
}

export interface PrivacyPolicyNoticeDirectory {
  listAccounts(input: {
    afterUserId: string | null;
    limit: number;
    createdBefore: string;
  }): Promise<PrivacyPolicyNoticeAccountPage>;
}

export interface PrivacyPolicyNoticeActivationResult {
  authorized: boolean;
  publicationVerified: boolean;
  deniedReason: string | null;
  examined: number;
  eligible: number;
  inserted: number;
  alreadyPresent: number;
  skipped: number;
  failed: number;
  nextAfterUserId: string | null;
  complete: boolean;
  failures: ReadonlyArray<{ userId: string; message: string }>;
}

export function isPrivacyPolicyNoticeAuthorized(input: {
  confirmation: string | undefined;
  activationToken: string | undefined;
}): boolean {
  return (
    input.confirmation === PRIVACY_POLICY_NOTICE_VERSION &&
    input.activationToken === PRIVACY_POLICY_NOTICE_VERSION
  );
}

export function isPrivacyPolicyNoticeEligible(
  account: PrivacyPolicyNoticeAccount,
  createdBefore: string,
): boolean {
  if (!account.userId.trim() || !account.memberId.trim()) {
    return false;
  }

  const cutoff = Date.parse(createdBefore);
  const createdAt = Date.parse(account.createdAt);
  if (Number.isNaN(cutoff) || Number.isNaN(createdAt) || createdAt >= cutoff) {
    return false;
  }

  if (account.deletionPhase === "finalized") {
    return false;
  }

  if (account.deletionPhase === "pending") {
    return true;
  }

  if (account.status === "active" && (account.role === "member" || account.role === "admin")) {
    return true;
  }

  if (account.status === "disabled" && account.suspensionActive) {
    return true;
  }

  return false;
}

export async function verifyPublicPrivacyPolicyV2(
  fetchImpl: typeof fetch,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let response: Response;
  try {
    response = await fetchImpl(PRIVACY_POLICY_NOTICE_PUBLIC_URL, { redirect: "manual" });
  } catch {
    return { ok: false, reason: "Public Privacy Policy could not be read." };
  }

  if (response.status !== 200) {
    return { ok: false, reason: "Public Privacy Policy did not return a successful page." };
  }

  const body = await response.text();
  if (!body.includes(PRIVACY_POLICY_NOTICE_EFFECTIVE_TEXT)) {
    return { ok: false, reason: "Public Privacy Policy does not show the approved effective date." };
  }
  if (!body.includes(PRIVACY_POLICY_NOTICE_PUBLIC_MARKER)) {
    return { ok: false, reason: "Public Privacy Policy does not show the approved v2 wording." };
  }
  if (body.includes(PRIVACY_POLICY_NOTICE_PREVIOUS_EFFECTIVE_TEXT)) {
    return { ok: false, reason: "Public Privacy Policy still shows the previous effective date." };
  }

  return { ok: true };
}

function emptyResult(
  overrides: Partial<PrivacyPolicyNoticeActivationResult> = {},
): PrivacyPolicyNoticeActivationResult {
  return {
    authorized: false,
    publicationVerified: false,
    deniedReason: null,
    examined: 0,
    eligible: 0,
    inserted: 0,
    alreadyPresent: 0,
    skipped: 0,
    failed: 0,
    nextAfterUserId: null,
    complete: false,
    failures: [],
    ...overrides,
  };
}

function clampBatchSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return PRIVACY_POLICY_NOTICE_BATCH_DEFAULT;
  }
  return Math.min(PRIVACY_POLICY_NOTICE_BATCH_MAX, Math.max(1, Math.trunc(value)));
}

export function parsePrivacyPolicyNoticeArgs(argv: readonly string[]): {
  ok: true;
  confirmation?: string;
  publishedBefore?: string;
  afterUserId?: string;
  batchSize?: number;
  maxBatches?: number;
} | { ok: false; reason: string } {
  let confirmation: string | undefined;
  let publishedBefore: string | undefined;
  let afterUserId: string | undefined;
  let batchSize: number | undefined;
  let maxBatches: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === undefined || !flag.startsWith("--") || value === undefined || value.startsWith("--")) {
      return { ok: false, reason: "Privacy Policy notice activation arguments are incomplete." };
    }
    index += 1;

    if (flag === "--confirm") {
      confirmation = value;
    } else if (flag === "--published-before") {
      publishedBefore = value;
    } else if (flag === "--after-user-id") {
      afterUserId = value;
    } else if (flag === "--batch-size") {
      batchSize = Number(value);
      if (!Number.isInteger(batchSize) || batchSize < 1) {
        return { ok: false, reason: "Batch size must be a positive integer." };
      }
    } else if (flag === "--max-batches") {
      maxBatches = Number(value);
      if (!Number.isInteger(maxBatches) || maxBatches < 1) {
        return { ok: false, reason: "Max batches must be a positive integer." };
      }
    } else {
      return { ok: false, reason: "Unknown Privacy Policy notice activation argument." };
    }
  }

  return { ok: true, confirmation, publishedBefore, afterUserId, batchSize, maxBatches };
}

function buildNotice(account: PrivacyPolicyNoticeAccount, createdAt: string): MemberNotification {
  return {
    notificationId: randomUUID(),
    recipientUserId: account.userId,
    recipientProfileId: account.memberId,
    eventType: "privacy_policy_updated",
    title: PRIVACY_POLICY_NOTICE_TITLE,
    message: PRIVACY_POLICY_NOTICE_MESSAGE,
    relatedEntityType: PRIVACY_POLICY_NOTICE_ENTITY,
    relatedEntityId: PRIVACY_POLICY_NOTICE_VERSION,
    relatedUrl: PRIVACY_POLICY_NOTICE_PATH,
    priority: "important",
    status: "unread",
    createdAt,
  };
}

export async function activatePrivacyPolicyNotice(input: {
  confirmation: string | undefined;
  activationToken: string | undefined;
  publishedBefore: string | undefined;
  afterUserId?: string | null;
  batchSize?: number;
  maxBatches?: number;
  now?: Date;
  allowMemoryPersistence?: boolean;
  fetchImpl: typeof fetch;
  directory: PrivacyPolicyNoticeDirectory;
  persistence: NotificationPersistenceAdapter;
  ensureUniqueIndex?: () => Promise<void>;
}): Promise<PrivacyPolicyNoticeActivationResult> {
  if (
    !isPrivacyPolicyNoticeAuthorized({
      confirmation: input.confirmation,
      activationToken: input.activationToken,
    })
  ) {
    return emptyResult({
      deniedReason: "Privacy Policy notice activation was not authorized.",
    });
  }

  if (!input.publishedBefore || Number.isNaN(Date.parse(input.publishedBefore))) {
    return emptyResult({
      authorized: true,
      deniedReason: "A publication cutoff timestamp is required.",
    });
  }

  const now = input.now ?? new Date();
  if (Date.parse(input.publishedBefore) > now.getTime()) {
    return emptyResult({
      authorized: true,
      deniedReason: "The publication cutoff cannot be in the future.",
    });
  }

  const publication = await verifyPublicPrivacyPolicyV2(input.fetchImpl);
  if (!publication.ok) {
    return emptyResult({
      authorized: true,
      deniedReason: publication.reason,
    });
  }

  if (input.persistence.mode === "mongodb") {
    if (!input.ensureUniqueIndex) {
      return emptyResult({
        authorized: true,
        publicationVerified: true,
        deniedReason: "The Privacy Policy notice unique index must be ready before activation.",
      });
    }
    try {
      await input.ensureUniqueIndex();
    } catch (error) {
      return emptyResult({
        authorized: true,
        publicationVerified: true,
        deniedReason: error instanceof Error ? error.message : "Unique index preparation failed.",
        failed: 1,
      });
    }
  } else if (!input.allowMemoryPersistence) {
    return emptyResult({
      authorized: true,
      publicationVerified: true,
      deniedReason: "Privacy Policy notice activation requires Mongo notification persistence.",
    });
  }

  const batchSize = clampBatchSize(input.batchSize);
  const maxBatches = input.maxBatches === undefined ? 1 : Math.max(1, Math.trunc(input.maxBatches));
  let cursor = input.afterUserId ?? null;
  let examined = 0;
  let eligible = 0;
  let inserted = 0;
  let alreadyPresent = 0;
  let skipped = 0;
  let complete = false;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const page = await input.directory.listAccounts({
      afterUserId: cursor,
      limit: batchSize,
      createdBefore: input.publishedBefore,
    });

    if (page.accounts.length === 0) {
      complete = true;
      break;
    }

    for (const account of page.accounts) {
      if (!isPrivacyPolicyNoticeEligible(account, input.publishedBefore)) {
        examined += 1;
        skipped += 1;
        cursor = account.userId;
        continue;
      }

      try {
        const outcome = await input.persistence.insertPrivacyPolicyNoticeIfAbsent(
          buildNotice(account, now.toISOString()),
        );
        examined += 1;
        eligible += 1;
        if (outcome === "inserted") {
          inserted += 1;
        } else {
          alreadyPresent += 1;
        }
        cursor = account.userId;
      } catch (error) {
        return {
          authorized: true,
          publicationVerified: true,
          deniedReason: null,
          examined,
          eligible,
          inserted,
          alreadyPresent,
          skipped,
          failed: 1,
          nextAfterUserId: cursor,
          complete: false,
          failures: [
            {
              userId: account.userId,
              message: error instanceof Error ? error.message : "Notice insert failed.",
            },
          ],
        };
      }
    }

    if (!page.hasMore || page.accounts.length < batchSize) {
      complete = true;
      break;
    }
  }

  return {
    authorized: true,
    publicationVerified: true,
    deniedReason: null,
    examined,
    eligible,
    inserted,
    alreadyPresent,
    skipped,
    failed: 0,
    nextAfterUserId: cursor,
    complete,
    failures: [],
  };
}

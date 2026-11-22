import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { isMemberNotificationEmailEventAllowlisted } from "../../../src/modules/notifications/email-delivery/allowlist.js";
import { createMemoryNotificationPersistenceAdapter } from "../../../src/modules/notifications/persistence/notification-memory.persistence.js";
import {
  PRIVACY_POLICY_NOTICE_MESSAGE,
  PRIVACY_POLICY_NOTICE_PATH,
  PRIVACY_POLICY_NOTICE_PUBLIC_URL,
  PRIVACY_POLICY_NOTICE_TITLE,
  PRIVACY_POLICY_NOTICE_VERSION,
} from "../../../src/modules/notifications/privacy-policy-notice.constants.js";
import {
  buildPrivacyPolicyNoticeAccountFilter,
  toPrivacyPolicyNoticeAccount,
} from "../../../src/modules/notifications/privacy-policy-notice.directory.js";
import { resolveNotificationRecipientMemberIds } from "../../../src/modules/notifications/notification.recipients.js";
import { getNotificationTemplate } from "../../../src/modules/notifications/notification.templates.js";
import {
  activatePrivacyPolicyNotice,
  isPrivacyPolicyNoticeEligible,
  parsePrivacyPolicyNoticeArgs,
  type PrivacyPolicyNoticeAccount,
  type PrivacyPolicyNoticeDirectory,
} from "../../../src/modules/notifications/privacy-policy-notice.js";
import { runPrivacyPolicyNoticeScript } from "../../../src/scripts/activate-privacy-policy-notice.js";

const ROOT = path.resolve(import.meta.dirname, "../../../../..");
const CUTOFF = "2026-11-22T18:00:00.000Z";
const NOW = new Date("2026-11-22T20:00:00.000Z");
const PUBLIC_BODY = [
  "Effective Date: November 22, 2026",
  "The period runs for 720 hours from confirmation.",
].join(" ");

function account(overrides: Partial<PrivacyPolicyNoticeAccount> = {}): PrivacyPolicyNoticeAccount {
  return {
    userId: "user-active",
    memberId: "member-active",
    role: "member",
    status: "active",
    createdAt: "2026-11-21T12:00:00.000Z",
    suspensionActive: false,
    ...overrides,
  };
}

function publishedFetch(body = PUBLIC_BODY, status = 200): typeof fetch {
  return (async () => new Response(body, { status })) as typeof fetch;
}

function directoryOf(accounts: readonly PrivacyPolicyNoticeAccount[]): PrivacyPolicyNoticeDirectory & {
  calls: number;
} {
  return {
    calls: 0,
    async listAccounts(input) {
      this.calls += 1;
      const filtered = accounts.filter(
        (candidate) => input.afterUserId === null || candidate.userId > input.afterUserId,
      );
      return {
        accounts: filtered.slice(0, input.limit),
        hasMore: filtered.length > input.limit,
      };
    },
  };
}

async function activateWith(
  accounts: readonly PrivacyPolicyNoticeAccount[],
  overrides: Partial<Parameters<typeof activatePrivacyPolicyNotice>[0]> = {},
) {
  const persistence = createMemoryNotificationPersistenceAdapter();
  const directory = directoryOf(accounts);
  const result = await activatePrivacyPolicyNotice({
    confirmation: PRIVACY_POLICY_NOTICE_VERSION,
    activationToken: PRIVACY_POLICY_NOTICE_VERSION,
    publishedBefore: CUTOFF,
    now: NOW,
    allowMemoryPersistence: true,
    maxBatches: 5,
    batchSize: 10,
    fetchImpl: publishedFetch(),
    directory,
    persistence,
    ...overrides,
  });
  return { result, persistence, directory };
}

describe("privacy policy v2 participant notice", () => {
  it("keeps the notice off civic recipient resolution and the email allowlist", () => {
    assert.deepEqual(
      resolveNotificationRecipientMemberIds({
        eventType: "privacy_policy_updated",
        entityType: "initiative",
        entityId: "initiative-1",
      }),
      [],
    );
    assert.equal(isMemberNotificationEmailEventAllowlisted("privacy_policy_updated"), false);
    assert.equal(getNotificationTemplate("privacy_policy_updated").title, PRIVACY_POLICY_NOTICE_TITLE);
    assert.equal(getNotificationTemplate("initiative_published").title, "Initiative published");
    assert.equal(PRIVACY_POLICY_NOTICE_PUBLIC_URL, "https://huws.org/privacy");
    assert.equal(PRIVACY_POLICY_NOTICE_PATH, "/privacy");
  });

  it("selects eligible existing accounts and leaves their access unchanged", () => {
    const active = Object.freeze(account());
    const admin = Object.freeze(account({ userId: "user-admin", memberId: "member-admin", role: "admin" }));
    const pending = Object.freeze(
      account({
        userId: "user-pending",
        memberId: "member-pending",
        deletionPhase: "pending",
        status: "disabled",
      }),
    );
    const suspended = Object.freeze(
      account({
        userId: "user-suspended",
        memberId: "member-suspended",
        status: "disabled",
        suspensionActive: true,
      }),
    );
    const finalized = account({ userId: "user-final", deletionPhase: "finalized" });
    const newer = account({ userId: "user-new", createdAt: "2026-11-22T18:00:00.000Z" });
    const disabled = account({ userId: "user-disabled", status: "disabled", suspensionActive: false });
    const blank = account({ userId: " ", memberId: "member-blank" });

    assert.equal(isPrivacyPolicyNoticeEligible(active, CUTOFF), true);
    assert.equal(isPrivacyPolicyNoticeEligible(admin, CUTOFF), true);
    assert.equal(isPrivacyPolicyNoticeEligible(pending, CUTOFF), true);
    assert.equal(isPrivacyPolicyNoticeEligible(suspended, CUTOFF), true);
    assert.equal(isPrivacyPolicyNoticeEligible(finalized, CUTOFF), false);
    assert.equal(isPrivacyPolicyNoticeEligible(newer, CUTOFF), false);
    assert.equal(isPrivacyPolicyNoticeEligible(disabled, CUTOFF), false);
    assert.equal(isPrivacyPolicyNoticeEligible(blank, CUTOFF), false);
    assert.equal(active.status, "active");
    assert.equal(pending.deletionPhase, "pending");
    assert.equal(suspended.status, "disabled");
  });

  it("stores one /privacy notice and does not enqueue email or change deletion flags", async () => {
    const source = fs.readFileSync(
      path.join(ROOT, "apps/api/src/modules/notifications/privacy-policy-notice.ts"),
      "utf8",
    );
    const allowlist = fs.readFileSync(
      path.join(ROOT, "apps/api/src/modules/notifications/email-delivery/allowlist.ts"),
      "utf8",
    );
    const flags = fs.readFileSync(path.join(ROOT, "apps/api/src/config/platform.config.ts"), "utf8");
    assert.doesNotMatch(source, /enqueueMemberNotificationEmailDelivery|persistNotificationWithOptionalEmailIntent/);
    assert.doesNotMatch(allowlist, /privacy_policy_updated/);
    assert.match(flags, /value === "true" \|\| value === "1"/);
    assert.doesNotMatch(source, /ACCOUNT_DELETION_ENABLED\s*=/);

    const { result, persistence } = await activateWith([account()]);
    assert.equal(result.inserted, 1);
    assert.equal(result.eligible, 1);
    const [notice] = await persistence.list({ userId: "user-active", status: "all" });
    assert.equal(notice.relatedUrl, "/privacy");
    assert.equal(notice.relatedEntityId, "privacy-2026-11-v2");
    assert.equal(notice.relatedEntityType, "legal_policy");
    assert.equal(notice.eventType, "privacy_policy_updated");
    assert.equal(notice.message, PRIVACY_POLICY_NOTICE_MESSAGE);
    assert.equal(notice.recipientUserId, "user-active");
    assert.equal(notice.recipientProfileId, "member-active");
    assert.equal("email" in notice, false);
  });

  it("refuses unauthorized, unpublished, and future-cutoff activation before any recipient read", async () => {
    let fetches = 0;
    let reads = 0;
    const directory: PrivacyPolicyNoticeDirectory = {
      async listAccounts() {
        reads += 1;
        return { accounts: [], hasMore: false };
      },
    };
    const fetchImpl = (async () => {
      fetches += 1;
      return new Response(PUBLIC_BODY, { status: 200 });
    }) as typeof fetch;
    const persistence = createMemoryNotificationPersistenceAdapter();
    const denied = await activatePrivacyPolicyNotice({
      confirmation: "privacy-2026-11-v1",
      activationToken: undefined,
      publishedBefore: CUTOFF,
      now: NOW,
      allowMemoryPersistence: true,
      fetchImpl,
      directory,
      persistence,
    });
    assert.equal(denied.authorized, false);
    assert.equal(fetches, 0);
    assert.equal(reads, 0);

    const unpublished = await activatePrivacyPolicyNotice({
      confirmation: PRIVACY_POLICY_NOTICE_VERSION,
      activationToken: PRIVACY_POLICY_NOTICE_VERSION,
      publishedBefore: CUTOFF,
      now: NOW,
      allowMemoryPersistence: true,
      fetchImpl: publishedFetch("Effective Date: November 18, 2026"),
      directory,
      persistence,
    });
    assert.equal(unpublished.publicationVerified, false);
    assert.equal(unpublished.inserted, 0);
    assert.equal(reads, 0);

    const future = await activatePrivacyPolicyNotice({
      confirmation: PRIVACY_POLICY_NOTICE_VERSION,
      activationToken: PRIVACY_POLICY_NOTICE_VERSION,
      publishedBefore: "2026-11-23T00:00:00.000Z",
      now: NOW,
      allowMemoryPersistence: true,
      fetchImpl,
      directory,
      persistence,
    });
    assert.equal(future.deniedReason, "The publication cutoff cannot be in the future.");
    assert.equal(fetches, 0);
  });

  it("does not duplicate concurrent activation and preserves read or archived status", async () => {
    const persistence = createMemoryNotificationPersistenceAdapter();
    const shared = {
      confirmation: PRIVACY_POLICY_NOTICE_VERSION,
      activationToken: PRIVACY_POLICY_NOTICE_VERSION,
      publishedBefore: CUTOFF,
      now: NOW,
      allowMemoryPersistence: true,
      maxBatches: 1,
      fetchImpl: publishedFetch(),
      directory: directoryOf([account()]),
      persistence,
    };
    const [first, second] = await Promise.all([
      activatePrivacyPolicyNotice(shared),
      activatePrivacyPolicyNotice(shared),
    ]);
    assert.equal(first.inserted + second.inserted, 1);
    assert.equal(first.alreadyPresent + second.alreadyPresent, 1);
    const [stored] = await persistence.list({ userId: "user-active", status: "all" });
    stored.status = "archived";
    stored.archivedAt = NOW.toISOString();
    await persistence.update(stored);

    const retry = await activatePrivacyPolicyNotice(shared);
    assert.equal(retry.inserted, 0);
    assert.equal(retry.alreadyPresent, 1);
    const [kept] = await persistence.list({ userId: "user-active", status: "all" });
    assert.equal(kept.status, "archived");
    assert.equal(kept.notificationId, stored.notificationId);
  });

  it("resumes a failed batch without repeating completed recipients", async () => {
    const persistence = createMemoryNotificationPersistenceAdapter();
    const original = persistence.insertPrivacyPolicyNoticeIfAbsent.bind(persistence);
    let failOnce = true;
    persistence.insertPrivacyPolicyNoticeIfAbsent = async (notification) => {
      if (failOnce && notification.recipientUserId === "user-b") {
        failOnce = false;
        throw new Error("batch interrupted");
      }
      return original(notification);
    };
    const accounts = [
      account({ userId: "user-a", memberId: "member-a" }),
      account({ userId: "user-b", memberId: "member-b" }),
      account({ userId: "user-c", memberId: "member-c" }),
    ];
    const first = await activatePrivacyPolicyNotice({
      confirmation: PRIVACY_POLICY_NOTICE_VERSION,
      activationToken: PRIVACY_POLICY_NOTICE_VERSION,
      publishedBefore: CUTOFF,
      now: NOW,
      allowMemoryPersistence: true,
      batchSize: 10,
      maxBatches: 1,
      fetchImpl: publishedFetch(),
      directory: directoryOf(accounts),
      persistence,
    });
    assert.equal(first.failed, 1);
    assert.equal(first.inserted, 1);
    assert.equal(first.nextAfterUserId, "user-a");
    assert.equal(first.complete, false);

    const second = await activatePrivacyPolicyNotice({
      confirmation: PRIVACY_POLICY_NOTICE_VERSION,
      activationToken: PRIVACY_POLICY_NOTICE_VERSION,
      publishedBefore: CUTOFF,
      afterUserId: first.nextAfterUserId,
      now: NOW,
      allowMemoryPersistence: true,
      batchSize: 10,
      maxBatches: 1,
      fetchImpl: publishedFetch(),
      directory: directoryOf(accounts),
      persistence,
    });
    assert.equal(second.failed, 0);
    assert.equal(second.inserted, 2);
    assert.equal(second.complete, true);
    assert.equal((await persistence.list({ userId: "user-a", status: "all" })).length, 1);
    assert.equal((await persistence.list({ userId: "user-b", status: "all" })).length, 1);
    assert.equal((await persistence.list({ userId: "user-c", status: "all" })).length, 1);
  });

  it("pages by stable user id and does not carry email into the account", () => {
    assert.deepEqual(buildPrivacyPolicyNoticeAccountFilter({ afterUserId: "user-a", createdBefore: CUTOFF }), {
      createdAt: { $type: "string", $lt: CUTOFF },
      userId: { $gt: "user-a" },
    });
    const mapped = toPrivacyPolicyNoticeAccount(
      {
        userId: "user-1",
        memberId: "member-1",
        role: "member",
        status: "active",
        createdAt: "2026-11-01T00:00:00.000Z",
        email: "hidden@example.com",
        passwordHash: "secret",
      } as never,
      false,
    );
    assert.equal(mapped?.userId, "user-1");
    assert.equal(mapped && "email" in mapped, false);
    assert.equal(mapped && "passwordHash" in mapped, false);
  });

  it("stays manual: startup does not import it, and a bare script exits before delivery", async () => {
    const startup = fs.readFileSync(path.join(ROOT, "apps/api/src/index.ts"), "utf8");
    const packageJson = fs.readFileSync(path.join(ROOT, "apps/api/package.json"), "utf8");
    assert.doesNotMatch(startup, /privacy-policy-notice|activate-privacy-policy-notice/);
    assert.doesNotMatch(packageJson, /activate-privacy-policy-notice/);
    assert.equal(await runPrivacyPolicyNoticeScript([]), 1);
    const parsed = parsePrivacyPolicyNoticeArgs(["--confirm", PRIVACY_POLICY_NOTICE_VERSION]);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.maxBatches, undefined);
    }
  });
});

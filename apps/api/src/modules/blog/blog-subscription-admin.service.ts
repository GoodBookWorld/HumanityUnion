/**
 * Pack 21C — Admin Blog subscriber directory + remove.
 * Pack 21G — Admin manual subscriber add (confirmed historical / needs confirmation).
 */
import { randomUUID } from "node:crypto";

import type {
  AdminBlogSubscriberDirectoryItem,
  AdminBlogSubscriberDirectoryResponse,
  AdminBlogSubscriberImportMode,
  AdminBlogSubscriberManualAddResponse,
  AdminBlogSubscriberRemoveResponse,
  AdminBlogSubscriberStatusFilter,
  BlogSubscriberRecord,
  BlogSubscriptionType,
} from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { record as recordAdministrationAudit } from "../administration/audit.service.js";
import { findAuthUserById, findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { BlogNotFoundError } from "./blog.errors.js";
import {
  isValidBlogSubscriptionEmail,
  normalizeBlogSubscriptionEmail,
  toBlogSubscriptionEmailDisplay,
} from "./blog-subscription-email.js";
import { isBlogSubscriberEligibleForPublicationDelivery } from "./blog-subscription-labels.js";
import {
  issueBlogSubscriptionTokens,
  issueBlogSubscriptionUnsubscribeToken,
  sendBlogSubscriptionConfirmationEmail,
} from "./blog-subscription.service.js";
import {
  countBlogSubscribersByStatus,
  findBlogSubscriberById,
  findBlogSubscriberByNormalizedEmail,
  listBlogSubscribersForAdmin,
  upsertBlogSubscriberRecord,
} from "./persistence/blog-subscriber.repository.js";

const MAX_DISPLAY_NAME_LENGTH = 120;

/** Pack 21C — memory-store unit tests without Auth Mongo. */
let adminActorOverrideForTests: {
  userId: string;
  participantId: string;
  role: "admin" | "member";
} | null = null;

let displayNameResolverForTests:
  | ((participantId: string) => string | undefined)
  | null = null;

export function setBlogSubscriberAdminActorOverrideForTests(
  actor: { userId: string; participantId: string; role: "admin" | "member" } | null,
): void {
  adminActorOverrideForTests = actor;
}

export function setBlogSubscriberDisplayNameResolverForTests(
  resolver: ((participantId: string) => string | undefined) | null,
): void {
  displayNameResolverForTests = resolver;
}

async function assertAdminActor(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  if (adminActorOverrideForTests) {
    if (adminActorOverrideForTests.userId !== userId) {
      throw new AdministrationUnauthorizedError();
    }
    if (adminActorOverrideForTests.role !== "admin") {
      throw new AdministrationForbiddenError("Administrator access is required.");
    }
    return {
      userId: adminActorOverrideForTests.userId,
      participantId: adminActorOverrideForTests.participantId,
    };
  }
  const user = await findAuthUserById(userId);
  if (!user) {
    throw new AdministrationUnauthorizedError();
  }
  if (user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  return { userId: user.userId, participantId: user.memberId };
}

/** Pack 21E — shared Admin gate for selected-subscriber messaging. */
export async function assertBlogSubscriberAdminActor(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  return assertAdminActor(userId);
}

async function resolveLinkedDisplayName(participantId: string): Promise<string | undefined> {
  if (displayNameResolverForTests) {
    return displayNameResolverForTests(participantId)?.trim() || undefined;
  }
  try {
    const authUser = await findAuthUserByMemberId(participantId);
    if (!authUser) {
      return undefined;
    }
    const profile = await findMemberProfileByUserId(authUser.userId);
    const name =
      profile?.displayName?.trim() || authUser.displayName?.trim() || undefined;
    return name || undefined;
  } catch {
    return undefined;
  }
}

function normalizeOptionalDisplayName(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AdministrationValidationError("Name must be plain text.");
  }
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) {
    return undefined;
  }
  if (name.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new AdministrationValidationError(
      `Name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters.`,
    );
  }
  if (/[<>]|script/i.test(name)) {
    throw new AdministrationValidationError("Name must not contain HTML.");
  }
  return name;
}

function parseImportMode(value: unknown): AdminBlogSubscriberImportMode {
  if (value === "confirmed_existing" || value === "needs_confirmation") {
    return value;
  }
  throw new AdministrationValidationError(
    "Subscription status must be Confirmed existing subscriber or Needs confirmation.",
  );
}

async function toDirectoryItem(
  record: BlogSubscriberRecord,
): Promise<AdminBlogSubscriberDirectoryItem> {
  const storedName = record.displayName?.trim() || undefined;
  const linkedName = record.participantId
    ? await resolveLinkedDisplayName(record.participantId)
    : undefined;
  const displayName = storedName || linkedName;
  return {
    subscriberId: record.subscriberId,
    ...(displayName ? { displayName } : {}),
    email: record.emailDisplay || record.emailNormalized,
    subscriptionType: record.subscriptionType,
    status: record.status,
    ...(record.subscribedAt ? { subscribedAt: record.subscribedAt } : {}),
    ...(record.confirmedAt ? { confirmedAt: record.confirmedAt } : {}),
    ...(record.countryCode ? { countryCode: record.countryCode } : {}),
    emailsSent: record.emailsSent,
    hasLinkedParticipant: Boolean(record.participantId),
    createdAt: record.createdAt,
  };
}

function recordMatchesSearch(
  record: BlogSubscriberRecord,
  displayName: string | undefined,
  qNormalized: string,
): boolean {
  if (!qNormalized) {
    return true;
  }
  if (record.emailNormalized.includes(qNormalized)) {
    return true;
  }
  if (record.emailDisplay.toLowerCase().includes(qNormalized)) {
    return true;
  }
  if (displayName?.toLowerCase().includes(qNormalized)) {
    return true;
  }
  if (record.displayName?.toLowerCase().includes(qNormalized)) {
    return true;
  }
  return false;
}

function resolveMergedDisplayName(
  next: string | undefined,
  existing: BlogSubscriberRecord | null,
): string | undefined {
  if (next !== undefined) {
    return next;
  }
  return existing?.displayName?.trim() || undefined;
}

export async function listAdminBlogSubscribers(input: {
  actorUserId: string;
  q?: string;
  status?: AdminBlogSubscriberStatusFilter;
  subscriptionType?: BlogSubscriptionType;
  limit?: number;
  offset?: number;
}): Promise<AdminBlogSubscriberDirectoryResponse> {
  await assertAdminActor(input.actorUserId);

  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const status = input.status ?? "all";
  const subscriptionType = input.subscriptionType ?? "blog_publications";
  const qNormalized = input.q?.trim().toLowerCase() ?? "";

  const counts = await countBlogSubscribersByStatus({ subscriptionType });

  if (!qNormalized) {
    const listed = await listBlogSubscribersForAdmin({
      subscriptionType,
      status,
      limit,
      offset,
    });
    const subscribers: AdminBlogSubscriberDirectoryItem[] = [];
    for (const record of listed.items) {
      subscribers.push(await toDirectoryItem(record));
    }
    return {
      subscribers,
      total: listed.total,
      subscribedCount: counts.subscribed,
      notConfirmedCount: counts.not_confirmed,
      unsubscribedCount: counts.unsubscribed,
      limit,
      offset,
    };
  }

  // Search: bounded scan so email + linked display name can both match without
  // loading the entire collection into the browser.
  const scanned = await listBlogSubscribersForAdmin({
    subscriptionType,
    status,
    limit: 500,
    offset: 0,
  });
  const matched: AdminBlogSubscriberDirectoryItem[] = [];
  for (const record of scanned.items) {
    const item = await toDirectoryItem(record);
    if (!recordMatchesSearch(record, item.displayName, qNormalized)) {
      continue;
    }
    matched.push(item);
  }
  matched.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    subscribers: matched.slice(offset, offset + limit),
    total: matched.length,
    subscribedCount: counts.subscribed,
    notConfirmedCount: counts.not_confirmed,
    unsubscribedCount: counts.unsubscribed,
    limit,
    offset,
  };
}

/**
 * Pack 21G — Admin manual add / import of a Blog subscriber.
 *
 * Confirmed historical: status=subscribed, no confirmation/Welcome email.
 * Needs confirmation: status=not_confirmed + canonical confirmation email
 * (Welcome only after successful public confirm, Pack 21A/21B).
 * Manual create itself never increments emailsSent.
 */
export async function adminManualAddBlogSubscriber(input: {
  actorUserId: string;
  body: unknown;
}): Promise<AdminBlogSubscriberManualAddResponse> {
  const admin = await assertAdminActor(input.actorUserId);

  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) {
    throw new AdministrationValidationError("Subscriber body is required.");
  }
  const body = input.body as Record<string, unknown>;

  if (typeof body.email !== "string" || !isValidBlogSubscriptionEmail(body.email)) {
    throw new AdministrationValidationError("A valid email address is required.");
  }

  const importMode = parseImportMode(body.importMode ?? body.subscriptionState);
  const restoreUnsubscribed = body.restoreUnsubscribed === true;
  const displayNameInput = normalizeOptionalDisplayName(body.displayName ?? body.name);

  const emailNormalized = normalizeBlogSubscriptionEmail(body.email);
  const emailDisplay = toBlogSubscriptionEmailDisplay(body.email);
  const existing = await findBlogSubscriberByNormalizedEmail(emailNormalized);
  const now = new Date().toISOString();

  if (existing?.status === "unsubscribed" && !restoreUnsubscribed) {
    throw new AdministrationValidationError(
      "This email is unsubscribed. Check “Restore if currently unsubscribed” to re-add it intentionally.",
    );
  }

  const restoredFromUnsubscribed = existing?.status === "unsubscribed" && restoreUnsubscribed;
  const mergedDisplayName = resolveMergedDisplayName(displayNameInput, existing);
  let record: BlogSubscriberRecord;
  let created = false;
  let reusedExisting = false;
  let confirmationEmailQueued = false;
  let message: string;

  if (importMode === "confirmed_existing") {
    if (!existing) {
      const tokens = issueBlogSubscriptionUnsubscribeToken();
      record = {
        subscriberId: randomUUID(),
        emailNormalized,
        emailDisplay,
        ...(mergedDisplayName ? { displayName: mergedDisplayName } : {}),
        status: "subscribed",
        subscriptionType: "blog_publications",
        subscribedAt: now,
        confirmedAt: now,
        emailsSent: 0,
        unsubscribeTokenHash: tokens.unsubscribeTokenHash,
        createdAt: now,
        updatedAt: now,
      };
      created = true;
      message = "Subscriber added as a confirmed existing subscriber.";
    } else if (existing.status === "subscribed") {
      record = {
        subscriberId: existing.subscriberId,
        emailNormalized: existing.emailNormalized,
        emailDisplay,
        ...(mergedDisplayName ? { displayName: mergedDisplayName } : {}),
        status: existing.status,
        subscriptionType: existing.subscriptionType,
        ...(existing.participantId ? { participantId: existing.participantId } : {}),
        ...(existing.countryCode ? { countryCode: existing.countryCode } : {}),
        ...(existing.subscribedAt ? { subscribedAt: existing.subscribedAt } : {}),
        ...(existing.confirmedAt ? { confirmedAt: existing.confirmedAt } : {}),
        ...(existing.welcomeSentAt ? { welcomeSentAt: existing.welcomeSentAt } : {}),
        emailsSent: existing.emailsSent,
        unsubscribeTokenHash: existing.unsubscribeTokenHash,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      reusedExisting = true;
      message = displayNameInput
        ? "Existing subscriber updated."
        : "Subscriber already exists; no second row created.";
    } else {
      // Upgrade not_confirmed / restore unsubscribed → subscribed (historical confirmed).
      const unsubscribeTokenHash =
        existing.unsubscribeTokenHash ??
        issueBlogSubscriptionUnsubscribeToken().unsubscribeTokenHash;
      record = {
        subscriberId: existing.subscriberId,
        emailNormalized: existing.emailNormalized,
        emailDisplay,
        ...(mergedDisplayName ? { displayName: mergedDisplayName } : {}),
        status: "subscribed",
        subscriptionType: existing.subscriptionType,
        ...(existing.participantId ? { participantId: existing.participantId } : {}),
        ...(existing.countryCode ? { countryCode: existing.countryCode } : {}),
        subscribedAt: existing.subscribedAt ?? now,
        confirmedAt: now,
        emailsSent: existing.emailsSent,
        ...(existing.welcomeSentAt ? { welcomeSentAt: existing.welcomeSentAt } : {}),
        unsubscribeTokenHash,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      reusedExisting = true;
      message = restoredFromUnsubscribed
        ? "Unsubscribed address restored as a confirmed subscriber."
        : "Existing subscriber marked confirmed.";
    }
  } else if (existing?.status === "subscribed") {
    // needs_confirmation — do not demote an already-confirmed subscriber.
    record = {
      subscriberId: existing.subscriberId,
      emailNormalized: existing.emailNormalized,
      emailDisplay,
      ...(mergedDisplayName ? { displayName: mergedDisplayName } : {}),
      status: existing.status,
      subscriptionType: existing.subscriptionType,
      ...(existing.participantId ? { participantId: existing.participantId } : {}),
      ...(existing.countryCode ? { countryCode: existing.countryCode } : {}),
      ...(existing.subscribedAt ? { subscribedAt: existing.subscribedAt } : {}),
      ...(existing.confirmedAt ? { confirmedAt: existing.confirmedAt } : {}),
      ...(existing.welcomeSentAt ? { welcomeSentAt: existing.welcomeSentAt } : {}),
      emailsSent: existing.emailsSent,
      unsubscribeTokenHash: existing.unsubscribeTokenHash,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    reusedExisting = true;
    message = displayNameInput
      ? "Existing confirmed subscriber updated (confirmation not re-sent)."
      : "Subscriber already confirmed; no second row created.";
  } else {
    const tokens = issueBlogSubscriptionTokens();
    if (existing) {
      record = {
        subscriberId: existing.subscriberId,
        emailNormalized: existing.emailNormalized,
        emailDisplay,
        ...(mergedDisplayName ? { displayName: mergedDisplayName } : {}),
        status: "not_confirmed",
        subscriptionType: existing.subscriptionType,
        ...(existing.participantId ? { participantId: existing.participantId } : {}),
        ...(existing.countryCode ? { countryCode: existing.countryCode } : {}),
        emailsSent: existing.emailsSent,
        confirmTokenHash: tokens.confirmTokenHash,
        confirmTokenExpiresAt: tokens.confirmTokenExpiresAt,
        unsubscribeTokenHash: tokens.unsubscribeTokenHash,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      reusedExisting = true;
      message = restoredFromUnsubscribed
        ? "Unsubscribed address re-entered confirmation; confirmation email sent."
        : "Confirmation email sent for existing subscriber.";
    } else {
      record = {
        subscriberId: randomUUID(),
        emailNormalized,
        emailDisplay,
        ...(mergedDisplayName ? { displayName: mergedDisplayName } : {}),
        status: "not_confirmed",
        subscriptionType: "blog_publications",
        emailsSent: 0,
        confirmTokenHash: tokens.confirmTokenHash,
        confirmTokenExpiresAt: tokens.confirmTokenExpiresAt,
        unsubscribeTokenHash: tokens.unsubscribeTokenHash,
        createdAt: now,
        updatedAt: now,
      };
      created = true;
      message = "Subscriber added; confirmation email sent.";
    }
    await upsertBlogSubscriberRecord(record);
    await sendBlogSubscriptionConfirmationEmail({
      to: emailNormalized,
      rawConfirmToken: tokens.rawConfirmToken,
      rawUnsubscribeToken: tokens.rawUnsubscribeToken,
    });
    confirmationEmailQueued = true;
  }

  if (!confirmationEmailQueued) {
    await upsertBlogSubscriberRecord(record!);
  }

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "blog.subscriber.manual_add",
    targetType: "blog_subscriber",
    targetId: record!.subscriberId,
    scope: { scopeType: "blog", scopeId: "subscribers" },
    afterSummary: `mode=${importMode};created=${String(created)};reusedExisting=${String(reusedExisting)};restoredFromUnsubscribed=${String(restoredFromUnsubscribed)};confirmationEmailQueued=${String(confirmationEmailQueued)}`,
  });

  const subscriber = await toDirectoryItem(record!);
  const raw = JSON.stringify(subscriber);
  if (/confirmToken|unsubscribeToken|TokenHash/i.test(raw)) {
    throw new Error("Admin subscriber response must not expose tokens.");
  }

  return {
    subscriber,
    created,
    reusedExisting,
    restoredFromUnsubscribed,
    confirmationEmailQueued,
    message,
  };
}

export async function removeAdminBlogSubscriber(input: {
  actorUserId: string;
  subscriberId: string;
}): Promise<AdminBlogSubscriberRemoveResponse> {
  const admin = await assertAdminActor(input.actorUserId);
  const subscriberId = input.subscriberId.trim();
  if (!subscriberId) {
    throw new BlogNotFoundError("Subscriber not found.");
  }

  const existing = await findBlogSubscriberById(subscriberId);
  if (!existing) {
    throw new BlogNotFoundError("Subscriber not found.");
  }

  if (existing.status === "unsubscribed") {
    return {
      removed: true,
      subscriberId: existing.subscriberId,
      status: "unsubscribed",
      alreadyUnsubscribed: true,
    };
  }

  const now = new Date().toISOString();
  const updated: BlogSubscriberRecord = {
    subscriberId: existing.subscriberId,
    emailNormalized: existing.emailNormalized,
    emailDisplay: existing.emailDisplay,
    ...(existing.displayName ? { displayName: existing.displayName } : {}),
    status: "unsubscribed",
    subscriptionType: existing.subscriptionType,
    ...(existing.participantId ? { participantId: existing.participantId } : {}),
    ...(existing.countryCode ? { countryCode: existing.countryCode } : {}),
    ...(existing.subscribedAt ? { subscribedAt: existing.subscribedAt } : {}),
    ...(existing.confirmedAt ? { confirmedAt: existing.confirmedAt } : {}),
    ...(existing.welcomeSentAt ? { welcomeSentAt: existing.welcomeSentAt } : {}),
    unsubscribedAt: now,
    emailsSent: existing.emailsSent,
    unsubscribeTokenHash: existing.unsubscribeTokenHash,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
  await upsertBlogSubscriberRecord(updated);

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "blog.subscriber.remove",
    targetType: "blog_subscriber",
    targetId: existing.subscriberId,
    scope: { scopeType: "blog", scopeId: "subscribers" },
    afterSummary: `subscriptionType=${existing.subscriptionType};status=unsubscribed`,
  });

  return {
    removed: true,
    subscriberId: existing.subscriberId,
    status: "unsubscribed",
    alreadyUnsubscribed: false,
  };
}

export { isBlogSubscriberEligibleForPublicationDelivery };

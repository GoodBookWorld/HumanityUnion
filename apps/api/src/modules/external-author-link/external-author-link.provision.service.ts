import { randomBytes, randomUUID } from "node:crypto";

import type { BlogCapabilityGrant } from "@hu/types";

import { MongoTransactionUnavailableError } from "../../infrastructure/mongodb/mongo-transaction.js";
import { assertAuthCodeSendAllowed } from "../auth/auth-code-rate-limit.js";
import { hashPassword } from "../auth/auth-password.js";
import type { AuthUserRecord } from "../auth/auth-user.types.js";
import {
  consumeEmailConfirmationCode,
  createEmailConfirmationCode,
  discardEmailConfirmationCode,
  findActiveEmailConfirmationCode,
  findLatestEmailConfirmationSendAt,
  incrementEmailConfirmationAttempt,
  markEmailConfirmationCodeDelivered,
  resolveResendPolicyForPurpose,
} from "../email/email-confirmation-code.repository.js";
import { sendIntegrityMediaAccountLinkCodeEmail } from "../email/email.service.js";
import { resolveLoginEmailTwoStepConfig } from "../email/login-email-two-step.config.js";
import { buildNewPersistedMember } from "../member/infrastructure/member.persistence.js";
import { buildDefaultMemberProfile } from "../member-profile/member-profile.repository.js";
import { integrityMediaAuthorDeletionBlocks } from "./external-author-link.author-deletion.js";
import { isIntegrityMediaBindingRecoveryStateFamily } from "./external-author-link.binding-recovery-state.js";
import { resolveIntegrityMediaLinkConfig, buildIntegrityMediaReturnUrl } from "./external-author-link.config.js";
import {
  INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN,
  INTEGRITY_MEDIA_AUTHOR_ID_PATTERN,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
  INTEGRITY_MEDIA_RESULT_TTL_MS,
  INTEGRITY_MEDIA_SOURCE,
} from "./external-author-link.constants.js";
import {
  integrityMediaEnvironmentTargetAccepted,
  isIntegrityMediaDeploymentTarget,
  readRawIntegrityMediaPlatformMode,
} from "./external-author-link.environment-target.js";
import {
  integrityMediaLinkSignaturesEqual,
  signIntegrityMediaLinkRedeem,
} from "./external-author-link.hmac.js";
import {
  currentProvisionDatabase,
  findCommittedProvisionAttempt,
  isProvisionDuplicateKeyError,
  ProvisionDuplicateKeyError,
  runProvisionTransaction,
  withProvisionLock,
  type ExistingAccountLinkBinding,
  type ProvisionAttemptRecord,
  type ProvisionDatabase,
  type ProvisionUserView,
} from "./external-author-link.provision.database.js";
import {
  buildProvisionAttemptPayload,
  hasProvisionAttemptSignature,
  noteProvisionAttemptSignature,
} from "./external-author-link.provision.hmac.js";
import {
  buildProvisionSnapshotPayload,
  hasProvisionSnapshotSignature,
  noteProvisionSnapshotSignature,
  snapshotDigest,
} from "./external-author-link.provision-snapshot.hmac.js";
import {
  buildProvisionVersionPayload,
  hasProvisionVersionSignature,
  noteProvisionVersionSignature,
} from "./external-author-link.provision-version.hmac.js";
import {
  MAX_PROVISION_SNAPSHOT_BYTES,
  parseApprovedProvisionSnapshot,
  type ApprovedProvisionSnapshot,
} from "./external-author-link.provision-snapshot.schema.js";
import {
  establishNewParticipantPhotoEligibility,
  finishProvisionPhoto,
  prepareProvisionPhoto,
  runAfterProvisionPhotoPrefetchForTests,
} from "./external-author-link.provision-photo.import.js";
import { revisionForNewLink } from "./external-author-link.revision.js";
import type {
  ExternalAuthorLinkFinalization,
  ExternalAuthorLinkRecord,
  ExternalAuthorLinkResultRecord,
} from "./external-author-link.types.js";

const COLLISION_MESSAGE =
  "This Integrity Media account cannot be linked automatically. No Humanity Union account was created.";

export type ProvisionMapping = "none" | "exists";
export type ProvisionOutcome = "NEW_AUTHOR" | "CONFIRMED_MAPPING_EXISTS";

export class ProvisionRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProvisionRequestError";
  }
}

export interface ProvisionRegistrationResult {
  attemptId: string;
  target: string;
  expiresAt: number;
  idempotent: boolean;
  mapping: ProvisionMapping;
}

export interface ProvisionSnapshotRegistrationResult {
  attemptId: string;
  target: string;
  idempotent: boolean;
}

export interface ProvisionConsentResult {
  displayName: string;
  email: string;
}

export interface ProvisionConfirmResult {
  redirectUrl: string | null;
  provisionOutcome: ProvisionOutcome;
}

interface NormalizedAttempt {
  attemptId: string;
  externalAuthorId: string;
  email: string;
  displayName: string;
  target: string;
  expiresAt: number;
  returnPath: string;
  emailVerification: "pending";
  snapshotRequired: boolean;
}

export function readRawPlatformMode(env: NodeJS.ProcessEnv = process.env): string {
  return readRawIntegrityMediaPlatformMode(env);
}

export async function findProvisionRedeemOutcome(
  attemptState: string,
  linkFinalization: ExternalAuthorLinkFinalization | undefined,
): Promise<{ provisionOutcome: ProvisionOutcome } | Record<string, never>> {
  const attempt = await findCommittedProvisionAttempt(attemptState);

  if (!attempt) {
    return {};
  }

  return {
    provisionOutcome:
      attempt.createdMember && linkFinalization === "provisional"
        ? "NEW_AUTHOR"
        : "CONFIRMED_MAPPING_EXISTS",
  };
}

/** Author bound by a committed provision attempt, or null when no attempt exists. */
export async function findProvisionAttemptAuthorId(attemptState: string): Promise<string | null> {
  const attempt = await findCommittedProvisionAttempt(attemptState);
  return attempt?.externalAuthorId ?? null;
}

export async function registerProvisionAttempt(input: {
  body: unknown;
  timestamp: string;
  signature: string;
  versionTimestamp?: string;
  versionSignature?: string;
  now?: Date;
}): Promise<ProvisionRegistrationResult> {
  const now = input.now ?? new Date();
  const normalized = normalizeAttemptBody(input.body);
  await verifyProvisionSignature({
    normalized,
    timestamp: input.timestamp,
    signature: input.signature,
    now,
  });
  normalized.snapshotRequired = verifyVersionDeclaration({
    normalized,
    timestamp: input.versionTimestamp ?? "",
    signature: input.versionSignature ?? "",
    now,
  });

  if (normalized.expiresAt <= unixSeconds(now)) {
    throw new ProvisionRequestError(409, "attempt_expired", "This provision attempt has expired.");
  }

  if (await integrityMediaAuthorDeletionBlocks(normalized.externalAuthorId)) {
    throw new ProvisionRequestError(
      409,
      "author_deletion_pending",
      "This Integrity Media author connection is pending deletion.",
    );
  }

  return withProvisionLock(() => storeProvisionAttempt(normalized, now));
}

export async function registerProvisionSnapshot(input: {
  body: unknown;
  timestamp: string;
  signature: string;
  now?: Date;
}): Promise<ProvisionSnapshotRegistrationResult> {
  const now = input.now ?? new Date();
  const normalized = normalizeSnapshotBody(input.body);
  await verifySnapshotSignature({
    normalized,
    timestamp: input.timestamp,
    signature: input.signature,
    now,
  });
  const parsed = parseApprovedProvisionSnapshot(normalized.snapshot);

  if (!parsed.ok) {
    throw new ProvisionRequestError(400, parsed.code, "The provision snapshot is not valid.");
  }

  const existingAttempt = await currentProvisionDatabase().findAttempt(normalized.attemptId);
  if (
    existingAttempt &&
    (await integrityMediaAuthorDeletionBlocks(existingAttempt.externalAuthorId))
  ) {
    throw new ProvisionRequestError(
      409,
      "author_deletion_pending",
      "This Integrity Media author connection is pending deletion.",
    );
  }

  const attached = await withProvisionLock(() =>
    currentProvisionDatabase().attachProfileSnapshot({
      attemptId: normalized.attemptId,
      target: normalized.target,
      snapshot: normalized.snapshot,
      digest: snapshotDigest(normalized.snapshot),
      nowSeconds: unixSeconds(now),
      updatedAt: now.toISOString(),
    }),
  );

  if (attached === "stored" || attached === "idempotent") {
    return {
      attemptId: normalized.attemptId,
      target: normalized.target,
      idempotent: attached === "idempotent",
    };
  }

  throw snapshotAttachError(attached);
}

export async function readProvisionConsent(input: {
  attemptState: string;
  now?: Date;
}): Promise<ProvisionConsentResult> {
  const now = input.now ?? new Date();
  if (!INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(input.attemptState)) {
    throw new ProvisionRequestError(400, "invalid_state", "This confirmation link is incomplete.");
  }

  // A recovery state is never an account-creation attempt.
  if (isIntegrityMediaBindingRecoveryStateFamily(input.attemptState)) {
    throw new ProvisionRequestError(404, "attempt_not_found", "This confirmation link is incomplete.");
  }

  const attempt = await currentProvisionDatabase().findAttempt(input.attemptState);
  if (!attempt) {
    throw new ProvisionRequestError(404, "attempt_not_found", "This confirmation link is incomplete.");
  }

  if (attempt.expiresAt <= unixSeconds(now)) {
    throw new ProvisionRequestError(410, "attempt_expired", "This provision attempt has expired.");
  }

  return {
    displayName: attempt.displayName,
    email: attempt.email,
  };
}

export async function confirmProvisionAttempt(input: {
  body: unknown;
  now?: Date;
}): Promise<ProvisionConfirmResult> {
  const now = input.now ?? new Date();
  const attemptId = readConfirmState(input.body);
  if (isIntegrityMediaBindingRecoveryStateFamily(attemptId)) {
    throw new ProvisionRequestError(404, "attempt_not_found", "This confirmation link is incomplete.");
  }

  const preparedPhoto = await prepareProvisionPhoto(attemptId, now);
  await runAfterProvisionPhotoPrefetchForTests();

  let result: ProvisionConfirmResult;
  try {
    result = await confirmOnce(attemptId, now);
  } catch (error) {
    if (!isProvisionDuplicateKeyError(error)) {
      throw mapTransactionError(error);
    }

    try {
      result = await confirmOnce(attemptId, now);
    } catch (retryError) {
      throw mapTransactionError(retryError);
    }
  }

  await finishProvisionPhoto(attemptId, now, preparedPhoto);
  return result;
}

async function confirmOnce(attemptId: string, now: Date): Promise<ProvisionConfirmResult> {
  return runProvisionTransaction((db) => confirmInTransaction(db, attemptId, now));
}

async function confirmInTransaction(
  db: ProvisionDatabase,
  attemptId: string,
  now: Date,
): Promise<ProvisionConfirmResult> {
  const attempt = await db.findAttempt(attemptId);
  if (!attempt) {
    throw new ProvisionRequestError(404, "attempt_not_found", "This confirmation link is incomplete.");
  }

  if (attempt.expiresAt <= unixSeconds(now)) {
    throw new ProvisionRequestError(410, "attempt_expired", "This provision attempt has expired.");
  }

  const existingLink = await db.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, attempt.externalAuthorId);
  if (await integrityMediaAuthorDeletionBlocks(attempt.externalAuthorId, existingLink)) {
    throw new ProvisionRequestError(
      409,
      "author_deletion_pending",
      "This Integrity Media author connection is pending deletion.",
    );
  }

  const boundMemberId = attempt.memberId ?? existingLink?.memberId ?? null;
  const emailOwner = await db.findUserByEmail(attempt.email);

  if (emailOwner && emailOwner.memberId !== boundMemberId) {
    throw new ProvisionRequestError(409, "existing_email_collision", COLLISION_MESSAGE);
  }

  let memberId = boundMemberId;
  let userId = attempt.userId;
  let createdMember = attempt.createdMember;
  let createdNewMember = false;

  if (!memberId && attempt.snapshotRequired === true && !hasAcceptedSnapshot(attempt)) {
    throw new ProvisionRequestError(
      409,
      "snapshot_required",
      "This provision attempt is waiting for its profile snapshot.",
    );
  }

  if (!memberId) {
    const created = await createProvisionedIdentity(db, attempt, now);
    memberId = created.memberId;
    userId = created.userId;
    createdMember = true;
    createdNewMember = true;
  } else if (!userId) {
    const boundUser = await db.findUserByMemberId(memberId);
    if (!boundUser) {
      throw new ProvisionRequestError(
        503,
        "unavailable",
        "Integrity Media account provisioning could not be recovered.",
      );
    }

    userId = boundUser.userId;
  }

  if (createdMember) {
    const grant = await db.findGrant(memberId);
    if (!grant) {
      await db.insertGrant(newAuthorGrant(memberId, now));
    }
  }

  if (!existingLink) {
    await insertProvisionalLink(db, {
      externalAuthorId: attempt.externalAuthorId,
      memberId,
      now,
    });
  }

  if (
    attempt.memberId !== memberId ||
    attempt.userId !== userId ||
    attempt.createdMember !== createdMember
  ) {
    await db.saveAttempt({
      ...attempt,
      memberId,
      userId,
      createdMember,
      updatedAt: now.toISOString(),
    });
  }

  if (createdNewMember) {
    const stored = await db.findAttempt(attemptId);
    if (stored) {
      await establishNewParticipantPhotoEligibility(db, stored, now.toISOString());
    }
  }

  const redirectUrl = await resultRedirect(db, {
    attempt,
    memberId,
    now,
  });

  return {
    redirectUrl,
    provisionOutcome: createdNewMember ? "NEW_AUTHOR" : "CONFIRMED_MAPPING_EXISTS",
  };
}

const EXISTING_ACCOUNT_LINK_PURPOSE = "integrity_media_account_link" as const;

export interface ExistingAccountCodeResult {
  /** Always true: the response does not reveal whether an eligible account exists. */
  accepted: true;
  expiresMinutes: number;
}

/**
 * Sends a code to an existing account whose email equals the attempt email.
 * The caller learns nothing about the account. Administrator, disabled, and
 * already linked accounts receive no code.
 */
export async function sendExistingAccountLinkCode(input: {
  body: unknown;
  ipKey?: string;
  now?: Date;
}): Promise<ExistingAccountCodeResult> {
  const now = input.now ?? new Date();
  const fields = readExistingAccountFields(input.body, new Set(["state", "email"]));
  const email = normalizeEmailInput(fields.email);
  const db = currentProvisionDatabase();
  const attempt = await findOpenExistingAccountAttempt(db, fields.state, now);

  if (email !== attempt.email) {
    throw new ProvisionRequestError(
      409,
      "email_mismatch",
      "Enter the email address of your Integrity Media account.",
    );
  }

  const expiresMinutes = resolveLoginEmailTwoStepConfig().codeTtlMinutes;
  const accepted: ExistingAccountCodeResult = { accepted: true, expiresMinutes };
  const user = await db.findUserByEmail(email);
  if (!user || !(await isLinkableExistingAccount(db, user))) {
    return accepted;
  }

  const previous = attempt.existingAccountLink?.userId === user.userId ? attempt.existingAccountLink : undefined;
  if (previous && previous.sendCount >= resolveResendPolicyForPurpose(EXISTING_ACCOUNT_LINK_PURPOSE).maxResendsPerChallenge) {
    throw new ProvisionRequestError(
      429,
      "code_send_limit",
      "Too many codes were requested. Start again from Integrity Media.",
    );
  }

  await assertAuthCodeSendAllowed({
    userId: user.userId,
    purpose: EXISTING_ACCOUNT_LINK_PURPOSE,
    ipKey: input.ipKey,
    lastSentAt:
      (await findLatestEmailConfirmationSendAt({
        userId: user.userId,
        purpose: EXISTING_ACCOUNT_LINK_PURPOSE,
      })) ?? undefined,
  });

  const issued = await createEmailConfirmationCode({
    userId: user.userId,
    email: user.email,
    purpose: EXISTING_ACCOUNT_LINK_PURPOSE,
    ipKey: input.ipKey,
  });
  const delivery = await sendIntegrityMediaAccountLinkCodeEmail({
    to: user.email,
    displayName: user.displayName,
    verificationCode: issued.code,
    expiresMinutes,
  });
  if (!delivery.emailSent) {
    await discardEmailConfirmationCode(issued.record.confirmationId);
    throw new ProvisionRequestError(503, "code_delivery_failed", "The code could not be sent. Try again.");
  }

  const sentAt = now.toISOString();
  await markEmailConfirmationCodeDelivered({
    confirmationId: issued.record.confirmationId,
    userId: user.userId,
    email: user.email,
    purpose: EXISTING_ACCOUNT_LINK_PURPOSE,
    sentAt,
    ipKey: input.ipKey,
  });

  const bound = await db.bindExistingAccountCode({
    attemptId: attempt.attemptId,
    binding: {
      confirmationId: issued.record.confirmationId,
      userId: user.userId,
      memberId: user.memberId,
      sentAt,
      sendCount: (previous?.sendCount ?? 0) + 1,
    },
    updatedAt: sentAt,
  });
  if (bound !== "bound") {
    await discardEmailConfirmationCode(issued.record.confirmationId);
    throw attemptAlreadyBound();
  }

  return accepted;
}

/**
 * Consumes the code bound to this attempt, then links the verified account
 * through the existing provision-confirm transaction. A verified attempt can
 * finish after a temporary failure without another code.
 */
export async function verifyExistingAccountLink(input: {
  body: unknown;
  now?: Date;
}): Promise<ProvisionConfirmResult> {
  const now = input.now ?? new Date();
  const fields = readExistingAccountFields(input.body, new Set(["state", "code", "authorize"]));
  if (fields.authorize !== true) {
    throw new ProvisionRequestError(
      400,
      "authorization_required",
      "Confirm that this account may be connected to Integrity Media.",
    );
  }

  const db = currentProvisionDatabase();
  const attempt = await findExistingAccountAttempt(db, fields.state, now);
  const binding = attempt.existingAccountLink;
  if (!binding) {
    throw new ProvisionRequestError(409, "code_not_requested", "Request a verification code first.");
  }

  if (attempt.memberId !== null && attempt.memberId !== binding.memberId) {
    throw attemptAlreadyBound();
  }

  if (binding.verifiedAt === undefined) {
    await consumeBoundCode(db, attempt.attemptId, binding, normalizeCodeInput(fields.code), now);
  }

  try {
    return await confirmExistingAccountOnce(attempt.attemptId, now);
  } catch (error) {
    if (!isProvisionDuplicateKeyError(error)) {
      throw mapTransactionError(error);
    }

    try {
      return await confirmExistingAccountOnce(attempt.attemptId, now);
    } catch (retryError) {
      throw mapTransactionError(retryError);
    }
  }
}

async function consumeBoundCode(
  db: ProvisionDatabase,
  attemptId: string,
  binding: ExistingAccountLinkBinding,
  code: string,
  now: Date,
): Promise<void> {
  const consumed = /^\d{6}$/.test(code)
    ? await consumeEmailConfirmationCode({
        userId: binding.userId,
        code,
        purpose: EXISTING_ACCOUNT_LINK_PURPOSE,
      })
    : null;

  if (!consumed) {
    const active = await findActiveEmailConfirmationCode({
      userId: binding.userId,
      purpose: EXISTING_ACCOUNT_LINK_PURPOSE,
    });
    if (!active || active.confirmationId !== binding.confirmationId) {
      throw new ProvisionRequestError(410, "code_expired", "This code is no longer valid. Request a new code.");
    }

    const counted = await incrementEmailConfirmationAttempt(active.confirmationId);
    if (!counted || counted.status !== "active") {
      throw new ProvisionRequestError(429, "code_locked", "Too many incorrect codes. Request a new code.");
    }

    throw new ProvisionRequestError(400, "invalid_code", "The verification code is incorrect.");
  }

  // A code consumed for another attempt of the same account is spent and authorizes nothing here.
  if (consumed.confirmationId !== binding.confirmationId) {
    throw new ProvisionRequestError(409, "code_not_for_attempt", "This code is no longer valid. Request a new code.");
  }

  const marked = await db.markExistingAccountVerified({
    attemptId,
    confirmationId: binding.confirmationId,
    verifiedAt: now.toISOString(),
  });
  if (marked !== "verified") {
    const current = await db.findAttempt(attemptId);
    if (current?.existingAccountLink?.confirmationId !== binding.confirmationId || !current.existingAccountLink.verifiedAt) {
      throw attemptAlreadyBound();
    }
  }
}

async function confirmExistingAccountOnce(attemptId: string, now: Date): Promise<ProvisionConfirmResult> {
  return runProvisionTransaction(async (db) => {
    const attempt = await db.findAttempt(attemptId);
    const binding = attempt?.existingAccountLink;
    if (!attempt || !binding?.verifiedAt) {
      throw new ProvisionRequestError(409, "code_not_verified", "Verify the code before connecting.");
    }

    if (attempt.memberId === null) {
      const user = await db.findUserByMemberId(binding.memberId);
      if (
        !user ||
        user.userId !== binding.userId ||
        user.email !== attempt.email ||
        !(await isLinkableExistingAccount(db, user, attempt.externalAuthorId))
      ) {
        throw new ProvisionRequestError(
          409,
          "account_not_linkable",
          "This Humanity Union account cannot be connected to Integrity Media.",
        );
      }

      await db.saveAttempt({
        ...attempt,
        memberId: binding.memberId,
        userId: binding.userId,
        createdMember: false,
        updatedAt: now.toISOString(),
      });
    } else if (attempt.memberId !== binding.memberId) {
      throw attemptAlreadyBound();
    }

    return confirmInTransaction(db, attemptId, now);
  });
}

/** Only an active member account with no Integrity Media link, other than this author's own. */
async function isLinkableExistingAccount(
  db: ProvisionDatabase,
  user: ProvisionUserView,
  externalAuthorId?: string,
): Promise<boolean> {
  if (user.role !== "member" || user.status !== "active" || !user.memberId) {
    return false;
  }

  const held = await db.findLinkByMember(INTEGRITY_MEDIA_SOURCE, user.memberId);
  return !held || held.externalAuthorId === externalAuthorId;
}

async function findExistingAccountAttempt(
  db: ProvisionDatabase,
  state: string,
  now: Date,
): Promise<ProvisionAttemptRecord> {
  if (isIntegrityMediaBindingRecoveryStateFamily(state)) {
    throw new ProvisionRequestError(404, "attempt_not_found", "This confirmation link is incomplete.");
  }

  const attempt = await db.findAttempt(state);
  if (!attempt) {
    throw new ProvisionRequestError(404, "attempt_not_found", "This confirmation link is incomplete.");
  }

  if (attempt.expiresAt <= unixSeconds(now)) {
    throw new ProvisionRequestError(410, "attempt_expired", "This provision attempt has expired.");
  }

  const existingLink = await db.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, attempt.externalAuthorId);
  if (await integrityMediaAuthorDeletionBlocks(attempt.externalAuthorId, existingLink)) {
    throw new ProvisionRequestError(
      409,
      "author_deletion_pending",
      "This Integrity Media author connection is pending deletion.",
    );
  }

  if (existingLink && existingLink.memberId !== attempt.existingAccountLink?.memberId) {
    throw new ProvisionRequestError(
      409,
      "author_already_linked",
      "This Integrity Media author is already connected to a Humanity Union account.",
    );
  }

  return attempt;
}

async function findOpenExistingAccountAttempt(
  db: ProvisionDatabase,
  state: string,
  now: Date,
): Promise<ProvisionAttemptRecord> {
  const attempt = await findExistingAccountAttempt(db, state, now);
  if (attempt.memberId !== null) {
    throw attemptAlreadyBound();
  }

  return attempt;
}

function attemptAlreadyBound(): ProvisionRequestError {
  return new ProvisionRequestError(
    409,
    "attempt_already_bound",
    "This confirmation link is already connected to a Humanity Union account.",
  );
}

function readExistingAccountFields(
  body: unknown,
  allowed: ReadonlySet<string>,
): { state: string; email: string; code: string; authorize: unknown } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProvisionRequestError(400, "invalid_request", "The confirmation request is not valid.");
  }

  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new ProvisionRequestError(400, "unexpected_field", "The confirmation request is not valid.");
    }
  }

  const state = typeof record.state === "string" ? record.state : "";
  if (!INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(state)) {
    throw new ProvisionRequestError(400, "invalid_state", "This confirmation link is incomplete.");
  }

  return {
    state,
    email: typeof record.email === "string" ? record.email : "",
    code: typeof record.code === "string" ? record.code : "",
    authorize: record.authorize,
  };
}

function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCodeInput(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

async function storeProvisionAttempt(
  normalized: NormalizedAttempt,
  now: Date,
): Promise<ProvisionRegistrationResult> {
  const db = currentProvisionDatabase();
  const existing = await db.findAttempt(normalized.attemptId);

  if (existing) {
    assertSameAttempt(existing, normalized);
    return registrationResult(existing, await mappingFor(db, existing.externalAuthorId), true);
  }

  const { snapshotRequired, ...attemptFields } = normalized;
  const record: ProvisionAttemptRecord = {
    ...attemptFields,
    memberId: null,
    userId: null,
    createdMember: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...(snapshotRequired ? { snapshotRequired: true } : {}),
  };
  const inserted = await db.insertAttempt(record);

  if (inserted === "duplicate") {
    const raced = await db.findAttempt(normalized.attemptId);
    if (!raced) {
      throw new ProvisionRequestError(503, "unavailable", "Provision attempt storage conflicted.");
    }

    assertSameAttempt(raced, normalized);
    return registrationResult(raced, await mappingFor(db, raced.externalAuthorId), true);
  }

  return registrationResult(record, await mappingFor(db, record.externalAuthorId), false);
}

function registrationResult(
  attempt: ProvisionAttemptRecord,
  mapping: ProvisionMapping,
  idempotent: boolean,
): ProvisionRegistrationResult {
  return {
    attemptId: attempt.attemptId,
    target: attempt.target,
    expiresAt: attempt.expiresAt,
    idempotent,
    mapping,
  };
}

async function mappingFor(
  db: ProvisionDatabase,
  externalAuthorId: string,
): Promise<ProvisionMapping> {
  const link = await db.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, externalAuthorId);
  return link?.linkFinalization === "confirmed" && link.state === "linked" ? "exists" : "none";
}

function assertSameAttempt(existing: ProvisionAttemptRecord, normalized: NormalizedAttempt): void {
  const same =
    existing.externalAuthorId === normalized.externalAuthorId &&
    existing.email === normalized.email &&
    existing.displayName === normalized.displayName &&
    existing.target === normalized.target &&
    existing.expiresAt === normalized.expiresAt &&
    existing.returnPath === normalized.returnPath &&
    existing.emailVerification === normalized.emailVerification;

  if (!same) {
    throw new ProvisionRequestError(
      409,
      "attempt_conflict",
      "This provision attempt does not match the stored attempt.",
    );
  }

  if ((existing.snapshotRequired === true) !== normalized.snapshotRequired) {
    throw new ProvisionRequestError(
      409,
      "version_conflict",
      "This provision attempt does not match the stored version.",
    );
  }
}

async function createProvisionedIdentity(
  db: ProvisionDatabase,
  attempt: ProvisionAttemptRecord,
  now: Date,
): Promise<{ memberId: string; userId: string }> {
  const memberId = randomUUID();
  const userId = randomUUID();
  const password = randomBytes(32).toString("base64url");
  const passwordHash = await hashPassword(password);
  const timestamp = now.toISOString();
  const approved = approvedSnapshotFields(attempt.profileSnapshot);
  const participantName = approved?.displayName ?? attempt.displayName;
  const user: AuthUserRecord = {
    userId,
    email: attempt.email,
    passwordHash,
    displayName: attempt.displayName,
    role: "member",
    status: "active",
    memberId,
    emailVerificationStatus: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const profile = buildDefaultMemberProfile({
    userId,
    displayName: participantName,
  });
  // New IM authors start public. Ordinary registration keeps the shared default,
  // and an existing participant's later choice is never written again.
  profile.profileVisibility = "public";

  if (approved?.biography !== undefined) {
    profile.biography = approved.biography;
  }
  if (approved?.website !== undefined) {
    profile.website = approved.website;
  }
  if (approved?.linkedinUrl !== undefined) {
    profile.linkedinUrl = approved.linkedinUrl;
  }
  if (approved?.facebookUrl !== undefined) {
    profile.facebookUrl = approved.facebookUrl;
  }
  if (approved?.youtubeUrl !== undefined) {
    profile.youtubeUrl = approved.youtubeUrl;
  }
  if (approved?.instagramUrl !== undefined) {
    profile.instagramUrl = approved.instagramUrl;
  }
  if (approved?.xUrl !== undefined) {
    profile.xUrl = approved.xUrl;
  }
  if (profile.avatarUrl === undefined) {
    delete profile.avatarUrl;
  }

  await db.insertUser(user);
  await db.insertProfile(profile);
  await db.insertParticipant(
    buildNewPersistedMember({
      memberId,
      identityId: userId,
      displayName: participantName,
      uniqueName: participantUniqueName(participantName, memberId),
      verificationLevel: "none",
    }),
  );
  await db.insertGrant(newAuthorGrant(memberId, now));
  return { memberId, userId };
}

function newAuthorGrant(memberId: string, now: Date): BlogCapabilityGrant {
  return {
    participantId: memberId,
    capabilities: ["author"],
    publishWithoutManualReview: true,
    updatedAt: now.toISOString(),
  };
}

function participantUniqueName(displayName: string, memberId: string): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return `${slug || "member"}-${memberId.replace(/-/g, "").slice(0, 8)}`;
}

async function insertProvisionalLink(
  db: ProvisionDatabase,
  input: { externalAuthorId: string; memberId: string; now: Date },
): Promise<ExternalAuthorLinkRecord> {
  if (await integrityMediaAuthorDeletionBlocks(input.externalAuthorId)) {
    throw new ProvisionRequestError(
      409,
      "author_deletion_pending",
      "This Integrity Media author connection is pending deletion.",
    );
  }

  const timestamp = input.now.toISOString();
  const record: ExternalAuthorLinkRecord = {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: input.externalAuthorId,
    memberId: input.memberId,
    state: "linked",
    createdAt: timestamp,
    updatedAt: timestamp,
    confirmedAt: timestamp,
    disconnectedAt: null,
    collaborationStatus: "active",
    linkRevision: revisionForNewLink(),
    linkFinalization: "provisional",
    linkInstanceId: randomUUID(),
  };
  const inserted = await db.insertLink(record);

  if (inserted === "duplicate") {
    throw new ProvisionDuplicateKeyError();
  }

  return record;
}

async function resultRedirect(
  db: ProvisionDatabase,
  input: { attempt: ProvisionAttemptRecord; memberId: string; now: Date },
): Promise<string | null> {
  const results = await db.listResultsForAttempt(input.attempt.attemptId);
  const nowIso = input.now.toISOString();

  if (results.some((result) => result.consumedAt)) {
    return null;
  }

  const live = results.find((result) => !result.consumedAt && result.expiresAt > nowIso);
  const resultCode = live?.resultCode ?? randomBytes(32).toString("base64url");

  if (!live) {
    const record: ExternalAuthorLinkResultRecord = {
      resultCode,
      source: INTEGRITY_MEDIA_SOURCE,
      attemptState: input.attempt.attemptId,
      memberId: input.memberId,
      expiresAt: new Date(input.now.getTime() + INTEGRITY_MEDIA_RESULT_TTL_MS).toISOString(),
      consumedAt: null,
      createdAt: nowIso,
    };
    await db.insertResult(record);
  }

  return buildIntegrityMediaReturnUrl({
    status: "confirmed",
    attemptState: input.attempt.attemptId,
    resultCode,
    nodeEnv: process.env.NODE_ENV,
  });
}

async function verifyProvisionSignature(input: {
  normalized: NormalizedAttempt;
  timestamp: string;
  signature: string;
  now: Date;
}): Promise<void> {
  if (!/^\d{10}$/.test(input.timestamp)) {
    throw new ProvisionRequestError(400, "invalid_timestamp", "The provision timestamp is not valid.");
  }

  const config = resolveIntegrityMediaLinkConfig();
  if (!config.hmacSecret) {
    throw new ProvisionRequestError(
      503,
      "provision_not_configured",
      "Integrity Media account provisioning is not configured.",
    );
  }

  if (input.normalized.returnPath !== config.returnPath) {
    throw new ProvisionRequestError(400, "return_path_rejected", "The provision return path is not valid.");
  }

  const payload = buildProvisionAttemptPayload({
    timestamp: input.timestamp,
    attemptId: input.normalized.attemptId,
    externalAuthorId: input.normalized.externalAuthorId,
    email: input.normalized.email,
    displayName: input.normalized.displayName,
    target: input.normalized.target,
    expiresAt: String(input.normalized.expiresAt),
    returnPath: input.normalized.returnPath,
    emailVerification: input.normalized.emailVerification,
  });
  const expected = signIntegrityMediaLinkRedeem(config.hmacSecret, payload);

  if (!integrityMediaLinkSignaturesEqual(expected, input.signature)) {
    throw new ProvisionRequestError(401, "invalid_signature", "The provision signature is not valid.");
  }

  const timestampSeconds = Number(input.timestamp);
  if (Math.abs(unixSeconds(input.now) - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    throw new ProvisionRequestError(
      401,
      "stale_timestamp",
      "The provision timestamp is outside the allowed window.",
    );
  }

  if (hasProvisionAttemptSignature(input.signature, input.now.getTime())) {
    throw new ProvisionRequestError(401, "replayed", "This provision request was already used.");
  }

  noteProvisionAttemptSignature(input.signature, input.now.getTime());
  assertProvisionEnvironmentTarget(input.normalized.target);
}

function approvedSnapshotFields(snapshot: string | undefined): ApprovedProvisionSnapshot | null {
  if (!snapshot) {
    return null;
  }

  const parsed = parseApprovedProvisionSnapshot(snapshot);
  if (!parsed.ok) {
    throw new ProvisionRequestError(400, parsed.code, "The provision snapshot is not valid.");
  }

  return parsed.fields;
}

function snapshotAttachError(result: Exclude<
  Awaited<ReturnType<ProvisionDatabase["attachProfileSnapshot"]>>,
  "stored" | "idempotent"
>): ProvisionRequestError {
  switch (result) {
    case "missing":
      return new ProvisionRequestError(404, "attempt_not_found", "This provision attempt is incomplete.");
    case "expired":
      return new ProvisionRequestError(410, "attempt_expired", "This provision attempt has expired.");
    case "consumed":
      return new ProvisionRequestError(
        409,
        "attempt_consumed",
        "This provision attempt has already been confirmed.",
      );
    case "conflict":
      return new ProvisionRequestError(
        409,
        "snapshot_conflict",
        "This provision attempt already has a different profile snapshot.",
      );
    case "target_mismatch":
      return new ProvisionRequestError(
        403,
        "target_mismatch",
        "This provision attempt is for a different Humanity Union environment.",
      );
    case "not_required":
      return new ProvisionRequestError(
        409,
        "snapshot_not_required",
        "This provision attempt does not accept a profile snapshot.",
      );
    default:
      return new ProvisionRequestError(
        503,
        "unavailable",
        "Integrity Media account provisioning is not available.",
      );
  }
}

interface NormalizedSnapshot {
  attemptId: string;
  target: string;
  snapshot: string;
}

function normalizeSnapshotBody(body: unknown): NormalizedSnapshot {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProvisionRequestError(400, "invalid_request", "The provision snapshot request is not valid.");
  }

  const record = body as Record<string, unknown>;
  const allowed = new Set(["attemptId", "target", "snapshot"]);

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new ProvisionRequestError(400, "unexpected_field", "The provision snapshot request is not valid.");
    }
  }

  const attemptId = requiredString(record.attemptId);
  const target = requiredString(record.target);
  const snapshot = requiredString(record.snapshot);

  if (!INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(attemptId)) {
    throw new ProvisionRequestError(400, "invalid_request", "The provision attempt id is not valid.");
  }

  assertRecognizedProvisionTarget(target);

  if (Buffer.byteLength(snapshot, "utf8") > MAX_PROVISION_SNAPSHOT_BYTES) {
    throw new ProvisionRequestError(413, "payload_too_large", "The provision snapshot is too large.");
  }

  return { attemptId, target, snapshot };
}

async function verifySnapshotSignature(input: {
  normalized: NormalizedSnapshot;
  timestamp: string;
  signature: string;
  now: Date;
}): Promise<void> {
  if (!/^\d{10}$/.test(input.timestamp)) {
    throw new ProvisionRequestError(400, "invalid_timestamp", "The provision timestamp is not valid.");
  }

  const config = resolveIntegrityMediaLinkConfig();
  if (!config.hmacSecret) {
    throw new ProvisionRequestError(
      503,
      "provision_not_configured",
      "Integrity Media account provisioning is not configured.",
    );
  }

  const payload = buildProvisionSnapshotPayload({
    timestamp: input.timestamp,
    attemptId: input.normalized.attemptId,
    target: input.normalized.target,
    snapshot: input.normalized.snapshot,
  });
  const expected = signIntegrityMediaLinkRedeem(config.hmacSecret, payload);

  if (!integrityMediaLinkSignaturesEqual(expected, input.signature)) {
    throw new ProvisionRequestError(401, "invalid_signature", "The provision signature is not valid.");
  }

  const timestampSeconds = Number(input.timestamp);
  if (Math.abs(unixSeconds(input.now) - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    throw new ProvisionRequestError(
      401,
      "stale_timestamp",
      "The provision timestamp is outside the allowed window.",
    );
  }

  if (hasProvisionSnapshotSignature(input.signature, input.now.getTime())) {
    throw new ProvisionRequestError(401, "replayed", "This provision request was already used.");
  }

  noteProvisionSnapshotSignature(input.signature, input.now.getTime());
  assertProvisionEnvironmentTarget(input.normalized.target);
}

function normalizeAttemptBody(body: unknown): NormalizedAttempt {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProvisionRequestError(400, "invalid_request", "The provision request is not valid.");
  }

  const record = body as Record<string, unknown>;
  const allowed = new Set([
    "attemptId",
    "externalAuthorId",
    "email",
    "displayName",
    "target",
    "expiresAt",
    "returnPath",
    "emailVerification",
  ]);

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new ProvisionRequestError(400, "unexpected_field", "The provision request is not valid.");
    }
  }

  const attemptId = requiredString(record.attemptId);
  const externalAuthorId = requiredString(record.externalAuthorId).toLowerCase();
  const email = requiredString(record.email).trim().toLowerCase();
  const displayName = requiredString(record.displayName).trim();
  const target = requiredString(record.target);
  const returnPath = requiredString(record.returnPath);
  const emailVerification = requiredString(record.emailVerification);

  if (!INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(attemptId)) {
    throw new ProvisionRequestError(400, "invalid_request", "The provision attempt id is not valid.");
  }

  if (!INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(externalAuthorId)) {
    throw new ProvisionRequestError(400, "invalid_author", "The Integrity Media author id is not valid.");
  }

  if (!isSafeEmail(email)) {
    throw new ProvisionRequestError(400, "invalid_request", "The provision email is not valid.");
  }

  if (!isSafeDisplayName(displayName)) {
    throw new ProvisionRequestError(400, "invalid_request", "The provision display name is not valid.");
  }

  assertRecognizedProvisionTarget(target);

  if (!Number.isInteger(record.expiresAt) || !isTenDigitSeconds(record.expiresAt as number)) {
    throw new ProvisionRequestError(400, "invalid_request", "The provision expiry is not valid.");
  }

  if (returnPath !== "/api/author/humanity-union-link/complete") {
    throw new ProvisionRequestError(400, "return_path_rejected", "The provision return path is not valid.");
  }

  if (emailVerification !== "pending") {
    throw new ProvisionRequestError(
      400,
      "invalid_request",
      "The provision email verification state is not valid.",
    );
  }

  return {
    attemptId,
    externalAuthorId,
    email,
    displayName,
    target,
    expiresAt: record.expiresAt as number,
    returnPath,
    emailVerification: "pending",
    snapshotRequired: false,
  };
}

function verifyVersionDeclaration(input: {
  normalized: NormalizedAttempt;
  timestamp: string;
  signature: string;
  now: Date;
}): boolean {
  const timestampPresent = input.timestamp.length > 0;
  const signaturePresent = input.signature.length > 0;
  if (!timestampPresent && !signaturePresent) {
    return false;
  }

  if (!timestampPresent || !signaturePresent) {
    throw new ProvisionRequestError(
      400,
      "incomplete_version",
      "The provision version declaration is incomplete.",
    );
  }

  if (!/^\d{10}$/.test(input.timestamp)) {
    throw new ProvisionRequestError(
      400,
      "invalid_version_timestamp",
      "The provision version timestamp is not valid.",
    );
  }

  const config = resolveIntegrityMediaLinkConfig();
  if (!config.hmacSecret) {
    throw new ProvisionRequestError(
      503,
      "provision_not_configured",
      "Integrity Media account provisioning is not configured.",
    );
  }

  const payload = buildProvisionVersionPayload({
    timestamp: input.timestamp,
    attemptId: input.normalized.attemptId,
    target: input.normalized.target,
  });
  const expected = signIntegrityMediaLinkRedeem(config.hmacSecret, payload);
  if (!integrityMediaLinkSignaturesEqual(expected, input.signature)) {
    throw new ProvisionRequestError(
      401,
      "invalid_version_signature",
      "The provision version signature is not valid.",
    );
  }

  const timestampSeconds = Number(input.timestamp);
  if (Math.abs(unixSeconds(input.now) - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    throw new ProvisionRequestError(
      401,
      "stale_version_timestamp",
      "The provision version timestamp is outside the allowed window.",
    );
  }

  if (hasProvisionVersionSignature(input.signature, input.now.getTime())) {
    throw new ProvisionRequestError(401, "replayed", "This provision request was already used.");
  }

  noteProvisionVersionSignature(input.signature, input.now.getTime());
  assertProvisionEnvironmentTarget(input.normalized.target);

  return true;
}

function assertRecognizedProvisionTarget(target: string): void {
  if (!isIntegrityMediaDeploymentTarget(target)) {
    throw new ProvisionRequestError(
      403,
      "target_mismatch",
      "This provision attempt is for a different Humanity Union environment.",
    );
  }
}

function assertProvisionEnvironmentTarget(target: string): void {
  if (!integrityMediaEnvironmentTargetAccepted(target)) {
    throw new ProvisionRequestError(
      403,
      "target_mismatch",
      "This provision attempt is for a different Humanity Union environment.",
    );
  }
}

function hasAcceptedSnapshot(attempt: ProvisionAttemptRecord): boolean {
  return typeof attempt.profileSnapshot === "string" && attempt.profileSnapshot.length > 0;
}

function readConfirmState(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ProvisionRequestError(400, "invalid_request", "The confirmation request is not valid.");
  }

  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "state") {
      const code =
        key === "returnUrl" || key === "returnTo" || key === "redirect" || key === "email"
          ? "unexpected_field"
          : "unexpected_field";
      throw new ProvisionRequestError(400, code, "The confirmation request is not valid.");
    }
  }

  const state = requiredString(record.state);
  if (!INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(state)) {
    throw new ProvisionRequestError(400, "invalid_state", "This confirmation link is incomplete.");
  }

  return state;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ProvisionRequestError(400, "invalid_request", "The provision request is not valid.");
  }

  return value;
}

function isSafeEmail(email: string): boolean {
  return (
    email.length <= 320 &&
    !/[\r\n\s]/.test(email) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function isSafeDisplayName(displayName: string): boolean {
  return (
    displayName.length > 0 &&
    !/[\r\n]/.test(displayName) &&
    [...displayName].length <= 120
  );
}

function isTenDigitSeconds(value: number): boolean {
  return value >= 1_000_000_000 && value <= 9_999_999_999;
}

function unixSeconds(now: Date): number {
  return Math.floor(now.getTime() / 1000);
}

function mapTransactionError(error: unknown): unknown {
  if (error instanceof ProvisionRequestError || error instanceof MongoTransactionUnavailableError) {
    if (error instanceof MongoTransactionUnavailableError) {
      return new ProvisionRequestError(
        503,
        "unavailable",
        "Integrity Media account provisioning is not available.",
      );
    }

    return error;
  }

  return error;
}

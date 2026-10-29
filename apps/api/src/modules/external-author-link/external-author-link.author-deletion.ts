import { MongoTransactionUnavailableError } from "../../infrastructure/mongodb/mongo-transaction.js";
import { isIntegrityMediaAuthorDeletionEnabled } from "./external-author-link.config.js";
import {
  INTEGRITY_MEDIA_AUTHOR_ID_PATTERN,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
  INTEGRITY_MEDIA_SOURCE,
} from "./external-author-link.constants.js";
import {
  buildIntegrityMediaAuthorDeletionPayload,
  hasIntegrityMediaAuthorDeletionSignature,
  integrityMediaAuthorDeletionSignaturesEqual,
  forgetIntegrityMediaAuthorDeletionSignature,
  noteIntegrityMediaAuthorDeletionSignature,
  signIntegrityMediaAuthorDeletion,
} from "./external-author-link.author-deletion.hmac.js";
import {
  AUTHOR_DELETION_INSTANCE_ABSENT,
  type AuthorDeletionCommand,
  type AuthorDeletionRejectCode,
} from "./external-author-link.author-deletion.rules.js";
import { isIntegrityMediaDeploymentTarget } from "./external-author-link.environment-target.js";
import { integrityMediaEnvironmentTargetAccepted } from "./external-author-link.environment-target.js";
import { getExternalAuthorLinkStore } from "./external-author-link.store.js";
import type { ExternalAuthorDeletionTombstone } from "./external-author-link.types.js";

export interface IntegrityMediaAuthorDeletionSuccess {
  ok: true;
  operationId: string;
  authorId: string;
  status: "pending";
  cleanup: "pending";
  idempotent: boolean;
}

export interface IntegrityMediaAuthorDeletionFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export const AUTHOR_DELETION_PENDING_MESSAGE =
  "This Integrity Media author connection is pending deletion.";

export async function integrityMediaAuthorDeletionBlocks(
  externalAuthorId: string,
  link?: { authorDeletionPending?: boolean } | null,
): Promise<boolean> {
  if (link?.authorDeletionPending === true) {
    return true;
  }

  const tombstone = await findBlockingAuthorDeletion(externalAuthorId);
  return tombstone !== null;
}

export async function findBlockingAuthorDeletion(
  externalAuthorId: string,
): Promise<ExternalAuthorDeletionTombstone | null> {
  if (!INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(externalAuthorId)) {
    return null;
  }

  return getExternalAuthorLinkStore().findAuthorDeletionTombstone(
    INTEGRITY_MEDIA_SOURCE,
    externalAuthorId,
  );
}

export async function acceptIntegrityMediaAuthorDeletion(input: {
  operationId: string;
  authorId: string;
  huTarget: string;
  expectedMemberId: string;
  expectedLinkRevision: number;
  expectedLinkInstanceId: string;
  timestamp: string;
  signature: string;
  secret: string | null;
  now?: Date;
}): Promise<IntegrityMediaAuthorDeletionSuccess | IntegrityMediaAuthorDeletionFailure> {
  if (!isIntegrityMediaAuthorDeletionEnabled()) {
    return failure(503, "author_deletion_disabled", "Integrity Media author deletion is disabled.");
  }

  if (!requestShapeIsValid(input)) {
    return failure(400, "invalid_request", "The deletion request is not valid.");
  }

  if (!input.secret) {
    return failure(503, "author_deletion_not_configured", "Integrity Media author deletion is not configured.");
  }

  const now = input.now ?? new Date();
  const expected = signIntegrityMediaAuthorDeletion(
    input.secret,
    buildIntegrityMediaAuthorDeletionPayload({
      timestamp: input.timestamp,
      operationId: input.operationId,
      authorId: input.authorId,
      huTarget: input.huTarget,
      expectedMemberId: input.expectedMemberId,
      expectedLinkRevision: input.expectedLinkRevision,
      expectedLinkInstanceId: input.expectedLinkInstanceId,
    }),
  );

  if (!integrityMediaAuthorDeletionSignaturesEqual(expected, input.signature)) {
    return failure(401, "invalid_signature", "The deletion signature is not valid.");
  }

  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    return failure(401, "stale_timestamp", "The deletion timestamp is outside the allowed window.");
  }

  if (!integrityMediaEnvironmentTargetAccepted(input.huTarget)) {
    return failure(409, "environment_rejected", "The deletion target does not match this environment.");
  }

  const command: AuthorDeletionCommand = {
    operationId: input.operationId,
    externalAuthorId: input.authorId,
    huTarget: input.huTarget,
    expectedMemberId: input.expectedMemberId,
    expectedLinkRevision: input.expectedLinkRevision,
    expectedLinkInstanceId:
      input.expectedLinkInstanceId === AUTHOR_DELETION_INSTANCE_ABSENT
        ? null
        : input.expectedLinkInstanceId,
    nowIso: now.toISOString(),
  };
  const store = getExternalAuthorLinkStore();
  const known = await store.findAuthorDeletionReceipt(command.operationId);

  if (known && known.externalAuthorId !== command.externalAuthorId) {
    return failure(409, "operation_conflict", "This deletion operation is already bound to another request.");
  }

  if (!known && hasIntegrityMediaAuthorDeletionSignature(input.signature, now.getTime())) {
    return failure(401, "replayed", "This deletion request was already used.");
  }

  if (!hasIntegrityMediaAuthorDeletionSignature(input.signature, now.getTime())) {
    noteIntegrityMediaAuthorDeletionSignature(input.signature, now.getTime());
  }

  try {
    const applied = await store.applyAuthorDeletion(command);

    if (applied.status === "pending") {
      return {
        ok: true,
        operationId: applied.operationId,
        authorId: applied.externalAuthorId,
        status: "pending",
        cleanup: "pending",
        idempotent: applied.idempotent,
      };
    }

    if (applied.status === "conflict") {
      return failure(409, "operation_conflict", "This deletion operation is already bound to another request.");
    }

    if (applied.status === "unavailable") {
      return failure(503, "deletion_unavailable", "Integrity Media author deletion could not be saved.");
    }

    return failure(statusFor(applied.code), applied.code, messageFor(applied.code));
  } catch (error) {
    if (error instanceof MongoTransactionUnavailableError) {
      forgetIntegrityMediaAuthorDeletionSignature(input.signature);
      return failure(503, "deletion_unavailable", "Integrity Media author deletion could not be saved.");
    }

    forgetIntegrityMediaAuthorDeletionSignature(input.signature);
    throw error;
  }
}

function requestShapeIsValid(input: {
  operationId: string;
  authorId: string;
  huTarget: string;
  expectedMemberId: string;
  expectedLinkRevision: number;
  expectedLinkInstanceId: string;
  timestamp: string;
}): boolean {
  const instanceIsUuid = INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.expectedLinkInstanceId);
  const instanceIsAbsent = input.expectedLinkInstanceId === AUTHOR_DELETION_INSTANCE_ABSENT;

  return (
    INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.operationId) &&
    INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.authorId) &&
    INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.expectedMemberId) &&
    (instanceIsUuid || instanceIsAbsent) &&
    isIntegrityMediaDeploymentTarget(input.huTarget) &&
    Number.isInteger(input.expectedLinkRevision) &&
    input.expectedLinkRevision >= 1 &&
    /^\d{10}$/.test(input.timestamp)
  );
}

function statusFor(code: AuthorDeletionRejectCode): number {
  return code === "link_not_found" ? 404 : 409;
}

function messageFor(code: AuthorDeletionRejectCode): string {
  switch (code) {
    case "link_not_found":
      return "No Integrity Media author link matches this deletion request.";
    case "member_mismatch":
      return "The expected member does not match this Integrity Media link.";
    case "revision_mismatch":
      return "The expected connection generation does not match this Integrity Media link.";
    case "instance_mismatch":
      return "The expected link instance does not match this Integrity Media link.";
    default:
      return "The deletion request does not match the current Integrity Media link.";
  }
}

function failure(
  status: number,
  code: string,
  message: string,
): IntegrityMediaAuthorDeletionFailure {
  return { ok: false, status, code, message };
}

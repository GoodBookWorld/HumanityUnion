import { randomUUID } from "node:crypto";

import { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";
import { assignedLinkRevision, revisionForReconnect } from "./external-author-link.revision.js";
import type {
  ExternalAuthorLinkAuditRecord,
  ExternalAuthorLinkRecord,
  ExternalAuthorLinkRecoveryOutcome,
  ExternalAuthorLinkRecoveryReceiptRecord,
  ExternalAuthorLinkResultRecord,
} from "./external-author-link.types.js";

export interface IntegrityMediaBindingRecoveryRequest {
  resultCode: string;
  externalAuthorId: string;
  huTarget: string;
  expectedHuMemberId: string;
  expectedHuLinkRevision: number;
  expectedHuLinkInstanceId: string;
  recoveryId: string;
}

export const BINDING_RECOVERY_REJECTIONS = {
  result_not_found: { status: 404, message: "The confirmation result was not found." },
  result_expired: { status: 410, message: "This confirmation result has expired." },
  result_already_used: { status: 409, message: "This confirmation result was already used." },
  result_author_mismatch: {
    status: 409,
    message: "This confirmation result belongs to another Integrity Media author.",
  },
  replacement_member_unchanged: {
    status: 409,
    message: "The confirmed participant is already the historical member.",
  },
  member_already_linked: {
    status: 409,
    message: "This Humanity Union account is already linked to another Integrity Media author.",
  },
  link_not_found: {
    status: 404,
    message: "No Integrity Media author link exists for this author.",
  },
  legacy_binding: {
    status: 409,
    message: "This Integrity Media link has no recoverable generation.",
  },
  link_provisional: { status: 409, message: "This Integrity Media link is still provisional." },
  link_not_recoverable: {
    status: 409,
    message: "This Integrity Media author link cannot be recovered.",
  },
  historical_member_mismatch: {
    status: 409,
    message: "The historical member does not match this Integrity Media link.",
  },
  historical_revision_mismatch: {
    status: 409,
    message: "The historical revision does not match this Integrity Media link.",
  },
  historical_instance_mismatch: {
    status: 409,
    message: "The historical instance does not match this Integrity Media link.",
  },
  historical_binding_mismatch: {
    status: 409,
    message: "The historical binding does not match this Integrity Media link.",
  },
} as const;

export type BindingRecoveryRejectionCode = keyof typeof BINDING_RECOVERY_REJECTIONS;

export function isBindingRecoveryRejectionCode(
  value: string | null | undefined,
): value is BindingRecoveryRejectionCode {
  return typeof value === "string" && Object.hasOwn(BINDING_RECOVERY_REJECTIONS, value);
}

export type BindingRecoveryApplyResult =
  | { kind: "recovered"; outcome: ExternalAuthorLinkRecoveryOutcome }
  | { kind: "rejected"; code: BindingRecoveryRejectionCode }
  | { kind: "conflict" };

/**
 * Persistence used by one recovery attempt. The Mongo implementation binds
 * every operation to one transaction session.
 */
export interface BindingRecoveryPersistence {
  findReceipt(recoveryId: string): Promise<ExternalAuthorLinkRecoveryReceiptRecord | null>;
  /** The Mongo implementation never returns "duplicate": a duplicate key aborts the transaction. */
  insertReceipt(record: ExternalAuthorLinkRecoveryReceiptRecord): Promise<"inserted" | "duplicate">;
  replaceReceipt(record: ExternalAuthorLinkRecoveryReceiptRecord): Promise<void>;
  findLinkByAuthor(externalAuthorId: string): Promise<ExternalAuthorLinkRecord | null>;
  findLinkByMember(memberId: string): Promise<ExternalAuthorLinkRecord | null>;
  findResult(resultCode: string): Promise<ExternalAuthorLinkResultRecord | null>;
  /** Reserve an unconsumed result that has no other reservation. */
  reserveResult(resultCode: string, reservationId: string): Promise<boolean>;
  /** Remove this reservation while the result is still unconsumed. */
  releaseResult(resultCode: string, reservationId: string): Promise<void>;
  /** Consume a result reserved by this reservation. */
  consumeResult(resultCode: string, reservationId: string, nowIso: string): Promise<boolean>;
  /** Compare-and-swap the historical tuple to the replacement member. */
  rebind(input: BindingRecoveryRebind): Promise<"rebound" | "stale" | "member_taken">;
  findRecoveryAudit(recoveryId: string): Promise<ExternalAuthorLinkAuditRecord | null>;
  insertAudit(record: ExternalAuthorLinkAuditRecord): Promise<void>;
}

export interface BindingRecoveryRebind {
  externalAuthorId: string;
  historicalMemberId: string;
  historicalLinkRevision: number;
  historicalLinkInstanceId: string;
  recoveryId: string;
  set: {
    memberId: string;
    linkRevision: number;
    linkInstanceId: string;
    linkFinalization: "provisional";
    updatedAt: string;
    bindingRecoveryId: string;
    bindingRecoveryResultCode: string;
    bindingRecoveryHuTarget: string;
    bindingRecoveryReplacedMemberId: string;
    bindingRecoveryReplacedLinkRevision: number;
    bindingRecoveryReplacedLinkInstanceId: string;
  };
}

export interface BindingRecoveryApplyInput {
  request: IntegrityMediaBindingRecoveryRequest;
  /** Author bound by the committed provision attempt of the result, if any. */
  provisionAuthorId: string | null;
  now: Date;
}

export type BindingRecoveryInterruptStage = "after_rebind" | "after_consume";

export class IntegrityMediaBindingRecoveryInterruptedError extends Error {
  constructor(readonly stage: BindingRecoveryInterruptStage) {
    super(`Integrity Media binding recovery interrupted ${stage}.`);
    this.name = "IntegrityMediaBindingRecoveryInterruptedError";
  }
}

export class IntegrityMediaBindingRecoveryIncompleteError extends Error {
  constructor() {
    super("Integrity Media binding recovery could not be finished.");
    this.name = "IntegrityMediaBindingRecoveryIncompleteError";
  }
}

let interruptStage: BindingRecoveryInterruptStage | null = null;

/** Test hook. Production leaves it unset. */
export function setIntegrityMediaBindingRecoveryInterruptForTests(
  stage: BindingRecoveryInterruptStage | null,
): void {
  interruptStage = stage;
}

function interruptIfRequested(stage: BindingRecoveryInterruptStage): void {
  if (interruptStage === stage) {
    throw new IntegrityMediaBindingRecoveryInterruptedError(stage);
  }
}

export function sameRecoveryRequest(
  receipt: ExternalAuthorLinkRecoveryReceiptRecord,
  request: IntegrityMediaBindingRecoveryRequest,
): boolean {
  return (
    receipt.recoveryId === request.recoveryId &&
    receipt.source === INTEGRITY_MEDIA_SOURCE &&
    receipt.resultCode === request.resultCode &&
    receipt.externalAuthorId === request.externalAuthorId &&
    receipt.huTarget === request.huTarget &&
    receipt.expectedHuMemberId === request.expectedHuMemberId &&
    receipt.expectedHuLinkRevision === request.expectedHuLinkRevision &&
    receipt.expectedHuLinkInstanceId === request.expectedHuLinkInstanceId
  );
}

/**
 * Read-only interpretation of a stored receipt. Null means the request has
 * no committed outcome: no receipt, or a pending one.
 */
export function recoveryResultFromCommittedReceipt(
  receipt: ExternalAuthorLinkRecoveryReceiptRecord | null,
  request: IntegrityMediaBindingRecoveryRequest,
): BindingRecoveryApplyResult | null {
  if (!receipt) {
    return null;
  }

  if (!sameRecoveryRequest(receipt, request)) {
    return { kind: "conflict" };
  }

  if (receipt.status === "completed" && receipt.outcome) {
    return { kind: "recovered", outcome: { ...receipt.outcome } };
  }

  if (receipt.status === "rejected" && isBindingRecoveryRejectionCode(receipt.rejectionCode)) {
    return { kind: "rejected", code: receipt.rejectionCode };
  }

  return null;
}

const MEMBER_UNIQUE_INDEX_NAME = "external_author_links_source_member_unique";

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/** A duplicate key on the unique (source, memberId) link index. */
export function isBindingRecoveryMemberDuplicate(error: unknown): boolean {
  if (!isMongoDuplicateKeyError(error)) {
    return false;
  }

  const keyPattern = (error as { keyPattern?: unknown }).keyPattern;
  if (typeof keyPattern === "object" && keyPattern !== null) {
    const keys = Object.keys(keyPattern).sort();
    if (keys.length === 2 && keys[0] === "memberId" && keys[1] === "source") {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : "";
  return message.includes(MEMBER_UNIQUE_INDEX_NAME);
}

/**
 * The server refused a transaction because it is not a replica set member or
 * mongos. Nothing was written and no ordinary write may follow.
 */
export function isMongoTransactionUnsupportedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
    ((error as { code?: unknown }).code === 20 && /transaction/i.test(message))
  );
}

/**
 * Interpret a failed recovery transaction without writing. Only a duplicate key
 * is interpreted: a committed receipt answers, an occupied replacement member is
 * the ordinary occupied-member rejection, and any other duplicate is incomplete.
 * Every other error is rethrown unchanged.
 */
export async function resolveAbortedBindingRecovery(input: {
  error: unknown;
  request: IntegrityMediaBindingRecoveryRequest;
  readCommittedReceipt: () => Promise<ExternalAuthorLinkRecoveryReceiptRecord | null>;
}): Promise<BindingRecoveryApplyResult> {
  if (!isMongoDuplicateKeyError(input.error)) {
    throw input.error;
  }

  const committed = recoveryResultFromCommittedReceipt(
    await input.readCommittedReceipt(),
    input.request,
  );
  if (committed) {
    return committed;
  }

  if (isBindingRecoveryMemberDuplicate(input.error)) {
    return { kind: "rejected", code: "member_already_linked" };
  }

  throw new IntegrityMediaBindingRecoveryIncompleteError();
}

/**
 * Only a linked, confirmed row with an assigned generation and instance that
 * equal the historical tuple is recoverable. A missing revision is not 0 and
 * is not generation 1.
 */
export function classifyHistoricalBinding(
  link: ExternalAuthorLinkRecord,
  request: IntegrityMediaBindingRecoveryRequest,
): BindingRecoveryRejectionCode | null {
  if (link.source !== INTEGRITY_MEDIA_SOURCE || link.state !== "linked") {
    return "link_not_recoverable";
  }

  if (link.linkFinalization === "provisional") {
    return "link_provisional";
  }

  const revision = assignedLinkRevision(link.linkRevision);
  if (link.linkFinalization !== "confirmed" || revision === null || !link.linkInstanceId) {
    return "legacy_binding";
  }

  if (link.memberId !== request.expectedHuMemberId) {
    return "historical_member_mismatch";
  }

  if (revision !== request.expectedHuLinkRevision) {
    return "historical_revision_mismatch";
  }

  if (link.linkInstanceId !== request.expectedHuLinkInstanceId) {
    return "historical_instance_mismatch";
  }

  if (link.bindingRecoveryId !== undefined && link.bindingRecoveryId !== request.recoveryId) {
    return "historical_binding_mismatch";
  }

  return null;
}

type Evaluation =
  | { kind: "reject"; code: BindingRecoveryRejectionCode; result: ExternalAuthorLinkResultRecord | null }
  | { kind: "proceed"; link: ExternalAuthorLinkRecord; result: ExternalAuthorLinkResultRecord }
  | { kind: "resume"; link: ExternalAuthorLinkRecord; result: ExternalAuthorLinkResultRecord };

/**
 * One recovery attempt. On Mongo this runs as one transaction callback, so a
 * thrown error commits nothing. The memory store keeps partial progress and a
 * retry with the same recoveryId finishes it.
 */
export async function executeBindingRecovery(
  persistence: BindingRecoveryPersistence,
  input: BindingRecoveryApplyInput,
): Promise<BindingRecoveryApplyResult> {
  const { request } = input;
  const nowIso = input.now.toISOString();
  let receipt = await persistence.findReceipt(request.recoveryId);

  if (receipt) {
    const committed = recoveryResultFromCommittedReceipt(receipt, request);
    if (committed) {
      return committed;
    }
  } else {
    receipt = pendingReceipt(request, nowIso);
    const inserted = await persistence.insertReceipt(receipt);
    if (inserted === "duplicate") {
      const winner = await persistence.findReceipt(request.recoveryId);
      const committed = recoveryResultFromCommittedReceipt(winner, request);
      if (committed) {
        return committed;
      }

      throw new IntegrityMediaBindingRecoveryIncompleteError();
    }
  }

  const evaluation = await evaluate(persistence, input);

  if (evaluation.kind === "reject") {
    if (evaluation.result) {
      await persistence.releaseResult(request.resultCode, request.recoveryId);
    }

    return reject(persistence, receipt, evaluation.code, nowIso);
  }

  let outcome: ExternalAuthorLinkRecoveryOutcome;
  let reserved = evaluation.result.bindingRecoveryReservationId === request.recoveryId;

  if (evaluation.kind === "resume") {
    outcome = outcomeFromRecoveredLink(evaluation.link, request);
  } else {
    if (!reserved) {
      reserved = await persistence.reserveResult(request.resultCode, request.recoveryId);
      if (!reserved) {
        return reject(persistence, receipt, "result_already_used", nowIso);
      }
    }

    const linkRevision = revisionForReconnect(evaluation.link.linkRevision);
    const linkInstanceId = randomUUID();
    const rebound = await persistence.rebind({
      externalAuthorId: request.externalAuthorId,
      historicalMemberId: request.expectedHuMemberId,
      historicalLinkRevision: request.expectedHuLinkRevision,
      historicalLinkInstanceId: request.expectedHuLinkInstanceId,
      recoveryId: request.recoveryId,
      set: {
        memberId: evaluation.result.memberId,
        linkRevision,
        linkInstanceId,
        linkFinalization: "provisional",
        updatedAt: nowIso,
        bindingRecoveryId: request.recoveryId,
        bindingRecoveryResultCode: request.resultCode,
        bindingRecoveryHuTarget: request.huTarget,
        bindingRecoveryReplacedMemberId: request.expectedHuMemberId,
        bindingRecoveryReplacedLinkRevision: request.expectedHuLinkRevision,
        bindingRecoveryReplacedLinkInstanceId: request.expectedHuLinkInstanceId,
      },
    });

    if (rebound !== "rebound") {
      await persistence.releaseResult(request.resultCode, request.recoveryId);
      return reject(
        persistence,
        receipt,
        rebound === "member_taken" ? "member_already_linked" : "historical_binding_mismatch",
        nowIso,
      );
    }

    interruptIfRequested("after_rebind");

    outcome = {
      memberId: evaluation.result.memberId,
      linkRevision,
      linkInstanceId,
      replacedMemberId: request.expectedHuMemberId,
      replacedLinkRevision: request.expectedHuLinkRevision,
      replacedLinkInstanceId: request.expectedHuLinkInstanceId,
    };
  }

  if (!evaluation.result.consumedAt) {
    if (!reserved) {
      reserved = await persistence.reserveResult(request.resultCode, request.recoveryId);
    }

    const consumed =
      reserved && (await persistence.consumeResult(request.resultCode, request.recoveryId, nowIso));
    if (!consumed) {
      throw new IntegrityMediaBindingRecoveryIncompleteError();
    }
  }

  interruptIfRequested("after_consume");

  const existingAudit = await persistence.findRecoveryAudit(request.recoveryId);
  if (!existingAudit) {
    await persistence.insertAudit({
      eventId: randomUUID(),
      action: "link_binding_recovered",
      source: INTEGRITY_MEDIA_SOURCE,
      memberId: outcome.memberId,
      externalAuthorId: request.externalAuthorId,
      attemptStateHash: null,
      reason: "reassigned",
      createdAt: nowIso,
      recoveryId: request.recoveryId,
      replacedMemberId: outcome.replacedMemberId,
      linkRevision: outcome.linkRevision,
      linkInstanceId: outcome.linkInstanceId,
      replacedLinkRevision: outcome.replacedLinkRevision,
      replacedLinkInstanceId: outcome.replacedLinkInstanceId,
    });
  }

  await persistence.replaceReceipt({
    ...receipt,
    status: "completed",
    outcome,
    rejectionCode: null,
    updatedAt: nowIso,
  });

  return { kind: "recovered", outcome };
}

async function evaluate(
  persistence: BindingRecoveryPersistence,
  input: BindingRecoveryApplyInput,
): Promise<Evaluation> {
  const { request } = input;
  const nowIso = input.now.toISOString();
  const result = await persistence.findResult(request.resultCode);

  if (!result || result.source !== INTEGRITY_MEDIA_SOURCE) {
    return { kind: "reject", code: "result_not_found", result: null };
  }

  const ownReservation = result.bindingRecoveryReservationId === request.recoveryId;

  if (!ownReservation) {
    if (result.bindingRecoveryReservationId !== undefined || result.consumedAt) {
      return { kind: "reject", code: "result_already_used", result: null };
    }

    if (result.expiresAt <= nowIso) {
      return { kind: "reject", code: "result_expired", result: null };
    }
  }

  if (
    (result.externalAuthorId !== undefined && result.externalAuthorId !== request.externalAuthorId) ||
    (input.provisionAuthorId !== null && input.provisionAuthorId !== request.externalAuthorId)
  ) {
    return { kind: "reject", code: "result_author_mismatch", result: ownReservation ? result : null };
  }

  const link = await persistence.findLinkByAuthor(request.externalAuthorId);
  if (!link) {
    return { kind: "reject", code: "link_not_found", result: ownReservation ? result : null };
  }

  if (isRecoveredByThisRequest(link, result, request)) {
    return { kind: "resume", link, result };
  }

  const historical = classifyHistoricalBinding(link, request);
  if (historical) {
    return { kind: "reject", code: historical, result: ownReservation ? result : null };
  }

  if (result.memberId === link.memberId) {
    return {
      kind: "reject",
      code: "replacement_member_unchanged",
      result: ownReservation ? result : null,
    };
  }

  const occupant = await persistence.findLinkByMember(result.memberId);
  if (occupant && occupant.externalAuthorId !== request.externalAuthorId) {
    return { kind: "reject", code: "member_already_linked", result: ownReservation ? result : null };
  }

  return { kind: "proceed", link, result };
}

function isRecoveredByThisRequest(
  link: ExternalAuthorLinkRecord,
  result: ExternalAuthorLinkResultRecord,
  request: IntegrityMediaBindingRecoveryRequest,
): boolean {
  return (
    link.bindingRecoveryId === request.recoveryId &&
    link.memberId === result.memberId &&
    link.bindingRecoveryReplacedMemberId === request.expectedHuMemberId &&
    link.bindingRecoveryReplacedLinkRevision === request.expectedHuLinkRevision &&
    link.bindingRecoveryReplacedLinkInstanceId === request.expectedHuLinkInstanceId &&
    assignedLinkRevision(link.linkRevision) !== null &&
    Boolean(link.linkInstanceId)
  );
}

function outcomeFromRecoveredLink(
  link: ExternalAuthorLinkRecord,
  request: IntegrityMediaBindingRecoveryRequest,
): ExternalAuthorLinkRecoveryOutcome {
  return {
    memberId: link.memberId,
    linkRevision: assignedLinkRevision(link.linkRevision)!,
    linkInstanceId: link.linkInstanceId!,
    replacedMemberId: request.expectedHuMemberId,
    replacedLinkRevision: request.expectedHuLinkRevision,
    replacedLinkInstanceId: request.expectedHuLinkInstanceId,
  };
}

function pendingReceipt(
  request: IntegrityMediaBindingRecoveryRequest,
  nowIso: string,
): ExternalAuthorLinkRecoveryReceiptRecord {
  return {
    recoveryId: request.recoveryId,
    source: INTEGRITY_MEDIA_SOURCE,
    resultCode: request.resultCode,
    externalAuthorId: request.externalAuthorId,
    huTarget: request.huTarget,
    expectedHuMemberId: request.expectedHuMemberId,
    expectedHuLinkRevision: request.expectedHuLinkRevision,
    expectedHuLinkInstanceId: request.expectedHuLinkInstanceId,
    status: "pending",
    outcome: null,
    rejectionCode: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

async function reject(
  persistence: BindingRecoveryPersistence,
  receipt: ExternalAuthorLinkRecoveryReceiptRecord,
  code: BindingRecoveryRejectionCode,
  nowIso: string,
): Promise<BindingRecoveryApplyResult> {
  await persistence.replaceReceipt({
    ...receipt,
    status: "rejected",
    outcome: null,
    rejectionCode: code,
    updatedAt: nowIso,
  });
  return { kind: "rejected", code };
}

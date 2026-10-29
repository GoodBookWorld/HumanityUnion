import { MongoTransactionUnavailableError } from "../../infrastructure/mongodb/mongo-transaction.js";
import { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";
import { linkRevisionMatches } from "./external-author-link.revision.js";
import type {
  AuthorDeletionRemovalCounts,
  AuthorDeletionWithheldRecord,
  ExternalAuthorDeletionReceipt,
  ExternalAuthorDeletionTombstone,
  ExternalAuthorLinkRecord,
} from "./external-author-link.types.js";

/** Signed token for a legacy link that has no linkInstanceId. */
export const AUTHOR_DELETION_INSTANCE_ABSENT = "absent";

export type AuthorDeletionRejectCode =
  | "link_not_found"
  | "member_mismatch"
  | "revision_mismatch"
  | "instance_mismatch";

export interface AuthorDeletionCommand {
  operationId: string;
  externalAuthorId: string;
  huTarget: string;
  expectedMemberId: string;
  expectedLinkRevision: number;
  expectedLinkInstanceId: string | null;
  nowIso: string;
}

export type AuthorDeletionApplyResult =
  | {
      status: "pending";
      idempotent: boolean;
      operationId: string;
      externalAuthorId: string;
    }
  | {
      status: "completed";
      idempotent: true;
      operationId: string;
      externalAuthorId: string;
      withheld: AuthorDeletionWithheldRecord[];
      removed: AuthorDeletionRemovalCounts;
    }
  | { status: "rejected"; idempotent: boolean; code: AuthorDeletionRejectCode }
  | { status: "conflict" }
  | { status: "unavailable" };

export function emptyAuthorDeletionRemovalCounts(): AuthorDeletionRemovalCounts {
  return {
    posts: 0,
    comments: 0,
    reactions: 0,
    translations: 0,
    publicationDeliveries: 0,
    articleDeliveries: 0,
    provisionAttempts: 0,
    ssoGrants: 0,
    messages: 0,
    messageAudits: 0,
    disconnectEvents: 0,
    linkAudits: 0,
    links: 0,
  };
}

export class AuthorDeletionRestartError extends Error {
  constructor() {
    super("author_deletion_restart");
    this.name = "AuthorDeletionRestartError";
  }
}

let failTransactionForTests = false;

export function setAuthorDeletionTransactionFailureForTests(fail: boolean): void {
  failTransactionForTests = fail;
}

export function assertAuthorDeletionTransactionAvailable(): void {
  if (failTransactionForTests) {
    throw new MongoTransactionUnavailableError();
  }
}

export function sameAuthorDeletionRequest(
  receipt: ExternalAuthorDeletionReceipt,
  command: AuthorDeletionCommand,
): boolean {
  return (
    receipt.source === INTEGRITY_MEDIA_SOURCE &&
    receipt.externalAuthorId === command.externalAuthorId &&
    receipt.huTarget === command.huTarget &&
    receipt.expectedMemberId === command.expectedMemberId &&
    receipt.expectedLinkRevision === command.expectedLinkRevision &&
    receipt.expectedLinkInstanceId === command.expectedLinkInstanceId
  );
}

export function classifyAuthorDeletionBinding(
  link: ExternalAuthorLinkRecord | null,
  command: AuthorDeletionCommand,
): { ok: true } | { ok: false; code: AuthorDeletionRejectCode } {
  if (!link || link.source !== INTEGRITY_MEDIA_SOURCE || link.externalAuthorId !== command.externalAuthorId) {
    return { ok: false, code: "link_not_found" };
  }

  if (link.memberId !== command.expectedMemberId) {
    return { ok: false, code: "member_mismatch" };
  }

  if (!linkRevisionMatches(link.linkRevision, command.expectedLinkRevision)) {
    return { ok: false, code: "revision_mismatch" };
  }

  const storedInstance = storedLinkInstance(link.linkInstanceId);
  if (storedInstance !== command.expectedLinkInstanceId) {
    return { ok: false, code: "instance_mismatch" };
  }

  return { ok: true };
}

function storedLinkInstance(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return value;
}

export interface AuthorDeletionIo {
  /** Write the shared author guard so a concurrent link insert conflicts. */
  bumpGuard(externalAuthorId: string): Promise<void>;
  findReceipt(operationId: string): Promise<ExternalAuthorDeletionReceipt | null>;
  findLink(externalAuthorId: string): Promise<ExternalAuthorLinkRecord | null>;
  findTombstone(externalAuthorId: string): Promise<ExternalAuthorDeletionTombstone | null>;
  insertReceipt(record: ExternalAuthorDeletionReceipt): Promise<"inserted" | "duplicate">;
  insertTombstone(record: ExternalAuthorDeletionTombstone): Promise<"inserted" | "duplicate">;
  markLinkPending(command: AuthorDeletionCommand): Promise<"marked" | "missing">;
}

export async function executeAuthorDeletion(
  io: AuthorDeletionIo,
  command: AuthorDeletionCommand,
): Promise<AuthorDeletionApplyResult> {
  await io.bumpGuard(command.externalAuthorId);
  const existing = await io.findReceipt(command.operationId);
  if (existing) {
    if (!sameAuthorDeletionRequest(existing, command)) {
      return { status: "conflict" };
    }

    if (existing.status === "pending") {
      return {
        status: "pending",
        idempotent: true,
        operationId: existing.operationId,
        externalAuthorId: existing.externalAuthorId,
      };
    }

    if (existing.status === "completed") {
      return {
        status: "completed",
        idempotent: true,
        operationId: existing.operationId,
        externalAuthorId: existing.externalAuthorId,
        withheld: existing.withheld?.map((entry) => ({ ...entry })) ?? [],
        removed: existing.removed ? { ...existing.removed } : emptyAuthorDeletionRemovalCounts(),
      };
    }

    if (existing.status === "rejected" && isRejectCode(existing.rejectCode)) {
      return { status: "rejected", idempotent: true, code: existing.rejectCode };
    }

    return { status: "unavailable" };
  }

  const decision = classifyAuthorDeletionBinding(
    await io.findLink(command.externalAuthorId),
    command,
  );
  if (!decision.ok) {
    const inserted = await io.insertReceipt(rejectedReceipt(command, decision.code));
    if (inserted === "duplicate") {
      throw new AuthorDeletionRestartError();
    }

    return { status: "rejected", idempotent: false, code: decision.code };
  }

  const tombstone = await io.findTombstone(command.externalAuthorId);
  if (!tombstone) {
    const inserted = await io.insertTombstone({
      source: INTEGRITY_MEDIA_SOURCE,
      externalAuthorId: command.externalAuthorId,
      operationId: command.operationId,
      createdAt: command.nowIso,
    });
    if (inserted === "duplicate") {
      throw new AuthorDeletionRestartError();
    }
  }

  const marked = await io.markLinkPending(command);
  if (marked !== "marked") {
    throw new AuthorDeletionRestartError();
  }

  const receipt = await io.insertReceipt(pendingReceipt(command));
  if (receipt === "duplicate") {
    throw new AuthorDeletionRestartError();
  }

  return {
    status: "pending",
    idempotent: false,
    operationId: command.operationId,
    externalAuthorId: command.externalAuthorId,
  };
}

function pendingReceipt(command: AuthorDeletionCommand): ExternalAuthorDeletionReceipt {
  return {
    operationId: command.operationId,
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: command.externalAuthorId,
    huTarget: command.huTarget,
    expectedMemberId: command.expectedMemberId,
    expectedLinkRevision: command.expectedLinkRevision,
    expectedLinkInstanceId: command.expectedLinkInstanceId,
    status: "pending",
    rejectCode: null,
    createdAt: command.nowIso,
    updatedAt: command.nowIso,
  };
}

function rejectedReceipt(
  command: AuthorDeletionCommand,
  code: AuthorDeletionRejectCode,
): ExternalAuthorDeletionReceipt {
  return {
    ...pendingReceipt(command),
    status: "rejected",
    rejectCode: code,
  };
}

function isRejectCode(value: string | null): value is AuthorDeletionRejectCode {
  return (
    value === "link_not_found" ||
    value === "member_mismatch" ||
    value === "revision_mismatch" ||
    value === "instance_mismatch"
  );
}

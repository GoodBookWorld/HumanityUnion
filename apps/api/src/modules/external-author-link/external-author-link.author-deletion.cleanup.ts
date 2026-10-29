import type { ArticleDeliveryRecord } from "./external-author-link.article-ingest.repository.js";
import {
  deleteProvenAuthorDeletionRecords,
  findAuthorDeletionPostOwners,
  listAuthorDeletionDeliveries,
  type AuthorDeletionPostOwner,
} from "./external-author-link.author-deletion.cleanup.records.js";
import {
  AuthorDeletionRestartError,
  classifyAuthorDeletionBinding,
  emptyAuthorDeletionRemovalCounts,
  sameAuthorDeletionRequest,
  type AuthorDeletionCommand,
} from "./external-author-link.author-deletion.rules.js";
import type {
  AuthorDeletionRemovalCounts,
  AuthorDeletionWithheldReason,
  AuthorDeletionWithheldRecord,
  ExternalAuthorDeletionReceipt,
  ExternalAuthorDeletionTombstone,
  ExternalAuthorLinkRecord,
} from "./external-author-link.types.js";

export type AuthorDeletionCleanupResult =
  | {
      status: "completed";
      idempotent: boolean;
      operationId: string;
      externalAuthorId: string;
      withheld: AuthorDeletionWithheldRecord[];
      removed: AuthorDeletionRemovalCounts;
    }
  | { status: "incomplete" }
  | { status: "conflict" }
  | { status: "unavailable" };

export class AuthorDeletionCleanupAbortError extends Error {
  constructor() {
    super("author_deletion_cleanup_aborted");
    this.name = "AuthorDeletionCleanupAbortError";
  }
}

type CleanupFailureMode = "off" | "before_writes" | "after_writes";

let cleanupFailureMode: CleanupFailureMode = "off";

export function setAuthorDeletionCleanupFailureForTests(mode: CleanupFailureMode): void {
  if (process.env.NODE_TEST_ENV !== "true" && mode !== "off") {
    throw new Error("Author deletion cleanup failures are available only when NODE_TEST_ENV=true.");
  }
  cleanupFailureMode = mode;
}

export interface AuthorDeletionCleanupIo {
  bumpGuard(externalAuthorId: string): Promise<void>;
  findReceipt(operationId: string): Promise<ExternalAuthorDeletionReceipt | null>;
  findLink(externalAuthorId: string): Promise<ExternalAuthorLinkRecord | null>;
  findTombstone(externalAuthorId: string): Promise<ExternalAuthorDeletionTombstone | null>;
  listDeliveries(externalAuthorId: string): Promise<ArticleDeliveryRecord[]>;
  findPosts(postIds: readonly string[]): Promise<AuthorDeletionPostOwner[]>;
  deleteProvenRecords(input: {
    externalAuthorId: string;
    postIds: readonly string[];
    publicationIds: readonly string[];
  }): Promise<
    Pick<
      AuthorDeletionRemovalCounts,
      | "posts"
      | "comments"
      | "reactions"
      | "translations"
      | "publicationDeliveries"
      | "articleDeliveries"
      | "provisionAttempts"
      | "ssoGrants"
      | "messages"
      | "messageAudits"
    >
  >;
  deleteAuthorLinkRecords(externalAuthorId: string): Promise<{
    disconnectEvents: number;
    linkAudits: number;
  }>;
  deleteLink(command: AuthorDeletionCommand): Promise<boolean>;
  completeReceipt(
    command: AuthorDeletionCommand,
    acknowledgment: {
      withheld: AuthorDeletionWithheldRecord[];
      removed: AuthorDeletionRemovalCounts;
    },
  ): Promise<boolean>;
}

export async function executeAuthorDeletionCleanup(
  io: AuthorDeletionCleanupIo,
  command: AuthorDeletionCommand,
): Promise<AuthorDeletionCleanupResult> {
  await io.bumpGuard(command.externalAuthorId);
  const existing = await io.findReceipt(command.operationId);
  if (!existing) {
    return { status: "unavailable" };
  }
  if (!sameAuthorDeletionRequest(existing, command)) {
    return { status: "conflict" };
  }
  if (existing.status === "completed") {
    return completedFromReceipt(existing, true);
  }
  if (existing.status !== "pending") {
    return { status: "unavailable" };
  }

  const tombstone = await io.findTombstone(command.externalAuthorId);
  if (!tombstone || tombstone.externalAuthorId !== command.externalAuthorId) {
    return { status: "incomplete" };
  }

  const link = await io.findLink(command.externalAuthorId);
  if (!classifyAuthorDeletionBinding(link, command).ok) {
    return { status: "incomplete" };
  }

  const deliveries = await io.listDeliveries(command.externalAuthorId);
  const plan = planAuthorDeletion(deliveries, command.externalAuthorId);
  const owners = await io.findPosts(plan.postIdsToInspect);
  const decision = decideProvenPosts(plan, owners, command.expectedMemberId);

  if (cleanupFailureMode === "before_writes") {
    throw new AuthorDeletionCleanupAbortError();
  }

  const deleted = await io.deleteProvenRecords({
    externalAuthorId: command.externalAuthorId,
    postIds: decision.provenPostIds,
    publicationIds: decision.provenPublicationIds,
  });
  const authorRecords = await io.deleteAuthorLinkRecords(command.externalAuthorId);
  const linkDeleted = await io.deleteLink(command);
  if (!linkDeleted) {
    throw new AuthorDeletionRestartError();
  }

  const removed: AuthorDeletionRemovalCounts = {
    ...emptyAuthorDeletionRemovalCounts(),
    ...deleted,
    disconnectEvents: authorRecords.disconnectEvents,
    linkAudits: authorRecords.linkAudits,
    links: 1,
  };

  if (cleanupFailureMode === "after_writes") {
    throw new AuthorDeletionCleanupAbortError();
  }

  const completed = await io.completeReceipt(command, {
    withheld: decision.withheld,
    removed,
  });
  if (!completed) {
    throw new AuthorDeletionRestartError();
  }

  return {
    status: "completed",
    idempotent: false,
    operationId: command.operationId,
    externalAuthorId: command.externalAuthorId,
    withheld: decision.withheld,
    removed,
  };
}

export function memoryAuthorDeletionReads(externalAuthorId: string) {
  return {
    async listDeliveries() {
      return listAuthorDeletionDeliveries(externalAuthorId);
    },
    async findPosts(postIds: readonly string[]) {
      return findAuthorDeletionPostOwners(postIds);
    },
    async deleteProvenRecords(input: {
      externalAuthorId: string;
      postIds: readonly string[];
      publicationIds: readonly string[];
    }) {
      return deleteProvenAuthorDeletionRecords(input);
    },
  };
}

export function mongoAuthorDeletionReads(externalAuthorId: string, session: import("mongodb").ClientSession) {
  return {
    async listDeliveries() {
      return listAuthorDeletionDeliveries(externalAuthorId, session);
    },
    async findPosts(postIds: readonly string[]) {
      return findAuthorDeletionPostOwners(postIds, session);
    },
    async deleteProvenRecords(input: {
      externalAuthorId: string;
      postIds: readonly string[];
      publicationIds: readonly string[];
    }) {
      return deleteProvenAuthorDeletionRecords({ ...input, session });
    },
  };
}

interface DeliveryPlan {
  withheld: AuthorDeletionWithheldRecord[];
  postIdsToInspect: string[];
  publicationIdByPostId: Map<string, string[]>;
}

function planAuthorDeletion(
  deliveries: readonly ArticleDeliveryRecord[],
  externalAuthorId: string,
): DeliveryPlan {
  const withheld: AuthorDeletionWithheldRecord[] = [];
  const postIdsToInspect: string[] = [];
  const publicationIdByPostId = new Map<string, string[]>();

  for (const delivery of deliveries) {
    const authorId = delivery.authorId;
    if (typeof authorId !== "string" || authorId.length === 0) {
      continue;
    }
    if (authorId !== externalAuthorId) {
      if (authorId.toLowerCase() === externalAuthorId.toLowerCase()) {
        withheld.push(withheldRecord(delivery, "author_id_case_variant"));
      }
      continue;
    }

    const postId = normalizedPostId(delivery.postId);
    if (!postId) {
      withheld.push({
        publicationId: delivery.publicationId,
        postId: null,
        reason: "missing_post_id",
      });
      continue;
    }

    postIdsToInspect.push(postId);
    const publications = publicationIdByPostId.get(postId) ?? [];
    publications.push(delivery.publicationId);
    publicationIdByPostId.set(postId, publications);
  }

  return { withheld, postIdsToInspect: [...new Set(postIdsToInspect)], publicationIdByPostId };
}

function decideProvenPosts(
  plan: DeliveryPlan,
  owners: readonly AuthorDeletionPostOwner[],
  memberId: string,
): {
  withheld: AuthorDeletionWithheldRecord[];
  provenPostIds: string[];
  provenPublicationIds: string[];
} {
  const ownersById = new Map(owners.map((owner) => [owner.postId, owner]));
  const provenPostIds: string[] = [];
  const provenPublicationIds: string[] = [];
  const withheld = [...plan.withheld];

  for (const postId of plan.postIdsToInspect) {
    const publicationIds = plan.publicationIdByPostId.get(postId) ?? [];
    const owner = ownersById.get(postId);
    if (!owner) {
      for (const publicationId of publicationIds) {
        withheld.push({ publicationId, postId, reason: "post_missing" });
      }
      continue;
    }
    if (owner.authorParticipantId !== memberId) {
      for (const publicationId of publicationIds) {
        withheld.push({ publicationId, postId, reason: "post_owner_mismatch" });
      }
      continue;
    }
    provenPostIds.push(postId);
    provenPublicationIds.push(...publicationIds);
  }

  withheld.sort(compareWithheld);
  return {
    withheld,
    provenPostIds,
    provenPublicationIds: [...new Set(provenPublicationIds)],
  };
}

function withheldRecord(
  delivery: ArticleDeliveryRecord,
  reason: AuthorDeletionWithheldReason,
): AuthorDeletionWithheldRecord {
  return {
    publicationId: delivery.publicationId,
    postId: normalizedPostId(delivery.postId),
    reason,
  };
}

function normalizedPostId(postId: string | null | undefined): string | null {
  if (typeof postId !== "string") {
    return null;
  }
  const trimmed = postId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function compareWithheld(
  left: AuthorDeletionWithheldRecord,
  right: AuthorDeletionWithheldRecord,
): number {
  return (
    left.publicationId.localeCompare(right.publicationId) ||
    left.reason.localeCompare(right.reason) ||
    (left.postId ?? "").localeCompare(right.postId ?? "")
  );
}

function completedFromReceipt(
  receipt: ExternalAuthorDeletionReceipt,
  idempotent: boolean,
): AuthorDeletionCleanupResult {
  return {
    status: "completed",
    idempotent,
    operationId: receipt.operationId,
    externalAuthorId: receipt.externalAuthorId,
    withheld: receipt.withheld?.map((entry) => ({ ...entry })) ?? [],
    removed: receipt.removed ? { ...receipt.removed } : emptyAuthorDeletionRemovalCounts(),
  };
}

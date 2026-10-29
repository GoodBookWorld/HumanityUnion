import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { ClientSession } from "mongodb";

import {
  ensureBlogAuthorCapability,
  type BlogAuthorCapabilityEnsureResult,
  type BlogAuthorCapabilityStore,
} from "../blog/blog-author-capability.js";
import {
  findBlogCapabilityGrant,
  upsertBlogCapabilityGrant,
} from "../blog/persistence/blog.repository.js";
import { getMemberById } from "../member/application/member-read.service.js";
import { classifyIntegrityMediaConfirmationState } from "./external-author-link.binding-recovery-state.js";
import {
  buildIntegrityMediaReturnUrl,
  resolveIntegrityMediaLinkConfig,
} from "./external-author-link.config.js";
import {
  INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN,
  INTEGRITY_MEDIA_AUTHOR_ACTIVATION_ATTEMPTS,
  INTEGRITY_MEDIA_BINDING_RECOVERY_RESULT_PURPOSE,
  INTEGRITY_MEDIA_AUTHOR_ID_PATTERN,
  INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
  INTEGRITY_MEDIA_RESULT_CODE_PATTERN,
  INTEGRITY_MEDIA_RESULT_TTL_MS,
  INTEGRITY_MEDIA_SOURCE,
} from "./external-author-link.constants.js";
import {
  assignedLinkRevision,
  revisionForDuplicateRedeem,
  revisionForNewLink,
  revisionForReconnect,
} from "./external-author-link.revision.js";
import {
  buildIntegrityMediaLinkAcknowledgePayload,
  buildIntegrityMediaLinkRedeemPayload,
  hasIntegrityMediaAcknowledgeSignature,
  hasIntegrityMediaRedeemSignature,
  integrityMediaLinkSignaturesEqual,
  noteIntegrityMediaAcknowledgeSignature,
  noteIntegrityMediaRedeemSignature,
  signIntegrityMediaLinkRedeem,
} from "./external-author-link.hmac.js";
import {
  AUTHOR_DELETION_PENDING_MESSAGE,
  integrityMediaAuthorDeletionBlocks,
} from "./external-author-link.author-deletion.js";
import { resolveIntegrityMediaCollaborationStatus } from "./external-author-link.collaboration.js";
import { findProvisionRedeemOutcome } from "./external-author-link.provision.service.js";
import {
  getExternalAuthorLinkStore,
  type ExternalAuthorLinkStore,
} from "./external-author-link.store.js";
import type {
  ExternalAuthorLinkAuditAction,
  ExternalAuthorLinkConflict,
  ExternalAuthorLinkRecord,
} from "./external-author-link.types.js";

export interface IntegrityMediaLinkFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export interface IntegrityMediaPreviewSuccess {
  ok: true;
  source: typeof INTEGRITY_MEDIA_SOURCE;
  displayName: string;
  /** Present only for a verified Binding Recovery state. */
  purpose?: typeof INTEGRITY_MEDIA_BINDING_RECOVERY_RESULT_PURPOSE;
  /** The signed-in account's own email. Present only with `purpose`. */
  email?: string;
}

export interface IntegrityMediaConfirmSuccess {
  ok: true;
  confirmed: true;
  redirectUrl: string | null;
  resultCode: string;
}

export interface IntegrityMediaCancelSuccess {
  ok: true;
  cancelled: true;
  redirectUrl: string | null;
}

export interface IntegrityMediaRedeemSuccess {
  ok: true;
  memberId: string;
  source: typeof INTEGRITY_MEDIA_SOURCE;
  externalAuthorId: string;
  reconnected: boolean;
  linkRevision: number;
  linkInstanceId?: string;
  provisionOutcome?: "NEW_AUTHOR" | "CONFIRMED_MAPPING_EXISTS";
}

export interface IntegrityMediaAcknowledgeSuccess {
  ok: true;
  source: typeof INTEGRITY_MEDIA_SOURCE;
  externalAuthorId: string;
  memberId: string;
  linkRevision: number;
  linkInstanceId: string;
  finalization: "confirmed";
  idempotent: boolean;
}

type DisplayNameResolver = (memberId: string, email: string) => Promise<string>;

let displayNameResolverOverride: DisplayNameResolver | null = null;

export function setIntegrityMediaDisplayNameResolverForTests(
  resolver: DisplayNameResolver | null,
): void {
  displayNameResolverOverride = resolver;
}

type BlogAuthorCapabilityEnsurer = (
  participantId: string,
  capabilityStore: BlogAuthorCapabilityStore,
) => Promise<BlogAuthorCapabilityEnsureResult>;

let blogAuthorCapabilityEnsurerOverride: BlogAuthorCapabilityEnsurer | null = null;

export function setIntegrityMediaAuthorCapabilityEnsurerForTests(
  ensurer: BlogAuthorCapabilityEnsurer | null,
): void {
  blogAuthorCapabilityEnsurerOverride = ensurer;
}

async function ensureLinkedBlogAuthorCapability(
  participantId: string,
  capabilityStore: BlogAuthorCapabilityStore,
): Promise<BlogAuthorCapabilityEnsureResult> {
  if (blogAuthorCapabilityEnsurerOverride) {
    return blogAuthorCapabilityEnsurerOverride(participantId, capabilityStore);
  }

  return ensureBlogAuthorCapability(participantId, capabilityStore);
}

/** Blog grant reads and writes bound to the link transaction, when there is one. */
function blogAuthorCapabilityStoreFor(session: ClientSession | null): BlogAuthorCapabilityStore {
  const options = session ? { session } : {};
  return {
    findGrant: (participantId) => findBlogCapabilityGrant(participantId, options),
    saveGrant: (grant) => upsertBlogCapabilityGrant(grant, options),
  };
}

type ProvenBlogAuthorOutcome =
  | { ok: true; capability: BlogAuthorCapabilityEnsureResult }
  | { ok: false; linkChanged: boolean };

/**
 * Grant only while the member still holds the link. A rebind or disconnect
 * that commits first leaves `linkChanged` and grants nothing.
 */
async function ensureProvenBlogAuthor(
  store: ExternalAuthorLinkStore,
  link: { externalAuthorId: string; memberId: string },
): Promise<ProvenBlogAuthorOutcome> {
  for (let attempt = 0; attempt < INTEGRITY_MEDIA_AUTHOR_ACTIVATION_ATTEMPTS; attempt += 1) {
    try {
      const outcome = await store.runWithBoundAuthorLink(
        {
          source: INTEGRITY_MEDIA_SOURCE,
          externalAuthorId: link.externalAuthorId,
          memberId: link.memberId,
        },
        (session) =>
          ensureLinkedBlogAuthorCapability(link.memberId, blogAuthorCapabilityStoreFor(session)),
      );
      if (outcome.status === "changed") {
        return { ok: false, linkChanged: true };
      }

      return { ok: true, capability: outcome.value };
    } catch {
      // The proven pair stays. The next attempt is the same idempotent ensure.
    }
  }

  return { ok: false, linkChanged: false };
}

async function setAuthorActivationPending(
  store: ExternalAuthorLinkStore,
  input: {
    externalAuthorId: string;
    memberId: string;
    pending: boolean;
    now: Date;
  },
): Promise<void> {
  const existing = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.externalAuthorId);

  if (!existing || existing.memberId !== input.memberId) {
    return;
  }

  if ((existing.authorActivationPending === true) === input.pending) {
    return;
  }

  await store.updateLink({
    ...existing,
    authorActivationPending: input.pending,
    authorActivationAttemptAt: input.pending ? input.now.toISOString() : null,
    updatedAt: input.now.toISOString(),
  });
}

async function findOperationalAuthorLink(
  store: ExternalAuthorLinkStore,
  input: { externalAuthorId: string; memberId: string },
): Promise<ExternalAuthorLinkRecord | null> {
  const current = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.externalAuthorId);

  if (
    !current ||
    current.memberId !== input.memberId ||
    current.externalAuthorId !== input.externalAuthorId ||
    !isIntegrityMediaAuthorLinkOperational(current)
  ) {
    return null;
  }

  return current;
}

export function isIntegrityMediaAuthorLinkOperational(link: {
  state: ExternalAuthorLinkRecord["state"];
  authorActivationPending?: boolean;
  linkFinalization?: ExternalAuthorLinkRecord["linkFinalization"];
}): boolean {
  return (
    link.state === "linked" &&
    link.authorActivationPending !== true &&
    link.linkFinalization !== "provisional"
  );
}

export async function previewIntegrityMediaLink(input: {
  memberId: string;
  email: string;
  attemptState: string;
}): Promise<IntegrityMediaPreviewSuccess | IntegrityMediaLinkFailure> {
  if (!isSessionMemberId(input.memberId)) {
    return failure(401, "authentication_required", "Authentication required.");
  }

  if (!INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(input.attemptState)) {
    return failure(400, "invalid_state", "This confirmation link is incomplete.");
  }

  const recovery = classifyConfirmationState(input.attemptState, new Date());
  if (recovery.kind === "recovery_rejected") {
    return failure(recovery.status, recovery.code, recovery.message);
  }

  return {
    ok: true,
    source: INTEGRITY_MEDIA_SOURCE,
    displayName: await resolveDisplayName(input.memberId, input.email),
    ...(recovery.kind === "recovery"
      ? { purpose: INTEGRITY_MEDIA_BINDING_RECOVERY_RESULT_PURPOSE, email: input.email }
      : {}),
  };
}

export async function confirmIntegrityMediaLink(input: {
  memberId: string;
  attemptState: string;
  now?: Date;
}): Promise<IntegrityMediaConfirmSuccess | IntegrityMediaLinkFailure> {
  if (!isSessionMemberId(input.memberId)) {
    return failure(401, "authentication_required", "Authentication required.");
  }

  if (!INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(input.attemptState)) {
    return failure(400, "invalid_state", "This confirmation link is incomplete.");
  }

  const now = input.now ?? new Date();
  const recovery = classifyConfirmationState(input.attemptState, now);
  if (recovery.kind === "recovery_rejected") {
    return failure(recovery.status, recovery.code, recovery.message);
  }

  const resultCode = randomBytes(32).toString("base64url");
  const store = getExternalAuthorLinkStore();

  await store.insertResult({
    resultCode,
    source: INTEGRITY_MEDIA_SOURCE,
    attemptState: input.attemptState,
    memberId: input.memberId,
    expiresAt: new Date(now.getTime() + INTEGRITY_MEDIA_RESULT_TTL_MS).toISOString(),
    consumedAt: null,
    createdAt: now.toISOString(),
    ...(recovery.kind === "recovery"
      ? {
          purpose: INTEGRITY_MEDIA_BINDING_RECOVERY_RESULT_PURPOSE,
          externalAuthorId: recovery.fields.externalAuthorId,
          bindingRecoveryId: recovery.fields.recoveryId,
          huTarget: recovery.fields.huTarget,
        }
      : {}),
  });

  await recordAudit(store, {
    action: "link_confirmation_created",
    memberId: input.memberId,
    externalAuthorId: recovery.kind === "recovery" ? recovery.fields.externalAuthorId : null,
    attemptState: input.attemptState,
    reason: recovery.kind === "recovery" ? INTEGRITY_MEDIA_BINDING_RECOVERY_RESULT_PURPOSE : "confirmed",
    now,
  });

  return {
    ok: true,
    confirmed: true,
    resultCode,
    redirectUrl: buildIntegrityMediaReturnUrl({
      status: "confirmed",
      attemptState: input.attemptState,
      resultCode,
      nodeEnv: process.env.NODE_ENV,
    }),
  };
}

export async function cancelIntegrityMediaLink(input: {
  memberId: string;
  attemptState: string;
  now?: Date;
}): Promise<IntegrityMediaCancelSuccess | IntegrityMediaLinkFailure> {
  if (!isSessionMemberId(input.memberId)) {
    return failure(401, "authentication_required", "Authentication required.");
  }

  if (!INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(input.attemptState)) {
    return failure(400, "invalid_state", "This confirmation link is incomplete.");
  }

  const now = input.now ?? new Date();

  await recordAudit(getExternalAuthorLinkStore(), {
    action: "link_rejected",
    memberId: input.memberId,
    externalAuthorId: null,
    attemptState: input.attemptState,
    reason: "cancelled",
    now,
  });

  return {
    ok: true,
    cancelled: true,
    redirectUrl: buildIntegrityMediaReturnUrl({
      status: "cancelled",
      attemptState: input.attemptState,
      nodeEnv: process.env.NODE_ENV,
    }),
  };
}

export async function rejectIntegrityMediaLinkRequest(input: {
  memberId: string | null;
  reason:
    "browser_member_id" | "unexpected_field" | "invalid_signature" | "stale_timestamp" | "replayed";
  now?: Date;
}): Promise<void> {
  await recordAudit(getExternalAuthorLinkStore(), {
    action: "link_rejected",
    memberId: input.memberId,
    externalAuthorId: null,
    attemptState: null,
    reason: input.reason,
    now: input.now ?? new Date(),
  });
}

export async function redeemIntegrityMediaLink(input: {
  resultCode: string;
  externalAuthorId: string;
  timestamp: string;
  signature: string;
  secret: string | null;
  now?: Date;
}): Promise<IntegrityMediaRedeemSuccess | IntegrityMediaLinkFailure> {
  if (!INTEGRITY_MEDIA_RESULT_CODE_PATTERN.test(input.resultCode)) {
    return failure(400, "invalid_result", "The confirmation result is not valid.");
  }

  if (!INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.externalAuthorId)) {
    return failure(400, "invalid_author", "The Integrity Media author id is not valid.");
  }

  if (!/^\d{10}$/.test(input.timestamp)) {
    return failure(400, "invalid_timestamp", "The redemption timestamp is not valid.");
  }

  if (!input.secret) {
    return failure(
      503,
      "link_redeem_not_configured",
      "Integrity Media link redemption is not configured.",
    );
  }

  const now = input.now ?? new Date();
  const expected = signIntegrityMediaLinkRedeem(
    input.secret,
    buildIntegrityMediaLinkRedeemPayload({
      timestamp: input.timestamp,
      resultCode: input.resultCode,
      externalAuthorId: input.externalAuthorId,
      purpose: INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE,
    }),
  );

  if (!integrityMediaLinkSignaturesEqual(expected, input.signature)) {
    await rejectIntegrityMediaLinkRequest({ memberId: null, reason: "invalid_signature", now });
    return failure(401, "invalid_signature", "The redemption signature is not valid.");
  }

  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (Math.abs(nowSeconds - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    await rejectIntegrityMediaLinkRequest({ memberId: null, reason: "stale_timestamp", now });
    return failure(
      401,
      "stale_timestamp",
      "The redemption timestamp is outside the allowed window.",
    );
  }

  if (hasIntegrityMediaRedeemSignature(input.signature, now.getTime())) {
    await rejectIntegrityMediaLinkRequest({ memberId: null, reason: "replayed", now });
    return failure(401, "replayed", "This redemption request was already used.");
  }

  noteIntegrityMediaRedeemSignature(input.signature, now.getTime());

  const store = getExternalAuthorLinkStore();
  const claimed = await store.claimResult(input.resultCode, now.toISOString());

  if (claimed.status === "missing") {
    return failure(404, "result_not_found", "The confirmation result was not found.");
  }

  if (claimed.status === "consumed") {
    return failure(409, "result_already_used", "This confirmation result was already used.");
  }

  if (claimed.status === "expired") {
    await recordAudit(store, {
      action: "link_expired",
      memberId: null,
      externalAuthorId: null,
      attemptState: null,
      reason: "expired",
      now,
    });
    return failure(410, "result_expired", "This confirmation result has expired.");
  }

  const established = await establishLink(store, {
    externalAuthorId: input.externalAuthorId,
    memberId: claimed.record.memberId,
    now,
  });

  if (!established.ok) {
    await recordAudit(store, {
      action: "link_conflict",
      memberId: claimed.record.memberId,
      externalAuthorId: input.externalAuthorId,
      attemptState: claimed.record.attemptState,
      reason: established.conflict,
      now,
    });
    return failure(409, established.conflict, conflictMessage(established.conflict));
  }

  const stored = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.externalAuthorId);
  if (
    stored &&
    stored.memberId === claimed.record.memberId &&
    isProtocolLink(stored)
  ) {
    const linkRevision = assignedLinkRevision(stored.linkRevision);
    if (linkRevision === null || !stored.linkInstanceId) {
      return failure(
        503,
        "revision_unavailable",
        "Integrity Media connection generation is not available.",
      );
    }

    await recordAudit(store, {
      action: "result_redeemed",
      memberId: stored.memberId,
      externalAuthorId: stored.externalAuthorId,
      attemptState: claimed.record.attemptState,
      reason: established.reason,
      now,
    });

    return {
      ok: true,
      memberId: stored.memberId,
      source: INTEGRITY_MEDIA_SOURCE,
      externalAuthorId: stored.externalAuthorId,
      reconnected: established.reconnected,
      linkRevision,
      linkInstanceId: stored.linkInstanceId,
      ...(await findProvisionRedeemOutcome(
        claimed.record.attemptState,
        stored.linkFinalization,
      )),
    };
  }

  const activated = await ensureProvenBlogAuthor(store, {
    externalAuthorId: input.externalAuthorId,
    memberId: claimed.record.memberId,
  });

  if (!activated.ok && activated.linkChanged) {
    return linkChangedFailure();
  }

  if (!activated.ok) {
    await setAuthorActivationPending(store, {
      externalAuthorId: input.externalAuthorId,
      memberId: claimed.record.memberId,
      pending: true,
      now,
    });
    await recordAudit(store, {
      action: "author_capability_failed",
      memberId: claimed.record.memberId,
      externalAuthorId: input.externalAuthorId,
      attemptState: null,
      reason: "author_setup_pending",
      now,
    });
    await recordAudit(store, {
      action: "author_activation_pending",
      memberId: claimed.record.memberId,
      externalAuthorId: input.externalAuthorId,
      attemptState: null,
      reason: "author_setup_pending",
      now,
    });
    return failure(
      503,
      "author_setup_pending",
      "Integrity Media author setup is still finishing.",
    );
  }

  await setAuthorActivationPending(store, {
    externalAuthorId: input.externalAuthorId,
    memberId: claimed.record.memberId,
    pending: false,
    now,
  });

  await recordAudit(store, {
    action: "result_redeemed",
    memberId: claimed.record.memberId,
    externalAuthorId: input.externalAuthorId,
    attemptState: claimed.record.attemptState,
    reason: established.reason,
    now,
  });

  if (activated.capability.changed) {
    await recordAudit(store, {
      action: "author_capability_ensured",
      memberId: claimed.record.memberId,
      externalAuthorId: input.externalAuthorId,
      attemptState: null,
      reason: "author",
      now,
    });
  }

  const operational = await findOperationalAuthorLink(store, {
    externalAuthorId: input.externalAuthorId,
    memberId: claimed.record.memberId,
  });

  if (!operational) {
    return failure(
      503,
      "author_setup_pending",
      "Integrity Media author setup is still finishing.",
    );
  }

  const linkRevision = assignedLinkRevision(operational.linkRevision);
  if (linkRevision === null) {
    return failure(
      503,
      "revision_unavailable",
      "Integrity Media connection generation is not available.",
    );
  }

  return {
    ok: true,
    memberId: operational.memberId,
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: operational.externalAuthorId,
    reconnected: established.reconnected,
    linkRevision,
    ...(await findProvisionRedeemOutcome(
      claimed.record.attemptState,
      operational.linkFinalization,
    )),
  };
}

/**
 * Finish ordinary Blog author setup for a pair that was already proven.
 * Does not accept a browser member id, result code, or redemption signature.
 */
export async function recoverProvenIntegrityMediaAuthorLink(input: {
  externalAuthorId: string;
  now?: Date;
}): Promise<IntegrityMediaRedeemSuccess | IntegrityMediaLinkFailure> {
  if (!INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.externalAuthorId)) {
    return failure(400, "invalid_author", "The Integrity Media author id is not valid.");
  }

  const now = input.now ?? new Date();
  const store = getExternalAuthorLinkStore();
  const link = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.externalAuthorId);

  if (!link) {
    if (await integrityMediaAuthorDeletionBlocks(input.externalAuthorId)) {
      return failure(409, "author_deletion_pending", AUTHOR_DELETION_PENDING_MESSAGE);
    }
    return failure(404, "link_not_found", "No proven Integrity Media author link exists.");
  }

  if (await integrityMediaAuthorDeletionBlocks(input.externalAuthorId, link)) {
    return failure(409, "author_deletion_pending", AUTHOR_DELETION_PENDING_MESSAGE);
  }

  if (link.linkFinalization === "provisional") {
    return failure(409, "link_provisional", "This Integrity Media link is not confirmed.");
  }

  if (link.state === "disabled") {
    return failure(
      409,
      "link_disabled",
      "This Integrity Media author link is disconnected.",
    );
  }

  const wasPending = link.authorActivationPending === true;
  const activated = await ensureProvenBlogAuthor(store, link);

  if (!activated.ok && activated.linkChanged) {
    return linkChangedFailure();
  }

  if (!activated.ok) {
    await setAuthorActivationPending(store, {
      externalAuthorId: link.externalAuthorId,
      memberId: link.memberId,
      pending: true,
      now,
    });
    await recordAudit(store, {
      action: "author_capability_failed",
      memberId: link.memberId,
      externalAuthorId: link.externalAuthorId,
      attemptState: null,
      reason: "author_setup_pending",
      now,
    });
    if (!wasPending) {
      await recordAudit(store, {
        action: "author_activation_pending",
        memberId: link.memberId,
        externalAuthorId: link.externalAuthorId,
        attemptState: null,
        reason: "author_setup_pending",
        now,
      });
    }
    return failure(
      503,
      "author_setup_pending",
      "Integrity Media author setup is still finishing.",
    );
  }

  await setAuthorActivationPending(store, {
    externalAuthorId: link.externalAuthorId,
    memberId: link.memberId,
    pending: false,
    now,
  });

  if (activated.capability.changed) {
    await recordAudit(store, {
      action: "author_capability_ensured",
      memberId: link.memberId,
      externalAuthorId: link.externalAuthorId,
      attemptState: null,
      reason: "author",
      now,
    });
  }

  if (wasPending || activated.capability.changed) {
    await recordAudit(store, {
      action: "author_capability_recovered",
      memberId: link.memberId,
      externalAuthorId: link.externalAuthorId,
      attemptState: null,
      reason: "author",
      now,
    });
  }

  const operational = await findOperationalAuthorLink(store, {
    externalAuthorId: link.externalAuthorId,
    memberId: link.memberId,
  });

  if (!operational) {
    return failure(
      503,
      "author_setup_pending",
      "Integrity Media author setup is still finishing.",
    );
  }

  const linkRevision = assignedLinkRevision(operational.linkRevision);
  if (linkRevision === null) {
    return failure(
      503,
      "revision_unavailable",
      "Integrity Media connection generation is not available.",
    );
  }

  return {
    ok: true,
    memberId: operational.memberId,
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: operational.externalAuthorId,
    reconnected: false,
    linkRevision,
  };
}

export async function disableIntegrityMediaAuthorLink(
  externalAuthorId: string,
  now = new Date(),
): Promise<"disabled" | "missing" | "invalid"> {
  if (!INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(externalAuthorId)) {
    return "invalid";
  }

  const store = getExternalAuthorLinkStore();
  const existing = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, externalAuthorId);

  if (!existing) {
    return "missing";
  }

  const updated = await store.updateLink({
    ...existing,
    state: "disabled",
    disconnectedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  return updated === "updated" ? "disabled" : "missing";
}

async function establishLink(
  store: ExternalAuthorLinkStore,
  input: { externalAuthorId: string; memberId: string; now: Date },
): Promise<
  | { ok: true; reconnected: boolean; linkRevision: number; reason: "confirmed" | "already_linked" | "reconnected" }
  | { ok: false; conflict: ExternalAuthorLinkConflict }
> {
  const blocked = await rejectAuthorDeletion(store, input.externalAuthorId);
  if (blocked) {
    return blocked;
  }

  const decision = await classifyLink(store, input);

  if (!decision.ok) {
    return decision;
  }

  if (decision.existing) {
    const stillBlocked = await rejectAuthorDeletion(store, input.externalAuthorId);
    if (stillBlocked) {
      return stillBlocked;
    }

    if (decision.existing.state !== "disabled") {
      const linkRevision = revisionForDuplicateRedeem(decision.existing.linkRevision);
      if (
        !isProtocolLink(decision.existing) &&
        assignedLinkRevision(decision.existing.linkRevision) === null
      ) {
        const materialized = await store.updateLink({
          ...decision.existing,
          linkRevision,
          updatedAt: input.now.toISOString(),
        });
        if (materialized !== "updated") {
          return (
            (await rejectAuthorDeletion(store, input.externalAuthorId)) ?? {
              ok: false,
              conflict: "external_author_already_linked",
            }
          );
        }
      }

      return (
        (await rejectAuthorDeletion(store, input.externalAuthorId)) ?? {
          ok: true,
          reconnected: false,
          linkRevision,
          reason: "already_linked",
        }
      );
    }

    const linkRevision = revisionForReconnect(decision.existing.linkRevision);
    const protocolReconnect = isProtocolLink(decision.existing);
    const updated = await store.updateLink({
      ...decision.existing,
      state: "linked",
      disconnectedAt: null,
      confirmedAt: input.now.toISOString(),
      updatedAt: input.now.toISOString(),
      collaborationStatus: resolveIntegrityMediaCollaborationStatus(decision.existing),
      linkRevision,
      ...(protocolReconnect
        ? {
            linkFinalization: "provisional" as const,
            linkInstanceId: randomUUID(),
            authorActivationPending: false,
            authorActivationAttemptAt: null,
          }
        : {}),
    });

    if (updated !== "updated") {
      return (
        (await rejectAuthorDeletion(store, input.externalAuthorId)) ?? {
          ok: false,
          conflict: "external_author_already_linked",
        }
      );
    }

    return (
      (await rejectAuthorDeletion(store, input.externalAuthorId)) ?? {
        ok: true,
        reconnected: true,
        linkRevision,
        reason: "reconnected",
      }
    );
  }

  const linkRevision = revisionForNewLink();
  const record: ExternalAuthorLinkRecord = {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: input.externalAuthorId,
    memberId: input.memberId,
    state: "linked",
    createdAt: input.now.toISOString(),
    updatedAt: input.now.toISOString(),
    confirmedAt: input.now.toISOString(),
    disconnectedAt: null,
    collaborationStatus: "active",
    linkRevision,
    linkFinalization: "provisional",
    linkInstanceId: randomUUID(),
  };
  const inserted = await store.insertLink(record);

  if (inserted === "inserted") {
    return (
      (await rejectAuthorDeletion(store, input.externalAuthorId)) ?? {
        ok: true,
        reconnected: false,
        linkRevision,
        reason: "confirmed",
      }
    );
  }

  const racedBlocked = await rejectAuthorDeletion(store, input.externalAuthorId);
  if (racedBlocked) {
    return racedBlocked;
  }

  const raced = await classifyLink(store, input);

  if (!raced.ok) {
    return raced;
  }

  if (raced.existing && raced.existing.memberId === input.memberId) {
    const racedRevision = revisionForDuplicateRedeem(raced.existing.linkRevision);
    return (
      (await rejectAuthorDeletion(store, input.externalAuthorId)) ?? {
        ok: true,
        reconnected: false,
        linkRevision: racedRevision,
        reason: "already_linked",
      }
    );
  }

  return { ok: false, conflict: "external_author_already_linked" };
}

async function rejectAuthorDeletion(
  store: ExternalAuthorLinkStore,
  externalAuthorId: string,
): Promise<{ ok: false; conflict: "author_deletion_pending" } | null> {
  const current = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, externalAuthorId);
  if (await integrityMediaAuthorDeletionBlocks(externalAuthorId, current)) {
    return { ok: false, conflict: "author_deletion_pending" };
  }

  return null;
}

async function classifyLink(
  store: ExternalAuthorLinkStore,
  input: { externalAuthorId: string; memberId: string },
): Promise<
  | { ok: true; existing: ExternalAuthorLinkRecord | null }
  | { ok: false; conflict: ExternalAuthorLinkConflict }
> {
  const byAuthor = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.externalAuthorId);
  const byMember = await store.findLinkByMember(INTEGRITY_MEDIA_SOURCE, input.memberId);

  if (byAuthor && byAuthor.memberId !== input.memberId) {
    return { ok: false, conflict: "external_author_already_linked" };
  }

  if (byMember && byMember.externalAuthorId !== input.externalAuthorId) {
    return { ok: false, conflict: "member_already_linked" };
  }

  return { ok: true, existing: byAuthor ?? byMember };
}

async function resolveDisplayName(memberId: string, email: string): Promise<string> {
  if (displayNameResolverOverride) {
    return displayNameResolverOverride(memberId, email);
  }

  try {
    const member = await getMemberById(memberId);
    const name = member?.profile.displayName?.trim();

    if (name) {
      return name;
    }
  } catch {
    // The profile label is optional. The session member id remains the proof.
  }

  const local = email.split("@")[0]?.trim();
  return local && local.length > 0 ? local : "Member";
}

async function recordAudit(
  store: ExternalAuthorLinkStore,
  input: {
    action: ExternalAuthorLinkAuditAction;
    memberId: string | null;
    externalAuthorId: string | null;
    attemptState: string | null;
    reason: string | null;
    now: Date;
  },
): Promise<void> {
  await store.appendAudit({
    eventId: randomUUID(),
    action: input.action,
    source: INTEGRITY_MEDIA_SOURCE,
    memberId: input.memberId,
    externalAuthorId: input.externalAuthorId,
    attemptStateHash: input.attemptState ? hashAttemptState(input.attemptState) : null,
    reason: input.reason,
    createdAt: input.now.toISOString(),
  });
}

function hashAttemptState(attemptState: string): string {
  return createHash("sha256").update(attemptState).digest("hex");
}

function isProtocolLink(link: ExternalAuthorLinkRecord): boolean {
  return link.linkFinalization === "provisional" || link.linkFinalization === "confirmed";
}

export async function acknowledgeIntegrityMediaLink(input: {
  eventId: string;
  externalAuthorId: string;
  memberId: string;
  linkRevision: number;
  linkInstanceId: string;
  timestamp: string;
  signature: string;
  secret: string | null;
  now?: Date;
}): Promise<IntegrityMediaAcknowledgeSuccess | IntegrityMediaLinkFailure> {
  if (
    !INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.eventId) ||
    !INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.externalAuthorId) ||
    !INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.memberId) ||
    !INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.linkInstanceId) ||
    !Number.isInteger(input.linkRevision) ||
    input.linkRevision < 1 ||
    !/^\d{10}$/.test(input.timestamp)
  ) {
    return failure(400, "invalid_request", "The acknowledgement request is not valid.");
  }

  if (!input.secret) {
    return failure(503, "unavailable", "Integrity Media acknowledgement is not configured.");
  }

  const now = input.now ?? new Date();
  const expected = signIntegrityMediaLinkRedeem(
    input.secret,
    buildIntegrityMediaLinkAcknowledgePayload({
      timestamp: input.timestamp,
      eventId: input.eventId,
      externalAuthorId: input.externalAuthorId,
      memberId: input.memberId,
      linkRevision: input.linkRevision,
      linkInstanceId: input.linkInstanceId,
    }),
  );

  if (!integrityMediaLinkSignaturesEqual(expected, input.signature)) {
    return failure(401, "invalid_signature", "The acknowledgement signature is not valid.");
  }

  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    return failure(401, "stale_timestamp", "The acknowledgement timestamp is outside the allowed window.");
  }

  if (hasIntegrityMediaAcknowledgeSignature(input.signature, now.getTime())) {
    return failure(401, "replayed", "This acknowledgement request was already used.");
  }

  noteIntegrityMediaAcknowledgeSignature(input.signature, now.getTime());

  const store = getExternalAuthorLinkStore();
  if (await integrityMediaAuthorDeletionBlocks(input.externalAuthorId)) {
    return failure(409, "author_deletion_pending", AUTHOR_DELETION_PENDING_MESSAGE);
  }

  const confirmed = await store.compareAndConfirmLink({
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: input.externalAuthorId,
    memberId: input.memberId,
    linkRevision: input.linkRevision,
    linkInstanceId: input.linkInstanceId,
    nowIso: now.toISOString(),
  });

  if (confirmed.status === "missing") {
    return failure(404, "link_not_found", "No Integrity Media author link exists for this author.");
  }

  if (
    await integrityMediaAuthorDeletionBlocks(
      input.externalAuthorId,
      "record" in confirmed ? confirmed.record : null,
    )
  ) {
    return failure(409, "author_deletion_pending", AUTHOR_DELETION_PENDING_MESSAGE);
  }

  if (confirmed.status === "legacy") {
    return failure(
      409,
      "acknowledgement_unavailable",
      "This Integrity Media link has no acknowledgement state.",
    );
  }

  if (confirmed.status === "mismatch") {
    return failure(
      409,
      "acknowledgement_mismatch",
      "This acknowledgement does not match the Integrity Media link.",
    );
  }

  if (confirmed.status === "disabled") {
    return failure(409, "link_disabled", "This Integrity Media author link is disconnected.");
  }

  if (confirmed.status === "confirmed") {
    await recordAudit(store, {
      action: "link_acknowledged",
      memberId: confirmed.record.memberId,
      externalAuthorId: confirmed.record.externalAuthorId,
      attemptState: null,
      reason: "confirmed",
      now,
    });
  }

  const granted = await grantBlogAuthorForConfirmedLink(store, confirmed.record, now);
  if (!granted.ok) {
    return granted;
  }

  return {
    ok: true,
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: confirmed.record.externalAuthorId,
    memberId: confirmed.record.memberId,
    linkRevision: input.linkRevision,
    linkInstanceId: input.linkInstanceId,
    finalization: "confirmed",
    idempotent: confirmed.status === "already_confirmed",
  };
}

async function grantBlogAuthorForConfirmedLink(
  store: ExternalAuthorLinkStore,
  link: ExternalAuthorLinkRecord,
  now: Date,
): Promise<{ ok: true } | IntegrityMediaLinkFailure> {
  const activated = await ensureProvenBlogAuthor(store, link);

  if (!activated.ok && activated.linkChanged) {
    return failure(
      409,
      "acknowledgement_mismatch",
      "This acknowledgement does not match the Integrity Media link.",
    );
  }

  if (!activated.ok) {
    await setAuthorActivationPending(store, {
      externalAuthorId: link.externalAuthorId,
      memberId: link.memberId,
      pending: true,
      now,
    });
    await recordAudit(store, {
      action: "author_capability_failed",
      memberId: link.memberId,
      externalAuthorId: link.externalAuthorId,
      attemptState: null,
      reason: "author_setup_pending",
      now,
    });
    if (link.authorActivationPending !== true) {
      await recordAudit(store, {
        action: "author_activation_pending",
        memberId: link.memberId,
        externalAuthorId: link.externalAuthorId,
        attemptState: null,
        reason: "author_setup_pending",
        now,
      });
    }
    return failure(
      503,
      "author_setup_pending",
      "Integrity Media author setup is still finishing.",
    );
  }

  await setAuthorActivationPending(store, {
    externalAuthorId: link.externalAuthorId,
    memberId: link.memberId,
    pending: false,
    now,
  });

  if (activated.capability.changed) {
    await recordAudit(store, {
      action: "author_capability_ensured",
      memberId: link.memberId,
      externalAuthorId: link.externalAuthorId,
      attemptState: null,
      reason: "author",
      now,
    });
  }

  return { ok: true };
}

function classifyConfirmationState(attemptState: string, now: Date) {
  return classifyIntegrityMediaConfirmationState({
    state: attemptState,
    secret: resolveIntegrityMediaLinkConfig().hmacSecret,
    now,
  });
}

function isSessionMemberId(memberId: string): boolean {
  return memberId.trim().length > 0 && !/\s/.test(memberId);
}

function conflictMessage(conflict: ExternalAuthorLinkConflict): string {
  if (conflict === "author_deletion_pending") {
    return AUTHOR_DELETION_PENDING_MESSAGE;
  }

  if (conflict === "external_author_already_linked") {
    return "This Integrity Media author is already linked to another Humanity Union account.";
  }

  return "This Humanity Union account is already linked to another Integrity Media author.";
}

/** The member no longer holds this link: nothing was granted and no pending state is written. */
function linkChangedFailure(): IntegrityMediaLinkFailure {
  return failure(409, "link_changed", "The Integrity Media link changed during author setup.");
}

function failure(status: number, code: string, message: string): IntegrityMediaLinkFailure {
  return { ok: false, status, code, message };
}

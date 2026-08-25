import type {
  Petition,
  PetitionPolicy,
  PetitionSubject,
  ParticipationMode,
  Signature,
} from "@hu/types";

import { validateDirectInitiativeAncestry } from "../../shared/initiative-ancestry/index.js";
import { runMongoTransaction } from "../../infrastructure/mongodb/mongo-transaction.js";
import { enqueueDomainEvent } from "../../infrastructure/outbox/outbox.repository.js";
import { getDecision } from "../collective-decision/collective-decision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { PetitionConcurrencyConflictError, PetitionTransactionError } from "./petition.errors.js";
import { createPetitionSignedEvent } from "./petition-signed.event.js";
import {
  assertMutablePetition,
  assertPreparatoryPetition,
  assertValidTransition,
  buildPetitionOutcome,
  buildShareLink,
  calculateSupportMetrics,
  createEmptySupportMetrics,
  isParticipantEligibleForPetition,
  mergePetitionPolicy,
  mergePetitionSubject,
} from "./petition.helpers.js";
import {
  countPetitionsByCollectiveDecisionId,
  deletePetitionsByIdForTests,
  deletePetitionsByInitiativeIdForTests,
  findPetitionByCollectiveDecisionId,
  findPetitionById,
  findPetitionByInitiativeId,
  insertPetitionDocument,
  listPetitionDocuments,
  updatePetitionConditionally,
} from "./persistence/petition.repository.js";
import type { PetitionMongoRecord } from "./persistence/petition.mongo-document.js";
import {
  deleteSignaturesByMemberIdForTests,
  deleteSignaturesByPetitionIdForTests,
  findSignatureByPetitionAndMember,
  insertPetitionSignatureDocument,
  isDuplicateSignatureError,
  listSignaturesByPetitionId,
  listSignaturesByPetitionIds,
  updateSignatureStatus,
} from "./persistence/petition-signature.repository.js";
import { toSignatureResponse } from "./persistence/petition-signature.mongo-document.js";
import type { PetitionSignatureMongoRecord } from "./persistence/petition-signature.mongo-document.js";

export interface PetitionUpdate {
  subject?: Partial<PetitionSubject>;
  policy?: Partial<PetitionPolicy>;
}

// Re-exported so tests can construct database-duplicate scenarios without
// reaching into the persistence layer directly.
export { deletePetitionsByIdForTests, deletePetitionsByInitiativeIdForTests };
export { deleteSignaturesByPetitionIdForTests, deleteSignaturesByMemberIdForTests };

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Reconstructs the pre-migration `Petition` response shape at read time by
 * combining the authoritative Petition document with its Signatures, loaded
 * separately (Recovery Task 24 Part 10). `supportMetrics` and `outcome` are
 * derived, never persisted, exactly as before the migration.
 */
function assemblePetitionResponse(
  record: PetitionMongoRecord,
  signatureRecords: PetitionSignatureMongoRecord[],
): Petition {
  const signatures: Signature[] = signatureRecords.map((signature) =>
    toSignatureResponse(signature),
  );

  const petition: Petition = {
    petitionId: record.petitionId,
    collectiveDecisionId: record.collectiveDecisionId,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    subject: structuredClone(record.subject),
    policy: structuredClone(record.policy),
    shareLink: record.shareLink ? structuredClone(record.shareLink) : null,
    signatures,
    supportMetrics: createEmptySupportMetrics(),
    outcome: null,
    traceability: record.traceability ? structuredClone(record.traceability) : null,
  };

  petition.supportMetrics = calculateSupportMetrics(petition);
  petition.outcome = buildPetitionOutcome(petition);

  return petition;
}

function assertApprovedCollectiveDecision(collectiveDecisionId: string): void {
  const decision = getDecision(collectiveDecisionId);

  if (!decision) {
    throw new Error(`Collective Decision "${collectiveDecisionId}" was not found.`);
  }

  if (decision.outcome?.outcomeType !== "Approved") {
    throw new Error("Petition may only be created from an approved Collective Decision.");
  }
}

async function assertUniqueCollectiveDecisionPath(
  collectiveDecisionId: string,
  petitionId?: string,
): Promise<void> {
  const duplicateCount = await countPetitionsByCollectiveDecisionId(
    collectiveDecisionId,
    petitionId,
  );

  if (duplicateCount > 0) {
    throw new Error(`Petition already exists for Collective Decision "${collectiveDecisionId}".`);
  }
}

export async function listPetitions(): Promise<Petition[]> {
  const records = await listPetitionDocuments();
  const signaturesByPetition = await listSignaturesByPetitionIds(
    records.map((record) => record.petitionId),
  );

  return records.map((record) =>
    assemblePetitionResponse(record, signaturesByPetition.get(record.petitionId) ?? []),
  );
}

export async function getPetition(petitionId: string): Promise<Petition | null> {
  const record = await findPetitionById(petitionId);

  if (!record) {
    return null;
  }

  const signatures = await listSignaturesByPetitionId(petitionId);

  return assemblePetitionResponse(record, signatures);
}

export async function getPetitionByCollectiveDecisionId(
  collectiveDecisionId: string,
): Promise<Petition | null> {
  const record = await findPetitionByCollectiveDecisionId(collectiveDecisionId);

  if (!record) {
    return null;
  }

  const signatures = await listSignaturesByPetitionId(record.petitionId);

  return assemblePetitionResponse(record, signatures);
}

export async function getPetitionByInitiativeId(initiativeId: string): Promise<Petition | null> {
  const record = await findPetitionByInitiativeId(initiativeId);

  if (!record) {
    return null;
  }

  const signatures = await listSignaturesByPetitionId(record.petitionId);

  return assemblePetitionResponse(record, signatures);
}

export async function participantHasSigned(
  petitionId: string,
  participantId: string,
): Promise<boolean> {
  const signature = await findSignatureByPetitionAndMember(petitionId, participantId);

  return signature !== null && signature.status === "Active";
}

export async function createPetition(petition: Petition): Promise<Petition> {
  const existing = await findPetitionById(petition.petitionId);

  if (existing) {
    throw new Error(`Petition "${petition.petitionId}" already exists.`);
  }

  if (petition.status !== "Draft") {
    throw new Error("New Petitions must begin in Draft state.");
  }

  assertApprovedCollectiveDecision(petition.collectiveDecisionId);

  // Direct Initiative ancestry validation — Recovery Task 24 Part 6. One
  // Initiative lookup; the resolved, validated `initiativeId` (not the raw
  // request value) becomes the immutable persisted ancestry.
  const ancestry = await validateDirectInitiativeAncestry(
    { initiativeId: petition.subject.initiativeId },
    { initiativeExists: (id) => getInitiativeById(id) !== null },
  );

  await assertUniqueCollectiveDecisionPath(petition.collectiveDecisionId);

  const now = nowIso();
  const record: PetitionMongoRecord = {
    petitionId: petition.petitionId,
    collectiveDecisionId: petition.collectiveDecisionId,
    status: "Draft",
    createdAt: now,
    updatedAt: now,
    subject: { ...structuredClone(petition.subject), initiativeId: ancestry.initiativeId },
    policy: structuredClone(petition.policy),
    shareLink: null,
    traceability: petition.traceability ? structuredClone(petition.traceability) : null,
  };

  await insertPetitionDocument(record);

  return assemblePetitionResponse(record, []);
}

export async function updatePetition(
  petitionId: string,
  update: PetitionUpdate,
): Promise<Petition | null> {
  const record = await findPetitionById(petitionId);

  if (!record) {
    return null;
  }

  assertMutablePetition(record.status);
  assertPreparatoryPetition(record.status);

  const mergedSubject =
    update.subject !== undefined ? mergePetitionSubject(record.subject, update.subject) : record.subject;

  // Initiative identity is immutable after creation regardless of what the
  // patch body requests — Recovery Task 24 Part 8.
  const nextSubject: PetitionSubject = {
    ...mergedSubject,
    initiativeId: record.subject.initiativeId,
  };

  const nextPolicy =
    update.policy !== undefined ? mergePetitionPolicy(record.policy, update.policy) : record.policy;

  const updated = await updatePetitionConditionally(petitionId, record.status, {
    subject: nextSubject,
    policy: nextPolicy,
    updatedAt: nowIso(),
  });

  if (!updated) {
    throw new PetitionConcurrencyConflictError();
  }

  const signatures = await listSignaturesByPetitionId(petitionId);

  return assemblePetitionResponse(updated, signatures);
}

/**
 * Initiative Lifecycle — Part F, Section 9 (Traceability). Only callable
 * while the Petition is still `Draft`/`Ready` (before Publish freezes its
 * public subject/policy) — mirrors `updatePetition`'s own mutability gate,
 * since traceability is set exactly once, by the Petition Lifecycle
 * service, immediately after `createPetition`.
 */
export async function setPetitionTraceability(
  petitionId: string,
  traceability: Petition["traceability"],
): Promise<Petition | null> {
  const record = await findPetitionById(petitionId);

  if (!record) {
    return null;
  }

  assertMutablePetition(record.status);
  assertPreparatoryPetition(record.status);

  const updated = await updatePetitionConditionally(petitionId, record.status, {
    traceability: traceability ?? null,
    updatedAt: nowIso(),
  });

  if (!updated) {
    throw new PetitionConcurrencyConflictError();
  }

  const signatures = await listSignaturesByPetitionId(petitionId);

  return assemblePetitionResponse(updated, signatures);
}

export async function preparePetition(petitionId: string): Promise<Petition | null> {
  const record = await findPetitionById(petitionId);

  if (!record) {
    return null;
  }

  assertMutablePetition(record.status);

  if (!record.subject.title.trim() || !record.subject.summary.trim()) {
    throw new Error("PetitionSubject must be complete before preparation.");
  }

  assertValidTransition(record.status, "Ready");

  const updated = await updatePetitionConditionally(petitionId, record.status, {
    status: "Ready",
    updatedAt: nowIso(),
  });

  if (!updated) {
    throw new PetitionConcurrencyConflictError();
  }

  const signatures = await listSignaturesByPetitionId(petitionId);

  return assemblePetitionResponse(updated, signatures);
}

export async function publishPetition(petitionId: string): Promise<Petition | null> {
  const record = await findPetitionById(petitionId);

  if (!record) {
    return null;
  }

  assertMutablePetition(record.status);
  assertValidTransition(record.status, "Published");

  const publishedAt = nowIso();

  const updated = await updatePetitionConditionally(petitionId, record.status, {
    status: "Published",
    shareLink: buildShareLink(record.subject.initiativeId, publishedAt),
    updatedAt: publishedAt,
  });

  if (!updated) {
    throw new PetitionConcurrencyConflictError();
  }

  const signatures = await listSignaturesByPetitionId(petitionId);

  return assemblePetitionResponse(updated, signatures);
}

export async function openPetition(petitionId: string, opensAt?: string): Promise<Petition | null> {
  const record = await findPetitionById(petitionId);

  if (!record) {
    return null;
  }

  assertMutablePetition(record.status);
  assertValidTransition(record.status, "Open");

  const effectiveOpensAt = opensAt ?? nowIso();
  const nextPolicy: PetitionPolicy = {
    ...record.policy,
    endorsementPeriod: {
      ...record.policy.endorsementPeriod,
      opensAt: effectiveOpensAt,
    },
  };

  const updated = await updatePetitionConditionally(petitionId, record.status, {
    status: "Open",
    policy: nextPolicy,
    updatedAt: nowIso(),
  });

  if (!updated) {
    throw new PetitionConcurrencyConflictError();
  }

  const signatures = await listSignaturesByPetitionId(petitionId);

  return assemblePetitionResponse(updated, signatures);
}

/**
 * Transactional signing (Recovery Task 24 Part 12; Recovery Task 25 Part 8
 * adds the atomic durable `PetitionSigned` outbox event to the same
 * transaction).
 *
 * Exactly one Petition lookup occurs (the read below): the resolved,
 * persisted, previously-validated `subject.initiativeId` is trusted as-is,
 * so signing performs zero Initiative lookups. Petition status is read once
 * (snapshot-time semantics); this preserves the pre-migration behavior for
 * the Open→Closed race (out of scope for this task — see final report) while
 * closing the actually-proven defect: concurrent duplicate signatures for
 * the same Petition/Member pair. The `unique(petitionId, memberId)` index is
 * the final duplicate authority; the pre-check below only produces a
 * friendlier failure for the common sequential case.
 *
 * The `PetitionSigned` event is constructed once, before the transaction is
 * entered, from the same validated signing context that produces the
 * Signature record (Recovery Task 25 Part 10) — so a `runMongoTransaction`
 * retry of the callback reuses the identical, already-deterministic event
 * ID rather than minting a new one per attempt. Signature insertion and
 * event enqueue share one Mongo `ClientSession`; either both commit or
 * neither does (Recovery Task 25 Part 9).
 */
export async function signPetition(
  petitionId: string,
  participantId: string,
  participationMode?: ParticipationMode,
): Promise<Petition | null> {
  const record = await findPetitionById(petitionId);

  if (!record) {
    return null;
  }

  assertMutablePetition(record.status);

  if (record.status !== "Open") {
    throw new Error("Petition is not open for signing.");
  }

  const existingSignature = await findSignatureByPetitionAndMember(petitionId, participantId);

  if (existingSignature?.status === "Active") {
    throw new Error(`Participant "${participantId}" already signed this Petition.`);
  }

  if (!(await isParticipantEligibleForPetition(participantId, record.policy))) {
    throw new Error(`Participant "${participantId}" is not eligible to sign this Petition.`);
  }

  // Initiative Lifecycle — Part F, Section 8 (Withdraw Signature). A
  // previously `Withdrawn` Signature is reactivated in place — never
  // re-inserted — so `unique(petitionId, memberId)` is never violated by a
  // re-sign after withdrawal.
  if (existingSignature) {
    const signedAt = nowIso();
    const reactivated = await updateSignatureStatus(petitionId, participantId, "Active", signedAt);

    if (!reactivated) {
      throw new Error(`Participant "${participantId}" already signed this Petition.`);
    }

    const signatures = await listSignaturesByPetitionId(petitionId);

    return assemblePetitionResponse(record, signatures);
  }

  const signatureRecord: PetitionSignatureMongoRecord = {
    signatureId: `signature-${petitionId}-${participantId}`,
    petitionId,
    initiativeId: record.subject.initiativeId,
    memberId: participantId,
    participationMode,
    signedAt: nowIso(),
    visibility: "operational",
    status: "Active",
  };

  // Recovery Task 25 Part 6/7: reuses the Signature's own just-assigned,
  // persisted-Petition-derived `initiativeId` — no additional Initiative
  // lookup, no ancestry re-validation, no request-supplied value.
  //
  // Recovery Task 26 Part 4: the event's actor field is `participantId`,
  // corrected from Task 25's provisional `memberId` — the platform is
  // participant-first (every Signature's acting identity is a Participant;
  // Member is a separate, independent, earned status). The value itself is
  // unchanged: `participantId` here is the same signing-function parameter
  // already used to build the Signature record above.
  const signedEvent = createPetitionSignedEvent({
    petitionId,
    signatureId: signatureRecord.signatureId,
    participantId,
    initiativeId: signatureRecord.initiativeId,
    participationMode,
    signedAt: signatureRecord.signedAt,
  });

  try {
    await runMongoTransaction(async (session) => {
      await insertPetitionSignatureDocument(signatureRecord, { session });
      await enqueueDomainEvent(signedEvent, { session });
      return signatureRecord.signatureId;
    });
  } catch (error) {
    if (isDuplicateSignatureError(error)) {
      throw new Error(`Participant "${participantId}" already signed this Petition.`);
    }

    throw new PetitionTransactionError("Petition signing transaction failed.", error);
  }

  const signatures = await listSignaturesByPetitionId(petitionId);

  return assemblePetitionResponse(record, signatures);
}

/**
 * Initiative Lifecycle — Part F, Section 8 (Petition Reactions —
 * "Withdraw Signature"). Never deletes the Signature document — flips its
 * `status` to `"Withdrawn"` in place, preserving the permanent record
 * `assertSignaturesImmutable` protects, while removing it from every
 * "Active signatures" count (`SupportMetrics`, the public Participant/
 * Member counters).
 */
export async function withdrawPetitionSignature(
  petitionId: string,
  participantId: string,
): Promise<Petition | null> {
  const record = await findPetitionById(petitionId);

  if (!record) {
    return null;
  }

  if (!record.policy.withdrawalPolicy.withdrawalPermitted) {
    throw new Error("This Petition does not permit signature withdrawal.");
  }

  const existingSignature = await findSignatureByPetitionAndMember(petitionId, participantId);

  if (!existingSignature || existingSignature.status !== "Active") {
    throw new Error(`Participant "${participantId}" has not signed this Petition.`);
  }

  const withdrawn = await updateSignatureStatus(
    petitionId,
    participantId,
    "Withdrawn",
    existingSignature.signedAt,
  );

  if (!withdrawn) {
    throw new Error(`Participant "${participantId}" has not signed this Petition.`);
  }

  const signatures = await listSignaturesByPetitionId(petitionId);

  return assemblePetitionResponse(record, signatures);
}

export async function closePetition(
  petitionId: string,
  closesAt?: string,
): Promise<Petition | null> {
  const record = await findPetitionById(petitionId);

  if (!record) {
    return null;
  }

  assertMutablePetition(record.status);
  assertValidTransition(record.status, "Closed");

  const effectiveClosesAt = closesAt ?? nowIso();
  const nextPolicy: PetitionPolicy = {
    ...record.policy,
    endorsementPeriod: {
      ...record.policy.endorsementPeriod,
      closesAt: effectiveClosesAt,
    },
  };

  const updated = await updatePetitionConditionally(petitionId, record.status, {
    status: "Closed",
    policy: nextPolicy,
    updatedAt: nowIso(),
  });

  if (!updated) {
    throw new PetitionConcurrencyConflictError();
  }

  const signatures = await listSignaturesByPetitionId(petitionId);

  return assemblePetitionResponse(updated, signatures);
}

export async function archivePetition(petitionId: string): Promise<Petition | null> {
  const record = await findPetitionById(petitionId);

  if (!record) {
    return null;
  }

  assertValidTransition(record.status, "Archived");

  const updated = await updatePetitionConditionally(petitionId, record.status, {
    status: "Archived",
    updatedAt: nowIso(),
  });

  if (!updated) {
    throw new PetitionConcurrencyConflictError();
  }

  const signatures = await listSignaturesByPetitionId(petitionId);

  return assemblePetitionResponse(updated, signatures);
}

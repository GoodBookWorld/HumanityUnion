export class PetitionPersistenceError extends Error {
  readonly code = "PETITION_PERSISTENCE_ERROR";

  constructor(message = "Petition persistence failed.", cause?: unknown) {
    super(message, { cause });
    this.name = "PetitionPersistenceError";
  }
}

export class PetitionSignaturePersistenceError extends Error {
  readonly code = "PETITION_SIGNATURE_PERSISTENCE_ERROR";

  constructor(message = "Petition Signature persistence failed.", cause?: unknown) {
    super(message, { cause });
    this.name = "PetitionSignaturePersistenceError";
  }
}

export class PetitionTransactionError extends Error {
  readonly code = "PETITION_TRANSACTION_ERROR";

  constructor(message = "Petition signing transaction failed.", cause?: unknown) {
    super(message, { cause });
    this.name = "PetitionTransactionError";
  }
}

/**
 * Raised when a conditional (status-guarded) lifecycle update does not match
 * any document because the Petition was concurrently mutated between the
 * initial read and the write. This is the mechanism that prevents stale
 * concurrent lifecycle writes required by Recovery Task 24 Part 11.
 */
export class PetitionConcurrencyConflictError extends Error {
  readonly code = "PETITION_CONCURRENCY_CONFLICT";

  constructor(message = "Petition was concurrently modified. Please retry.") {
    super(message);
    this.name = "PetitionConcurrencyConflictError";
  }
}

/**
 * HU-LC-05C.4A.3 — a Petition becomes public only in a transaction in which it
 * holds a published slot of its own Initiative (the three-slot limit).
 */
export class PetitionSlotRequiredError extends Error {
  readonly code = "PETITION_SLOT_REQUIRED";

  constructor(
    message = "Petition publication requires a reserved Petition slot; publish through the Petition slot contract.",
  ) {
    super(message);
    this.name = "PetitionSlotRequiredError";
  }
}

export type PetitionSignatureRejectionReason =
  | "not_yet_open"
  | "no_longer_open"
  | "already_signed"
  | "not_eligible"
  | "not_signed"
  | "withdrawal_not_permitted";

const PETITION_SIGNATURE_REJECTION_MESSAGES: Record<PetitionSignatureRejectionReason, string> = {
  not_yet_open: "This Petition is not open for signing yet.",
  no_longer_open: "This Petition is no longer open for signatures.",
  already_signed: "You have already signed this Petition.",
  not_eligible: "You are not eligible to sign this Petition.",
  not_signed: "You have not signed this Petition.",
  withdrawal_not_permitted: "This Petition does not permit signature withdrawal.",
};

/**
 * HU-LC-05C.4C.6C — an expected signing/withdrawal refusal. The message is
 * shown to the signer as-is, so it must never carry identifiers.
 */
export class PetitionSignatureRejectedError extends Error {
  readonly code = "PETITION_SIGNATURE_REJECTED";

  constructor(readonly reason: PetitionSignatureRejectionReason) {
    super(PETITION_SIGNATURE_REJECTION_MESSAGES[reason]);
    this.name = "PetitionSignatureRejectedError";
  }
}

/** The authenticated Participant may not perform this Petition action. */
export class PetitionAccessDeniedError extends Error {
  readonly code = "PETITION_ACCESS_DENIED";

  constructor(message = "You do not have access to manage this Petition.") {
    super(message);
    this.name = "PetitionAccessDeniedError";
  }
}

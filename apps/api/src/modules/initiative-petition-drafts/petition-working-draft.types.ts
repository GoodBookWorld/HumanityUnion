/**
 * HU-LC-05C.3 — one of possibly many independent Petition drafts of a Standard
 * Initiative. Stored in its own collection keyed by draftId; the legacy
 * one-draft-per-Initiative store (`initiative_petition_drafts`) is separate.
 */
export interface PetitionWorkingDraft {
  readonly draftId: string;
  readonly initiativeId: string;
  /** Participant (the Initiative steward) who created the draft. */
  readonly authorId: string;
  readonly title: string;
  readonly publicSummary: string;
  readonly requestStatement: string;
  readonly expectedOutcome: string;
  readonly supportingContext: string;
  readonly keyArguments: readonly string[];
  /** Intended recipients of the Petition (free text); empty when not set. */
  readonly recipients: readonly string[];
  /** Published Petition of the same Initiative this draft was derived from. */
  readonly derivedFromPetitionId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PetitionWorkingDraftContentUpdate = Partial<
  Pick<
    PetitionWorkingDraft,
    | "title"
    | "publicSummary"
    | "requestStatement"
    | "expectedOutcome"
    | "supportingContext"
    | "keyArguments"
    | "recipients"
  >
>;

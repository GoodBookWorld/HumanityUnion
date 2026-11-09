import { validateSaveInitiativePetitionDraftInput } from "../initiative-petition-lifecycle/initiative-petition-lifecycle.validators.js";
import type { PetitionWorkingDraftContentUpdate } from "./petition-working-draft.types.js";

export const PETITION_DRAFT_MAX_RECIPIENTS = 50;
export const PETITION_DRAFT_MAX_RECIPIENT_LENGTH = 200;

function validateRecipients(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("recipients must be an array of strings.");
  }

  const recipients = (value as string[]).map((entry) => entry.trim()).filter(Boolean);

  if (recipients.length > PETITION_DRAFT_MAX_RECIPIENTS) {
    throw new Error(`recipients may contain at most ${PETITION_DRAFT_MAX_RECIPIENTS} entries.`);
  }

  if (recipients.some((entry) => entry.length > PETITION_DRAFT_MAX_RECIPIENT_LENGTH)) {
    throw new Error(
      `Each recipient must be at most ${PETITION_DRAFT_MAX_RECIPIENT_LENGTH} characters.`,
    );
  }

  return recipients;
}

/** Content update: the existing Petition draft fields plus recipients. */
export function validatePetitionWorkingDraftUpdate(
  body: unknown,
): PetitionWorkingDraftContentUpdate {
  const content = validateSaveInitiativePetitionDraftInput(body);
  const recipients = validateRecipients((body as Record<string, unknown>).recipients);
  const update: Record<string, unknown> = { ...content, recipients };

  return Object.fromEntries(
    Object.entries(update).filter(([, value]) => value !== undefined),
  ) as PetitionWorkingDraftContentUpdate;
}

/** Create body: optional `derivedFromPetitionId`. */
export function validatePetitionWorkingDraftCreate(body: unknown): {
  derivedFromPetitionId: string | null;
} {
  const value = (body as { derivedFromPetitionId?: unknown } | null | undefined)
    ?.derivedFromPetitionId;

  if (value === undefined || value === null) {
    return { derivedFromPetitionId: null };
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new Error("derivedFromPetitionId must be a non-empty string when provided.");
  }

  return { derivedFromPetitionId: value.trim() };
}

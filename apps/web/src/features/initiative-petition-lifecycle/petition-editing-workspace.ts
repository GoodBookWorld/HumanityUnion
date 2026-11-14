import {
  presentLifecycleStageTokensAsEnglish,
  preserveLifecycleStageTokensWhenPresentationUnchanged,
  type PublicPetitionRecord,
} from "@hu/types";

import { ApiRequestError } from "../../lib/api-client";
import type { PetitionWorkingDraft, SavePetitionWorkingDraftInput } from "./api";

/** HU-LC-05C.4A — published Petitions and working drafts share three slots per Initiative. */
export const PETITION_SLOT_LIMIT = 3;

export interface PetitionSlotSummary {
  readonly limit: number;
  readonly occupied: number;
  readonly available: number;
}

/**
 * Mirrors the server's slot accounting (publicly visible Petitions plus working
 * drafts). The server stays authoritative: creation beyond the limit is a 409.
 */
export function computePetitionSlotSummary(input: {
  readonly draftCount: number;
  readonly publishedCount: number;
}): PetitionSlotSummary {
  const occupied = Math.min(PETITION_SLOT_LIMIT, input.draftCount + input.publishedCount);
  return { limit: PETITION_SLOT_LIMIT, occupied, available: PETITION_SLOT_LIMIT - occupied };
}

export type PetitionSlotSegment = "published" | "draft" | "available";

/**
 * HU-LC-05C.4C.7C.3C — display-only: the three slots in order, published
 * Petitions first, then drafts, then free slots.
 */
export function buildPetitionSlotSegments(input: {
  readonly draftCount: number;
  readonly publishedCount: number;
}): PetitionSlotSegment[] {
  const published = Math.min(PETITION_SLOT_LIMIT, input.publishedCount);
  const drafts = Math.min(PETITION_SLOT_LIMIT - published, input.draftCount);
  return [
    ...Array<PetitionSlotSegment>(published).fill("published"),
    ...Array<PetitionSlotSegment>(drafts).fill("draft"),
    ...Array<PetitionSlotSegment>(PETITION_SLOT_LIMIT - published - drafts).fill("available"),
  ];
}

/** This Initiative's published Petitions, oldest first. */
export function selectInitiativePublishedPetitions(
  records: readonly PublicPetitionRecord[],
  initiativeId: string,
): PublicPetitionRecord[] {
  return records
    .filter((record) => record.subject.initiativeId === initiativeId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.petitionId.localeCompare(b.petitionId));
}

export type PetitionDraftErrorKind =
  | "signIn"
  | "forbidden"
  | "notFound"
  | "slotLimit"
  | "sourceUnavailable"
  | "staleRevision"
  | "overwriteRequired"
  | "generateConflict"
  | "beingPublished"
  | "invalid"
  | "unavailable"
  | "unknown";

export type PetitionDraftOperation =
  | "load"
  | "create"
  | "createDerived"
  | "save"
  | "generate"
  | "publish"
  | "delete";

/**
 * Maps an API failure to a translatable kind from the HTTP status and what
 * was being done. The working-draft API sends no error codes, so server
 * wording is never matched or shown.
 */
export function classifyPetitionDraftError(
  error: unknown,
  context: {
    readonly operation: PetitionDraftOperation;
    /** `overwrite` sent with a generate request. */
    readonly overwrite?: boolean;
    /** Free slots after reloading, for a failed derived creation. */
    readonly slotsAvailable?: number;
  },
): PetitionDraftErrorKind {
  if (!(error instanceof ApiRequestError)) {
    return "unknown";
  }

  switch (error.status) {
    case 0:
      return "unavailable";
    case 400:
      return "invalid";
    case 401:
      return "signIn";
    case 403:
      return "forbidden";
    case 404:
      return "notFound";
    case 409:
      switch (context.operation) {
        case "create":
          return "slotLimit";
        case "createDerived":
          return context.slotsAvailable === 0 ? "slotLimit" : "sourceUnavailable";
        case "save":
        case "delete":
          return "beingPublished";
        case "generate":
          return context.overwrite ? "generateConflict" : "overwriteRequired";
        case "publish":
          return "staleRevision";
        default:
          return "unknown";
      }
    default:
      return "unknown";
  }
}

/** Kinds after which the steward should see fresh drafts and slots. */
export function petitionDraftErrorRequiresReload(kind: PetitionDraftErrorKind): boolean {
  return (
    kind === "notFound" ||
    kind === "slotLimit" ||
    kind === "sourceUnavailable" ||
    kind === "beingPublished" ||
    kind === "generateConflict" ||
    kind === "staleRevision"
  );
}

/** Same rule as the API: generating into a draft with content needs `overwrite: true`. */
export function workingDraftHasContent(draft: PetitionWorkingDraft): boolean {
  return (
    [
      draft.title,
      draft.publicSummary,
      draft.requestStatement,
      draft.expectedOutcome,
      draft.supportingContext,
    ].some((value) => value.trim().length > 0) || draft.keyArguments.length > 0
  );
}

export interface PetitionEditorFieldValues {
  readonly title: string;
  readonly publicSummary: string;
  readonly requestStatement: string;
  readonly expectedOutcome: string;
  readonly supportingContext: string;
  readonly keyArguments: readonly string[];
  readonly recipients: readonly string[];
}

/** Lifecycle tokens become English Registry labels for editing only. */
export function presentWorkingDraftForEditor(draft: PetitionWorkingDraft): PetitionEditorFieldValues {
  return {
    title: presentLifecycleStageTokensAsEnglish(draft.title),
    publicSummary: presentLifecycleStageTokensAsEnglish(draft.publicSummary),
    requestStatement: presentLifecycleStageTokensAsEnglish(draft.requestStatement),
    expectedOutcome: presentLifecycleStageTokensAsEnglish(draft.expectedOutcome),
    supportingContext: presentLifecycleStageTokensAsEnglish(draft.supportingContext),
    keyArguments: draft.keyArguments.map(presentLifecycleStageTokensAsEnglish),
    recipients: [...draft.recipients],
  };
}

function preserveTokens(canonicalField: string, presentedEdit: string): string {
  return preserveLifecycleStageTokensWhenPresentationUnchanged({ canonicalField, presentedEdit });
}

/**
 * The save body: each field keeps the stored lifecycle tokens wherever the
 * steward left the presented label in place; empty lines are dropped.
 */
export function buildWorkingDraftSaveInput(input: {
  readonly canonical: PetitionWorkingDraft;
  readonly presented: PetitionEditorFieldValues;
}): SavePetitionWorkingDraftInput {
  const { canonical, presented } = input;
  const keyArguments = presented.keyArguments
    .map((argument, index) =>
      preserveTokens(canonical.keyArguments[index] ?? "", argument),
    )
    .filter((argument) => argument.trim().length > 0);

  return {
    title: preserveTokens(canonical.title, presented.title),
    publicSummary: preserveTokens(canonical.publicSummary, presented.publicSummary),
    requestStatement: preserveTokens(canonical.requestStatement, presented.requestStatement),
    expectedOutcome: preserveTokens(canonical.expectedOutcome, presented.expectedOutcome),
    supportingContext: preserveTokens(canonical.supportingContext, presented.supportingContext),
    keyArguments,
    recipients: presented.recipients.map((recipient) => recipient.trim()).filter(Boolean),
  };
}

export type PetitionPublishRequirement =
  | "title"
  | "publicSummary"
  | "requestStatement"
  | "expectedOutcome"
  | "revisionReference";

/** The API's publication requirements, checked before asking for confirmation. */
export function unresolvedPetitionPublishRequirements(input: {
  readonly fields: Pick<
    PetitionEditorFieldValues,
    "title" | "publicSummary" | "requestStatement" | "expectedOutcome"
  >;
  readonly revisionId: string | null;
  readonly revisionVersion: number | null;
}): PetitionPublishRequirement[] {
  const missing: PetitionPublishRequirement[] = [];
  if (!input.fields.title.trim()) missing.push("title");
  if (!input.fields.publicSummary.trim()) missing.push("publicSummary");
  if (!input.fields.requestStatement.trim()) missing.push("requestStatement");
  if (!input.fields.expectedOutcome.trim()) missing.push("expectedOutcome");
  if (!input.revisionId || input.revisionVersion === null) missing.push("revisionReference");
  return missing;
}

export type PetitionDocumentView = "status" | "editing";

export const PETITION_VIEW_QUERY_PARAM = "view";

export function readPetitionDocumentView(value: string | string[] | undefined | null): PetitionDocumentView {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "editing" ? "editing" : "status";
}

/** `/petitions/<id>` — a published Petition's own Petition Status view and document. */
export function buildPetitionStatusHref(petitionId: string): string {
  return `/petitions/${encodeURIComponent(petitionId)}`;
}

/**
 * HU-LC-05C.4C.7C.3D — a plain click on the Petition already open on this page
 * switches to its Petition Status view in place; any other click (new tab,
 * new window, another Petition) follows the link.
 */
export function shouldShowPetitionStatusInPlace(
  event: {
    readonly button: number;
    readonly metaKey: boolean;
    readonly ctrlKey: boolean;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
  },
  isCurrentPetition: boolean,
): boolean {
  return (
    isCurrentPetition &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/** `/petitions/<id>?view=editing` — the steward's Editing Petition workspace. */
export function buildPetitionEditingHref(petitionId: string): string {
  return `/petitions/${encodeURIComponent(petitionId)}?${PETITION_VIEW_QUERY_PARAM}=editing`;
}

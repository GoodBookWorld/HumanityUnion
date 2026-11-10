import type {
  PetitionState,
  PetitionTraceability,
  PublicPetitionIdentity,
  PublicPetitionSubject,
} from "@hu/types";

/**
 * HU-LC-05C.4C.3B — public Petition document presentation rules.
 * Reader-facing ordering, labels and references only; stored Petition
 * content and traceability are never altered.
 */

/** `initiativeExperience.author.petition.public.document.*` label key per body field. */
export const PETITION_DOCUMENT_FIELD_LABEL_KEYS = {
  summary: "summary",
  requestStatement: "request",
  expectedOutcome: "expectedOutcome",
  supportingContext: "supportingInformation",
  keyArguments: "keyArguments",
} as const;

export function buildPetitionDocumentFallbackFields(
  identity: Pick<PublicPetitionIdentity, "title">,
  subject: PublicPetitionSubject,
): Record<string, string> {
  return {
    title: identity.title,
    summary: subject.summary ?? "",
    requestStatement: subject.requestStatement ?? "",
    expectedOutcome: subject.expectedOutcome ?? "",
    supportingContext: subject.supportingContext ?? "",
    keyArguments: (subject.keyArguments ?? []).join("\n"),
  };
}

export function petitionDocumentRecipients(subject: PublicPetitionSubject): string[] {
  return (subject.recipients ?? [])
    .filter((recipient): recipient is string => typeof recipient === "string")
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

/** Status shown in the document header; `Published` is already conveyed by the publication date. */
export function petitionDocumentStatusKey(
  status: PetitionState,
): "statusOpen" | "statusClosed" | "statusArchived" | null {
  switch (status) {
    case "Open":
      return "statusOpen";
    case "Closed":
      return "statusClosed";
    case "Archived":
      return "statusArchived";
    default:
      return null;
  }
}

export type PetitionDocumentRevisionReference =
  | { readonly key: "basedOnRevisionVersion"; readonly version: number }
  | { readonly key: "basedOnRevision" };

/** Reader-facing source reference; internal record ids are never exposed. */
export function petitionDocumentRevisionReference(
  traceability: PetitionTraceability | null,
): PetitionDocumentRevisionReference | null {
  if (!traceability) {
    return null;
  }

  const version = traceability.revisionVersion;
  return Number.isInteger(version) && version >= 1
    ? { key: "basedOnRevisionVersion", version }
    : { key: "basedOnRevision" };
}

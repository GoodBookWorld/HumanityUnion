import type { PublicPetitionListItem } from "@hu/types";

/**
 * HU-LC-05C.4C.3C — which Petition the central Lifecycle viewer shows.
 *
 * `?petition=<petitionId>` is only a request. It is honoured once the
 * Initiative's own public list (server-scoped to that Initiative) confirms
 * the id; anything else falls back to the stage's default Petition, so a
 * foreign, closed or made-up id can never surface another record.
 */

export const PETITION_QUERY_PARAM = "petition";

const PETITION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

export type InitiativePetitionListState =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly initiativeId: string;
      readonly petitions: readonly PublicPetitionListItem[];
    }
  | { readonly status: "failed" };

export type PetitionViewerSelection =
  | { readonly kind: "default" }
  | { readonly kind: "pending" }
  | { readonly kind: "selected"; readonly petitionId: string };

export function readRequestedPetitionId(search: string): string | null {
  const value = new URLSearchParams(search).get(PETITION_QUERY_PARAM)?.trim() ?? "";
  return PETITION_ID_PATTERN.test(value) ? value : null;
}

/** `?petition=` is present but can never be a Petition id (blank, too long, unsafe characters). */
export function hasMalformedPetitionQuery(search: string): boolean {
  return new URLSearchParams(search).has(PETITION_QUERY_PARAM) && !readRequestedPetitionId(search);
}

/**
 * HU-LC-05C.4C.4 — true only when this Initiative's list loaded successfully
 * and does not contain the requested id. Loading or a failed fetch is never
 * definitive, so a valid selection survives temporary network errors.
 */
export function isDefinitivelyInvalidPetitionRequest(input: {
  readonly initiativeId: string;
  readonly requestedPetitionId: string | null;
  readonly list: InitiativePetitionListState;
}): boolean {
  const list = petitionListForInitiative(input.list, input.initiativeId);
  return (
    input.requestedPetitionId !== null &&
    list.status === "ready" &&
    !list.petitions.some((petition) => petition.petitionId === input.requestedPetitionId)
  );
}

/** Same location without `?petition=`; every other query value and the hash are kept. */
export function removePetitionQueryParam(currentHref: string): string {
  return buildPetitionSelectionHref(currentHref, null, new URL(currentHref).hash);
}

/**
 * A failed refresh keeps the last list loaded for this Initiative, so the
 * current selection and counts stay usable; only a first load can fail.
 */
export function petitionListAfterFetchFailure(
  current: InitiativePetitionListState,
  initiativeId: string,
): InitiativePetitionListState {
  return current.status === "ready" && current.initiativeId === initiativeId
    ? current
    : { status: "failed" };
}

/** A list loaded for another Initiative counts as not loaded yet. */
export function petitionListForInitiative(
  list: InitiativePetitionListState,
  initiativeId: string,
): InitiativePetitionListState {
  return list.status === "ready" && list.initiativeId !== initiativeId
    ? { status: "loading" }
    : list;
}

export function resolvePetitionViewerSelection(input: {
  readonly initiativeId: string;
  readonly requestedPetitionId: string | null;
  readonly list: InitiativePetitionListState;
}): PetitionViewerSelection {
  if (!input.requestedPetitionId) {
    return { kind: "default" };
  }

  const list = petitionListForInitiative(input.list, input.initiativeId);

  if (list.status === "loading") {
    return { kind: "pending" };
  }

  if (
    list.status === "ready" &&
    list.petitions.some((petition) => petition.petitionId === input.requestedPetitionId)
  ) {
    return { kind: "selected", petitionId: input.requestedPetitionId };
  }

  return { kind: "default" };
}

export type CentralPetitionView =
  | { readonly kind: "none" }
  | { readonly kind: "pending" }
  | { readonly kind: "petition"; readonly petitionId: string };

/**
 * The central viewer only ever shows a Petition when the stage itself has a
 * published result; a validated selection then replaces the stage default.
 */
export function resolveCentralPetitionView(input: {
  readonly publishedRecordId: string | null;
  readonly selection: PetitionViewerSelection;
}): CentralPetitionView {
  if (!input.publishedRecordId) {
    return { kind: "none" };
  }

  if (input.selection.kind === "pending") {
    return { kind: "pending" };
  }

  return {
    kind: "petition",
    petitionId:
      input.selection.kind === "selected" ? input.selection.petitionId : input.publishedRecordId,
  };
}

/**
 * HU-LC-05C.4C.7C.3A — a Petition chosen from a Petition list is brought into
 * view on its own document, once that document has loaded; never in Public
 * Preview and never for any other Petition.
 */
export function shouldScrollToPetitionDocument(input: {
  readonly scrollRequestPetitionId: string | null | undefined;
  readonly petitionId: string;
  readonly isPreview: boolean;
}): boolean {
  return !input.isPreview && input.scrollRequestPetitionId === input.petitionId;
}

export type PetitionDocumentScrollStep = "none" | "wait" | "scroll" | "fallback";

/**
 * When a requested document may scroll: only once it has rendered (data loaded
 * and the element mounted); a failed load falls back to the stage instead.
 */
export function planPetitionDocumentScroll(input: {
  readonly requested: boolean;
  readonly loaded: boolean;
  readonly loadFailed: boolean;
  readonly mounted: boolean;
}): PetitionDocumentScrollStep {
  if (!input.requested) {
    return "none";
  }
  if (input.loadFailed) {
    return "fallback";
  }
  return input.loaded && input.mounted ? "scroll" : "wait";
}

export type StewardPetitionStageView =
  | { readonly kind: "editor" }
  | { readonly kind: "pending" }
  | { readonly kind: "petition"; readonly petitionId: string };

/**
 * HU-LC-05C.4C.7B — the steward's Petition stage outside Public Preview.
 * Without a validated selection it stays the Author Workspace; a selection
 * confirmed by this Initiative's public list opens that published Petition
 * in its normal public (signing) mode.
 */
export function resolveStewardPetitionStageView(
  selection: PetitionViewerSelection,
): StewardPetitionStageView {
  switch (selection.kind) {
    case "selected":
      return { kind: "petition", petitionId: selection.petitionId };
    case "pending":
      return { kind: "pending" };
    default:
      return { kind: "editor" };
  }
}

/** Same location with `?petition=` set (or removed) and the given stage hash; other params kept. */
export function buildPetitionSelectionHref(
  currentHref: string,
  petitionId: string | null,
  stageHash: string,
): string {
  const url = new URL(currentHref);
  if (petitionId) {
    url.searchParams.set(PETITION_QUERY_PARAM, petitionId);
  } else {
    url.searchParams.delete(PETITION_QUERY_PARAM);
  }
  url.hash = stageHash;
  return `${url.pathname}${url.search}${url.hash}`;
}

const RELATIVE_URL_BASE = "https://relative.invalid";

/**
 * `href` (relative or absolute) with `?petition=<petitionId>`, so it opens this
 * Petition rather than the Initiative's default one. Other query values, the
 * origin and the hash (default `#petition`) are kept.
 */
export function withPetitionQuery(href: string, petitionId: string): string {
  const url = new URL(href, RELATIVE_URL_BASE);
  const selected = buildPetitionSelectionHref(url.href, petitionId, url.hash || "#petition");
  return url.origin === RELATIVE_URL_BASE ? selected : `${url.origin}${selected}`;
}

/** The public Initiative page opened on this Petition. */
export function publicPetitionHref(initiativeId: string, petitionId: string): string {
  return withPetitionQuery(`/initiatives/public/${encodeURIComponent(initiativeId)}#petition`, petitionId);
}

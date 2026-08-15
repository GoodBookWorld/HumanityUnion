import {
  isCivicArtifactType,
  type CivicArtifactType,
  type DirectInitiativeAncestry,
  type InitiativeId,
  type TransitiveInitiativeAncestry,
} from "@hu/types";

import {
  InitiativeAncestryMissingError,
  InitiativeAncestryResolutionInconsistentError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
  ParentArtifactMissingInitiativeAncestryError,
  ParentArtifactNotFoundError,
  UnsupportedParentArtifactTypeError,
} from "./initiative-ancestry.errors.js";

/**
 * Dependency capable of checking whether an Initiative exists.
 *
 * Callers inject a module-specific implementation (e.g. backed by the
 * `initiatives` module's store, a Mongo collection, or a test fake). This
 * validator never accesses persistence directly.
 */
export interface InitiativeExistenceChecker {
  initiativeExists(initiativeId: InitiativeId): boolean | Promise<boolean>;
}

/**
 * Outcome of looking up a parent civic artifact's own Initiative ancestry.
 *
 * `found: false` means the parent artifact itself does not exist.
 * `found: true` with `initiativeId: null` means the parent artifact exists
 * but currently has no resolvable Initiative ancestry of its own.
 */
export type ParentArtifactLookupResult =
  | { readonly found: false }
  | { readonly found: true; readonly initiativeId: string | null };

/**
 * Dependency capable of resolving a parent civic artifact's `initiativeId`.
 *
 * Callers inject a module-specific implementation (e.g. one resolver per
 * supported {@link CivicArtifactType}, or a dispatching resolver).
 */
export interface ParentArtifactInitiativeResolver {
  resolveParentInitiativeId(
    parentArtifactType: CivicArtifactType,
    parentArtifactId: string,
  ): ParentArtifactLookupResult | Promise<ParentArtifactLookupResult>;
}

export interface ValidateDirectInitiativeAncestryInput {
  readonly initiativeId: unknown;
}

export interface ValidateTransitiveInitiativeAncestryInput {
  readonly parentArtifactType: unknown;
  readonly parentArtifactId: unknown;
}

/**
 * The repository's accepted identifier format for `initiativeId` (and, by
 * extension, other opaque civic-artifact identifiers): a non-empty string
 * with no leading/trailing whitespace.
 *
 * The codebase does not enforce a stricter format (e.g. UUID) for
 * `initiativeId` anywhere today — see `initiative.store.ts` and every
 * `initiative-*` module's validators, which all treat `initiativeId` as an
 * opaque, non-empty string. This helper codifies that existing convention
 * rather than introducing a new, stricter format.
 */
function isValidIdentifierFormat(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

/**
 * Validates a caller-supplied candidate `initiativeId` and confirms, via the
 * injected {@link InitiativeExistenceChecker}, that the referenced
 * Initiative exists.
 *
 * @throws {InitiativeAncestryMissingError} when no `initiativeId` is supplied.
 * @throws {InitiativeIdMalformedError} when `initiativeId` is not a
 *   well-formed identifier.
 * @throws {InitiativeNotFoundError} when the referenced Initiative does not exist.
 */
export async function validateDirectInitiativeAncestry(
  input: ValidateDirectInitiativeAncestryInput,
  deps: InitiativeExistenceChecker,
): Promise<DirectInitiativeAncestry> {
  const { initiativeId } = input;

  if (initiativeId === undefined || initiativeId === null || initiativeId === "") {
    throw new InitiativeAncestryMissingError();
  }

  if (!isValidIdentifierFormat(initiativeId)) {
    throw new InitiativeIdMalformedError();
  }

  const exists = await deps.initiativeExists(initiativeId);

  if (!exists) {
    throw new InitiativeNotFoundError();
  }

  return { kind: "direct", initiativeId };
}

/**
 * Validates a caller-supplied candidate transitive ancestry claim: resolves
 * the named parent civic artifact's own Initiative ancestry via the injected
 * {@link ParentArtifactInitiativeResolver}, then confirms the resolved
 * Initiative exists via the injected {@link InitiativeExistenceChecker}.
 *
 * @throws {InitiativeAncestryMissingError} when the parent artifact type or
 *   id is not supplied.
 * @throws {UnsupportedParentArtifactTypeError} when `parentArtifactType` is
 *   not one of the canonical civic artifact types.
 * @throws {ParentArtifactNotFoundError} when the parent artifact does not exist.
 * @throws {ParentArtifactMissingInitiativeAncestryError} when the parent
 *   artifact exists but has no Initiative ancestry of its own.
 * @throws {InitiativeIdMalformedError} when the resolved `initiativeId` is
 *   not well-formed.
 * @throws {InitiativeNotFoundError} when the resolved Initiative does not exist.
 * @throws {InitiativeAncestryResolutionInconsistentError} when the injected
 *   resolver returns a result that does not conform to
 *   {@link ParentArtifactLookupResult}.
 */
export async function validateTransitiveInitiativeAncestry(
  input: ValidateTransitiveInitiativeAncestryInput,
  deps: InitiativeExistenceChecker & ParentArtifactInitiativeResolver,
): Promise<TransitiveInitiativeAncestry> {
  const { parentArtifactType, parentArtifactId } = input;

  if (
    parentArtifactType === undefined ||
    parentArtifactType === null ||
    parentArtifactType === "" ||
    parentArtifactId === undefined ||
    parentArtifactId === null ||
    parentArtifactId === ""
  ) {
    throw new InitiativeAncestryMissingError();
  }

  if (!isCivicArtifactType(parentArtifactType)) {
    throw new UnsupportedParentArtifactTypeError();
  }

  if (!isValidIdentifierFormat(parentArtifactId)) {
    throw new ParentArtifactNotFoundError();
  }

  const lookup = await deps.resolveParentInitiativeId(parentArtifactType, parentArtifactId);

  if (typeof lookup !== "object" || lookup === null || typeof lookup.found !== "boolean") {
    throw new InitiativeAncestryResolutionInconsistentError();
  }

  if (!lookup.found) {
    throw new ParentArtifactNotFoundError();
  }

  if (!lookup.initiativeId) {
    throw new ParentArtifactMissingInitiativeAncestryError();
  }

  if (!isValidIdentifierFormat(lookup.initiativeId)) {
    throw new InitiativeIdMalformedError();
  }

  const resolvedInitiativeId = lookup.initiativeId;
  const exists = await deps.initiativeExists(resolvedInitiativeId);

  if (!exists) {
    throw new InitiativeNotFoundError();
  }

  return {
    kind: "transitive",
    parentArtifactType,
    parentArtifactId,
    initiativeId: resolvedInitiativeId,
  };
}

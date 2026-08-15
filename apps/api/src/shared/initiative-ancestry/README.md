# Initiative Ancestry Foundation

Governing authority: [`architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md`](../../../../../architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md)

**Initiative is the sole canonical civic root of the Humanity Union platform.**
Every civic artifact — Discussion, Contribution, Evidence, Proposal, Petition,
Collective Decision, Implementation Commitment, Implementation, Impact — must
carry a direct or transitively provable Initiative ancestry. No such artifact
may exist as, or become, an independent civic root.

This module provides the shared, module-agnostic building blocks for
enforcing that invariant. It does not itself change the behavior of any
existing module — it is a foundation for future tasks to adopt incrementally
(ADR §16, Migration Principle 6: "one bounded architectural change per task").

## Two forms of ancestry

- **Direct ancestry** — the artifact stores its own `initiativeId` (e.g. a
  Discussion record created directly under an Initiative).
- **Transitive ancestry** — the artifact derives its `initiativeId` through
  exactly one parent civic artifact (e.g. a Proposal that references a
  published Collaborative Analysis, which itself references the Initiative).

Both forms are modeled as a discriminated union, `InitiativeAncestry`, in
`@hu/types` (`packages/types/src/domain/initiative-ancestry.ts`). That package
contains only pure data contracts — no persistence, HTTP, or Express/MongoDB
dependencies — so it can be safely imported from any layer, including the
frontend, in the future.

## Activity is not a root

Activity is intentionally **not** included in the `CivicArtifactType` union.
Per the ADR, Activity is a bounded, subordinate record of a Member action
performed *within* the lifecycle of an Initiative — it is not itself a civic
root and it cannot anchor Initiative ancestry for Discussion, Proposal,
Petition, Decision, Implementation, or Impact records.

## Validation is dependency-injected

`validateDirectInitiativeAncestry` and `validateTransitiveInitiativeAncestry`
(in `initiative-ancestry.validator.ts`) never touch a database, an HTTP
request, or a specific module's store directly. Callers inject:

- an `InitiativeExistenceChecker` — answers "does this Initiative exist?";
- a `ParentArtifactInitiativeResolver` (transitive ancestry only) — answers
  "what Initiative does this parent artifact belong to?".

This keeps the validator reusable across every current and future
Initiative-lifecycle module (file-based, in-memory, or MongoDB-backed) without
introducing a dependency from this shared module onto any specific module, and
without introducing circular module dependencies.

## Errors

Failures are typed `Error` subclasses (see `initiative-ancestry.errors.ts`),
following the repository's existing per-module `*.errors.ts` convention
(compare `apps/api/src/modules/activity/domain/activity.errors.ts` and
`apps/api/src/modules/workspace/workspace.errors.ts`). Error messages are
generic and do not leak persistence details.

## Adoption

This foundation is intentionally **not** wired into any existing module yet.
Future recovery tasks (Recovery Roadmap Phase 2 onward) will adopt it
incrementally, module by module, per Migration Principle 11 ("add tests to
the Initiative path before removing parallel tested paths").

As of Recovery Task 11, every `CivicArtifactType` member's canonical module
is pinned directly in code — see the per-member comments on
`CIVIC_ARTIFACT_TYPES` and `CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE` in
`packages/types/src/domain/initiative-ancestry.ts`. In particular,
`"decision"` means `initiative-collective-decision` only, and MUST NOT be
resolved against the legacy Activity-scoped `decision` module. No production
module has adopted `validateTransitiveInitiativeAncestry` yet; Task 11 makes
the vocabulary safe for that first adoption without performing it.

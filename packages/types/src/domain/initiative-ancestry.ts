import type { InitiativeId } from "./initiative.js";

/**
 * Initiative Ancestry — shared domain contract.
 *
 * Governing authority: architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md
 *
 * INITIATIVE IS THE SOLE CANONICAL CIVIC ROOT of the Humanity Union platform.
 * Every civic artifact (Discussion, Contribution, Evidence, Proposal, Petition,
 * Collective Decision, Implementation Commitment, Implementation, Impact) MUST
 * carry either a direct or a transitively resolvable reference to exactly one
 * Initiative. No such artifact may exist as, or become, an independent civic
 * root.
 *
 * Activity is intentionally NOT included in {@link CIVIC_ARTIFACT_TYPES}.
 * Activity is a bounded, subordinate record of a Member action performed
 * within the lifecycle of an Initiative (ADR §8, §12) — it is not a civic
 * root and it is not a parent capable of anchoring Initiative ancestry for
 * the artifact types below.
 *
 * This module defines pure data contracts only. It contains no persistence,
 * HTTP, or module-specific business logic. See
 * apps/api/src/shared/initiative-ancestry for the reusable validator that
 * enforces these contracts against injected, module-agnostic dependencies.
 */

/** Discriminator for the two supported forms of Initiative ancestry. */
export const INITIATIVE_ANCESTRY_KINDS = ["direct", "transitive"] as const;

export type InitiativeAncestryKind = (typeof INITIATIVE_ANCESTRY_KINDS)[number];

/**
 * Civic artifact types that may participate in Initiative ancestry as a
 * child of an Initiative. This set is intentionally bounded to the
 * artifacts named in the canonical lifecycle (ADR §9). Initiative itself is
 * never a member of this set — it is the root, not a child artifact.
 *
 * Recovery Task 11 pins the canonical meaning of every member directly in
 * code (see the per-member comments below and
 * {@link CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE}), so no member's meaning
 * depends on ADR prose alone. None of these members refer to the legacy
 * Activity pipeline (`apps/api/src/modules/{discussion,proposal,decision}`),
 * which ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0 §14 marks
 * Superseded/Retiring — see `"decision"` below for the specific,
 * previously-ambiguous case this task resolves.
 */
export const CIVIC_ARTIFACT_TYPES = [
  /** Collaboration/Discussion stage. Canonical module: `initiative-collaborative-analysis`. */
  "discussion",
  /**
   * Individual input within Collaboration (ADR §9 "Contributions and
   * Evidence"). Embedded within Collaborative Analysis today, not an
   * independently addressable aggregate — reserved for future transitive
   * resolution, not currently resolvable via
   * {@link ParentArtifactInitiativeResolver}.
   */
  "contribution",
  /** Same status as `"contribution"` above — embedded within Collaborative Analysis, reserved. */
  "evidence",
  /** Proposal stage. Canonical module: `initiative-improvement-proposal`. */
  "proposal",
  /** Petition stage. Canonical module: `petition`. */
  "petition",
  /**
   * Collective Decision stage. Canonical module:
   * `initiative-collective-decision` ONLY.
   *
   * MUST NOT be interpreted as the legacy Activity-scoped `decision` module
   * (`apps/api/src/modules/decision`), which
   * ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0 §14 marks Superseded
   * ("Superseded by `initiative-collective-decision`"). As of Recovery
   * Task 11, this is a pinned, test-enforced reserved contract: no
   * production module yet resolves `"decision"` through
   * {@link ParentArtifactInitiativeResolver} — see
   * `apps/api/src/shared/initiative-ancestry/README.md` for adoption status.
   */
  "decision",
  /** Implementation Commitment stage. Canonical module: `initiative-implementation-commitment`. */
  "implementation_commitment",
  /** Implementation tracking stage. Canonical module: `initiative-implementation-tracking`. */
  "implementation",
  /** Impact stage. Canonical module: `initiative-public-impact`. */
  "impact",
] as const;

export type CivicArtifactType = (typeof CIVIC_ARTIFACT_TYPES)[number];

export function isCivicArtifactType(value: unknown): value is CivicArtifactType {
  return (
    typeof value === "string" && (CIVIC_ARTIFACT_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Canonical `apps/api/src/modules/*` owner for each {@link CivicArtifactType}
 * member (Recovery Task 11). This is documentation-as-data, not a resolver:
 * it answers "what module does this artifact type mean?" without performing
 * any lookup, persistence access, or ancestry resolution itself. Consumers
 * implementing a real {@link ParentArtifactInitiativeResolver} for a given
 * type should resolve against the module named here.
 *
 * Every value here is a **canonical** `initiative-*` (or `petition`) module,
 * per ADR §9/§14. None of them are the legacy Activity-pipeline modules
 * (`activity`, `discussion`, `proposal`, `decision`, `collaborative-analysis`,
 * `collective-decision`, `implementation-commitment`, `implementation` under
 * their older, non-`initiative-` paths).
 */
export const CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE: Readonly<Record<CivicArtifactType, string>> = {
  discussion: "initiative-collaborative-analysis",
  contribution: "initiative-collaborative-analysis",
  evidence: "initiative-collaborative-analysis",
  proposal: "initiative-improvement-proposal",
  petition: "petition",
  decision: "initiative-collective-decision",
  implementation_commitment: "initiative-implementation-commitment",
  implementation: "initiative-implementation-tracking",
  impact: "initiative-public-impact",
};

/**
 * A civic artifact stores its own {@link InitiativeId} directly.
 *
 * This is validated ancestry — the output of a successful ancestry
 * validation, not a raw, unvalidated caller input.
 */
export interface DirectInitiativeAncestry {
  readonly kind: "direct";
  readonly initiativeId: InitiativeId;
}

/**
 * A civic artifact derives its Initiative ancestry through exactly one
 * parent civic artifact. `initiativeId` is only present once ancestry has
 * been successfully resolved and validated — it is the resolved Initiative,
 * not a caller-supplied value.
 */
export interface TransitiveInitiativeAncestry {
  readonly kind: "transitive";
  readonly parentArtifactType: CivicArtifactType;
  readonly parentArtifactId: string;
  readonly initiativeId: InitiativeId;
}

/**
 * Validated Initiative ancestry for a civic artifact: either a direct
 * reference to its own Initiative, or a transitive reference resolved
 * through exactly one parent civic artifact.
 */
export type InitiativeAncestry = DirectInitiativeAncestry | TransitiveInitiativeAncestry;

/**
 * A caller-supplied, not-yet-validated claim of direct Initiative ancestry.
 * `initiativeId` here is `string`, not the branded {@link InitiativeId},
 * because it has not yet been validated to reference an existing Initiative.
 */
export interface DirectInitiativeAncestryCandidate {
  readonly kind: "direct";
  readonly initiativeId: string;
}

/**
 * A caller-supplied, not-yet-validated claim of transitive Initiative
 * ancestry through a named parent civic artifact.
 */
export interface TransitiveInitiativeAncestryCandidate {
  readonly kind: "transitive";
  readonly parentArtifactType: CivicArtifactType;
  readonly parentArtifactId: string;
}

/** A caller-supplied, not-yet-validated Initiative ancestry claim. */
export type InitiativeAncestryCandidate =
  | DirectInitiativeAncestryCandidate
  | TransitiveInitiativeAncestryCandidate;

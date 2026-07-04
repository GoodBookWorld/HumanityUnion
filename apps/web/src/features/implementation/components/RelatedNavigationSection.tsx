import Link from "next/link";

import type { Implementation } from "@hu/types";

interface RelatedNavigationSectionProps {
  implementation: Implementation;
}

export function RelatedNavigationSection({ implementation }: RelatedNavigationSectionProps) {
  return (
    <nav className="related-navigation" aria-label="Related participation context">
      <Link className="related-navigation__link" href="/initiatives">
        Initiative Workspace
      </Link>
      <Link
        className="related-navigation__link"
        href={`/collective-decisions/${encodeURIComponent(implementation.collectiveDecisionId)}`}
      >
        Collective Decision Workspace
      </Link>
      <Link
        className="related-navigation__link"
        href={`/petitions/${encodeURIComponent(implementation.petitionId)}`}
      >
        Petition Workspace
      </Link>
      <Link
        className="related-navigation__link"
        href={`/implementation-commitments/${encodeURIComponent(implementation.implementationCommitmentId)}`}
      >
        Implementation Commitment Workspace
      </Link>
      <Link
        className="related-navigation__link"
        href={`/implementations/public/${encodeURIComponent(implementation.implementationId)}`}
      >
        Public Implementation
      </Link>
      <Link
        className="related-navigation__link"
        href={`/implementation-commitments/public/${encodeURIComponent(implementation.implementationCommitmentId)}`}
      >
        Public Implementation Commitment
      </Link>
      <Link
        className="related-navigation__link"
        href={`/initiatives/public/${encodeURIComponent(implementation.initiativeId)}`}
      >
        Public Initiative
      </Link>
      <Link
        className="related-navigation__link"
        href={`/collective-decisions/public/${encodeURIComponent(implementation.collectiveDecisionId)}`}
      >
        Public Collective Decision
      </Link>
      <Link
        className="related-navigation__link"
        href={`/petitions/public/${encodeURIComponent(implementation.petitionId)}`}
      >
        Public Petition
      </Link>
      <span className="related-navigation__link">Future Impact (not yet active)</span>
    </nav>
  );
}

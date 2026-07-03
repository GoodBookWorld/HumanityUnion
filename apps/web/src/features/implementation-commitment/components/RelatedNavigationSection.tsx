import Link from "next/link";

import type { ImplementationCommitment } from "@hu/types";

interface RelatedNavigationSectionProps {
  commitment: ImplementationCommitment;
}

export function RelatedNavigationSection({ commitment }: RelatedNavigationSectionProps) {
  return (
    <nav className="related-navigation" aria-label="Related participation context">
      <Link className="related-navigation__link" href="/initiatives">
        Initiative Workspace
      </Link>
      <Link
        className="related-navigation__link"
        href={`/collective-decisions/${encodeURIComponent(commitment.collectiveDecisionId)}`}
      >
        Collective Decision Workspace
      </Link>
      <Link
        className="related-navigation__link"
        href={`/petitions/${encodeURIComponent(commitment.petitionId)}`}
      >
        Petition Workspace
      </Link>
      <Link
        className="related-navigation__link"
        href={`/implementation-commitments/public/${encodeURIComponent(commitment.implementationCommitmentId)}`}
      >
        Public Implementation Commitment
      </Link>
      <Link
        className="related-navigation__link"
        href={`/initiatives/public/${encodeURIComponent(commitment.initiativeId)}`}
      >
        Public Initiative
      </Link>
      <Link
        className="related-navigation__link"
        href={`/collective-decisions/public/${encodeURIComponent(commitment.collectiveDecisionId)}`}
      >
        Public Collective Decision
      </Link>
      <Link
        className="related-navigation__link"
        href={`/petitions/public/${encodeURIComponent(commitment.petitionId)}`}
      >
        Public Petition
      </Link>
      <span className="related-navigation__link">Future Implementation (not yet active)</span>
    </nav>
  );
}

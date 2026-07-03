import Link from "next/link";

import type { Petition } from "@hu/types";

interface RelatedLinksProps {
  petition: Petition;
}

export function RelatedLinks({ petition }: RelatedLinksProps) {
  const initiativeId = petition.subject.initiativeId;
  const decisionId = petition.collectiveDecisionId;
  const petitionId = petition.petitionId;

  return (
    <nav className="related-links" aria-label="Related participation context">
      <Link className="related-links__link" href="/initiatives">
        Initiative Workspace
      </Link>
      <Link
        className="related-links__link"
        href={`/collective-decisions/${encodeURIComponent(decisionId)}`}
      >
        Collective Decision Workspace
      </Link>
      <Link
        className="related-links__link"
        href={`/petitions/public/${encodeURIComponent(petitionId)}`}
      >
        Public Petition
      </Link>
      <Link
        className="related-links__link"
        href={`/initiatives/public/${encodeURIComponent(initiativeId)}`}
      >
        Public Initiative
      </Link>
      <Link
        className="related-links__link"
        href={`/collective-decisions/public/${encodeURIComponent(decisionId)}`}
      >
        Public Collective Decision
      </Link>
    </nav>
  );
}

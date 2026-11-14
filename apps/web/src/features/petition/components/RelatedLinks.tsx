import Link from "next/link";
import { useTranslations } from "next-intl";

import type { PublicPetitionRecord } from "@hu/types";

import { ViewImplementationCommitmentLink } from "../../implementation-commitment/components/ViewImplementationCommitmentLink";
import { ViewImplementationLink } from "../../implementation/components/ViewImplementationLink";
import { publicPetitionHref } from "../../initiative-petition-lifecycle/petition-viewer-selection";

const LINKS = "author.petition.public.status.links";

interface RelatedLinksProps {
  petition: PublicPetitionRecord;
}

export function RelatedLinks({ petition }: RelatedLinksProps) {
  const t = useTranslations("initiativeExperience");
  const initiativeId = petition.subject.initiativeId;
  const decisionId = petition.collectiveDecisionId;
  const petitionId = petition.petitionId;

  return (
    <nav className="related-links" aria-label={t(`${LINKS}.relatedAria`)}>
      <Link className="related-links__link" href="/initiatives">
        {t(`${LINKS}.initiativeWorkspace`)}
      </Link>
      <Link
        className="related-links__link"
        href={`/collective-decisions/${encodeURIComponent(decisionId)}`}
      >
        {t(`${LINKS}.collectiveDecisionWorkspace`)}
      </Link>
      <ViewImplementationCommitmentLink petitionId={petitionId} />
      <ViewImplementationLink petitionId={petitionId} />
      <Link className="related-links__link" href={publicPetitionHref(initiativeId, petitionId)}>
        {t(`${LINKS}.publicPetition`)}
      </Link>
      <ViewImplementationCommitmentLink petitionId={petitionId} publicView />
      <ViewImplementationLink petitionId={petitionId} publicView />
      <Link
        className="related-links__link"
        href={`/initiatives/public/${encodeURIComponent(initiativeId)}`}
      >
        {t(`${LINKS}.publicInitiative`)}
      </Link>
      <Link
        className="related-links__link"
        href={`/collective-decisions/public/${encodeURIComponent(decisionId)}`}
      >
        {t(`${LINKS}.publicCollectiveDecision`)}
      </Link>
    </nav>
  );
}

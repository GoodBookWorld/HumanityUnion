"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  getImplementationByCollectiveDecisionId,
  getImplementationByCommitmentId,
  getImplementationByPetitionId,
} from "../api";

import "../../petition/components/view-petition-link.css";

const LINKS = "author.petition.public.status.links";

interface ViewImplementationLinkProps {
  implementationCommitmentId?: string | null;
  petitionId?: string | null;
  collectiveDecisionId?: string | null;
  publicView?: boolean;
}

export function ViewImplementationLink({
  implementationCommitmentId = null,
  petitionId = null,
  collectiveDecisionId = null,
  publicView = false,
}: ViewImplementationLinkProps) {
  const t = useTranslations("initiativeExperience");
  const [implementationId, setImplementationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!implementationCommitmentId && !petitionId && !collectiveDecisionId) {
      setImplementationId(null);
      return;
    }

    let cancelled = false;

    async function loadImplementationLink() {
      setLoading(true);

      try {
        const implementation = implementationCommitmentId
          ? await getImplementationByCommitmentId(implementationCommitmentId)
          : petitionId
            ? await getImplementationByPetitionId(petitionId)
            : collectiveDecisionId
              ? await getImplementationByCollectiveDecisionId(collectiveDecisionId)
              : null;

        if (!cancelled) {
          setImplementationId(implementation?.implementationId ?? null);
        }
      } catch {
        if (!cancelled) {
          setImplementationId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadImplementationLink();

    return () => {
      cancelled = true;
    };
  }, [collectiveDecisionId, implementationCommitmentId, petitionId]);

  if (!implementationCommitmentId && !petitionId && !collectiveDecisionId) {
    return <p className="view-petition-link__empty">{t(`${LINKS}.implementationNoReference`)}</p>;
  }

  if (loading) {
    return <p className="view-petition-link__empty">{t(`${LINKS}.implementationLoading`)}</p>;
  }

  if (!implementationId) {
    return <p className="view-petition-link__empty">{t(`${LINKS}.implementationNotLinked`)}</p>;
  }

  const href = publicView
    ? `/implementations/public/${encodeURIComponent(implementationId)}`
    : `/implementations/${encodeURIComponent(implementationId)}`;

  return (
    <Link className="view-petition-link" href={href}>
      {publicView
        ? t(`${LINKS}.viewPublicImplementation`)
        : t(`${LINKS}.openImplementationWorkspace`)}
    </Link>
  );
}

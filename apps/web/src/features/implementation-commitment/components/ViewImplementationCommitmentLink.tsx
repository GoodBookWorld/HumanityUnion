"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  getImplementationCommitmentByCollectiveDecisionId,
  getImplementationCommitmentByPetitionId,
} from "../api";

import "../../petition/components/view-petition-link.css";

const LINKS = "author.petition.public.status.links";

interface ViewImplementationCommitmentLinkProps {
  petitionId?: string | null;
  collectiveDecisionId?: string | null;
  publicView?: boolean;
}

export function ViewImplementationCommitmentLink({
  petitionId = null,
  collectiveDecisionId = null,
  publicView = false,
}: ViewImplementationCommitmentLinkProps) {
  const t = useTranslations("initiativeExperience");
  const [commitmentId, setCommitmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!petitionId && !collectiveDecisionId) {
      setCommitmentId(null);
      return;
    }

    let cancelled = false;

    async function loadCommitmentLink() {
      setLoading(true);

      try {
        const commitment = petitionId
          ? await getImplementationCommitmentByPetitionId(petitionId)
          : collectiveDecisionId
            ? await getImplementationCommitmentByCollectiveDecisionId(collectiveDecisionId)
            : null;

        if (!cancelled) {
          setCommitmentId(commitment?.implementationCommitmentId ?? null);
        }
      } catch {
        if (!cancelled) {
          setCommitmentId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCommitmentLink();

    return () => {
      cancelled = true;
    };
  }, [collectiveDecisionId, petitionId]);

  if (!petitionId && !collectiveDecisionId) {
    return <p className="view-petition-link__empty">{t(`${LINKS}.commitmentNoReference`)}</p>;
  }

  if (loading) {
    return <p className="view-petition-link__empty">{t(`${LINKS}.commitmentLoading`)}</p>;
  }

  if (!commitmentId) {
    return <p className="view-petition-link__empty">{t(`${LINKS}.commitmentNotLinked`)}</p>;
  }

  const href = publicView
    ? `/implementation-commitments/public/${encodeURIComponent(commitmentId)}`
    : `/implementation-commitments/${encodeURIComponent(commitmentId)}`;

  return (
    <Link className="view-petition-link" href={href}>
      {publicView ? t(`${LINKS}.viewPublicCommitment`) : t(`${LINKS}.openCommitmentWorkspace`)}
    </Link>
  );
}

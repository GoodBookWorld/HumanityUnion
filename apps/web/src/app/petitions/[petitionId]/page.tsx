import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getCollaborativeAnalysisByInitiativeId } from "../../../features/collaborative-analysis/api";
import { getCollectiveDecisionById } from "../../../features/collective-decision/api";
import { getInitiativeById } from "../../../features/initiatives/api";
import { getPetitionById } from "../../../features/petition/api";
import { getImplementationCommitmentByPetitionId } from "../../../features/implementation-commitment/api";
import { PetitionWorkspace } from "../../../features/petition/components/PetitionWorkspace";
import { petitionStatusNavItems } from "../../../features/petition/petition-status-i18n";
import { PetitionDocumentViews } from "../../../features/initiative-petition-lifecycle/components/PetitionDocumentViews";
import {
  PETITION_VIEW_QUERY_PARAM,
  readPetitionDocumentView,
} from "../../../features/initiative-petition-lifecycle/petition-editing-workspace";
import { publicPetitionHref } from "../../../features/initiative-petition-lifecycle/petition-viewer-selection";
import { WorkspaceNavigation } from "../../../features/initiatives/components/WorkspaceNavigation";

import "../petition-page.css";

const PAGE = "author.petition.public.status.page";
const LINKS = "author.petition.public.status.links";

interface PetitionPageProps {
  params: Promise<{
    petitionId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PetitionPage({ params, searchParams }: PetitionPageProps) {
  const { petitionId } = await params;
  const initialView = readPetitionDocumentView((await searchParams)[PETITION_VIEW_QUERY_PARAM]);
  const t = await getTranslations("initiativeExperience");
  let petition = null;

  try {
    petition = await getPetitionById(petitionId);
  } catch {
    petition = null;
  }

  if (!petition) {
    return (
      <main className="petition-page humanity-workspace-page">
        <WorkspaceNavigation />
        <h1>{t(`${PAGE}.unavailableTitle`)}</h1>
        <p>{t(`${PAGE}.unavailable`)}</p>
        <p className="petition-page__back">
          <Link href="/initiatives">{t(`${PAGE}.backToInitiatives`)}</Link>
        </p>
      </main>
    );
  }

  let collectiveDecision = null;
  let initiative = null;
  let collaborativeAnalysis = null;

  try {
    collectiveDecision = await getCollectiveDecisionById(petition.collectiveDecisionId);
  } catch {
    collectiveDecision = null;
  }

  try {
    initiative = await getInitiativeById(petition.subject.initiativeId);
  } catch {
    initiative = null;
  }

  try {
    collaborativeAnalysis = await getCollaborativeAnalysisByInitiativeId(
      petition.subject.initiativeId,
    );
  } catch {
    collaborativeAnalysis = null;
  }

  let implementationCommitmentId: string | null = null;

  try {
    const commitment = await getImplementationCommitmentByPetitionId(petition.petitionId);
    implementationCommitmentId = commitment.implementationCommitmentId;
  } catch {
    implementationCommitmentId = null;
  }

  return (
    <main className="petition-page humanity-workspace-page">
      <PetitionDocumentViews
        petitionId={petition.petitionId}
        initiativeId={petition.subject.initiativeId}
        initialView={initialView}
        title={t(`${PAGE}.title`)}
        subtitle={t(`${PAGE}.subtitle`)}
        statusNavItems={petitionStatusNavItems((key) => t(key))}
        sectionsLabel={t(`${PAGE}.sectionsLabel`)}
        sectionsAriaLabel={t(`${PAGE}.sectionsAria`)}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <PetitionWorkspace
          initialPetition={petition}
          collectiveDecision={collectiveDecision}
          initiative={initiative}
          collaborativeAnalysis={collaborativeAnalysis}
        />
      </PetitionDocumentViews>

      <nav className="petition-page__links" aria-label={t(`${PAGE}.platformLinksAria`)}>
        <Link href="/initiatives">{t(`${LINKS}.initiativeWorkspace`)}</Link>
        <Link href={`/collective-decisions/${encodeURIComponent(petition.collectiveDecisionId)}`}>
          {t(`${LINKS}.collectiveDecisionWorkspace`)}
        </Link>
        <Link href={publicPetitionHref(petition.subject.initiativeId, petition.petitionId)}>
          {t(`${LINKS}.publicPetition`)}
        </Link>
        <Link href={`/initiatives/public/${encodeURIComponent(petition.subject.initiativeId)}`}>
          {t(`${LINKS}.publicInitiative`)}
        </Link>
        <Link
          href={`/collective-decisions/public/${encodeURIComponent(petition.collectiveDecisionId)}`}
        >
          {t(`${LINKS}.publicCollectiveDecision`)}
        </Link>
        {implementationCommitmentId ? (
          <>
            <Link
              href={`/implementation-commitments/${encodeURIComponent(implementationCommitmentId)}`}
            >
              {t(`${LINKS}.implementationCommitmentWorkspace`)}
            </Link>
            <Link
              href={`/implementation-commitments/public/${encodeURIComponent(implementationCommitmentId)}`}
            >
              {t(`${LINKS}.publicImplementationCommitment`)}
            </Link>
          </>
        ) : null}
      </nav>

      <p className="petition-page__back">
        <Link href="/initiatives">{t(`${PAGE}.backToInitiatives`)}</Link>
      </p>
    </main>
  );
}

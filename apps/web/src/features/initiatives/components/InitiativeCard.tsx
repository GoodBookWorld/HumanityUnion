"use client";

import type { Initiative } from "@hu/types";
import { resolveInitiativeCoverMedia } from "@hu/types";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { formatInitiativeDate } from "../initiative-lifecycle-labels";
import {
  buildInitiativeExperienceHref,
  buildInitiativeExperienceManageHref,
} from "../../initiative-owner-studio/initiative-experience-routes";
import {
  resolveActivityAreaDisplayLabel,
  resolveLifecyclePhaseDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";
import { useInitiativeCardTitlePresentation } from "../../public-initiative-experience/use-initiative-public-presentation";

import { InitiativeImage } from "./InitiativeImage";

import "./initiative-card.css";

interface InitiativeCardProps {
  initiative: Initiative;
}

export function InitiativeCard({ initiative }: InitiativeCardProps) {
  const tWorkspace = useTranslations("workspace.initiativesPage");
  const tExperience = useTranslations("initiativeExperience");
  const displayTitle = useInitiativeCardTitlePresentation({
    initiativeId: initiative.initiativeId,
    canonicalTitle: initiative.title,
  });

  const href =
    initiative.lifecyclePhase === "draft"
      ? buildInitiativeExperienceManageHref(initiative.initiativeId)
      : buildInitiativeExperienceHref(initiative.initiativeId);

  const actionLabel =
    initiative.lifecyclePhase === "draft"
      ? tWorkspace("manageInitiative")
      : tWorkspace("openInitiative");

  const phaseLabel = resolveLifecyclePhaseDisplayLabel(initiative.lifecyclePhase, tExperience);
  const activityAreaLabel = resolveActivityAreaDisplayLabel(
    initiative.metadata.activityArea,
    tExperience,
  );
  const community =
    initiative.metadata.communityAssociation ||
    initiative.metadata.communitySlug ||
    tWorkspace("notSpecified");

  return (
    <Link
      href={href}
      className="initiative-card initiative-card--link"
      aria-label={`${actionLabel}: ${displayTitle}`}
    >
      <span className="initiative-card__media">
        <InitiativeImage
          title={displayTitle}
          imageUrl={initiative.metadata.imageUrl}
          coverMedia={resolveInitiativeCoverMedia(initiative.metadata)}
        />
      </span>
      <span className="initiative-card__title">{displayTitle}</span>
      <span className="initiative-card__meta">
        <span>{phaseLabel}</span>
        <span>{activityAreaLabel}</span>
        <span>{community}</span>
      </span>
      <span className="initiative-card__dates">
        <span>{tWorkspace("created", { date: formatInitiativeDate(initiative.createdAt) })}</span>
        <span>{tWorkspace("updated", { date: formatInitiativeDate(initiative.updatedAt) })}</span>
      </span>
      <span className="initiative-card__action">{actionLabel}</span>
    </Link>
  );
}

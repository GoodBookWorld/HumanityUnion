"use client";

import type { Initiative } from "@hu/types";
import Link from "next/link";

import {
  INITIATIVE_LIFECYCLE_PHASE_LABELS,
  formatInitiativeDate,
} from "../initiative-lifecycle-labels";
import {
  buildInitiativeExperienceHref,
  buildInitiativeExperienceManageHref,
} from "../../initiative-owner-studio/initiative-experience-routes";

import { InitiativeImage } from "./InitiativeImage";

import "./initiative-card.css";

interface InitiativeCardProps {
  initiative: Initiative;
}

function communityLabel(initiative: Initiative): string {
  return (
    initiative.metadata.communityAssociation || initiative.metadata.communitySlug || "Not specified"
  );
}

function resolveActionLabel(initiative: Initiative): string {
  return initiative.lifecyclePhase === "draft" ? "Manage Initiative" : "Open Initiative";
}

export function InitiativeCard({ initiative }: InitiativeCardProps) {
  const href =
    initiative.lifecyclePhase === "draft"
      ? buildInitiativeExperienceManageHref(initiative.initiativeId)
      : buildInitiativeExperienceHref(initiative.initiativeId);

  return (
    <Link
      href={href}
      className="initiative-card initiative-card--link"
      aria-label={`${resolveActionLabel(initiative)}: ${initiative.title}`}
    >
      <span className="initiative-card__media">
        <InitiativeImage title={initiative.title} imageUrl={initiative.metadata.imageUrl} />
      </span>
      <span className="initiative-card__title">{initiative.title}</span>
      <span className="initiative-card__meta">
        <span>{INITIATIVE_LIFECYCLE_PHASE_LABELS[initiative.lifecyclePhase]}</span>
        <span>{initiative.metadata.activityArea}</span>
        <span>{communityLabel(initiative)}</span>
      </span>
      <span className="initiative-card__dates">
        <span>Created {formatInitiativeDate(initiative.createdAt)}</span>
        <span>Updated {formatInitiativeDate(initiative.updatedAt)}</span>
      </span>
      <span className="initiative-card__action">{resolveActionLabel(initiative)}</span>
    </Link>
  );
}

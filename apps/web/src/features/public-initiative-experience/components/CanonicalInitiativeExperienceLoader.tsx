"use client";

import type { Initiative, PublicInitiativeExperienceProjection } from "@hu/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getInitiativeOwnerAccess } from "../../initiative-owner-studio/api";
import { InitiativeOwnerDraftShell } from "../../initiative-owner-studio/components/InitiativeOwnerDraftShell";
import { getPublicInitiativeExperience } from "../api";
import { PublicInitiativeExperiencePage } from "./PublicInitiativeExperiencePage";

import "../../initiative-owner-studio/initiative-owner-studio.css";

interface CanonicalInitiativeExperienceLoaderProps {
  readonly initiativeId: string;
}

/**
 * ONE canonical Initiative experience mount for `/initiatives/public/{id}`.
 */
export function CanonicalInitiativeExperienceLoader({
  initiativeId,
}: CanonicalInitiativeExperienceLoaderProps) {
  const t = useTranslations("initiativeExperience");
  const [experience, setExperience] = useState<PublicInitiativeExperienceProjection | null>(null);
  const [manageInitiative, setManageInitiative] = useState<Initiative | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) {
      setLoading(true);
    }
    setUnavailable(false);

    const [experienceResult, ownerResult] = await Promise.allSettled([
      getPublicInitiativeExperience(initiativeId),
      getInitiativeOwnerAccess(initiativeId),
    ]);

    const nextExperience = experienceResult.status === "fulfilled" ? experienceResult.value : null;
    const ownerAccess = ownerResult.status === "fulfilled" ? ownerResult.value : null;

    setExperience(nextExperience);
    setManageInitiative(ownerAccess?.canManage ? (ownerAccess.initiative ?? null) : null);
    setUnavailable(!nextExperience && !ownerAccess?.canManage);
    setLoading(false);
  }, [initiativeId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <main className="pie-page">
        <p role="status">{t("common.loadingExperience")}</p>
      </main>
    );
  }

  if (unavailable) {
    return (
      <main className="pie-page">
        <h1>{t("common.unavailableTitle")}</h1>
        <p>{t("common.unavailableBody")}</p>
        <p>
          <Link href="/">{t("common.backToHome")}</Link>
        </p>
      </main>
    );
  }

  if (experience) {
    return (
      <PublicInitiativeExperiencePage
        experience={experience}
        manageInitiative={manageInitiative}
        onManageInitiativeUpdated={(updated) => {
          setManageInitiative(updated);
          void load({ quiet: true });
        }}
        onExperienceRefetch={() => load({ quiet: true })}
      />
    );
  }

  if (manageInitiative) {
    return (
      <InitiativeOwnerDraftShell
        initiative={manageInitiative}
        onInitiativeUpdated={(updated) => {
          setManageInitiative(updated);
          void load();
        }}
      />
    );
  }

  return null;
}

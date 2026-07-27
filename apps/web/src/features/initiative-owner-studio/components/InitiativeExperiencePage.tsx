"use client";

import type { Initiative, PublicInitiativeExperienceProjection } from "@hu/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getPublicInitiativeExperience } from "../../public-initiative-experience/api";
import { PublicInitiativeExperiencePage } from "../../public-initiative-experience/components/PublicInitiativeExperiencePage";
import { getInitiativeOwnerAccess } from "../api";
import { InitiativeOwnerDraftShell } from "./InitiativeOwnerDraftShell";

import "../initiative-owner-studio.css";

interface InitiativeExperiencePageProps {
  initiativeId: string;
}

function resolveManageTabFromHash(): boolean {
  return window.location.hash.replace(/^#/, "").trim().toLowerCase() === "manage";
}

export function InitiativeExperiencePage({ initiativeId }: InitiativeExperiencePageProps) {
  const [publicExperience, setPublicExperience] =
    useState<PublicInitiativeExperienceProjection | null>(null);
  const [ownerInitiative, setOwnerInitiative] = useState<Initiative | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showManageTab, setShowManageTab] = useState(false);

  const loadAccess = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);

    const [experienceResult, ownerResult] = await Promise.allSettled([
      getPublicInitiativeExperience(initiativeId),
      getInitiativeOwnerAccess(initiativeId),
    ]);

    const experience = experienceResult.status === "fulfilled" ? experienceResult.value : null;
    const ownerAccess = ownerResult.status === "fulfilled" ? ownerResult.value : null;

    setPublicExperience(experience);
    setCanManage(ownerAccess?.canManage === true);
    setOwnerInitiative(ownerAccess?.initiative ?? null);
    setUnavailable(!experience && !ownerAccess?.canManage);
    setLoading(false);
  }, [initiativeId]);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  useEffect(() => {
    function syncManageHash() {
      if (canManage) {
        setShowManageTab(resolveManageTabFromHash());
      }
    }

    syncManageHash();
    window.addEventListener("hashchange", syncManageHash);
    return () => window.removeEventListener("hashchange", syncManageHash);
  }, [canManage]);

  if (loading) {
    return (
      <main className="pie-page initiative-owner-studio">
        <p role="status">Loading initiative experience…</p>
      </main>
    );
  }

  if (unavailable) {
    return (
      <main className="pie-page initiative-owner-studio">
        <h1>Initiative unavailable</h1>
        <p>This initiative is not publicly available.</p>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  if (publicExperience && canManage && ownerInitiative) {
    return (
      <PublicInitiativeExperiencePage
        experience={publicExperience}
        ownerMode={{
          initiative: ownerInitiative,
          showManageTab,
          onShowManageTabChange: (active) => {
            setShowManageTab(active);
            window.history.replaceState(null, "", active ? "#manage" : window.location.pathname);
          },
          onInitiativeUpdated: (updated) => {
            setOwnerInitiative(updated);
            void loadAccess();
          },
        }}
      />
    );
  }

  if (publicExperience) {
    return <PublicInitiativeExperiencePage experience={publicExperience} />;
  }

  if (canManage && ownerInitiative) {
    return (
      <InitiativeOwnerDraftShell
        initiative={ownerInitiative}
        onInitiativeUpdated={(updated) => {
          setOwnerInitiative(updated);
          void loadAccess();
        }}
      />
    );
  }

  return null;
}

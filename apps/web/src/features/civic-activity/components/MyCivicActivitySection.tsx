"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { loadCivicActivitySnapshot } from "../api";
import type { CivicActivitySnapshot } from "../types";

import {
  CivicActivityIntro,
  CivicActivitySummaryCards,
  CivicActivityTimeline,
} from "./MyCivicActivityWorkspace";

import "./civic-activity-workspace.css";

export function MyCivicActivitySection() {
  const t = useTranslations("civicActivity");
  const tWorkspace = useTranslations("workspace");
  const [snapshot, setSnapshot] = useState<CivicActivitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await loadCivicActivitySnapshot();

        if (!cancelled) {
          setSnapshot(data);
        }
      } catch {
        if (!cancelled) {
          setError(t("unavailable"));
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <ProfileSection title={tWorkspace("myCivicActivity")}>
        <p>{t("loading")}</p>
      </ProfileSection>
    );
  }

  if (error || !snapshot) {
    return (
      <ProfileSection title={tWorkspace("myCivicActivity")}>
        <p>{error ?? t("unavailable")}</p>
      </ProfileSection>
    );
  }

  return (
    <div className="civic-activity-workspace">
      <ProfileSection title={tWorkspace("myCivicActivity")} id="section-my-civic-activity">
        <CivicActivityIntro loadedAt={snapshot.loadedAt} />
      </ProfileSection>

      <ProfileSection title={t("sections.summary")} id="section-activity-summary">
        <CivicActivitySummaryCards groups={snapshot.groups} />
      </ProfileSection>

      <ProfileSection title={t("sections.timeline")} id="section-activity-timeline">
        <div className="civic-activity-workspace__timeline-viewport">
          <CivicActivityTimeline timeline={snapshot.timeline} />
        </div>
      </ProfileSection>
    </div>
  );
}

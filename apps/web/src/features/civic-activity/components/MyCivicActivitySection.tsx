"use client";

import { useEffect, useState } from "react";

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
          setError("Civic activity data is not available right now.");
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
  }, []);

  if (loading) {
    return (
      <ProfileSection title="My Civic Activity">
        <p>Loading your civic activity...</p>
      </ProfileSection>
    );
  }

  if (error || !snapshot) {
    return (
      <ProfileSection title="My Civic Activity">
        <p>{error ?? "Civic activity data is not available right now."}</p>
      </ProfileSection>
    );
  }

  return (
    <div className="civic-activity-workspace">
      <ProfileSection title="My Civic Activity">
        <CivicActivityIntro loadedAt={snapshot.loadedAt} />
      </ProfileSection>

      <ProfileSection title="Activity Summary">
        <CivicActivitySummaryCards groups={snapshot.groups} />
      </ProfileSection>

      <ProfileSection title="Activity Timeline">
        <CivicActivityTimeline timeline={snapshot.timeline} />
      </ProfileSection>
    </div>
  );
}

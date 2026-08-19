"use client";

import type { ReactNode } from "react";

interface PublicCivicRecordExperienceLayoutProps {
  hero: ReactNode;
  lifecycle: ReactNode;
  center: ReactNode;
  sidebar: ReactNode;
}

/**
 * Canonical Initiative Experience shell (Lifecycle Staging Fix 05).
 * Hero is full-width above the three-column grid. Document flow is natural;
 * footer follows page content. No viewport-lock shell.
 */
export function PublicCivicRecordExperienceLayout({
  hero,
  lifecycle,
  center,
  sidebar,
}: PublicCivicRecordExperienceLayoutProps) {
  return (
    <main className="pie-page">
      <div className="pie-layout__hero">{hero}</div>

      <div className="pie-layout pie-layout__columns">
        <aside className="pie-layout__lifecycle" aria-label="Lifecycle stages">
          {lifecycle}
        </aside>
        <div className="pie-layout__center">
          <div className="pie-layout__center-body">{center}</div>
        </div>
        <aside className="pie-layout__sidebar" aria-label="Initiative sidebar">
          {sidebar}
        </aside>
      </div>
    </main>
  );
}

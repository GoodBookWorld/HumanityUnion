"use client";

import type { ReactNode } from "react";

interface PublicCivicRecordExperienceLayoutProps {
  hero: ReactNode;
  lifecycle: ReactNode;
  center: ReactNode;
  sidebar: ReactNode;
}

export function PublicCivicRecordExperienceLayout({
  hero,
  lifecycle,
  center,
  sidebar,
}: PublicCivicRecordExperienceLayoutProps) {
  return (
    <main className="pie-page">
      {hero}

      <div className="pie-layout">
        <aside className="pie-layout__lifecycle">{lifecycle}</aside>
        <div className="pie-layout__center">{center}</div>
        <aside className="pie-layout__sidebar">{sidebar}</aside>
      </div>
    </main>
  );
}

"use client";

import type { Initiative } from "@hu/types";

import {
  MY_INITIATIVE_SECTIONS,
  groupInitiativesByLifecyclePhase,
} from "../initiative-lifecycle-labels";

import { InitiativeCard } from "./InitiativeCard";

import "./my-initiatives-dashboard.css";

interface MyInitiativesDashboardProps {
  initiatives: Initiative[];
  selectedId: string | null;
  onSelect: (initiativeId: string) => void;
}

export function MyInitiativesDashboard({
  initiatives,
  selectedId,
  onSelect,
}: MyInitiativesDashboardProps) {
  const grouped = groupInitiativesByLifecyclePhase(initiatives);

  return (
    <div className="my-initiatives-dashboard">
      {MY_INITIATIVE_SECTIONS.map((section) => {
        const sectionInitiatives = grouped[section.id];

        return (
          <section key={section.id} className="my-initiatives-dashboard__section">
            <h3 className="my-initiatives-dashboard__heading">{section.title}</h3>
            {sectionInitiatives.length === 0 ? (
              <p className="my-initiatives-dashboard__empty">No initiatives in this section.</p>
            ) : (
              <div className="my-initiatives-dashboard__cards">
                {sectionInitiatives.map((initiative) => (
                  <InitiativeCard
                    key={initiative.initiativeId}
                    initiative={initiative}
                    selected={initiative.initiativeId === selectedId}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

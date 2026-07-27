"use client";

import type { Initiative } from "@hu/types";
import { useState } from "react";

import {
  MY_INITIATIVE_SECTIONS,
  groupInitiativesByLifecyclePhase,
} from "../initiative-lifecycle-labels";

import { InitiativeCard } from "./InitiativeCard";

import "./my-initiatives-dashboard.css";

interface MyInitiativesDashboardProps {
  initiatives: Initiative[];
}

export function MyInitiativesDashboard({ initiatives }: MyInitiativesDashboardProps) {
  const grouped = groupInitiativesByLifecyclePhase(initiatives);
  const [openSectionId, setOpenSectionId] = useState<string | null>(
    MY_INITIATIVE_SECTIONS.find((section) => grouped[section.id].length > 0)?.id ?? null,
  );

  return (
    <div className="my-initiatives-dashboard">
      {MY_INITIATIVE_SECTIONS.map((section) => {
        const sectionInitiatives = grouped[section.id];
        const isOpen = openSectionId === section.id;
        const panelId = `my-initiatives-panel-${section.id}`;

        return (
          <section key={section.id} className="my-initiatives-dashboard__section">
            <button
              type="button"
              className="my-initiatives-dashboard__summary"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenSectionId(isOpen ? null : section.id)}
            >
              <span className="my-initiatives-dashboard__heading">{section.title}</span>
              <span className="my-initiatives-dashboard__count">{sectionInitiatives.length}</span>
            </button>
            {isOpen ? (
              <div id={panelId} className="my-initiatives-dashboard__panel">
                {sectionInitiatives.length === 0 ? (
                  <p className="my-initiatives-dashboard__empty">No initiatives in this section.</p>
                ) : (
                  <div className="my-initiatives-dashboard__cards">
                    {sectionInitiatives.map((initiative) => (
                      <InitiativeCard key={initiative.initiativeId} initiative={initiative} />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

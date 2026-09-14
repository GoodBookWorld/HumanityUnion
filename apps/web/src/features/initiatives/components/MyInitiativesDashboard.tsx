"use client";

import type { Initiative } from "@hu/types";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  MY_INITIATIVE_SECTION_IDS,
  groupInitiativesByLifecyclePhase,
} from "../initiative-lifecycle-labels";

import { InitiativeCard } from "./InitiativeCard";

import "./my-initiatives-dashboard.css";

interface MyInitiativesDashboardProps {
  initiatives: Initiative[];
}

export function MyInitiativesDashboard({ initiatives }: MyInitiativesDashboardProps) {
  const t = useTranslations("workspace.initiativesPage");
  const grouped = groupInitiativesByLifecyclePhase(initiatives);
  const [openSectionId, setOpenSectionId] = useState<string | null>(
    MY_INITIATIVE_SECTION_IDS.find((sectionId) => grouped[sectionId].length > 0) ?? null,
  );

  return (
    <div className="my-initiatives-dashboard">
      {MY_INITIATIVE_SECTION_IDS.map((sectionId) => {
        const sectionInitiatives = grouped[sectionId];
        const isOpen = openSectionId === sectionId;
        const panelId = `my-initiatives-panel-${sectionId}`;

        return (
          <section key={sectionId} className="my-initiatives-dashboard__section">
            <button
              type="button"
              className="my-initiatives-dashboard__summary"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenSectionId(isOpen ? null : sectionId)}
            >
              <span className="my-initiatives-dashboard__heading">
                {t(`sections.${sectionId}`)}
              </span>
              <span className="my-initiatives-dashboard__count">{sectionInitiatives.length}</span>
            </button>
            {isOpen ? (
              <div id={panelId} className="my-initiatives-dashboard__panel">
                {sectionInitiatives.length === 0 ? (
                  <p className="my-initiatives-dashboard__empty">{t("emptySection")}</p>
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

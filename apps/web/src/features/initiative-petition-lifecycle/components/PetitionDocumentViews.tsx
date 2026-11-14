"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import type { WorkspaceNavSection } from "../../../components/member/WorkspaceSectionNav";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { listPetitionWorkingDrafts } from "../api";
import {
  PETITION_VIEW_QUERY_PARAM,
  type PetitionDocumentView,
} from "../petition-editing-workspace";
import { PetitionEditingWorkspace } from "./PetitionEditingWorkspace";

import "./initiative-petition-stage-workspace.css";

/** Editing exists only for the steward; everyone else always sees Petition Status. */
export function resolvePetitionDocumentView(
  activeView: PetitionDocumentView,
  canEdit: boolean,
): PetitionDocumentView {
  return canEdit ? activeView : "status";
}

export interface PetitionDocumentViewsTabsProps {
  readonly activeView: PetitionDocumentView;
  /** True only once the API confirmed the viewer is this Initiative's steward. */
  readonly canEdit: boolean;
  readonly onSelect: (view: PetitionDocumentView) => void;
  readonly statusPanel: ReactNode;
  readonly editingPanel: ReactNode;
}

/** Presentation of the two Petition submenus; Editing exists only for the steward. */
export function PetitionDocumentViewsTabs({
  activeView,
  canEdit,
  onSelect,
  statusPanel,
  editingPanel,
}: PetitionDocumentViewsTabsProps) {
  const t = useTranslations("initiativeExperience");
  const view = resolvePetitionDocumentView(activeView, canEdit);
  const tabs: Array<[PetitionDocumentView, string]> = canEdit
    ? [
        ["status", t("petitionEditing.tabs.status")],
        ["editing", t("petitionEditing.tabs.editing")],
      ]
    : [["status", t("petitionEditing.tabs.status")]];

  return (
    <div className="ipl-document-views">
      <div className="ipl-document-views__tabs" role="tablist" aria-label={t("petitionEditing.tabs.aria")}>
        {tabs.map(([tabView, label]) => (
          <button
            key={tabView}
            type="button"
            role="tab"
            id={`ipl-document-tab-${tabView}`}
            aria-selected={view === tabView}
            aria-controls={`ipl-document-panel-${tabView}`}
            className={`ipl-document-views__tab${view === tabView ? " ipl-document-views__tab--active" : ""}`}
            onClick={() => onSelect(tabView)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`ipl-document-panel-${view}`}
        aria-labelledby={`ipl-document-tab-${view}`}
      >
        {view === "editing" ? editingPanel : statusPanel}
      </div>
    </div>
  );
}

export interface PetitionDocumentWorkspaceProps extends PetitionDocumentViewsTabsProps {
  readonly title: string;
  readonly subtitle?: string;
  /** Links to the Petition Status sections; they exist only in that view. */
  readonly statusNavItems: readonly WorkspaceNavSection[];
  readonly sectionsLabel?: string;
  readonly sectionsAriaLabel?: string;
  readonly workspaceNavigation: ReactNode;
}

/**
 * HU-LC-05C.4C.7C.3B — one Workspace layout for both Petition views, so
 * Petition Status and Editing Petition share the same sidebar and geometry.
 */
export function PetitionDocumentWorkspace({
  title,
  subtitle,
  statusNavItems,
  sectionsLabel,
  sectionsAriaLabel,
  workspaceNavigation,
  ...tabs
}: PetitionDocumentWorkspaceProps) {
  const view = resolvePetitionDocumentView(tabs.activeView, tabs.canEdit);

  return (
    <MemberWorkspace
      title={title}
      subtitle={subtitle}
      navItems={view === "status" ? statusNavItems : undefined}
      sectionsLabel={sectionsLabel}
      sectionsAriaLabel={sectionsAriaLabel}
      workspaceNavigation={workspaceNavigation}
    >
      <PetitionDocumentViewsTabs {...tabs} />
    </MemberWorkspace>
  );
}

type StewardAccess = "unknown" | "steward" | "none";

interface PetitionDocumentViewsProps {
  readonly petitionId: string;
  readonly initiativeId: string;
  readonly initialView: PetitionDocumentView;
  readonly title: string;
  readonly subtitle?: string;
  readonly statusNavItems: readonly WorkspaceNavSection[];
  readonly sectionsLabel?: string;
  readonly sectionsAriaLabel?: string;
  readonly workspaceNavigation: ReactNode;
  /** The existing public Petition workspace (Petition Status). */
  readonly children: ReactNode;
}

/**
 * HU-LC-05C.4C.7C.2 — `/petitions/<id>`: Petition Status (unchanged public
 * workspace) and, for the steward only, Editing Petition (`?view=editing`).
 */
export function PetitionDocumentViews({
  petitionId,
  initiativeId,
  initialView,
  title,
  subtitle,
  statusNavItems,
  sectionsLabel,
  sectionsAriaLabel,
  workspaceNavigation,
  children,
}: PetitionDocumentViewsProps) {
  const authStatus = useClientAuthStatus();
  const [view, setView] = useState<PetitionDocumentView>(initialView);
  const [access, setAccess] = useState<StewardAccess>("unknown");

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setAccess(authStatus === "pending" ? "unknown" : "none");
      return;
    }

    let cancelled = false;
    listPetitionWorkingDrafts(initiativeId)
      .then(() => {
        if (!cancelled) setAccess("steward");
      })
      .catch(() => {
        if (!cancelled) setAccess("none");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, initiativeId]);

  function selectView(next: PetitionDocumentView) {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "editing") {
      url.searchParams.set(PETITION_VIEW_QUERY_PARAM, "editing");
    } else {
      url.searchParams.delete(PETITION_VIEW_QUERY_PARAM);
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  /** HU-LC-05C.4C.7C.3D — this page's own Petition: Status view, from the top, no reload. */
  function showPetitionStatus() {
    selectView("status");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <PetitionDocumentWorkspace
      title={title}
      subtitle={subtitle}
      statusNavItems={statusNavItems}
      sectionsLabel={sectionsLabel}
      sectionsAriaLabel={sectionsAriaLabel}
      workspaceNavigation={workspaceNavigation}
      activeView={view}
      canEdit={access === "steward"}
      onSelect={selectView}
      statusPanel={children}
      editingPanel={
        <PetitionEditingWorkspace
          initiativeId={initiativeId}
          currentPetitionId={petitionId}
          onShowPetitionStatus={showPetitionStatus}
        />
      }
    />
  );
}

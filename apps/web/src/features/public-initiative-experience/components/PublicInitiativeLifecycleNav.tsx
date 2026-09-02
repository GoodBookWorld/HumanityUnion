"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { InitiativeLifecycleProfile, PublicInitiativeLifecycleStageNavItem } from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

import { isLifecycleStageSelectable } from "../lifecycle-stage-navigation";
import {
  resolveLifecycleStageDisplayLabel,
  resolveLifecycleStateDisplayLabel,
} from "../initiative-experience-i18n";

interface PublicInitiativeLifecycleNavProps {
  stages: PublicInitiativeLifecycleStageNavItem[];
  /** Resolver progress / guidance cursor — informational only for Authors. */
  currentStageId: string;
  /** DISPLAY-ONLY selected stage (may differ from current/recommended). */
  selectedStageId: string;
  /** Steward Author — all applicable stages selectable (Step 02). */
  viewerIsSteward?: boolean;
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  onStageSelect?: (stageId: string, hash: string) => void;
  resolveStageHref?: (stageId: string, hash: string) => string | null;
  activeRecordId?: string;
}

export function PublicInitiativeLifecycleNav({
  stages,
  currentStageId,
  selectedStageId,
  viewerIsSteward = false,
  lifecycleProfile,
  onStageSelect,
  resolveStageHref,
  activeRecordId,
}: PublicInitiativeLifecycleNavProps) {
  const t = useTranslations("initiativeExperience");
  const isPublicChoice = resolveInitiativeLifecycleProfile(lifecycleProfile) === "PUBLIC_CHOICE";
  return (
    <nav className="pie-lifecycle" aria-label={t("lifecycle.navAria")}>
      <h2 className="pie-lifecycle__title">{t("lifecycle.title")}</h2>
      <ul className="pie-lifecycle__list">
        {stages.map((stage) => {
          const stageLabel = resolveLifecycleStageDisplayLabel(stage.stageId, t, stage.label);
          const stateLabel = resolveLifecycleStateDisplayLabel(stage.state, t, stage.stateLabel);
          const label =
            stage.recordCount > 0 ? `${stageLabel} (${stage.recordCount})` : stageLabel;
          const isSelected = stage.stageId === selectedStageId;
          const isCurrent = stage.stageId === currentStageId;
          const selectable = isLifecycleStageSelectable(stages, stage.stageId, {
            viewerIsSteward,
          });
          const showElectionResultsSubtitle =
            isPublicChoice && stage.stageId === "collective_decision";
          const href = selectable
            ? (resolveStageHref?.(stage.stageId, stage.hash) ?? null)
            : null;
          const className = [
            "pie-lifecycle__stage",
            `pie-lifecycle__stage--${stage.state}`,
            isSelected ? "pie-lifecycle__stage--active" : "",
            isCurrent ? "pie-lifecycle__stage--current" : "",
            selectable ? "" : "pie-lifecycle__stage--locked",
          ]
            .filter(Boolean)
            .join(" ");

          const ariaLabel = `${stageLabel}${isCurrent ? t("lifecycle.currentStageSuffix") : ""}${
            isSelected ? t("lifecycle.selectedSuffix") : ""
          }${!selectable && !href ? t("lifecycle.lockedSuffix") : ""}`;

          const content = (
            <>
              <span
                className="pie-lifecycle__marker"
                data-lifecycle-marker={stage.state}
                aria-hidden="true"
              />
              <span className="pie-lifecycle__label">{label}</span>
              {showElectionResultsSubtitle ? (
                <span className="pie-lifecycle__subtitle">{t("common.electionResults")}</span>
              ) : null}
              <span className="pie-lifecycle__state">
                {stateLabel}
                {isCurrent ? t("common.currentSuffix") : ""}
              </span>
            </>
          );

          return (
            <li key={stage.stageId}>
              {href ? (
                <Link
                  href={href}
                  className={className}
                  aria-current={isSelected ? "step" : undefined}
                  aria-label={ariaLabel}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  className={className}
                  aria-current={isSelected ? "step" : undefined}
                  aria-disabled={!selectable}
                  disabled={!selectable}
                  aria-label={
                    selectable
                      ? ariaLabel
                      : `${stageLabel}${isCurrent ? t("lifecycle.currentStageSuffix") : ""}${t("lifecycle.lockedSuffix")}`
                  }
                  onClick={() => {
                    if (!selectable) {
                      return;
                    }

                    onStageSelect?.(stage.stageId, stage.hash);
                  }}
                >
                  {content}
                </button>
              )}
              {isSelected && activeRecordId ? (
                <p className="pie-lifecycle__active-record" aria-live="polite">
                  {t("common.viewingActiveRecord")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

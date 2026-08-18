"use client";

import Link from "next/link";

import type { PublicInitiativeLifecycleStageNavItem } from "@hu/types";

import { isLifecycleStageSelectable } from "../lifecycle-stage-navigation";

interface PublicInitiativeLifecycleNavProps {
  stages: PublicInitiativeLifecycleStageNavItem[];
  /** Resolver progress / guidance cursor — informational only for Authors. */
  currentStageId: string;
  /** DISPLAY-ONLY selected stage (may differ from current/recommended). */
  selectedStageId: string;
  /** Steward Author — all applicable stages selectable (Step 02). */
  viewerIsSteward?: boolean;
  onStageSelect?: (stageId: string, hash: string) => void;
  resolveStageHref?: (stageId: string, hash: string) => string | null;
  activeRecordId?: string;
}

export function PublicInitiativeLifecycleNav({
  stages,
  currentStageId,
  selectedStageId,
  viewerIsSteward = false,
  onStageSelect,
  resolveStageHref,
  activeRecordId,
}: PublicInitiativeLifecycleNavProps) {
  return (
    <nav className="pie-lifecycle" aria-label="Initiative lifecycle">
      <h2 className="pie-lifecycle__title">Lifecycle</h2>
      <ul className="pie-lifecycle__list">
        {stages.map((stage) => {
          const label =
            stage.recordCount > 0 ? `${stage.label} (${stage.recordCount})` : stage.label;
          const isSelected = stage.stageId === selectedStageId;
          const isCurrent = stage.stageId === currentStageId;
          const selectable = isLifecycleStageSelectable(stages, stage.stageId, {
            viewerIsSteward,
          });
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

          const content = (
            <>
              <span
                className="pie-lifecycle__marker"
                data-lifecycle-marker={stage.state}
                aria-hidden="true"
              />
              <span className="pie-lifecycle__label">{label}</span>
              <span className="pie-lifecycle__state">
                {stage.stateLabel}
                {isCurrent ? " · Current" : ""}
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
                  aria-label={`${stage.label}${isCurrent ? ", current stage" : ""}${isSelected ? ", selected" : ""}`}
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
                  aria-label={`${stage.label}${isCurrent ? ", current stage" : ""}${
                    selectable ? "" : ", locked"
                  }`}
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
                  Viewing active record
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

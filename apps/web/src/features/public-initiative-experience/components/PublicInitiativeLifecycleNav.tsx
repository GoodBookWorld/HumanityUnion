"use client";

import Link from "next/link";

import type { PublicInitiativeLifecycleStageNavItem } from "@hu/types";

import { isLifecycleStageSelectable } from "../lifecycle-stage-navigation";

interface PublicInitiativeLifecycleNavProps {
  stages: PublicInitiativeLifecycleStageNavItem[];
  activeStageId: string;
  onStageSelect?: (stageId: string, hash: string) => void;
  resolveStageHref?: (stageId: string, hash: string) => string | null;
  activeRecordId?: string;
}

export function PublicInitiativeLifecycleNav({
  stages,
  activeStageId,
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
          const isActive = stage.stageId === activeStageId;
          const selectable = isLifecycleStageSelectable(stages, stage.stageId);
          const href = selectable
            ? (resolveStageHref?.(stage.stageId, stage.hash) ?? null)
            : null;
          const className = [
            "pie-lifecycle__stage",
            `pie-lifecycle__stage--${stage.state}`,
            isActive ? "pie-lifecycle__stage--active" : "",
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
              <span className="pie-lifecycle__state">{stage.stateLabel}</span>
            </>
          );

          return (
            <li key={stage.stageId}>
              {href ? (
                <Link
                  href={href}
                  className={className}
                  aria-current={isActive ? "step" : undefined}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  className={className}
                  aria-current={isActive ? "step" : undefined}
                  aria-disabled={!selectable}
                  disabled={!selectable}
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
              {isActive && activeRecordId ? (
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

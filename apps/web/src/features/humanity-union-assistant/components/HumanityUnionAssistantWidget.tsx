"use client";

import { useEffect, useRef } from "react";

import type {
  HumanityUnionAssistantSurfaceId,
  InitiativeLifecycleStageId,
} from "@hu/types";

import { useOptionalHumanityUnionAssistant } from "../assistant-context";
import { assistantWidgetCopy } from "../resolve-assistant-surface";

import "../humanity-union-assistant.css";

export interface HumanityUnionAssistantWidgetProps {
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly initiativeId?: string;
  readonly stageId?: InitiativeLifecycleStageId;
  readonly description?: string;
  readonly className?: string;
}

/**
 * Workspace sidebar entry surface only — opens the canonical Assistant modal.
 * Registers as a dedicated widget so the floating launcher stays hidden.
 */
export function HumanityUnionAssistantWidget({
  surfaceId,
  initiativeId,
  stageId,
  description,
  className,
}: HumanityUnionAssistantWidgetProps) {
  const assistant = useOptionalHumanityUnionAssistant();
  const launchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!assistant) {
      return;
    }

    assistant.registerDedicatedWidget();
    return () => assistant.unregisterDedicatedWidget();
  }, [assistant]);

  if (!assistant) {
    return null;
  }

  const copy = description ?? assistantWidgetCopy(surfaceId);

  return (
    <aside
      className={["hu-assistant-widget", className].filter(Boolean).join(" ")}
      aria-label="Humanity Union Assistant"
    >
      <div className="hu-assistant-widget__card">
        <div className="hu-assistant-widget__header">
          <img
            src="/icons/workspace/intel.webp"
            alt=""
            width={40}
            height={40}
            className="hu-assistant-widget__icon"
            decoding="async"
          />
          <h2 className="hu-assistant-widget__title hu-widget-title">Humanity Union Assistant</h2>
        </div>
        <p className="hu-assistant-widget__copy">{copy}</p>
        <button
          ref={launchRef}
          type="button"
          className="hu-assistant-widget__ask"
          onClick={() =>
            assistant.openAssistant({
              surfaceId,
              initiativeId,
              stageId,
              returnFocusRef: launchRef,
            })
          }
        >
          Ask Assistant
        </button>
      </div>
    </aside>
  );
}

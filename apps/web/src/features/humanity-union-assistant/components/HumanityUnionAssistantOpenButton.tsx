"use client";

import { useRef } from "react";

import type {
  HumanityUnionAssistantSurfaceId,
  InitiativeLifecycleStageId,
} from "@hu/types";

import { useOptionalHumanityUnionAssistant } from "../assistant-context";

import "../humanity-union-assistant.css";

export interface HumanityUnionAssistantOpenButtonProps {
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly initiativeId?: string;
  readonly stageId?: InitiativeLifecycleStageId;
  readonly label?: string;
  readonly className?: string;
}

/**
 * Canonical Ask Assistant launcher. Lifecycle Staging Fix 03 — larger
 * control with intel.webp (28×28) while preserving existing design language.
 */
export function HumanityUnionAssistantOpenButton({
  surfaceId,
  initiativeId,
  stageId,
  label = "Ask Assistant",
  className,
}: HumanityUnionAssistantOpenButtonProps) {
  const assistant = useOptionalHumanityUnionAssistant();
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (!assistant) {
    return null;
  }

  const resolvedClassName = ["hu-assistant-open-button", className].filter(Boolean).join(" ");

  return (
    <button
      ref={buttonRef}
      type="button"
      className={resolvedClassName}
      aria-haspopup="dialog"
      aria-label={label}
      onClick={() =>
        assistant.openAssistant({
          surfaceId,
          initiativeId,
          stageId,
          returnFocusRef: buttonRef,
        })
      }
    >
      <img
        src="/icons/workspace/intel.webp"
        alt=""
        width={28}
        height={28}
        className="hu-assistant-open-button__icon"
        decoding="async"
        loading="lazy"
        fetchPriority="low"
        aria-hidden="true"
      />
      <span className="hu-assistant-open-button__label">{label}</span>
    </button>
  );
}

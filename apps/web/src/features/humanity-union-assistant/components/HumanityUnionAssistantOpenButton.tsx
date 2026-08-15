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

  return (
    <button
      ref={buttonRef}
      type="button"
      className={className ?? "hu-assistant-open-button"}
      aria-haspopup="dialog"
      onClick={() =>
        assistant.openAssistant({
          surfaceId,
          initiativeId,
          stageId,
          returnFocusRef: buttonRef,
        })
      }
    >
      {label}
    </button>
  );
}

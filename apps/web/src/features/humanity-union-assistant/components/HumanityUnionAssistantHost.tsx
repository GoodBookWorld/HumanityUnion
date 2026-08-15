"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import {
  useHumanityUnionAssistant,
  type OpenHumanityUnionAssistantInput,
} from "../assistant-context";

/**
 * Launch Readiness Pack 06 — lazy-load the Assistant modal so public routes
 * (and closed-launcher sessions) do not pay conversational UI cost until the
 * Participant opens the Assistant. After first open, the modal stays mounted
 * so `isOpen={false}` cleanup matches pre-Pack behavior.
 */
const HumanityUnionAssistantModal = dynamic(
  () =>
    import("./HumanityUnionAssistantModal").then((module) => module.HumanityUnionAssistantModal),
  { ssr: false },
);

export function HumanityUnionAssistantHost() {
  const { isOpen, target, closeAssistant } = useHumanityUnionAssistant();
  const [everOpened, setEverOpened] = useState(false);
  const [activeTarget, setActiveTarget] = useState<OpenHumanityUnionAssistantInput | null>(null);

  useEffect(() => {
    if (!target) {
      return;
    }

    setEverOpened(true);
    setActiveTarget(target);
  }, [target]);

  if (!everOpened || !activeTarget) {
    return null;
  }

  return (
    <HumanityUnionAssistantModal
      isOpen={isOpen}
      onClose={closeAssistant}
      surfaceId={activeTarget.surfaceId}
      initiativeId={activeTarget.initiativeId}
      stageId={activeTarget.stageId}
      pagePath={activeTarget.pagePath}
    />
  );
}

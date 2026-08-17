import type { InitiativeLifecycleStageId } from "@hu/types";
import { getInitiativeLifecycleStageDefinition } from "@hu/types";

/** Canonical Initiative shell deep link for a lifecycle stage / tab. */
export function buildInitiativeShellDeepLink(
  initiativeId: string,
  stageId: InitiativeLifecycleStageId | "discussion",
): string {
  const base = `/initiatives/public/${encodeURIComponent(initiativeId)}`;
  if (stageId === "discussion") {
    return `${base}#discussion`;
  }

  const definition = getInitiativeLifecycleStageDefinition(stageId);
  const hash = definition?.hash ?? stageId.replaceAll("_", "-");
  return `${base}#${hash}`;
}

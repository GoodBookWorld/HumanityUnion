/**
 * Pack 12E2 — Editor grant notifications via canonical member_notifications.
 * Best-effort: never blocks or rolls back Editor grant persistence.
 */
import type {
  EditorCapabilityId,
  EditorGeographicScope,
  EditorGrantRecord,
} from "@hu/types";
import { EDITOR_CAPABILITY_LABELS } from "@hu/types";

import { createNotification } from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";
import { formatEditorGeographicScope } from "./editor-grant.scope.js";

const EDITOR_PANEL_URL = "/workspace/editor";

function capabilitySummary(capabilities: readonly EditorCapabilityId[]): string {
  return capabilities.map((id) => EDITOR_CAPABILITY_LABELS[id]).join(", ");
}

function scopeSummary(scope: EditorGeographicScope): string {
  return formatEditorGeographicScope(scope).summary;
}

async function deliverEditorNotification(input: {
  participantId: string;
  editorGrantId: string;
  eventType:
    | "editor_access_assigned"
    | "editor_access_activated"
    | "editor_access_deactivated"
    | "editor_permissions_updated"
    | "editor_editing_area_updated";
  message: string;
}): Promise<boolean> {
  try {
    const recipient = await resolveRecipientIdentity(input.participantId);
    if (!recipient) {
      return false;
    }

    const template = getNotificationTemplate(input.eventType);
    await createNotification({
      recipientUserId: recipient.userId,
      recipientProfileId: recipient.profileId,
      eventType: input.eventType,
      title: template.title,
      message: input.message,
      relatedEntityType: "editor_grant",
      relatedEntityId: input.editorGrantId,
      relatedUrl: EDITOR_PANEL_URL,
      priority: template.priority,
    });
    return true;
  } catch {
    return false;
  }
}

export async function notifyEditorAccessAssigned(grant: EditorGrantRecord): Promise<boolean> {
  const caps = capabilitySummary(grant.capabilities);
  const area = scopeSummary(grant.geographicScope);
  const statusNote =
    grant.status === "ACTIVE"
      ? "You can now use the Editor Panel for your assigned editing area and permissions."
      : "Your Editor grant is inactive until an Administrator activates it.";

  return deliverEditorNotification({
    participantId: grant.participantId,
    editorGrantId: grant.editorGrantId,
    eventType: "editor_access_assigned",
    message: `${statusNote} Editing area: ${area}. Permissions: ${caps}.`,
  });
}

export async function notifyEditorAccessActivated(grant: EditorGrantRecord): Promise<boolean> {
  const caps = capabilitySummary(grant.capabilities);
  const area = scopeSummary(grant.geographicScope);
  return deliverEditorNotification({
    participantId: grant.participantId,
    editorGrantId: grant.editorGrantId,
    eventType: "editor_access_activated",
    message: `Your Editor access has been activated. Editing area: ${area}. Permissions: ${caps}.`,
  });
}

export async function notifyEditorAccessDeactivated(grant: EditorGrantRecord): Promise<boolean> {
  return deliverEditorNotification({
    participantId: grant.participantId,
    editorGrantId: grant.editorGrantId,
    eventType: "editor_access_deactivated",
    message: "Your Editor access has been deactivated.",
  });
}

export async function notifyEditorPermissionsUpdated(grant: EditorGrantRecord): Promise<boolean> {
  const caps = capabilitySummary(grant.capabilities);
  return deliverEditorNotification({
    participantId: grant.participantId,
    editorGrantId: grant.editorGrantId,
    eventType: "editor_permissions_updated",
    message: `Your Editor permissions were updated: ${caps}.`,
  });
}

export async function notifyEditorEditingAreaUpdated(grant: EditorGrantRecord): Promise<boolean> {
  const area = scopeSummary(grant.geographicScope);
  return deliverEditorNotification({
    participantId: grant.participantId,
    editorGrantId: grant.editorGrantId,
    eventType: "editor_editing_area_updated",
    message: `Your Editor editing area was updated: ${area}.`,
  });
}

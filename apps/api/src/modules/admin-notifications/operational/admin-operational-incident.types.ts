/**
 * Pack 22E.3 — operational incident state (separate from visible Admin inbox rows).
 */
import type { AdminNotificationSeverity, AdminOpsDedupeKey } from "@hu/types";

export type AdminOperationalIncidentState = "active" | "recovered";

export interface AdminOperationalIncident {
  dedupeKey: AdminOpsDedupeKey;
  incidentId: string;
  state: AdminOperationalIncidentState;
  severity: AdminNotificationSeverity;
  targetLabel: string;
  openedAt: string;
  recoveredAt?: string;
  lastEvaluatedAt: string;
  /** TTL for recovered incidents (and safety bound for active). */
  expireAt: string;
}

export interface AdminOperationalIncidentStore {
  findByDedupeKey(dedupeKey: AdminOpsDedupeKey): Promise<AdminOperationalIncident | null>;
  upsert(incident: AdminOperationalIncident): Promise<void>;
  clearForTests?(): void;
}

/**
 * Pack 12A — Delegated Editor grants.
 *
 * Editor is NOT an AuthUserAccountRole and NOT Admin Panel access.
 * Identity remains the canonical Participant (memberId).
 * One grant record per Participant; activate/deactivate without deleting.
 */

/** Stable capability IDs — never authorize by display labels. */
export type EditorCapabilityId =
  | "INITIATIVE_EDIT"
  | "INITIATIVE_MODERATE"
  | "PUBLIC_CHOICE_EDIT"
  | "PUBLIC_CHOICE_MODERATE"
  | "PUBLISHING_EDIT"
  | "MEDIA_RESOURCE_EDIT"
  | "COUNTRY_PEOPLE_EDIT"
  | "BETA_ACCESS_EDIT";

export const EDITOR_CAPABILITY_IDS: readonly EditorCapabilityId[] = [
  "INITIATIVE_EDIT",
  "INITIATIVE_MODERATE",
  "PUBLIC_CHOICE_EDIT",
  "PUBLIC_CHOICE_MODERATE",
  "PUBLISHING_EDIT",
  "MEDIA_RESOURCE_EDIT",
  "COUNTRY_PEOPLE_EDIT",
  "BETA_ACCESS_EDIT",
] as const;

/**
 * Pack 12D — capabilities Admin may assign today.
 * PUBLISHING_EDIT remains a reserved ID but is not Editor-operational
 * (BlogCapability is separate); omit from assignable grants until wired.
 */
export const EDITOR_ASSIGNABLE_CAPABILITY_IDS: readonly EditorCapabilityId[] =
  EDITOR_CAPABILITY_IDS.filter((id) => id !== "PUBLISHING_EDIT");

export const EDITOR_CAPABILITY_LABELS: Record<EditorCapabilityId, string> = {
  INITIATIVE_EDIT: "Initiatives",
  INITIATIVE_MODERATE: "Moderate Initiatives",
  PUBLIC_CHOICE_EDIT: "Public Choice",
  PUBLIC_CHOICE_MODERATE: "Moderate Public Choice",
  PUBLISHING_EDIT: "Publishing",
  MEDIA_RESOURCE_EDIT: "Media Resources",
  COUNTRY_PEOPLE_EDIT: "Country Team & Partners",
  BETA_ACCESS_EDIT: "Beta Access",
};

export type EditorGrantStatus = "ACTIVE" | "INACTIVE";

export type EditorGeographicScopeLevel = "WORLD" | "COUNTRY" | "REGION" | "CITY";

/** Canonical geographic editing scope (codes from @hu/geography). */
export interface EditorGeographicScope {
  readonly level: EditorGeographicScopeLevel;
  readonly countryCode?: string;
  readonly regionCode?: string;
  /** Canonical community slug when level is CITY. */
  readonly communityCode?: string;
}

/** Safe presentation of scope for Workspace / Admin (no internal audit IDs). */
export interface EditorGeographicScopePresentation extends EditorGeographicScope {
  readonly levelLabel: string;
  readonly summary: string;
  readonly detail: string;
}

/**
 * Persisted Editor grant — no duplicated profile/auth fields.
 * Resolve displayName/avatar from Participant Profile.
 */
export interface EditorGrantRecord {
  readonly editorGrantId: string;
  readonly participantId: string;
  readonly status: EditorGrantStatus;
  readonly capabilities: readonly EditorCapabilityId[];
  readonly geographicScope: EditorGeographicScope;
  readonly assignedByAdminParticipantId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly activatedAt?: string;
  readonly deactivatedAt?: string;
}

/** Admin table / detail row with Profile identity resolved. */
export interface AdminEditorDirectoryItem {
  readonly editorGrantId: string;
  readonly participantId: string;
  readonly displayName: string;
  readonly uniqueName?: string;
  readonly email: string;
  readonly avatarUrl?: string;
  readonly status: EditorGrantStatus;
  readonly capabilities: readonly EditorCapabilityId[];
  readonly capabilityLabels: readonly string[];
  readonly geographicScope: EditorGeographicScopePresentation;
  readonly assignedByAdminParticipantId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly activatedAt?: string;
  readonly deactivatedAt?: string;
}

/**
 * Pack 12E2 — Admin assign/update/activate/deactivate response.
 * Grant persistence is primary; notificationDelivered reports best-effort notify.
 */
export interface AdminEditorMutationResult extends AdminEditorDirectoryItem {
  readonly notificationDelivered: boolean;
}

export interface AdminEditorDirectoryResponse {
  readonly editors: readonly AdminEditorDirectoryItem[];
  readonly total: number;
  readonly activeCount: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

export interface AdminEditorSummary {
  readonly total: number;
  readonly activeCount: number;
  readonly inactiveCount: number;
}

export interface AssignEditorGrantInput {
  readonly participantId: string;
  readonly capabilities: readonly EditorCapabilityId[];
  readonly geographicScope: EditorGeographicScope;
  readonly status?: EditorGrantStatus;
}

export interface UpdateEditorGrantInput {
  readonly capabilities?: readonly EditorCapabilityId[];
  readonly geographicScope?: EditorGeographicScope;
  readonly status?: EditorGrantStatus;
}

/**
 * Safe viewer projection for authenticated /me (no assignedBy / audit internals).
 * Present when the Participant has an Editor grant record (active or inactive).
 */
export interface EditorViewerProjection {
  readonly isEditor: true;
  readonly status: EditorGrantStatus;
  readonly capabilities: readonly EditorCapabilityId[];
  readonly geographicScope: EditorGeographicScopePresentation;
}

export interface NonEditorViewerProjection {
  readonly isEditor: false;
}

export type EditorViewerState = EditorViewerProjection | NonEditorViewerProjection;

/**
 * Pack 12A — Delegated Editor grants (Participant + grant record, not JWT role).
 * Pack 12B — Workspace Editor Panel routes + dual-auth helpers.
 */

export {
  assertEditorCanMutate,
  assertEditorCapability,
  assertEditorScope,
  isActiveEditorStatus,
  isEditorCapabilityId,
  normalizeEditorCapabilities,
  resolveEditorAuthorizationActor,
} from "./editor-grant.authorization.js";
export {
  activateEditorGrant,
  assignEditorGrant,
  deactivateEditorGrant,
  getAdminEditor,
  getAdminEditorSummary,
  listAdminEditors,
  resolveEditorViewerState,
  updateEditorGrant,
} from "./editor-grant.admin.service.js";
export {
  contentMatchesEditorScope,
  formatEditorGeographicScope,
  normalizeEditorGeographicScope,
  type EditorContentGeography,
} from "./editor-grant.scope.js";
export {
  countEditorGrantsByStatus,
  deleteEditorGrantsByParticipantIds,
  findEditorGrantById,
  findEditorGrantByParticipantId,
  insertEditorGrant,
  listEditorGrants,
  replaceEditorGrant,
} from "./editor-grant.repository.js";
export { default as adminEditorGrantsRouter } from "./editor-grant.admin.routes.js";
export { default as editorPanelRouter } from "./editor-panel.routes.js";
export {
  assertEditorMayMutatePublicChoiceElection,
  getEditorPanel,
  listEditorCountryPeople,
  listEditorInitiatives,
  listEditorMediaResources,
  listEditorPublicChoice,
} from "./editor-panel.service.js";
export {
  blockInitiativeAsEditor,
  blockPublicChoiceCandidateAsEditor,
  unblockInitiativeAsEditor,
  unblockPublicChoiceCandidateAsEditor,
} from "./editor-moderation.service.js";
export {
  assertActiveEditorCapability,
  assertAdminOrEditorCanMutate,
} from "./editor-grant.dual-auth.js";

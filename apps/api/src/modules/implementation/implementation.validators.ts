import type { EvidenceKind, MilestoneRequirementType } from "@hu/types";

import type {
  AddMilestoneInput,
  AddPhaseInput,
  AttachEvidenceInput,
  ImplementationCreateInput,
  ImplementationUpdate,
  RecordAchievementInput,
  UpdateMilestoneInput,
  UpdatePhaseInput,
} from "./implementation.store.js";

const MILESTONE_REQUIREMENT_TYPES = new Set<MilestoneRequirementType>(["Required", "Optional"]);

const EVIDENCE_KINDS = new Set<EvidenceKind>(["Reference", "Attachment", "Link"]);

const IMMUTABLE_PATCH_FIELDS = new Set([
  "implementationId",
  "initiativeId",
  "collectiveDecisionId",
  "petitionId",
  "implementationCommitmentId",
  "status",
  "createdAt",
  "updatedAt",
  "implementationPhases",
  "milestones",
  "achievements",
  "evidence",
  "collectiveProgress",
  "completionAssessment",
  "completion",
  "progressIndicator",
  "completionIndicator",
  "progressSnapshots",
]);

const PATCHABLE_FIELDS = new Set(["subjectTitle", "subjectSummary", "frozenPolicyId"]);

export function validateImplementationId(implementationId: string): string | null {
  if (!implementationId.trim()) {
    return "Implementation identifier is required.";
  }

  return null;
}

export function validateReferenceId(referenceId: string, label: string): string | null {
  if (!referenceId.trim()) {
    return `${label} is required.`;
  }

  return null;
}

export function validatePhaseId(phaseId: string): string | null {
  if (!phaseId.trim()) {
    return "Implementation Phase identifier is required.";
  }

  return null;
}

export function validateMilestoneId(milestoneId: string): string | null {
  if (!milestoneId.trim()) {
    return "Milestone identifier is required.";
  }

  return null;
}

export function validateAchievementId(achievementId: string): string | null {
  if (!achievementId.trim()) {
    return "Achievement identifier is required.";
  }

  return null;
}

export function validatePatchBody(body: Record<string, unknown>): string | null {
  if (Object.keys(body).length === 0) {
    return "At least one patch field is required.";
  }

  for (const key of Object.keys(body)) {
    if (IMMUTABLE_PATCH_FIELDS.has(key)) {
      return `Field "${key}" cannot be modified.`;
    }

    if (!PATCHABLE_FIELDS.has(key)) {
      return `Field "${key}" cannot be modified.`;
    }
  }

  if (body.subjectTitle !== undefined && typeof body.subjectTitle !== "string") {
    return "subjectTitle must be a string.";
  }

  if (body.subjectSummary !== undefined && typeof body.subjectSummary !== "string") {
    return "subjectSummary must be a string.";
  }

  if (body.frozenPolicyId !== undefined && typeof body.frozenPolicyId !== "string") {
    return "frozenPolicyId must be a string.";
  }

  return null;
}

export function validateCreateBody(body: Record<string, unknown>): string | null {
  if (typeof body.implementationId !== "string" || !body.implementationId.trim()) {
    return "implementationId is required.";
  }

  if (typeof body.initiativeId !== "string" || !body.initiativeId.trim()) {
    return "initiativeId is required.";
  }

  if (typeof body.collectiveDecisionId !== "string" || !body.collectiveDecisionId.trim()) {
    return "collectiveDecisionId is required.";
  }

  if (typeof body.petitionId !== "string" || !body.petitionId.trim()) {
    return "petitionId is required.";
  }

  if (
    typeof body.implementationCommitmentId !== "string" ||
    !body.implementationCommitmentId.trim()
  ) {
    return "implementationCommitmentId is required.";
  }

  if (typeof body.subjectTitle !== "string" || !body.subjectTitle.trim()) {
    return "subjectTitle is required.";
  }

  if (typeof body.subjectSummary !== "string" || !body.subjectSummary.trim()) {
    return "subjectSummary is required.";
  }

  if (body.frozenPolicyId !== undefined && typeof body.frozenPolicyId !== "string") {
    return "frozenPolicyId must be a string when provided.";
  }

  if (body.status !== undefined && body.status !== "Planned") {
    return 'status must be "Planned" when creating an Implementation.';
  }

  return null;
}

export function parseCreateInput(body: Record<string, unknown>): ImplementationCreateInput {
  return {
    implementationId: body.implementationId as string,
    initiativeId: body.initiativeId as string,
    collectiveDecisionId: body.collectiveDecisionId as string,
    petitionId: body.petitionId as string,
    implementationCommitmentId: body.implementationCommitmentId as string,
    subjectTitle: body.subjectTitle as string,
    subjectSummary: body.subjectSummary as string,
    frozenPolicyId:
      typeof body.frozenPolicyId === "string" ? body.frozenPolicyId : undefined,
  };
}

export function parsePatchUpdate(body: Record<string, unknown>): ImplementationUpdate {
  const update: ImplementationUpdate = {};

  if (body.subjectTitle !== undefined) {
    update.subjectTitle = body.subjectTitle as string;
  }

  if (body.subjectSummary !== undefined) {
    update.subjectSummary = body.subjectSummary as string;
  }

  if (body.frozenPolicyId !== undefined) {
    update.frozenPolicyId = body.frozenPolicyId as string;
  }

  return update;
}

function validateSequenceOrder(value: unknown, label: string): string | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return `${label} must be a positive integer.`;
  }

  return null;
}

export function validateAddPhaseBody(body: Record<string, unknown>): string | null {
  if (typeof body.implementationPhaseId !== "string" || !body.implementationPhaseId.trim()) {
    return "implementationPhaseId is required.";
  }

  if (typeof body.title !== "string" || !body.title.trim()) {
    return "title is required.";
  }

  if (typeof body.summary !== "string" || !body.summary.trim()) {
    return "summary is required.";
  }

  return validateSequenceOrder(body.sequenceOrder, "sequenceOrder");
}

export function parseAddPhaseInput(body: Record<string, unknown>): AddPhaseInput {
  return {
    implementationPhaseId: body.implementationPhaseId as string,
    title: body.title as string,
    summary: body.summary as string,
    sequenceOrder: body.sequenceOrder as number,
  };
}

export function validateUpdatePhaseBody(body: Record<string, unknown>): string | null {
  if (Object.keys(body).length === 0) {
    return "At least one phase field is required.";
  }

  if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim())) {
    return "title must be a non-empty string when provided.";
  }

  if (body.summary !== undefined && (typeof body.summary !== "string" || !body.summary.trim())) {
    return "summary must be a non-empty string when provided.";
  }

  if (body.sequenceOrder !== undefined) {
    return validateSequenceOrder(body.sequenceOrder, "sequenceOrder");
  }

  if (
    body.status !== undefined ||
    body.implementationPhaseId !== undefined ||
    body.implementationId !== undefined ||
    body.createdAt !== undefined ||
    body.updatedAt !== undefined
  ) {
    return "Derived or immutable phase fields cannot be modified.";
  }

  return null;
}

export function parseUpdatePhaseInput(body: Record<string, unknown>): UpdatePhaseInput {
  const update: UpdatePhaseInput = {};

  if (body.title !== undefined) {
    update.title = body.title as string;
  }

  if (body.summary !== undefined) {
    update.summary = body.summary as string;
  }

  if (body.sequenceOrder !== undefined) {
    update.sequenceOrder = body.sequenceOrder as number;
  }

  return update;
}

export function validateAddMilestoneBody(body: Record<string, unknown>): string | null {
  if (typeof body.milestoneId !== "string" || !body.milestoneId.trim()) {
    return "milestoneId is required.";
  }

  if (typeof body.implementationPhaseId !== "string" || !body.implementationPhaseId.trim()) {
    return "implementationPhaseId is required.";
  }

  if (typeof body.title !== "string" || !body.title.trim()) {
    return "title is required.";
  }

  if (typeof body.description !== "string" || !body.description.trim()) {
    return "description is required.";
  }

  if (
    typeof body.requirementType !== "string" ||
    !MILESTONE_REQUIREMENT_TYPES.has(body.requirementType as MilestoneRequirementType)
  ) {
    return 'requirementType must be "Required" or "Optional".';
  }

  return validateSequenceOrder(body.sequenceOrder, "sequenceOrder");
}

export function parseAddMilestoneInput(body: Record<string, unknown>): AddMilestoneInput {
  return {
    milestoneId: body.milestoneId as string,
    implementationPhaseId: body.implementationPhaseId as string,
    title: body.title as string,
    description: body.description as string,
    requirementType: body.requirementType as MilestoneRequirementType,
    sequenceOrder: body.sequenceOrder as number,
  };
}

export function validateUpdateMilestoneBody(body: Record<string, unknown>): string | null {
  if (Object.keys(body).length === 0) {
    return "At least one milestone field is required.";
  }

  if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim())) {
    return "title must be a non-empty string when provided.";
  }

  if (
    body.description !== undefined &&
    (typeof body.description !== "string" || !body.description.trim())
  ) {
    return "description must be a non-empty string when provided.";
  }

  if (body.requirementType !== undefined) {
    if (
      typeof body.requirementType !== "string" ||
      !MILESTONE_REQUIREMENT_TYPES.has(body.requirementType as MilestoneRequirementType)
    ) {
      return 'requirementType must be "Required" or "Optional" when provided.';
    }
  }

  if (body.sequenceOrder !== undefined) {
    return validateSequenceOrder(body.sequenceOrder, "sequenceOrder");
  }

  if (
    body.status !== undefined ||
    body.satisfiedAt !== undefined ||
    body.milestoneId !== undefined ||
    body.implementationId !== undefined ||
    body.implementationPhaseId !== undefined ||
    body.createdAt !== undefined ||
    body.updatedAt !== undefined
  ) {
    return "Derived or immutable milestone fields cannot be modified.";
  }

  return null;
}

export function parseUpdateMilestoneInput(body: Record<string, unknown>): UpdateMilestoneInput {
  const update: UpdateMilestoneInput = {};

  if (body.title !== undefined) {
    update.title = body.title as string;
  }

  if (body.description !== undefined) {
    update.description = body.description as string;
  }

  if (body.requirementType !== undefined) {
    update.requirementType = body.requirementType as MilestoneRequirementType;
  }

  if (body.sequenceOrder !== undefined) {
    update.sequenceOrder = body.sequenceOrder as number;
  }

  return update;
}

export function validateRecordAchievementBody(body: Record<string, unknown>): string | null {
  if (typeof body.achievementId !== "string" || !body.achievementId.trim()) {
    return "achievementId is required.";
  }

  if (typeof body.milestoneId !== "string" || !body.milestoneId.trim()) {
    return "milestoneId is required.";
  }

  if (typeof body.title !== "string" || !body.title.trim()) {
    return "title is required.";
  }

  if (typeof body.summary !== "string" || !body.summary.trim()) {
    return "summary is required.";
  }

  if (typeof body.recordedByParticipantId !== "string" || !body.recordedByParticipantId.trim()) {
    return "recordedByParticipantId is required.";
  }

  return null;
}

export function parseRecordAchievementInput(body: Record<string, unknown>): RecordAchievementInput {
  return {
    achievementId: body.achievementId as string,
    milestoneId: body.milestoneId as string,
    title: body.title as string,
    summary: body.summary as string,
    recordedByParticipantId: body.recordedByParticipantId as string,
  };
}

function validateEvidenceReference(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "reference must be an object when provided.";
  }

  const reference = value as Record<string, unknown>;

  if (typeof reference.referenceId !== "string" || !reference.referenceId.trim()) {
    return "reference.referenceId is required.";
  }

  if (typeof reference.referenceType !== "string" || !reference.referenceType.trim()) {
    return "reference.referenceType is required.";
  }

  if (typeof reference.displayLabel !== "string" || !reference.displayLabel.trim()) {
    return "reference.displayLabel is required.";
  }

  return null;
}

function validateEvidenceAttachment(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "attachment must be an object when provided.";
  }

  const attachment = value as Record<string, unknown>;

  if (typeof attachment.attachmentId !== "string" || !attachment.attachmentId.trim()) {
    return "attachment.attachmentId is required.";
  }

  if (typeof attachment.mediaType !== "string" || !attachment.mediaType.trim()) {
    return "attachment.mediaType is required.";
  }

  if (typeof attachment.displayLabel !== "string" || !attachment.displayLabel.trim()) {
    return "attachment.displayLabel is required.";
  }

  if (
    attachment.storageReference !== undefined &&
    attachment.storageReference !== null &&
    typeof attachment.storageReference !== "string"
  ) {
    return "attachment.storageReference must be a string or null when provided.";
  }

  return null;
}

function validateEvidenceLink(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "link must be an object when provided.";
  }

  const link = value as Record<string, unknown>;

  if (typeof link.url !== "string" || !link.url.trim()) {
    return "link.url is required.";
  }

  if (typeof link.displayLabel !== "string" || !link.displayLabel.trim()) {
    return "link.displayLabel is required.";
  }

  if (typeof link.linkKind !== "string" || !link.linkKind.trim()) {
    return "link.linkKind is required.";
  }

  return null;
}

export function validateAttachEvidenceBody(body: Record<string, unknown>): string | null {
  if (typeof body.evidenceId !== "string" || !body.evidenceId.trim()) {
    return "evidenceId is required.";
  }

  if (typeof body.evidenceKind !== "string" || !EVIDENCE_KINDS.has(body.evidenceKind as EvidenceKind)) {
    return 'evidenceKind must be "Reference", "Attachment", or "Link".';
  }

  if (typeof body.label !== "string" || !body.label.trim()) {
    return "label is required.";
  }

  const evidenceKind = body.evidenceKind as EvidenceKind;

  if (evidenceKind === "Reference") {
    return validateEvidenceReference(body.reference);
  }

  if (evidenceKind === "Attachment") {
    return validateEvidenceAttachment(body.attachment);
  }

  return validateEvidenceLink(body.link);
}

export function parseAttachEvidenceInput(
  achievementId: string,
  body: Record<string, unknown>,
): AttachEvidenceInput {
  const evidenceKind = body.evidenceKind as EvidenceKind;

  return {
    evidenceId: body.evidenceId as string,
    achievementId,
    evidenceKind,
    label: body.label as string,
    reference: evidenceKind === "Reference" ? (body.reference as AttachEvidenceInput["reference"]) : null,
    attachment:
      evidenceKind === "Attachment" ? (body.attachment as AttachEvidenceInput["attachment"]) : null,
    link: evidenceKind === "Link" ? (body.link as AttachEvidenceInput["link"]) : null,
  };
}

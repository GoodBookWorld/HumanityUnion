import {
  INITIATIVE_PUBLIC_IMPACT_REPORT_SECTION_IDS,
  type InitiativePublicImpactLifecycleDraft,
  type InitiativePublicImpactParticipationStatistics,
  type InitiativePublicImpactReportSection,
  type InitiativePublicImpactReportSectionId,
} from "@hu/types";

import type { InitiativePublicImpactLifecycleDraftUpdate } from "./initiative-public-impact-lifecycle-draft.store.js";

const SECTION_ID_SET = new Set<string>(INITIATIVE_PUBLIC_IMPACT_REPORT_SECTION_IDS);

function assertOptionalString(value: unknown, fieldName: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
}

function assertOptionalNullableString(
  value: unknown,
  fieldName: string,
): asserts value is string | null | undefined {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new Error(`${fieldName} must be a string or null.`);
  }
}

function assertString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
}

function assertStringArray(value: unknown, fieldName: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
}

function assertNonNegativeNumber(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
}

function assertSection(value: unknown, index: number): InitiativePublicImpactReportSection {
  if (!value || typeof value !== "object") {
    throw new Error(`sections[${index}] must be an object.`);
  }

  const record = value as Record<string, unknown>;

  if (typeof record.sectionId !== "string" || !SECTION_ID_SET.has(record.sectionId)) {
    throw new Error(
      `sections[${index}].sectionId must be one of: ${INITIATIVE_PUBLIC_IMPACT_REPORT_SECTION_IDS.join(", ")}.`,
    );
  }

  assertString(record.title, `sections[${index}].title`);
  assertString(record.body, `sections[${index}].body`);
  assertStringArray(record.evidenceReferences, `sections[${index}].evidenceReferences`);

  return {
    sectionId: record.sectionId as InitiativePublicImpactReportSectionId,
    title: record.title as string,
    body: record.body as string,
    evidenceReferences: [...(record.evidenceReferences as string[])],
  };
}

function assertParticipationStatistics(
  value: unknown,
): InitiativePublicImpactParticipationStatistics {
  if (!value || typeof value !== "object") {
    throw new Error("participationStatistics must be an object.");
  }

  const record = value as Record<string, unknown>;
  assertNonNegativeNumber(record.signatureCount, "participationStatistics.signatureCount");
  assertNonNegativeNumber(record.supportCount, "participationStatistics.supportCount");
  assertNonNegativeNumber(record.reactionCount, "participationStatistics.reactionCount");
  assertNonNegativeNumber(record.activeAllyCount, "participationStatistics.activeAllyCount");

  return {
    signatureCount: record.signatureCount as number,
    supportCount: record.supportCount as number,
    reactionCount: record.reactionCount as number,
    activeAllyCount: record.activeAllyCount as number,
  };
}

export function validateSaveInitiativePublicImpactLifecycleDraftInput(
  body: unknown,
): InitiativePublicImpactLifecycleDraftUpdate {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  assertOptionalString(record.title, "title");
  assertOptionalNullableString(record.officialResponsePackageId, "officialResponsePackageId");
  assertOptionalNullableString(record.trackingPackageId, "trackingPackageId");
  assertOptionalNullableString(record.commitmentPackageId, "commitmentPackageId");
  assertOptionalNullableString(record.decisionId, "decisionId");

  if (record.sections !== undefined && !Array.isArray(record.sections)) {
    throw new Error("sections must be an array.");
  }

  const sections = Array.isArray(record.sections)
    ? record.sections.map((section, index) => assertSection(section, index))
    : undefined;

  const participationStatistics =
    record.participationStatistics !== undefined
      ? assertParticipationStatistics(record.participationStatistics)
      : undefined;

  return {
    title: record.title as string | undefined,
    officialResponsePackageId: record.officialResponsePackageId as string | null | undefined,
    trackingPackageId: record.trackingPackageId as string | null | undefined,
    commitmentPackageId: record.commitmentPackageId as string | null | undefined,
    decisionId: record.decisionId as string | null | undefined,
    sections,
    participationStatistics,
  };
}

export function validateInitiativePublicImpactLifecycleDraftForPublication(
  draft: InitiativePublicImpactLifecycleDraft,
): void {
  if (!draft.title.trim()) {
    throw new Error("Public Impact Report title is required.");
  }

  if (!draft.officialResponsePackageId) {
    throw new Error(
      "A published Official Response Package is required before publishing Public Impact.",
    );
  }

  const byId = new Map(draft.sections.map((section) => [section.sectionId, section]));
  const executive = byId.get("executive_summary");
  const evidence = byId.get("evidence");

  if (!executive?.body.trim()) {
    throw new Error("The executive_summary section must be non-empty before publishing.");
  }

  if (!evidence?.body.trim()) {
    throw new Error("The evidence section must be non-empty before publishing.");
  }

  for (const [index, section] of draft.sections.entries()) {
    if (section.body.trim() && section.evidenceReferences.length === 0) {
      throw new Error(
        `Section ${index + 1} (${section.sectionId}) has a body but no evidenceReference — unsupported statements are rejected.`,
      );
    }
  }
}

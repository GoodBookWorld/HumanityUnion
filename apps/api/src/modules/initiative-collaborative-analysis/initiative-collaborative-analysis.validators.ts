import type { InitiativeCollaborativeAnalysis } from "@hu/types";

export interface CreateInitiativeCollaborativeAnalysisDraftInput {
  initiativeId: string;
  title: string;
  summary: string;
  supportingEvidence: string;
  risks: string;
  suggestedImprovements: string;
  references: string;
}

export interface SaveInitiativeCollaborativeAnalysisDraftInput {
  title?: string;
  summary?: string;
  supportingEvidence?: string;
  risks?: string;
  suggestedImprovements?: string;
  references?: string;
}

function normalizeText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeOptionalText(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeText(value, fieldName);
}

export function validateCreateInitiativeCollaborativeAnalysisDraftInput(
  body: unknown,
): CreateInitiativeCollaborativeAnalysisDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  return {
    initiativeId: normalizeText(record.initiativeId, "Initiative"),
    title: normalizeText(record.title, "Analysis title"),
    summary: normalizeText(record.summary, "Summary"),
    supportingEvidence: normalizeText(record.supportingEvidence, "Supporting evidence"),
    risks: normalizeText(record.risks, "Risks"),
    suggestedImprovements: normalizeText(record.suggestedImprovements, "Suggested improvements"),
    references: normalizeText(record.references, "References"),
  };
}

export function validateSaveInitiativeCollaborativeAnalysisDraftInput(
  body: unknown,
): SaveInitiativeCollaborativeAnalysisDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const update: SaveInitiativeCollaborativeAnalysisDraftInput = {};

  const title = normalizeOptionalText(record.title, "Analysis title");
  if (title !== undefined) {
    update.title = title;
  }

  const summary = normalizeOptionalText(record.summary, "Summary");
  if (summary !== undefined) {
    update.summary = summary;
  }

  const supportingEvidence = normalizeOptionalText(
    record.supportingEvidence,
    "Supporting evidence",
  );
  if (supportingEvidence !== undefined) {
    update.supportingEvidence = supportingEvidence;
  }

  const risks = normalizeOptionalText(record.risks, "Risks");
  if (risks !== undefined) {
    update.risks = risks;
  }

  const suggestedImprovements = normalizeOptionalText(
    record.suggestedImprovements,
    "Suggested improvements",
  );
  if (suggestedImprovements !== undefined) {
    update.suggestedImprovements = suggestedImprovements;
  }

  const references = normalizeOptionalText(record.references, "References");
  if (references !== undefined) {
    update.references = references;
  }

  if (Object.keys(update).length === 0) {
    throw new Error("At least one editable field is required.");
  }

  return update;
}

export function validateInitiativeCollaborativeAnalysisForPublication(
  analysis: InitiativeCollaborativeAnalysis,
): void {
  normalizeText(analysis.title, "Analysis title");
  normalizeText(analysis.summary, "Summary");
  normalizeText(analysis.supportingEvidence, "Supporting evidence");
  normalizeText(analysis.risks, "Risks");
  normalizeText(analysis.suggestedImprovements, "Suggested improvements");
  normalizeText(analysis.references, "References");
}

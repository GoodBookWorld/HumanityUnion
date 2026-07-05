import type { DecisionSession } from "@hu/types";

export interface CreateDecisionSessionDraftInput {
  initiativeId: string;
  title: string;
  purpose: string;
  decisionQuestion: string;
  opensAt: string;
  closesAt: string;
}

export interface SaveDecisionSessionDraftInput {
  title?: string;
  purpose?: string;
  decisionQuestion?: string;
  opensAt?: string;
  closesAt?: string;
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

function normalizeIsoDate(value: unknown, fieldName: string): string {
  const normalized = normalizeText(value, fieldName);
  const parsed = Date.parse(normalized);

  if (Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return new Date(parsed).toISOString();
}

function normalizeOptionalIsoDate(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeIsoDate(value, fieldName);
}

export function validateCreateDecisionSessionDraftInput(
  body: unknown,
): CreateDecisionSessionDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  return {
    initiativeId: normalizeText(record.initiativeId, "Initiative"),
    title: normalizeText(record.title, "Title"),
    purpose: normalizeText(record.purpose, "Purpose"),
    decisionQuestion: normalizeText(record.decisionQuestion, "Decision question"),
    opensAt: normalizeIsoDate(record.opensAt, "Opening date"),
    closesAt: normalizeIsoDate(record.closesAt, "Closing date"),
  };
}

export function validateSaveDecisionSessionDraftInput(
  body: unknown,
): SaveDecisionSessionDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const update: SaveDecisionSessionDraftInput = {};

  const title = normalizeOptionalText(record.title, "Title");
  if (title !== undefined) {
    update.title = title;
  }

  const purpose = normalizeOptionalText(record.purpose, "Purpose");
  if (purpose !== undefined) {
    update.purpose = purpose;
  }

  const decisionQuestion = normalizeOptionalText(record.decisionQuestion, "Decision question");
  if (decisionQuestion !== undefined) {
    update.decisionQuestion = decisionQuestion;
  }

  const opensAt = normalizeOptionalIsoDate(record.opensAt, "Opening date");
  if (opensAt !== undefined) {
    update.opensAt = opensAt;
  }

  const closesAt = normalizeOptionalIsoDate(record.closesAt, "Closing date");
  if (closesAt !== undefined) {
    update.closesAt = closesAt;
  }

  if (Object.keys(update).length === 0) {
    throw new Error("At least one editable field is required.");
  }

  return update;
}

export function validateDecisionSessionForPublication(session: DecisionSession): void {
  normalizeText(session.title, "Title");
  normalizeText(session.purpose, "Purpose");
  normalizeText(session.decisionQuestion, "Decision question");

  const opensAt = Date.parse(session.opensAt);
  const closesAt = Date.parse(session.closesAt);

  if (Number.isNaN(opensAt) || Number.isNaN(closesAt)) {
    throw new Error("Opening and closing dates must be valid.");
  }

  if (closesAt <= opensAt) {
    throw new Error("Closing date must be after opening date.");
  }
}

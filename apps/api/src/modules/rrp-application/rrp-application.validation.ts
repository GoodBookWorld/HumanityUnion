import { isRecognizedCountrySlug } from "@hu/geography";
import type {
  AdminRrpApplicationReviewDecision,
  RrpFundingModel,
} from "@hu/types";
import { RRP_FUNDING_MODELS } from "@hu/types";

import {
  RRP_ANNUAL_AMOUNT_CAD_MAX,
  RRP_ANNUAL_AMOUNT_CAD_MIN,
  RRP_CURRENT_CONSENT_VERSION,
  RRP_EXPERIENCE_MAX_LENGTH,
  RRP_LEGAL_NAME_MAX_LENGTH,
  RRP_MOTIVATION_MAX_LENGTH,
  RRP_PROFESSION_MAX_LENGTH,
  RRP_REVIEW_NOTE_MAX_LENGTH,
  RRP_TEAM_MEMBER_COUNT_MAX,
  RRP_TEAM_MEMBER_COUNT_MIN,
} from "./rrp-application.constants.js";
import { RrpApplicationValidationError } from "./rrp-application.errors.js";

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FUNDING_SET = new Set<string>(RRP_FUNDING_MODELS);

const ADMIN_REVIEW_DECISIONS = new Set<AdminRrpApplicationReviewDecision>([
  "mark_under_review",
  "request_information",
  "reject",
]);

/** Stable message when clients attempt legacy status-only approve on /review. */
export const RRP_REVIEW_APPROVE_REJECTED_MESSAGE =
  'decision "approve" is not supported on review. Use POST /api/v1/admin/rrp-applications/:applicationId/confirm-appointment to approve and create the Representative platform designation.' as const;

function requireObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RrpApplicationValidationError("Request body must be an object.");
  }
  return body as Record<string, unknown>;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
  label: string,
): string | null | undefined {
  if (!(key in record)) {
    return undefined;
  }
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new RrpApplicationValidationError(`${label} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new RrpApplicationValidationError(
      `${label} must be at most ${maxLength} characters.`,
    );
  }
  return trimmed;
}

function requireNonEmptyString(
  value: string | null | undefined,
  label: string,
): string {
  if (!value || value.trim().length === 0) {
    throw new RrpApplicationValidationError(`${label} is required.`);
  }
  return value.trim();
}

export function normalizeRrpCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

export function validateRrpCountryCode(value: string, label: string): string {
  const normalized = normalizeRrpCountryCode(value);

  if (!COUNTRY_CODE_PATTERN.test(normalized)) {
    throw new RrpApplicationValidationError(
      `${label} must be a valid ISO 3166-1 alpha-2 code.`,
    );
  }

  if (!isRecognizedCountrySlug(normalized)) {
    throw new RrpApplicationValidationError(
      `${label} must be selected from the approved geography list.`,
    );
  }

  return normalized;
}

/**
 * Exact calendar-date age in whole years (UTC), not approximate year subtraction.
 * On the 18th birthday the age is 18.
 */
export function computeExactAgeYears(
  dateOfBirth: string,
  asOf: Date = new Date(),
): number {
  const match = CALENDAR_DATE_PATTERN.exec(dateOfBirth);
  if (!match) {
    throw new RrpApplicationValidationError(
      "Date of birth must be a valid calendar date (YYYY-MM-DD).",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);

  if (
    Number.isNaN(utc) ||
    new Date(utc).getUTCFullYear() !== year ||
    new Date(utc).getUTCMonth() + 1 !== month ||
    new Date(utc).getUTCDate() !== day
  ) {
    throw new RrpApplicationValidationError(
      "Date of birth must be a real calendar date.",
    );
  }

  const asYear = asOf.getUTCFullYear();
  const asMonth = asOf.getUTCMonth() + 1;
  const asDay = asOf.getUTCDate();

  let age = asYear - year;
  if (asMonth < month || (asMonth === month && asDay < day)) {
    age -= 1;
  }

  return age;
}

export function validateDateOfBirth(
  value: string,
  asOf: Date = new Date(),
): string {
  const match = CALENDAR_DATE_PATTERN.exec(value.trim());
  if (!match) {
    throw new RrpApplicationValidationError(
      "Date of birth must be a valid calendar date (YYYY-MM-DD).",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const reconstructed = new Date(utc);

  if (
    Number.isNaN(utc) ||
    reconstructed.getUTCFullYear() !== year ||
    reconstructed.getUTCMonth() + 1 !== month ||
    reconstructed.getUTCDate() !== day
  ) {
    throw new RrpApplicationValidationError(
      "Date of birth must be a real calendar date.",
    );
  }

  const asUtc = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  if (utc > asUtc) {
    throw new RrpApplicationValidationError("Date of birth cannot be in the future.");
  }

  // Reject impossibly old DOBs (before 1900-01-01).
  if (year < 1900) {
    throw new RrpApplicationValidationError("Date of birth is outside the accepted range.");
  }

  const age = computeExactAgeYears(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    asOf,
  );

  if (age < 18) {
    throw new RrpApplicationValidationError(
      "Applicants must be at least 18 years old.",
    );
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function validateFundingFields(input: {
  fundingModel: RrpFundingModel | null | undefined;
  annualRequestedAmountCad: number | null | undefined;
  requireComplete: boolean;
}): { fundingModel: RrpFundingModel | null; annualRequestedAmountCad: number | null } {
  const model = input.fundingModel ?? null;
  const amount = input.annualRequestedAmountCad ?? null;

  if (input.requireComplete && !model) {
    throw new RrpApplicationValidationError("Funding model is required.");
  }

  if (model === null) {
    if (amount !== null) {
      throw new RrpApplicationValidationError(
        "Annual requested amount must be null when funding model is unset.",
      );
    }
    return { fundingModel: null, annualRequestedAmountCad: null };
  }

  if (model === "SELF") {
    if (amount !== null) {
      throw new RrpApplicationValidationError(
        "Annual requested amount must be null for SELF funding.",
      );
    }
    return { fundingModel: "SELF", annualRequestedAmountCad: null };
  }

  if (amount === null) {
    if (input.requireComplete) {
      throw new RrpApplicationValidationError(
        "Annual requested CAD amount is required for PARTIAL and FULL funding.",
      );
    }
    return { fundingModel: model, annualRequestedAmountCad: null };
  }

  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    Math.round(amount * 100) !== amount * 100
  ) {
    throw new RrpApplicationValidationError(
      "Annual requested CAD amount must be a finite number with at most two decimal places.",
    );
  }

  if (amount < RRP_ANNUAL_AMOUNT_CAD_MIN || amount > RRP_ANNUAL_AMOUNT_CAD_MAX) {
    throw new RrpApplicationValidationError(
      `Annual requested CAD amount must be between ${RRP_ANNUAL_AMOUNT_CAD_MIN} and ${RRP_ANNUAL_AMOUNT_CAD_MAX}.`,
    );
  }

  return { fundingModel: model, annualRequestedAmountCad: amount };
}

function parseFundingModel(
  record: Record<string, unknown>,
): RrpFundingModel | null | undefined {
  if (!("fundingModel" in record)) {
    return undefined;
  }
  const value = record.fundingModel;
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || !FUNDING_SET.has(value)) {
    throw new RrpApplicationValidationError(
      "Funding model must be SELF, PARTIAL, or FULL.",
    );
  }
  return value as RrpFundingModel;
}

function parseAmount(record: Record<string, unknown>): number | null | undefined {
  if (!("annualRequestedAmountCad" in record)) {
    return undefined;
  }
  const value = record.annualRequestedAmountCad;
  if (value === null) {
    return null;
  }
  if (typeof value !== "number") {
    throw new RrpApplicationValidationError(
      "Annual requested CAD amount must be a number or null.",
    );
  }
  return value;
}

function parseTeamCount(record: Record<string, unknown>): number | null | undefined {
  if (!("teamMemberCount" in record)) {
    return undefined;
  }
  const value = record.teamMemberCount;
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new RrpApplicationValidationError("Team member count must be an integer.");
  }
  if (value < RRP_TEAM_MEMBER_COUNT_MIN || value > RRP_TEAM_MEMBER_COUNT_MAX) {
    throw new RrpApplicationValidationError(
      `Team member count must be between ${RRP_TEAM_MEMBER_COUNT_MIN} and ${RRP_TEAM_MEMBER_COUNT_MAX}.`,
    );
  }
  return value;
}

export function parseExpectedRevision(record: Record<string, unknown>, required: boolean): number | undefined {
  if (!("expectedRevision" in record)) {
    if (required) {
      throw new RrpApplicationValidationError("expectedRevision is required.");
    }
    return undefined;
  }
  const value = record.expectedRevision;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new RrpApplicationValidationError(
      "expectedRevision must be a positive integer.",
    );
  }
  return value;
}

function parseCountry(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string | null | undefined {
  if (!(key in record)) {
    return undefined;
  }
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new RrpApplicationValidationError(`${label} must be a string.`);
  }
  if (value.trim().length === 0) {
    return null;
  }
  return validateRrpCountryCode(value, label);
}

export interface RrpApplicationDraftFields {
  legalFirstName?: string | null;
  legalLastName?: string | null;
  profession?: string | null;
  residenceCountryCode?: string | null;
  representCountryCode?: string;
  dateOfBirth?: string | null;
  fundingModel?: RrpFundingModel | null;
  annualRequestedAmountCad?: number | null;
  teamMemberCount?: number | null;
  relevantExperience?: string | null;
  motivation?: string | null;
}

export interface RrpCreateDraftInput extends RrpApplicationDraftFields {
  representCountryCode: string;
}

export interface RrpUpdateDraftInput extends RrpApplicationDraftFields {
  expectedRevision: number;
}

export interface RrpSubmitInput {
  expectedRevision: number;
  consentAccepted: true;
  consentVersion: string;
}

export function validateCreateDraftBody(body: unknown): RrpCreateDraftInput {
  const record = requireObject(body);
  const representRaw = record.representCountryCode;
  if (typeof representRaw !== "string" || representRaw.trim().length === 0) {
    throw new RrpApplicationValidationError(
      "Representation country is required to create a draft.",
    );
  }

  const representCountryCode = validateRrpCountryCode(
    representRaw,
    "Representation country",
  );

  const legalFirstName = readOptionalString(
    record,
    "legalFirstName",
    RRP_LEGAL_NAME_MAX_LENGTH,
    "Legal first name",
  );
  const legalLastName = readOptionalString(
    record,
    "legalLastName",
    RRP_LEGAL_NAME_MAX_LENGTH,
    "Legal last name",
  );
  const profession = readOptionalString(
    record,
    "profession",
    RRP_PROFESSION_MAX_LENGTH,
    "Profession",
  );
  const residenceCountryCode = parseCountry(
    record,
    "residenceCountryCode",
    "Residence country",
  );
  const dateOfBirthRaw = readOptionalString(record, "dateOfBirth", 32, "Date of birth");
  const dateOfBirth =
    dateOfBirthRaw === undefined
      ? undefined
      : dateOfBirthRaw === null
        ? null
        : validateDateOfBirth(dateOfBirthRaw);

  const fundingModel = parseFundingModel(record);
  const annualRequestedAmountCad = parseAmount(record);
  const funding =
    fundingModel === undefined && annualRequestedAmountCad === undefined
      ? undefined
      : validateFundingFields({
          fundingModel: fundingModel ?? null,
          annualRequestedAmountCad: annualRequestedAmountCad ?? null,
          requireComplete: false,
        });

  const teamMemberCount = parseTeamCount(record);
  const relevantExperience = readOptionalString(
    record,
    "relevantExperience",
    RRP_EXPERIENCE_MAX_LENGTH,
    "Relevant experience",
  );
  const motivation = readOptionalString(
    record,
    "motivation",
    RRP_MOTIVATION_MAX_LENGTH,
    "Motivation",
  );

  return {
    representCountryCode,
    ...(legalFirstName !== undefined ? { legalFirstName } : {}),
    ...(legalLastName !== undefined ? { legalLastName } : {}),
    ...(profession !== undefined ? { profession } : {}),
    ...(residenceCountryCode !== undefined ? { residenceCountryCode } : {}),
    ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
    ...(funding
      ? {
          fundingModel: funding.fundingModel,
          annualRequestedAmountCad: funding.annualRequestedAmountCad,
        }
      : {}),
    ...(teamMemberCount !== undefined ? { teamMemberCount } : {}),
    ...(relevantExperience !== undefined ? { relevantExperience } : {}),
    ...(motivation !== undefined ? { motivation } : {}),
  };
}

export function validateUpdateDraftBody(body: unknown): RrpUpdateDraftInput {
  const record = requireObject(body);
  const expectedRevision = parseExpectedRevision(record, true)!;
  const patch: RrpUpdateDraftInput = { expectedRevision };

  if ("representCountryCode" in record) {
    if (typeof record.representCountryCode !== "string") {
      throw new RrpApplicationValidationError("Representation country must be a string.");
    }
    patch.representCountryCode = validateRrpCountryCode(
      record.representCountryCode,
      "Representation country",
    );
  }

  if ("legalFirstName" in record) {
    patch.legalFirstName =
      readOptionalString(record, "legalFirstName", RRP_LEGAL_NAME_MAX_LENGTH, "Legal first name") ??
      null;
  }
  if ("legalLastName" in record) {
    patch.legalLastName =
      readOptionalString(record, "legalLastName", RRP_LEGAL_NAME_MAX_LENGTH, "Legal last name") ??
      null;
  }
  if ("profession" in record) {
    patch.profession =
      readOptionalString(record, "profession", RRP_PROFESSION_MAX_LENGTH, "Profession") ?? null;
  }
  if ("residenceCountryCode" in record) {
    patch.residenceCountryCode =
      parseCountry(record, "residenceCountryCode", "Residence country") ?? null;
  }
  if ("dateOfBirth" in record) {
    const dateOfBirthRaw = readOptionalString(record, "dateOfBirth", 32, "Date of birth");
    patch.dateOfBirth =
      dateOfBirthRaw === null || dateOfBirthRaw === undefined
        ? null
        : validateDateOfBirth(dateOfBirthRaw);
  }

  if ("fundingModel" in record || "annualRequestedAmountCad" in record) {
    const funding = validateFundingFields({
      fundingModel: parseFundingModel(record) ?? null,
      annualRequestedAmountCad: parseAmount(record) ?? null,
      requireComplete: false,
    });
    patch.fundingModel = funding.fundingModel;
    patch.annualRequestedAmountCad = funding.annualRequestedAmountCad;
  }

  if ("teamMemberCount" in record) {
    patch.teamMemberCount = parseTeamCount(record) ?? null;
  }
  if ("relevantExperience" in record) {
    patch.relevantExperience =
      readOptionalString(
        record,
        "relevantExperience",
        RRP_EXPERIENCE_MAX_LENGTH,
        "Relevant experience",
      ) ?? null;
  }
  if ("motivation" in record) {
    patch.motivation =
      readOptionalString(record, "motivation", RRP_MOTIVATION_MAX_LENGTH, "Motivation") ?? null;
  }

  return patch;
}

export function validateSubmitBody(body: unknown): RrpSubmitInput {
  const record = requireObject(body);
  const expectedRevision = parseExpectedRevision(record, true)!;

  if (record.consentAccepted !== true) {
    throw new RrpApplicationValidationError(
      "Explicit consent acceptance is required to submit.",
    );
  }

  if (typeof record.consentVersion !== "string" || record.consentVersion.trim().length === 0) {
    throw new RrpApplicationValidationError("Consent version is required.");
  }

  const consentVersion = record.consentVersion.trim();
  if (consentVersion !== RRP_CURRENT_CONSENT_VERSION) {
    throw new RrpApplicationValidationError(
      `Consent version must be ${RRP_CURRENT_CONSENT_VERSION}.`,
    );
  }

  return { expectedRevision, consentAccepted: true, consentVersion };
}

/** Full submission field requirements against a merged application snapshot. */
export function assertSubmissionFieldsComplete(
  record: {
    legalFirstName: string | null;
    legalLastName: string | null;
    profession: string | null;
    residenceCountryCode: string | null;
    representCountryCode: string;
    dateOfBirth: string | null;
    fundingModel: RrpFundingModel | null;
    annualRequestedAmountCad: number | null;
    teamMemberCount: number | null;
    relevantExperience: string | null;
    motivation: string | null;
  },
  asOf: Date = new Date(),
): void {
  requireNonEmptyString(record.legalFirstName, "Legal first name");
  requireNonEmptyString(record.legalLastName, "Legal last name");
  requireNonEmptyString(record.profession, "Profession");
  requireNonEmptyString(record.residenceCountryCode, "Residence country");
  validateRrpCountryCode(record.residenceCountryCode!, "Residence country");
  validateRrpCountryCode(record.representCountryCode, "Representation country");
  requireNonEmptyString(record.dateOfBirth, "Date of birth");
  validateDateOfBirth(record.dateOfBirth!, asOf);
  validateFundingFields({
    fundingModel: record.fundingModel,
    annualRequestedAmountCad: record.annualRequestedAmountCad,
    requireComplete: true,
  });
  if (record.teamMemberCount === null || record.teamMemberCount === undefined) {
    throw new RrpApplicationValidationError("Team member count is required.");
  }
  if (
    !Number.isInteger(record.teamMemberCount) ||
    record.teamMemberCount < RRP_TEAM_MEMBER_COUNT_MIN ||
    record.teamMemberCount > RRP_TEAM_MEMBER_COUNT_MAX
  ) {
    throw new RrpApplicationValidationError(
      `Team member count must be between ${RRP_TEAM_MEMBER_COUNT_MIN} and ${RRP_TEAM_MEMBER_COUNT_MAX}.`,
    );
  }
  requireNonEmptyString(record.relevantExperience, "Relevant experience");
  requireNonEmptyString(record.motivation, "Motivation");
}

export function validateAdminReviewBody(body: unknown): {
  decision: AdminRrpApplicationReviewDecision;
  expectedRevision: number;
  note: string | null;
} {
  const record = requireObject(body);
  const expectedRevision = parseExpectedRevision(record, true)!;

  if (typeof record.decision !== "string") {
    throw new RrpApplicationValidationError(
      "decision must be mark_under_review, request_information, or reject.",
    );
  }

  if (record.decision === "approve") {
    throw new RrpApplicationValidationError(RRP_REVIEW_APPROVE_REJECTED_MESSAGE, 422);
  }

  if (!ADMIN_REVIEW_DECISIONS.has(record.decision as AdminRrpApplicationReviewDecision)) {
    throw new RrpApplicationValidationError(
      "decision must be mark_under_review, request_information, or reject.",
    );
  }

  const decision = record.decision as AdminRrpApplicationReviewDecision;
  let note: string | null = null;

  if ("note" in record && record.note !== null && record.note !== undefined) {
    if (typeof record.note !== "string") {
      throw new RrpApplicationValidationError("note must be a string.");
    }
    const trimmed = record.note.trim();
    if (trimmed.length > RRP_REVIEW_NOTE_MAX_LENGTH) {
      throw new RrpApplicationValidationError(
        `note must be at most ${RRP_REVIEW_NOTE_MAX_LENGTH} characters.`,
      );
    }
    note = trimmed.length > 0 ? trimmed : null;
  }

  if (decision === "request_information" && !note) {
    throw new RrpApplicationValidationError(
      "note is required when requesting more information.",
    );
  }

  if (decision === "reject" && !note) {
    throw new RrpApplicationValidationError("note is required when rejecting an application.");
  }

  return { decision, expectedRevision, note };
}

export function clampAdminListLimit(raw: unknown): number {
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 25;
  }
  return Math.min(Math.floor(parsed), 100);
}

export function clampAdminListOffset(raw: unknown): number {
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

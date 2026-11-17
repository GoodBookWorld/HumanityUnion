import { isRecognizedCountrySlug, normalizeCountryInput } from "@hu/geography";
import {
  RRP_APPLICATION_ACTIVE_STATUSES,
  type RrpApplicationDetail,
  type RrpApplicationStatus,
  type RrpFundingModel,
} from "@hu/types";

export interface RrpApplicationFormState {
  legalFirstName: string;
  legalLastName: string;
  profession: string;
  residenceCountryCode: string;
  representCountryCode: string;
  dateOfBirth: string;
  fundingModel: RrpFundingModel | "";
  annualRequestedAmountCad: string;
  teamMemberCount: string;
  relevantExperience: string;
  motivation: string;
  consentAccepted: boolean;
}

export const EMPTY_RRP_APPLICATION_FORM: RrpApplicationFormState = {
  legalFirstName: "",
  legalLastName: "",
  profession: "",
  residenceCountryCode: "",
  representCountryCode: "",
  dateOfBirth: "",
  fundingModel: "",
  annualRequestedAmountCad: "",
  teamMemberCount: "0",
  relevantExperience: "",
  motivation: "",
  consentAccepted: false,
};

const ACTIVE = new Set<string>(RRP_APPLICATION_ACTIVE_STATUSES);

export function isRrpApplicationActiveStatus(status: RrpApplicationStatus): boolean {
  return ACTIVE.has(status);
}

export function isRrpApplicationEditableStatus(status: RrpApplicationStatus): boolean {
  return status === "draft" || status === "information_requested";
}

/**
 * Compact widget / hub ordering: active applications first (newest updated),
 * then terminal history (newest updated). Does not mutate the input array.
 */
export function partitionRrpApplicationsForDisplay(
  applications: readonly RrpApplicationDetail[],
): {
  active: RrpApplicationDetail[];
  history: RrpApplicationDetail[];
} {
  const byUpdatedDesc = (left: RrpApplicationDetail, right: RrpApplicationDetail) =>
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  const active = applications
    .filter((item) => isRrpApplicationActiveStatus(item.status))
    .slice()
    .sort(byUpdatedDesc);
  const history = applications
    .filter((item) => !isRrpApplicationActiveStatus(item.status))
    .slice()
    .sort(byUpdatedDesc);
  return { active, history };
}

export function formStateFromRrpApplication(
  application: RrpApplicationDetail,
): RrpApplicationFormState {
  return {
    legalFirstName: application.legalFirstName ?? "",
    legalLastName: application.legalLastName ?? "",
    profession: application.profession ?? "",
    residenceCountryCode: application.residenceCountryCode ?? "",
    representCountryCode: application.representCountryCode,
    dateOfBirth: application.dateOfBirth ?? "",
    fundingModel: application.fundingModel ?? "",
    annualRequestedAmountCad:
      application.annualRequestedAmountCad === null ||
      application.annualRequestedAmountCad === undefined
        ? ""
        : String(application.annualRequestedAmountCad),
    teamMemberCount:
      application.teamMemberCount === null || application.teamMemberCount === undefined
        ? "0"
        : String(application.teamMemberCount),
    relevantExperience: application.relevantExperience ?? "",
    motivation: application.motivation ?? "",
    consentAccepted: false,
  };
}

/** Compare editable fields; consent is included so an unchecked→checked change counts. */
export function isRrpApplicationFormDirty(
  form: RrpApplicationFormState,
  baseline: RrpApplicationFormState | null,
): boolean {
  if (!baseline) {
    return false;
  }
  const keys: (keyof RrpApplicationFormState)[] = [
    "legalFirstName",
    "legalLastName",
    "profession",
    "residenceCountryCode",
    "representCountryCode",
    "dateOfBirth",
    "fundingModel",
    "annualRequestedAmountCad",
    "teamMemberCount",
    "relevantExperience",
    "motivation",
    "consentAccepted",
  ];
  return keys.some((key) => form[key] !== baseline[key]);
}

/** Exact calendar-date age (UTC), matching API enforcement. */
export function computeExactAgeYears(dateOfBirth: string, asOf: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth.trim());
  if (!match) {
    return null;
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
    return null;
  }
  let age = asOf.getUTCFullYear() - year;
  const asMonth = asOf.getUTCMonth() + 1;
  const asDay = asOf.getUTCDate();
  if (asMonth < month || (asMonth === month && asDay < day)) {
    age -= 1;
  }
  return age;
}

export function isValidAdultDateOfBirth(dateOfBirth: string, asOf: Date = new Date()): boolean {
  const age = computeExactAgeYears(dateOfBirth, asOf);
  if (age === null) {
    return false;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth.trim());
  if (!match) {
    return false;
  }
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  if (utc > today) {
    return false;
  }
  return age >= 18;
}

export function resolvePrefillResidenceCountryCode(raw: string | null | undefined): string {
  const normalized = normalizeCountryInput(raw ?? undefined);
  if (!normalized || !isRecognizedCountrySlug(normalized)) {
    return "";
  }
  return normalized;
}

export function buildRrpDraftPayload(form: RrpApplicationFormState): {
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
} {
  const fundingModel = form.fundingModel || null;
  let annualRequestedAmountCad: number | null = null;
  if (fundingModel === "PARTIAL" || fundingModel === "FULL") {
    const parsed = Number(form.annualRequestedAmountCad);
    annualRequestedAmountCad = Number.isFinite(parsed) ? parsed : null;
  }

  const teamRaw = form.teamMemberCount.trim();
  const teamMemberCount = teamRaw === "" ? null : Number.parseInt(teamRaw, 10);

  return {
    legalFirstName: form.legalFirstName.trim() || null,
    legalLastName: form.legalLastName.trim() || null,
    profession: form.profession.trim() || null,
    residenceCountryCode: form.residenceCountryCode.trim() || null,
    representCountryCode: form.representCountryCode.trim().toUpperCase(),
    dateOfBirth: form.dateOfBirth.trim() || null,
    fundingModel,
    annualRequestedAmountCad,
    teamMemberCount:
      teamMemberCount !== null && Number.isInteger(teamMemberCount) ? teamMemberCount : null,
    relevantExperience: form.relevantExperience.trim() || null,
    motivation: form.motivation.trim() || null,
  };
}

export type RrpClientValidationIssue =
  | "representCountry"
  | "legalFirstName"
  | "legalLastName"
  | "profession"
  | "residenceCountry"
  | "dateOfBirth"
  | "fundingModel"
  | "annualAmount"
  | "teamMemberCount"
  | "relevantExperience"
  | "motivation"
  | "consent";

export function validateRrpApplicationFormForSubmit(
  form: RrpApplicationFormState,
): RrpClientValidationIssue | null {
  if (!form.representCountryCode.trim()) return "representCountry";
  if (!form.legalFirstName.trim()) return "legalFirstName";
  if (!form.legalLastName.trim()) return "legalLastName";
  if (!form.profession.trim()) return "profession";
  if (!form.residenceCountryCode.trim()) return "residenceCountry";
  if (!isValidAdultDateOfBirth(form.dateOfBirth)) return "dateOfBirth";
  if (!form.fundingModel) return "fundingModel";
  if (form.fundingModel === "SELF" && form.annualRequestedAmountCad.trim() !== "") {
    return "annualAmount";
  }
  if (form.fundingModel === "PARTIAL" || form.fundingModel === "FULL") {
    const amount = Number(form.annualRequestedAmountCad);
    if (!Number.isFinite(amount) || amount < 1) return "annualAmount";
  }
  const team = Number.parseInt(form.teamMemberCount, 10);
  if (!Number.isInteger(team) || team < 0) return "teamMemberCount";
  if (!form.relevantExperience.trim()) return "relevantExperience";
  if (!form.motivation.trim()) return "motivation";
  if (!form.consentAccepted) return "consent";
  return null;
}

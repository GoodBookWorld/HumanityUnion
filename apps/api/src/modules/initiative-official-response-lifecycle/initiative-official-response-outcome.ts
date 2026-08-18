import type {
  InitiativeOfficialResponseNoResponseDetail,
  InitiativeOfficialResponseOutcomeKind,
} from "@hu/types";

export function emptyOfficialResponseNoResponseDetail(): InitiativeOfficialResponseNoResponseDetail {
  return {
    contactedOrganizations: [],
    contactedDates: [],
    note: "",
  };
}

export function normalizeOfficialResponseOutcomeKind(
  value: InitiativeOfficialResponseOutcomeKind | undefined,
  _candidateCount: number,
): InitiativeOfficialResponseOutcomeKind {
  if (value === "no_official_response_received" || value === "responses_received") {
    return value;
  }

  return "responses_received";
}

import type {
  TerminologyConcept,
  TerminologyConceptStatus,
  TerminologyConceptUpdateInput,
  TerminologyGlossaryAdminListResponse,
  TerminologyLocaleTranslation,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

const ADMIN_TERMINOLOGY_GLOSSARY_PATH = "/api/v1/admin/terminology-glossary";

export type AdminTerminologyGlossaryPatchInput = TerminologyConceptUpdateInput;

export async function fetchAdminTerminologyGlossary(): Promise<TerminologyGlossaryAdminListResponse> {
  return apiRequest<TerminologyGlossaryAdminListResponse>(ADMIN_TERMINOLOGY_GLOSSARY_PATH);
}

export async function fetchAdminTerminologyConcept(
  conceptId: string,
): Promise<TerminologyConcept> {
  return apiRequest<TerminologyConcept>(
    `${ADMIN_TERMINOLOGY_GLOSSARY_PATH}/${encodeURIComponent(conceptId)}`,
  );
}

export async function updateAdminTerminologyConcept(
  conceptId: string,
  input: AdminTerminologyGlossaryPatchInput,
): Promise<TerminologyConcept> {
  return apiRequest<TerminologyConcept>(
    `${ADMIN_TERMINOLOGY_GLOSSARY_PATH}/${encodeURIComponent(conceptId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export type { TerminologyConcept, TerminologyConceptStatus, TerminologyLocaleTranslation };

/**
 * In-memory Terminology Glossary store for tests and non-Mongo local runs.
 */

import type { TerminologyConcept } from "@hu/types";

const byConceptId = new Map<string, TerminologyConcept>();

export function resetTerminologyGlossaryMemoryForTests(): void {
  byConceptId.clear();
}

export function listTerminologyGlossaryMemory(): TerminologyConcept[] {
  return Array.from(byConceptId.values(), (record) => structuredClone(record)).sort((a, b) =>
    a.conceptId.localeCompare(b.conceptId),
  );
}

export function getTerminologyGlossaryByIdMemory(
  conceptId: string,
): TerminologyConcept | null {
  const found = byConceptId.get(conceptId.trim());
  return found ? structuredClone(found) : null;
}

export function upsertTerminologyGlossaryMemory(
  record: TerminologyConcept,
): TerminologyConcept {
  byConceptId.set(record.conceptId, structuredClone(record));
  return structuredClone(record);
}

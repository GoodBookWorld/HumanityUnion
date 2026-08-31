/**
 * Production Completion Pack 02F Task 02 — Terminology Glossary repository.
 *
 * Mongo-backed with memory adapter for tests.
 * Bootstrap is idempotent; Admin-managed translations/status are preserved.
 */

import type { TerminologyConcept, TerminologyConceptUpdateInput } from "@hu/types";
import { isInitiativeLifecycleStageId } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  TerminologyGlossaryConflictError,
  TerminologyGlossaryError,
  TerminologyGlossaryNotFoundError,
  TerminologyGlossaryPersistenceError,
  TerminologyGlossaryValidationError,
} from "./terminology-glossary.errors.js";
import {
  assertGlossaryAliasIntegrity,
  assertTerminologyStatus,
  sortTerminologyConcepts,
} from "./terminology-glossary.integrity.js";
import { canonicalizeGlossaryTranslationLocales } from "./terminology-glossary.locale.js";
import {
  getTerminologyGlossaryByIdMemory,
  listTerminologyGlossaryMemory,
  resetTerminologyGlossaryMemoryForTests,
  upsertTerminologyGlossaryMemory,
} from "./terminology-glossary.memory.store.js";
import {
  fromTerminologyGlossaryMongoDocument,
  toTerminologyGlossaryMongoDocument,
  type TerminologyGlossaryMongoDocument,
} from "./terminology-glossary.mongo-document.js";
import {
  TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS,
  buildTerminologyConceptFromSeed,
  getTerminologyGlossarySeedDefinition,
  isSeededTerminologyConceptId,
  reconcileSeededImmutableMetadata,
} from "./terminology-glossary.seed.js";

let forceMemoryForTests = false;
let mongoSeedPromise: Promise<TerminologyGlossarySeedResult> | null = null;

export interface TerminologyGlossarySeedResult {
  readonly inserted: number;
  readonly skippedExisting: number;
  readonly reconciled: number;
  readonly conceptIds: readonly string[];
}

export function setTerminologyGlossaryForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetTerminologyGlossaryStoreForTests(): void {
  resetTerminologyGlossaryMemoryForTests();
  mongoSeedPromise = null;
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new TerminologyGlossaryPersistenceError("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<TerminologyGlossaryMongoDocument>(
    MONGO_COLLECTIONS.terminologyGlossary,
  );
}

function assertSeedLinkedRefs(): void {
  for (const definition of TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS) {
    const stageId = definition.linkedRefs?.stageId;
    if (stageId !== undefined && !isInitiativeLifecycleStageId(stageId)) {
      throw new TerminologyGlossaryValidationError(
        `Seed concept "${definition.conceptId}" has invalid stageId "${stageId}".`,
      );
    }
  }
}

async function listAllRecordsInternal(): Promise<TerminologyConcept[]> {
  if (shouldUseMemoryAdapter()) {
    return listTerminologyGlossaryMemory();
  }
  await ensureMongoReady();
  const docs = await collection().find({}).toArray();
  return docs.map((doc) => fromTerminologyGlossaryMongoDocument(doc));
}

export async function listTerminologyConcepts(): Promise<TerminologyConcept[]> {
  try {
    await ensureTerminologyGlossarySeeded();
    return sortTerminologyConcepts(await listAllRecordsInternal());
  } catch (error) {
    if (error instanceof TerminologyGlossaryError) {
      throw error;
    }
    throw new TerminologyGlossaryPersistenceError("Failed to list terminology glossary.", error);
  }
}

export async function getTerminologyConceptById(
  conceptId: string,
): Promise<TerminologyConcept | null> {
  const id = conceptId.trim();
  if (!id) {
    return null;
  }

  await ensureTerminologyGlossarySeeded();

  if (shouldUseMemoryAdapter()) {
    return getTerminologyGlossaryByIdMemory(id);
  }

  try {
    await ensureMongoReady();
    const doc = await collection().findOne({ conceptId: id });
    return doc ? fromTerminologyGlossaryMongoDocument(doc) : null;
  } catch (error) {
    throw new TerminologyGlossaryPersistenceError(
      "Failed to load terminology glossary concept.",
      error,
    );
  }
}

/**
 * Update mutable presentation fields only.
 * conceptId / canonicalEnglishTerm / category / linkedRefs are immutable here.
 */
export async function updateTerminologyConcept(
  conceptId: string,
  input: TerminologyConceptUpdateInput,
): Promise<TerminologyConcept> {
  const id = conceptId.trim();
  if (!id) {
    throw new TerminologyGlossaryValidationError("conceptId is required.");
  }
  if (!isSeededTerminologyConceptId(id)) {
    throw new TerminologyGlossaryNotFoundError(
      `Terminology concept not found: ${id}`,
    );
  }

  await ensureTerminologyGlossarySeeded();

  let current: TerminologyConcept | null;
  if (shouldUseMemoryAdapter()) {
    current = getTerminologyGlossaryByIdMemory(id);
  } else {
    await ensureMongoReady();
    const doc = await collection().findOne({ conceptId: id });
    current = doc ? fromTerminologyGlossaryMongoDocument(doc) : null;
  }

  if (!current) {
    throw new TerminologyGlossaryNotFoundError(`Terminology concept not found: ${id}`);
  }

  const nextStatus =
    input.status !== undefined ? assertTerminologyStatus(input.status) : current.status;

  let nextTranslations = { ...current.translations };
  if (input.translations !== undefined) {
    // Merge by locale — PATCHing one locale must not erase others.
    const patchTranslations = await canonicalizeGlossaryTranslationLocales(input.translations);
    nextTranslations = {
      ...current.translations,
      ...patchTranslations,
    };
  }

  const others = (await listAllRecordsInternal()).filter((row) => row.conceptId !== id);
  assertGlossaryAliasIntegrity({
    conceptId: id,
    translations: nextTranslations,
    allConcepts: [...others, current],
  });

  const next: TerminologyConcept = {
    ...current,
    // Immutable code-owned identity
    conceptId: current.conceptId,
    canonicalEnglishTerm: current.canonicalEnglishTerm,
    category: current.category,
    ...(current.linkedRefs ? { linkedRefs: { ...current.linkedRefs } } : {}),
    translations: nextTranslations,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    updatedByParticipantId:
      input.updatedByParticipantId !== undefined
        ? input.updatedByParticipantId
        : current.updatedByParticipantId,
  };

  if (shouldUseMemoryAdapter()) {
    return upsertTerminologyGlossaryMemory(next);
  }

  try {
    await ensureMongoReady();
    await collection().replaceOne(
      { conceptId: id },
      toTerminologyGlossaryMongoDocument(next),
      { upsert: false },
    );
    return next;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/duplicate key|E11000/i.test(message)) {
      throw new TerminologyGlossaryConflictError(
        "Terminology glossary unique constraint violated (conceptId).",
      );
    }
    throw new TerminologyGlossaryPersistenceError(
      "Failed to update terminology glossary concept.",
      error,
    );
  }
}

/**
 * Idempotent bootstrap for seeded concepts.
 * Existing rows keep Admin translations/status; immutable seed metadata may reconcile.
 */
export async function ensureTerminologyGlossarySeeded(): Promise<TerminologyGlossarySeedResult> {
  assertSeedLinkedRefs();

  if (shouldUseMemoryAdapter()) {
    let inserted = 0;
    let skippedExisting = 0;
    let reconciled = 0;
    const nowIso = new Date().toISOString();

    for (const definition of TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS) {
      const existing = getTerminologyGlossaryByIdMemory(definition.conceptId);
      if (!existing) {
        upsertTerminologyGlossaryMemory(buildTerminologyConceptFromSeed(definition));
        inserted += 1;
        continue;
      }

      const next = reconcileSeededImmutableMetadata(existing, definition, nowIso);
      if (next !== existing) {
        upsertTerminologyGlossaryMemory(next);
        reconciled += 1;
      } else {
        skippedExisting += 1;
      }
    }

    return {
      inserted,
      skippedExisting,
      reconciled,
      conceptIds: TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.map((d) => d.conceptId),
    };
  }

  if (!mongoSeedPromise) {
    mongoSeedPromise = (async () => {
      try {
        await ensureMongoReady();
        let inserted = 0;
        let skippedExisting = 0;
        let reconciled = 0;
        const nowIso = new Date().toISOString();

        for (const definition of TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS) {
          const existingDoc = await collection().findOne({ conceptId: definition.conceptId });
          if (!existingDoc) {
            const seed = buildTerminologyConceptFromSeed(definition);
            await collection().insertOne(toTerminologyGlossaryMongoDocument(seed));
            inserted += 1;
            continue;
          }

          const existing = fromTerminologyGlossaryMongoDocument(existingDoc);
          const next = reconcileSeededImmutableMetadata(existing, definition, nowIso);
          if (
            next.canonicalEnglishTerm !== existing.canonicalEnglishTerm ||
            next.category !== existing.category ||
            JSON.stringify(next.linkedRefs ?? null) !== JSON.stringify(existing.linkedRefs ?? null)
          ) {
            await collection().replaceOne(
              { conceptId: definition.conceptId },
              toTerminologyGlossaryMongoDocument(next),
              { upsert: false },
            );
            reconciled += 1;
          } else {
            skippedExisting += 1;
          }
        }

        return {
          inserted,
          skippedExisting,
          reconciled,
          conceptIds: TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS.map((d) => d.conceptId),
        };
      } catch (error) {
        mongoSeedPromise = null;
        if (
          error instanceof TerminologyGlossaryConflictError ||
          error instanceof TerminologyGlossaryValidationError
        ) {
          throw error;
        }
        throw new TerminologyGlossaryPersistenceError(
          "Failed to seed terminology glossary.",
          error,
        );
      }
    })();
  }

  return mongoSeedPromise;
}

export function getSeededTerminologyConceptDefinition(conceptId: string) {
  return getTerminologyGlossarySeedDefinition(conceptId);
}

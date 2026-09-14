/**
 * Simplification Step 04A/04C — client cache for controlled preferredTerms.
 * Presentation locale → published Terminology Glossary preferredTerm maps.
 */

import { API_BASE_URL } from "../../lib/api-base-url";

export const CONTROLLED_LIFECYCLE_PREFERRED_TERMS_CACHE_TTL_MS = 30_000;

type PreferredTermsByKey = Readonly<Record<string, string>>;

interface CacheEntry {
  readonly preferredTermsByStageId: PreferredTermsByKey;
  readonly preferredTermsByConceptId: PreferredTermsByKey;
  readonly locale: string;
  fetchedAtMs: number;
}

const EMPTY_PREFERRED_TERMS: PreferredTermsByKey = Object.freeze({});

const clientCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

let cacheRevision = 0;
const listeners = new Set<() => void>();

function bumpRevision(): void {
  cacheRevision += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeControlledLifecyclePreferredTerms(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getControlledLifecyclePreferredTermsRevision(): number {
  return cacheRevision;
}

export function resetControlledLifecyclePreferredTermsCacheForTests(): void {
  clientCache.clear();
  inFlight.clear();
  cacheRevision = 0;
}

function parseStringMap(raw: unknown): PreferredTermsByKey {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) {
      next[key] = value.trim();
    }
  }
  return next;
}

function parsePreferredTermsPayload(payload: unknown): Omit<CacheEntry, "fetchedAtMs" | "locale"> {
  const envelope = payload as {
    success?: boolean;
    data?: {
      preferredTermsByStageId?: Record<string, unknown>;
      preferredTermsByConceptId?: Record<string, unknown>;
    };
  };
  const preferredTermsByStageId = parseStringMap(envelope.data?.preferredTermsByStageId);
  const preferredTermsByConceptId = {
    ...preferredTermsByStageId,
    ...parseStringMap(envelope.data?.preferredTermsByConceptId),
  };
  return { preferredTermsByStageId, preferredTermsByConceptId };
}

async function fetchPreferredTerms(locale: string): Promise<Omit<CacheEntry, "fetchedAtMs" | "locale">> {
  const requested = locale.trim() || "en";
  const response = await fetch(
    `${API_BASE_URL}/api/v1/terminology-glossary/controlled-lifecycle-preferred-terms?locale=${encodeURIComponent(requested)}`,
    {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      credentials: "omit",
    },
  );
  if (!response.ok) {
    return { preferredTermsByStageId: {}, preferredTermsByConceptId: {} };
  }
  return parsePreferredTermsPayload(await response.json());
}

/**
 * Ensure preferredTerms for a locale are loaded into the client cache.
 */
export async function ensureControlledLifecyclePreferredTermsForLocale(
  locale: string,
): Promise<PreferredTermsByKey> {
  const key = locale.trim() || "en";
  const now = Date.now();
  const existing = clientCache.get(key);
  if (
    existing &&
    now - existing.fetchedAtMs < CONTROLLED_LIFECYCLE_PREFERRED_TERMS_CACHE_TTL_MS
  ) {
    return existing.preferredTermsByStageId;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending.then((entry) => entry.preferredTermsByStageId);
  }

  const request = fetchPreferredTerms(key)
    .then((maps) => {
      const entry: CacheEntry = {
        locale: key,
        preferredTermsByStageId: maps.preferredTermsByStageId,
        preferredTermsByConceptId: maps.preferredTermsByConceptId,
        fetchedAtMs: Date.now(),
      };
      clientCache.set(key, entry);
      bumpRevision();
      return entry;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request.then((entry) => entry.preferredTermsByStageId);
}

/** Sync peek — stageId preferredTerm. */
export function getControlledLifecyclePreferredTerm(
  locale: string,
  stageId: string,
): string | null {
  const key = locale.trim() || "en";
  const entry = clientCache.get(key);
  if (!entry) {
    return null;
  }
  const preferred = entry.preferredTermsByStageId[stageId]?.trim();
  return preferred && preferred.length > 0 ? preferred : null;
}

/**
 * ConceptId map for controlled-vocabulary substitution (stages + domain concepts).
 * Safe empty object when cache is cold.
 */
export function getControlledVocabularyPreferredTermsMap(
  locale: string,
): PreferredTermsByKey {
  const key = locale.trim() || "en";
  return clientCache.get(key)?.preferredTermsByConceptId ?? EMPTY_PREFERRED_TERMS;
}

/** Test helper — seed cache without network. */
export function seedControlledLifecyclePreferredTermsForTests(input: {
  readonly locale: string;
  readonly preferredTermsByStageId: PreferredTermsByKey;
  readonly preferredTermsByConceptId?: PreferredTermsByKey;
}): void {
  const locale = input.locale.trim() || "en";
  clientCache.set(locale, {
    locale,
    preferredTermsByStageId: input.preferredTermsByStageId,
    preferredTermsByConceptId: {
      ...input.preferredTermsByStageId,
      ...(input.preferredTermsByConceptId ?? {}),
    },
    fetchedAtMs: Date.now(),
  });
  bumpRevision();
}

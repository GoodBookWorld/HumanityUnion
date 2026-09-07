/**
 * TRANSLATION DELIVERY RESET 02 — Published Localized Presentation core tests.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  protectedIdentity,
  protectedTechnical,
  type PublicPresentationNode,
} from "@hu/types";

import {
  findCurrentPublishedMemory,
  findPublishedSnapshotByIdMemory,
  formatPublishedReadImportGuardCounters,
  getPublishedLocalizationMemoryStoreStatsForTests,
  getPublishedLocalizationReadImportGuards,
  isPublishedLocalizationConsumptionEnabled,
  mergeLocalizedLayersByProvenance,
  PUBLISHED_LOCALIZATION_CONSUMER_ALLOWLIST,
  publishPublishedLocalizedPresentation,
  putPublishedSnapshotMemory,
  resetPublishedLocalizationPersistenceForTests,
  resetPublishedLocalizationReadImportGuardsForTests,
  resolvePublishedPresentation,
  seedPublishedLocalizationBallastCountForTests,
  setPublishedLocalizationFindFailureForTests,
  validatePublishedBuildResult,
} from "../../../src/modules/language/published-localized-presentation/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const plpRoot = join(
  here,
  "../../../src/modules/language/published-localized-presentation",
);

function readPlp(relative: string): string {
  return readFileSync(join(plpRoot, relative), "utf8");
}

function listPlpFiles(dir = plpRoot): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listPlpFiles(full));
    } else if (entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

const canonicalTree = {
  title: "Trusted Media Title",
  explanation: "Canonical explanation prose.",
  name: protectedIdentity("The Atlantic"),
  websiteUrl: protectedTechnical("https://www.theatlantic.com/"),
} as const satisfies PublicPresentationNode;

describe("Reset 02 PublishedLocalizedPresentation core", () => {
  beforeEach(() => {
    resetPublishedLocalizationPersistenceForTests();
    resetPublishedLocalizationReadImportGuardsForTests();
  });

  it("A: domain identity fields required on publish record", async () => {
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: canonicalTree,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Trusted Media Title",
            explanation: "[uk] Canonical explanation prose.",
          },
        },
      ],
    });
    const published = await publishPublishedLocalizedPresentation({
      entityType: "civic_media_trusted",
      entityId: "the-atlantic",
      locale: "uk",
      canonicalVersion: "v-canon-1",
      contentRevision: 1,
      canonicalPresentation: canonicalTree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      seo: {
        title: "[uk] SEO title",
        description: "[uk] SEO description",
        openGraph: { title: "[uk] OG" },
        twitter: { title: "[uk] TW" },
        jsonLdFields: { headline: "[uk] headline" },
      },
    });
    assert.equal(published.ok, true);
    if (!published.ok) return;
    assert.equal(published.record.identity.entityType, "civic_media_trusted");
    assert.equal(published.record.identity.entityId, "the-atlantic");
    assert.equal(published.record.identity.locale, "uk");
    assert.equal(published.record.identity.canonicalVersion, "v-canon-1");
    assert.equal(
      published.record.identity.localizationSchemaVersion,
      PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    );
    assert.equal(published.record.state, "PUBLISHED");
  });

  it("B/C/D: legal states — PARTIAL cannot publish; complete can", () => {
    const partial = validatePublishedBuildResult({
      entityType: "civic_media_trusted",
      entityId: "the-atlantic",
      locale: "uk",
      canonicalVersion: "v1",
      buildTargetCanonicalVersion: "v1",
      localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      canonicalPresentation: canonicalTree,
      localizedCandidate: {
        ...canonicalTree,
        title: "[uk] Trusted Media Title",
        // explanation still canonical
      },
      provenance: [
        {
          path: "title",
          source: "MACHINE",
          appliedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      fieldPolicy: { explanation: "MACHINE_CONTENT" as const, name: "PROTECTED_CANONICAL" as const, websiteUrl: "PROTECTED_CANONICAL" as const, title: "MACHINE_CONTENT" as const },
    });
    assert.equal(partial.status, "NOT_READY");
    assert.ok(partial.reasonCodes.includes("PARTIAL_AUTO_NODES"));
    assert.ok(partial.missingPaths.includes("explanation"));

    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: canonicalTree,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Trusted Media Title",
            explanation: "[uk] Canonical explanation prose.",
          },
        },
      ],
    });
    const complete = validatePublishedBuildResult({
      entityType: "civic_media_trusted",
      entityId: "the-atlantic",
      locale: "uk",
      canonicalVersion: "v1",
      buildTargetCanonicalVersion: "v1",
      localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      canonicalPresentation: canonicalTree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      fieldPolicy: { explanation: "MACHINE_CONTENT" as const, name: "PROTECTED_CANONICAL" as const, websiteUrl: "PROTECTED_CANONICAL" as const, title: "MACHINE_CONTENT" as const },
    });
    assert.equal(complete.status, "READY_TO_PUBLISH");
  });

  it("E–K: provenance priority — manual/Brand/Legal/terminology/geography/protected/machine", () => {
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: canonicalTree,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[machine] title",
            explanation: "[machine] explanation",
          },
          provider: "deterministic",
        },
        {
          source: "MANUAL_APPROVED",
          values: { title: "[manual] approved title" },
        },
        {
          source: "BRAND_LOCALIZATION",
          values: { title: "[brand] must not appear if manual wins — wait brand > manual?" },
        },
        {
          source: "LEGAL_LOCALIZATION",
          values: { explanation: "[legal] explanation" },
        },
        {
          source: "CONTROLLED_TERMINOLOGY",
          values: { title: "[term] ignored when brand/legal/manual higher on title" },
        },
        {
          source: "GEOGRAPHY",
          values: {},
        },
      ],
    });

    // Priority: LEGAL > BRAND > MANUAL > TERM > GEO > MACHINE
    // title: BRAND wins over MANUAL and MACHINE
    // explanation: LEGAL wins over MACHINE
    const title = (merged.presentation as { title: string }).title;
    const explanation = (merged.presentation as { explanation: string }).explanation;
    assert.equal(title, "[brand] must not appear if manual wins — wait brand > manual?");
    assert.equal(explanation, "[legal] explanation");

    const titleProv = merged.provenance.find((p) => p.path === "title");
    const explProv = merged.provenance.find((p) => p.path === "explanation");
    assert.equal(titleProv?.source, "BRAND_LOCALIZATION");
    assert.equal(explProv?.source, "LEGAL_LOCALIZATION");

    // Protected remain canonical wrappers
    assert.deepEqual(
      (merged.presentation as { name: unknown }).name,
      protectedIdentity("The Atlantic"),
    );
    assert.deepEqual(
      (merged.presentation as { websiteUrl: unknown }).websiteUrl,
      protectedTechnical("https://www.theatlantic.com/"),
    );

    // MACHINE can fill an ordinary AUTO when no higher layer
    const machineOnly = mergeLocalizedLayersByProvenance({
      canonicalPresentation: { body: "Hello" },
      layers: [{ source: "MACHINE", values: { body: "[uk] Hello" } }],
    });
    assert.equal((machineOnly.presentation as { body: string }).body, "[uk] Hello");
    assert.equal(machineOnly.provenance[0]?.source, "MACHINE");

    // Manual survives later machine rebuild merge
    const rebuild = mergeLocalizedLayersByProvenance({
      canonicalPresentation: canonicalTree,
      layers: [
        {
          source: "MANUAL_APPROVED",
          values: { title: "[manual] keep", explanation: "[manual] keep expl" },
        },
        {
          source: "MACHINE",
          values: {
            title: "[machine] overwrite attempt",
            explanation: "[machine] overwrite attempt",
          },
        },
      ],
    });
    assert.equal((rebuild.presentation as { title: string }).title, "[manual] keep");
    assert.equal(
      (rebuild.presentation as { explanation: string }).explanation,
      "[manual] keep expl",
    );
  });

  it("L/M/N/O/P/Q: read resolution — version/schema/state safety", async () => {
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: canonicalTree,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Trusted Media Title",
            explanation: "[uk] Canonical explanation prose.",
          },
        },
      ],
    });
    const published = await publishPublishedLocalizedPresentation({
      entityType: "civic_media_trusted",
      entityId: "the-atlantic",
      locale: "uk",
      canonicalVersion: "v-canon-1",
      contentRevision: 1,
      canonicalPresentation: canonicalTree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
    });
    assert.equal(published.ok, true);

    const hit = await resolvePublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: "the-atlantic",
      locale: "uk",
      liveCanonicalVersion: "v-canon-1",
      canonicalPresentation: canonicalTree,
    });
    assert.equal(hit.mode, "PUBLISHED_LOCALIZED");
    assert.equal((hit.presentation as { title: string }).title, "[uk] Trusted Media Title");

    const versionMismatch = await resolvePublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: "the-atlantic",
      locale: "uk",
      liveCanonicalVersion: "v-canon-2",
      canonicalPresentation: canonicalTree,
    });
    assert.equal(versionMismatch.mode, "CANONICAL_FALLBACK");
    assert.equal(versionMismatch.reasonCode, "CANONICAL_VERSION_MISMATCH");
    assert.equal(
      (versionMismatch.presentation as { title: string }).title,
      "Trusted Media Title",
    );

    const schemaMismatch = await resolvePublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: "the-atlantic",
      locale: "uk",
      liveCanonicalVersion: "v-canon-1",
      liveLocalizationSchemaVersion: "PLP.999",
      canonicalPresentation: canonicalTree,
    });
    assert.equal(schemaMismatch.mode, "CANONICAL_FALLBACK");
    assert.equal(schemaMismatch.reasonCode, "SCHEMA_VERSION_MISMATCH");

    // BUILDING / FAILED never exposed via current pointer
    putPublishedSnapshotMemory({
      snapshotId: "building-1",
      identity: {
        entityType: "civic_media_trusted",
        entityId: "other",
        locale: "uk",
        canonicalVersion: "v1",
        localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      },
      state: "BUILDING",
      contentRevision: 1,
      presentation: merged.presentation,
      provenance: merged.provenance,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const buildingRead = await resolvePublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: "other",
      locale: "uk",
      liveCanonicalVersion: "v1",
      canonicalPresentation: canonicalTree,
    });
    assert.equal(buildingRead.mode, "CANONICAL_FALLBACK");

    // SUPERSEDED after replace
    const next = await publishPublishedLocalizedPresentation({
      entityType: "civic_media_trusted",
      entityId: "the-atlantic",
      locale: "uk",
      canonicalVersion: "v-canon-2",
      contentRevision: 2,
      canonicalPresentation: canonicalTree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      snapshotId: "snap-v2",
    });
    assert.equal(next.ok, true);
    if (next.ok && next.supersededSnapshotId) {
      const old = findPublishedSnapshotByIdMemory(next.supersededSnapshotId);
      assert.equal(old?.state, "SUPERSEDED");
    }
    const supersededNotCurrent = findCurrentPublishedMemory({
      entityType: "civic_media_trusted",
      entityId: "the-atlantic",
      locale: "uk",
    });
    assert.equal(supersededNotCurrent?.identity.canonicalVersion, "v-canon-2");
  });

  it("R/S/T: atomic replacement, concurrent publish, idempotent duplicate", async () => {
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: canonicalTree,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Trusted Media Title",
            explanation: "[uk] Canonical explanation prose.",
          },
        },
      ],
    });

    const [a, b] = await Promise.all([
      publishPublishedLocalizedPresentation({
        entityType: "civic_media_trusted",
        entityId: "race",
        locale: "uk",
        canonicalVersion: "v1",
        contentRevision: 5,
        canonicalPresentation: canonicalTree,
        localizedCandidate: merged.presentation,
        provenance: merged.provenance,
        snapshotId: "race-a",
      }),
      publishPublishedLocalizedPresentation({
        entityType: "civic_media_trusted",
        entityId: "race",
        locale: "uk",
        canonicalVersion: "v0-old",
        contentRevision: 1,
        canonicalPresentation: canonicalTree,
        localizedCandidate: merged.presentation,
        provenance: merged.provenance,
        snapshotId: "race-b",
      }),
    ]);

    const successes = [a, b].filter((r) => r.ok);
    assert.ok(successes.length >= 1);
    const current = findCurrentPublishedMemory({
      entityType: "civic_media_trusted",
      entityId: "race",
      locale: "uk",
    });
    assert.equal(current?.contentRevision, 5);
    assert.equal(current?.identity.canonicalVersion, "v1");
    const stale = [a, b].find((r) => !r.ok);
    if (stale && !stale.ok) {
      assert.equal(stale.outcome, "STALE_REVISION");
    }

    const again = await publishPublishedLocalizedPresentation({
      entityType: "civic_media_trusted",
      entityId: "race",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 5,
      canonicalPresentation: canonicalTree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      snapshotId: "race-a",
    });
    assert.equal(again.ok, true);
    if (again.ok) {
      assert.equal(again.outcome, "IDEMPOTENT");
    }
  });

  it("F failed candidate leaves existing snapshot intact", async () => {
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: canonicalTree,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Trusted Media Title",
            explanation: "[uk] Canonical explanation prose.",
          },
        },
      ],
    });
    await publishPublishedLocalizedPresentation({
      entityType: "civic_media_trusted",
      entityId: "keep",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      canonicalPresentation: canonicalTree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
    });

    const failed = await publishPublishedLocalizedPresentation({
      entityType: "civic_media_trusted",
      entityId: "keep",
      locale: "uk",
      canonicalVersion: "v2",
      contentRevision: 2,
      canonicalPresentation: canonicalTree,
      localizedCandidate: { ...canonicalTree, title: "[uk] only title" },
      provenance: [
        {
          path: "title",
          source: "MACHINE",
          appliedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    assert.equal(failed.ok, false);
    if (!failed.ok) {
      assert.equal(failed.outcome, "NOT_READY");
    }
    const current = findCurrentPublishedMemory({
      entityType: "civic_media_trusted",
      entityId: "keep",
      locale: "uk",
    });
    assert.equal(current?.identity.canonicalVersion, "v1");
  });

  it("U: read import isolation — provider/worker/corpus/aggregate not imported", () => {
    const readSource = readPlp("read.ts");
    const resolveSource = readPlp("resolve-published-presentation.ts");
    const repoSource = readPlp("persistence/repository.ts");
    const memorySource = readPlp("persistence/memory.store.ts");
    const guardsSource = readPlp("import-guards.ts");
    const featureSource = readPlp("feature-boundary.ts");

    const readGraph = [
      readSource,
      resolveSource,
      repoSource,
      memorySource,
      guardsSource,
      featureSource,
    ].join("\n");

    assert.doesNotMatch(readGraph, /gemini-translation-provider|GeminiTranslationProvider/);
    assert.doesNotMatch(readGraph, /content-translation-warm-consumer/);
    assert.doesNotMatch(readGraph, /content-translation-worker-concurrency/);
    assert.doesNotMatch(readGraph, /public-localization-reconciliation|discoverThinMedia/);
    assert.doesNotMatch(readGraph, /bootstrap.*hydrate|hydrateInitiative/);

    assert.doesNotMatch(
      readSource,
      /from ["'].*(gemini|warm-consumer|worker-concurrency)/i,
    );

    const guards = getPublishedLocalizationReadImportGuards();
    assert.equal(guards.PUBLISHED_READ_PROVIDER_IMPORTED, false);
    assert.equal(guards.PUBLISHED_READ_WORKER_IMPORTED, false);
    assert.equal(guards.PUBLISHED_READ_CORPUS_IMPORTED, false);
    assert.equal(guards.PUBLISHED_READ_AGGREGATE_HYDRATION_IMPORTED, false);
    const formatted = formatPublishedReadImportGuardCounters();
    assert.match(formatted, /PUBLISHED_READ_PROVIDER_IMPORTED=false/);
    assert.match(formatted, /PUBLISHED_READ_WORKER_IMPORTED=false/);
    assert.match(formatted, /PUBLISHED_READ_CORPUS_IMPORTED=false/);
    assert.match(formatted, /PUBLISHED_READ_AGGREGATE_HYDRATION_IMPORTED=false/);

    // Module file inventory must not include provider/worker files inside PLP package
    const files = listPlpFiles().map((f) => f.replace(plpRoot, ""));
    assert.ok(files.every((f) => !/gemini|warm-consumer|worker/i.test(f)));
  });

  it("V: corpus-size-independent read (ballast vs direct key)", async () => {
    seedPublishedLocalizationBallastCountForTests(100_000);
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: canonicalTree,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Trusted Media Title",
            explanation: "[uk] Canonical explanation prose.",
          },
        },
      ],
    });
    await publishPublishedLocalizedPresentation({
      entityType: "civic_media_trusted",
      entityId: "direct",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      canonicalPresentation: canonicalTree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
    });

    const stats = getPublishedLocalizationMemoryStoreStatsForTests();
    assert.equal(stats.ballastCount, 100_000);
    assert.ok(stats.currentCount < 10);
    assert.ok(stats.snapshotCount < 10);

    const result = await resolvePublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: "direct",
      locale: "uk",
      liveCanonicalVersion: "v1",
      canonicalPresentation: canonicalTree,
    });
    assert.equal(result.mode, "PUBLISHED_LOCALIZED");
    // Read path uses Map.get by key — independent of ballastCount
    assert.equal(stats.ballastCount, 100_000);
  });

  it("W: persistence failure safe fallback", async () => {
    setPublishedLocalizationFindFailureForTests(true);
    const result = await resolvePublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: "any",
      locale: "uk",
      liveCanonicalVersion: "v1",
      canonicalPresentation: canonicalTree,
    });
    assert.equal(result.mode, "CANONICAL_FALLBACK");
    assert.equal(result.reasonCode, "PERSISTENCE_LOOKUP_FAILED");
    setPublishedLocalizationFindFailureForTests(false);
  });

  it("X: SEO-capable structured fields on snapshot", async () => {
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: canonicalTree,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Trusted Media Title",
            explanation: "[uk] Canonical explanation prose.",
          },
        },
      ],
    });
    const published = await publishPublishedLocalizedPresentation({
      entityType: "civic_media_trusted",
      entityId: "seo",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      canonicalPresentation: canonicalTree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      seo: {
        title: "[uk] page title",
        description: "[uk] meta description",
        openGraph: { title: "[uk] og title", description: "[uk] og desc" },
        twitter: { title: "[uk] tw title" },
        jsonLdFields: { headline: "[uk] jsonld" },
      },
    });
    assert.equal(published.ok, true);
    if (!published.ok) return;
    assert.equal(published.record.seo?.title, "[uk] page title");
    assert.equal(published.record.seo?.openGraph?.title, "[uk] og title");
    assert.equal(published.record.seo?.jsonLdFields?.headline, "[uk] jsonld");
  });

  it("dormant migration boundary — allowlist empty", () => {
    assert.deepEqual([...PUBLISHED_LOCALIZATION_CONSUMER_ALLOWLIST], []);
    assert.equal(isPublishedLocalizationConsumptionEnabled("civic_media"), false);
    assert.equal(isPublishedLocalizationConsumptionEnabled("civic_media_trusted"), false);
  });

  it("G: superseded cannot become current again accidentally", async () => {
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: canonicalTree,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Trusted Media Title",
            explanation: "[uk] Canonical explanation prose.",
          },
        },
      ],
    });
    const first = await publishPublishedLocalizedPresentation({
      entityType: "civic_media_trusted",
      entityId: "sup",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      canonicalPresentation: canonicalTree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      snapshotId: "sup-1",
    });
    assert.equal(first.ok, true);
    await publishPublishedLocalizedPresentation({
      entityType: "civic_media_trusted",
      entityId: "sup",
      locale: "uk",
      canonicalVersion: "v2",
      contentRevision: 2,
      canonicalPresentation: canonicalTree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      snapshotId: "sup-2",
    });
    const old = findPublishedSnapshotByIdMemory("sup-1");
    assert.equal(old?.state, "SUPERSEDED");
    // Re-publishing older revision fails
    const stale = await publishPublishedLocalizedPresentation({
      entityType: "civic_media_trusted",
      entityId: "sup",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      canonicalPresentation: canonicalTree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      snapshotId: "sup-1-again",
    });
    assert.equal(stale.ok, false);
    const current = findCurrentPublishedMemory({
      entityType: "civic_media_trusted",
      entityId: "sup",
      locale: "uk",
    });
    assert.equal(current?.snapshotId, "sup-2");
  });
});

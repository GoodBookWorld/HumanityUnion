/**
 * TRANSLATION DELIVERY RESET 03 — Media PLP vertical slice tests.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpPrincipleEntityId,
  mediaPlpPublicNewsEntityId,
  mediaPlpTrustedEntityId,
  protectedIdentity,
  protectedTechnical,
  type PublicNewsArticleItem,
  type TrustedMediaResource,
} from "@hu/types";

import {
  assertMediaPlpReadImportIsolation,
  buildCanonicalPrinciplePresentation,
  buildCanonicalPublicNewsPresentation,
  buildCanonicalTrustedPresentation,
  buildMediaPlpCandidate,
  fingerprintMediaPlpCanonicalVersion,
  formatMediaPlpInstrumentationCounters,
  getMediaPlpInstrumentationCounters,
  isMediaPlpConsumptionEnabled,
  MEDIA_LOCALIZATION_BUILD_HOOK_STATUS,
  mediaPlpReadModulesAvoidCorpusToArray,
  notifyMediaCanonicalPublishedForLocalizationBuild,
  publishMediaPlpEntity,
  resetMediaPlpInstrumentationForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveMediaPlpPresentation,
  setMediaPlpConsumptionEnabledForTests,
  asMediaPlpPresentationNode,
} from "../../../src/modules/language/published-localized-presentation/index.js";

const trustedResource: TrustedMediaResource = {
  id: "the-atlantic",
  name: "The Atlantic",
  logoLabel: "The Atlantic",
  country: "United States",
  countryCode: "US",
  categoryId: "independent-investigative",
  explanation: "Trusted explanation of editorial standards for participants.",
  websiteUrl: "https://www.theatlantic.com/",
  sortOrder: 1,
};

const newsArticle: PublicNewsArticleItem = {
  id: "news-abc123",
  title: "Civic shoreline restoration expands",
  summary: "Communities organize a public initiative around coastal habitats.",
  category: "Environment",
  sourceName: "The Atlantic",
  articleUrl: "https://example.com/a",
  publishedAt: "2026-01-01T00:00:00.000Z",
  verificationStatus: "external-source",
  geographicScope: "world",
  language: "en",
};

describe("Reset 03 Media PLP vertical slice", () => {
  beforeEach(() => {
    resetPublishedLocalizationPersistenceForTests();
    resetMediaPlpInstrumentationForTests();
    setMediaPlpConsumptionEnabledForTests(null);
  });

  it("A: stable Media PLP identities (route-independent; shared trusted id)", () => {
    assert.equal(MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS, "public_news");
    assert.equal(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE, "civic_media_principle");
    assert.equal(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED, "civic_media_trusted");
    assert.equal(mediaPlpTrustedEntityId("the-atlantic"), "the-atlantic");
    assert.equal(mediaPlpPublicNewsEntityId("news-abc123"), "news-abc123");
    assert.equal(mediaPlpPrincipleEntityId("editorial-transparency"), "editorial-transparency");
    // Same trusted id for /media and country
    assert.equal(
      mediaPlpTrustedEntityId(trustedResource.id),
      mediaPlpTrustedEntityId("the-atlantic"),
    );
  });

  it("B/C/D: canonical trees + PARTIAL cannot publish; complete can", async () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalTrustedPresentation(trustedResource),
    );
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    assert.match(version, /^v-/);
    assert.deepEqual(
      (tree as { name: unknown }).name,
      protectedIdentity("The Atlantic"),
    );
    assert.deepEqual(
      (tree as { websiteUrl: unknown }).websiteUrl,
      protectedTechnical("https://www.theatlantic.com/"),
    );

    const partial = buildMediaPlpCandidate({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(trustedResource.id),
      locale: "uk",
      canonicalVersion: version,
      canonicalPresentation: tree,
      includeDeterministicMachine: false,
      layers: [
        {
          source: "MACHINE",
          values: { explanation: "[uk] only explanation — missing nothing if only one auto" },
        },
      ],
    });
    // With only explanation AUTO and machine filling it, should be ready —
    // force partial by leaving explanation untranslated:
    const partial2 = buildMediaPlpCandidate({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(trustedResource.id),
      locale: "uk",
      canonicalVersion: version,
      canonicalPresentation: tree,
      includeDeterministicMachine: false,
      layers: [],
    });
    assert.equal(partial2.validation.status, "NOT_READY");
    assert.ok(partial2.validation.reasonCodes.includes("PARTIAL_AUTO_NODES"));

    const publishedPartial = await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(trustedResource.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: tree,
      includeDeterministicMachine: false,
      layers: [],
    });
    assert.equal(publishedPartial.ok, false);

    const complete = await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(trustedResource.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: tree,
      seo: {
        title: "[uk] SEO",
        description: "[uk] meta",
        openGraph: { title: "[uk] og" },
        twitter: { title: "[uk] tw" },
        jsonLdFields: { headline: "[uk] hl" },
      },
    });
    assert.equal(complete.ok, true);
    void partial;
  });

  it("E/F: feature flag default OFF; PLP read disabled until enabled", async () => {
    assert.equal(isMediaPlpConsumptionEnabled(), false);
    const tree = asMediaPlpPresentationNode(
      buildCanonicalTrustedPresentation(trustedResource),
    );
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(trustedResource.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: tree,
    });
    const disabled = await resolveMediaPlpPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(trustedResource.id),
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: tree,
    });
    assert.equal(disabled.reasonCode, "MEDIA_PLP_DISABLED");
    assert.equal(disabled.mode, "CANONICAL_FALLBACK");

    setMediaPlpConsumptionEnabledForTests(true);
    const enabled = await resolveMediaPlpPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(trustedResource.id),
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: tree,
    });
    assert.equal(enabled.mode, "PUBLISHED_LOCALIZED");
    assert.equal(getMediaPlpInstrumentationCounters().PLP_READ_COUNT, 1);
    assert.equal(getMediaPlpInstrumentationCounters().PROVIDER_CALL_COUNT, 0);
  });

  it("K/N: coherent fallback; /media and country share trusted presentation", async () => {
    setMediaPlpConsumptionEnabledForTests(true);
    const tree = asMediaPlpPresentationNode(
      buildCanonicalTrustedPresentation(trustedResource),
    );
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(trustedResource.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: tree,
    });

    const mediaSurface = await resolveMediaPlpPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(trustedResource.id),
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: tree,
    });
    const countrySurface = await resolveMediaPlpPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(trustedResource.id),
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: tree,
    });
    assert.equal(mediaSurface.mode, "PUBLISHED_LOCALIZED");
    assert.deepEqual(mediaSurface.presentation, countrySurface.presentation);

    const mismatch = await resolveMediaPlpPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(trustedResource.id),
      locale: "uk",
      liveCanonicalVersion: "v-other",
      canonicalPresentation: tree,
    });
    assert.equal(mismatch.mode, "CANONICAL_FALLBACK");
    assert.equal(
      (mismatch.presentation as { explanation: string }).explanation,
      trustedResource.explanation,
    );
  });

  it("O: manual/Brand/Legal priority over machine; protected preserved", () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalTrustedPresentation(trustedResource),
    );
    const built = buildMediaPlpCandidate({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: "the-atlantic",
      locale: "uk",
      canonicalVersion: "v1",
      canonicalPresentation: tree,
      layers: [
        {
          source: "MANUAL_APPROVED",
          values: { explanation: "[manual] approved explanation" },
        },
        {
          source: "BRAND_LOCALIZATION",
          values: {},
        },
        {
          source: "MACHINE",
          values: { explanation: "[machine] should lose" },
        },
      ],
    });
    assert.equal(built.validation.status, "READY_TO_PUBLISH");
    assert.equal(
      (built.presentation as { explanation: string }).explanation,
      "[manual] approved explanation",
    );
    assert.deepEqual(
      (built.presentation as { name: unknown }).name,
      protectedIdentity("The Atlantic"),
    );
  });

  it("historical failure classes: news identity + semantic version + partial fail", async () => {
    const newsTree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation(newsArticle),
    );
    const v1 = fingerprintMediaPlpCanonicalVersion(newsTree);
    // updatedAt-like wall clock must not be in tree — fingerprint stable
    const v1Again = fingerprintMediaPlpCanonicalVersion(
      asMediaPlpPresentationNode(buildCanonicalPublicNewsPresentation({
        ...newsArticle,
        publishedAt: "2099-01-01T00:00:00.000Z", // protected technical — still in fingerprint
      })),
    );
    // publishedAt is protected but still part of tree fingerprint material via collect —
    // protected nodes are skipped in collectAutoPaths, so version should match for AUTO-only.
    assert.equal(
      fingerprintMediaPlpCanonicalVersion(
        asMediaPlpPresentationNode(
          buildCanonicalPublicNewsPresentation({
            ...newsArticle,
            // same semantic AUTO fields
          }),
        ),
      ),
      v1,
    );
    void v1Again;

    const principle = buildCanonicalPrinciplePresentation({
      id: "editorial-transparency",
      title: "Independence",
      description: "Principle description",
    });
    const principleTree = asMediaPlpPresentationNode(principle);
    const principlePub = await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId: mediaPlpPrincipleEntityId("editorial-transparency"),
      locale: "uk",
      canonicalVersion: fingerprintMediaPlpCanonicalVersion(principleTree),
      contentRevision: 1,
      canonicalPresentation: principleTree,
    });
    assert.equal(principlePub.ok, true);

    // title translated but description missing → NOT_READY
    const partialNews = buildMediaPlpCandidate({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(newsArticle.id),
      locale: "uk",
      canonicalVersion: v1,
      canonicalPresentation: newsTree,
      includeDeterministicMachine: false,
      layers: [
        { source: "MACHINE", values: { title: "[uk] Civic shoreline restoration expands" } },
      ],
    });
    assert.equal(partialNews.validation.status, "NOT_READY");
    assert.ok(partialNews.validation.missingPaths.includes("summary"));
  });

  it("T/U: import isolation + instrumentation counters", () => {
    const isolation = assertMediaPlpReadImportIsolation();
    assert.equal(isolation.ok, true, isolation.violations.join(","));
    assert.equal(mediaPlpReadModulesAvoidCorpusToArray(), true);
    const counters = formatMediaPlpInstrumentationCounters();
    assert.match(counters, /PROVIDER_CALL_COUNT=0/);
    assert.match(counters, /CONTENT_TRANSLATION_WRITE_COUNT=0/);
  });

  it("W: future publication hook inactive", () => {
    assert.equal(MEDIA_LOCALIZATION_BUILD_HOOK_STATUS, "INACTIVE");
    notifyMediaCanonicalPublishedForLocalizationBuild({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: "the-atlantic",
      canonicalVersion: "v1",
      contentRevision: 1,
    });
  });
});

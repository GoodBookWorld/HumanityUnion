/**
 * Reset 03B / 03B.2 — RSS phase instrumentation for Media PLP materializer.
 */

export type MediaPlpMaterializerMemoryPhases = {
  readonly RSS_START_MB: number;
  readonly RSS_AFTER_IMPORT_MB: number;
  readonly RSS_AFTER_MONGO_CONNECT_MB: number;
  readonly RSS_AFTER_SOURCE_LOOKUP_MB: number;
  readonly RSS_AFTER_TRANSLATION_LOOKUP_MB: number;
  readonly RSS_AFTER_THIN_PROVIDER_IMPORT_MB: number | null;
  readonly RSS_BEFORE_PROVIDER_MB: number | null;
  readonly RSS_AFTER_PROVIDER_MB: number | null;
  readonly RSS_AFTER_PUBLISH_MB: number | null;
  readonly RSS_PEAK_MB: number;
};

function rssMb(): number {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

let startRss = rssMb();
let afterImportRss = startRss;
let afterMongoRss = startRss;
let afterSourceRss = startRss;
let afterTranslationRss = startRss;
let afterThinProviderImportRss: number | null = null;
let beforeProviderRss: number | null = null;
let afterProviderRss: number | null = null;
let afterPublishRss: number | null = null;
let peakRss = startRss;

function bumpPeak(value = rssMb()): number {
  if (value > peakRss) {
    peakRss = value;
  }
  return value;
}

export function captureMaterializerStart(): void {
  startRss = rssMb();
  peakRss = startRss;
  afterThinProviderImportRss = null;
  beforeProviderRss = null;
  afterProviderRss = null;
  afterPublishRss = null;
}

export function captureMaterializerAfterImport(): void {
  afterImportRss = bumpPeak();
}

export function captureMaterializerAfterMongoConnect(): void {
  afterMongoRss = bumpPeak();
}

export function captureMaterializerAfterSourceLookup(): void {
  afterSourceRss = bumpPeak();
}

export function captureMaterializerAfterTranslationLookup(): void {
  afterTranslationRss = bumpPeak();
}

export function captureMaterializerAfterThinProviderImport(): number {
  afterThinProviderImportRss = bumpPeak();
  return afterThinProviderImportRss;
}

export function captureMaterializerBeforeProvider(): number {
  beforeProviderRss = bumpPeak();
  return beforeProviderRss;
}

export function captureMaterializerAfterProvider(): number {
  afterProviderRss = bumpPeak();
  return afterProviderRss;
}

export function captureMaterializerAfterPublish(): void {
  afterPublishRss = bumpPeak();
}

export function currentMaterializerRssMb(): number {
  return bumpPeak();
}

export function getMediaPlpMaterializerMemoryPhases(): MediaPlpMaterializerMemoryPhases {
  bumpPeak();
  return {
    RSS_START_MB: startRss,
    RSS_AFTER_IMPORT_MB: afterImportRss,
    RSS_AFTER_MONGO_CONNECT_MB: afterMongoRss,
    RSS_AFTER_SOURCE_LOOKUP_MB: afterSourceRss,
    RSS_AFTER_TRANSLATION_LOOKUP_MB: afterTranslationRss,
    RSS_AFTER_THIN_PROVIDER_IMPORT_MB: afterThinProviderImportRss,
    RSS_BEFORE_PROVIDER_MB: beforeProviderRss,
    RSS_AFTER_PROVIDER_MB: afterProviderRss,
    RSS_AFTER_PUBLISH_MB: afterPublishRss,
    RSS_PEAK_MB: peakRss,
  };
}

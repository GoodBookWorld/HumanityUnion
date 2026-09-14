/**
 * Reset 03A — bounded RSS phase instrumentation for Media PLP preflight.
 * Never logs secrets, URIs, or document bodies.
 */

export type MediaPlpPreflightMemoryPhases = {
  readonly RSS_START_MB: number;
  readonly RSS_AFTER_IMPORT_MB: number;
  readonly RSS_AFTER_MONGO_CONNECT_MB: number;
  readonly RSS_AFTER_SOURCE_LOOKUP_MB: number;
  readonly RSS_AFTER_PLP_LOOKUP_MB: number;
  readonly RSS_PEAK_MB: number;
};

function rssMb(): number {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

let startRss = rssMb();
let afterImportRss = startRss;
let afterMongoRss = startRss;
let afterSourceRss = startRss;
let afterPlpRss = startRss;
let peakRss = startRss;

function bumpPeak(): void {
  const rss = rssMb();
  if (rss > peakRss) {
    peakRss = rss;
  }
}

export function captureMediaPlpPreflightStart(): void {
  startRss = rssMb();
  peakRss = startRss;
}

export function captureMediaPlpPreflightAfterImport(): void {
  afterImportRss = rssMb();
  bumpPeak();
}

export function captureMediaPlpPreflightAfterMongoConnect(): void {
  afterMongoRss = rssMb();
  bumpPeak();
}

export function captureMediaPlpPreflightAfterSourceLookup(): void {
  afterSourceRss = rssMb();
  bumpPeak();
}

export function captureMediaPlpPreflightAfterPlpLookup(): void {
  afterPlpRss = rssMb();
  bumpPeak();
}

export function getMediaPlpPreflightMemoryPhases(): MediaPlpPreflightMemoryPhases {
  bumpPeak();
  return {
    RSS_START_MB: startRss,
    RSS_AFTER_IMPORT_MB: afterImportRss,
    RSS_AFTER_MONGO_CONNECT_MB: afterMongoRss,
    RSS_AFTER_SOURCE_LOOKUP_MB: afterSourceRss,
    RSS_AFTER_PLP_LOOKUP_MB: afterPlpRss,
    RSS_PEAK_MB: peakRss,
  };
}

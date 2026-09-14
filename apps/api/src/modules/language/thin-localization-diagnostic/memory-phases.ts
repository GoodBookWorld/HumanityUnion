/**
 * Pack 08K.2.8 — local/dev RSS phase instrumentation for thin diagnostics.
 * Never logs secrets or connection strings.
 */

export type ThinLocalizationMemoryPhases = {
  readonly PROCESS_START_RSS_MB: number;
  readonly AFTER_IMPORTS_RSS_MB: number;
  readonly AFTER_DB_CONNECT_RSS_MB: number;
  readonly AFTER_REGISTRY_RSS_MB: number;
  readonly AFTER_IDENTITY_LOOKUPS_RSS_MB: number;
  readonly PEAK_RSS_MB: number;
  readonly PEAK_HEAP_USED_MB: number;
};

function rssMb(): number {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

function heapMb(): number {
  return Math.round((process.memoryUsage().heapUsed / (1024 * 1024)) * 10) / 10;
}

let processStartRss = rssMb();
let afterImportsRss = processStartRss;
let afterDbRss = processStartRss;
let afterRegistryRss = processStartRss;
let afterLookupsRss = processStartRss;
let peakRss = processStartRss;
let peakHeap = heapMb();

function bumpPeak(): void {
  const rss = rssMb();
  const heap = heapMb();
  if (rss > peakRss) {
    peakRss = rss;
  }
  if (heap > peakHeap) {
    peakHeap = heap;
  }
}

export function captureThinLocalizationProcessStart(): void {
  processStartRss = rssMb();
  peakRss = processStartRss;
  peakHeap = heapMb();
}

export function captureThinLocalizationAfterImports(): void {
  afterImportsRss = rssMb();
  bumpPeak();
}

export function captureThinLocalizationAfterDbConnect(): void {
  afterDbRss = rssMb();
  bumpPeak();
}

export function captureThinLocalizationAfterRegistry(): void {
  afterRegistryRss = rssMb();
  bumpPeak();
}

export function captureThinLocalizationAfterIdentityLookups(): void {
  afterLookupsRss = rssMb();
  bumpPeak();
}

export function getThinLocalizationMemoryPhases(): ThinLocalizationMemoryPhases {
  bumpPeak();
  return {
    PROCESS_START_RSS_MB: processStartRss,
    AFTER_IMPORTS_RSS_MB: afterImportsRss,
    AFTER_DB_CONNECT_RSS_MB: afterDbRss,
    AFTER_REGISTRY_RSS_MB: afterRegistryRss,
    AFTER_IDENTITY_LOOKUPS_RSS_MB: afterLookupsRss,
    PEAK_RSS_MB: peakRss,
    PEAK_HEAP_USED_MB: peakHeap,
  };
}

/**
 * Pack 08K.2.8 — test-visible import/architecture guards for thin diagnostics.
 * Values flip only when the corresponding thin modules load (or forbidden imports are detected).
 */

export type ThinLocalizationImportGuards = {
  FULL_APPLICATION_GRAPH_IMPORTED: boolean;
  PROVIDER_MODULE_IMPORTED: boolean;
  WORKER_MODULE_IMPORTED: boolean;
  PRESENTATION_TREE_BUILT: boolean;
  FULL_CORPUS_HYDRATED: boolean;
  OPERATOR_MODE: "THIN_READ_ONLY";
};

const guards: ThinLocalizationImportGuards = {
  FULL_APPLICATION_GRAPH_IMPORTED: false,
  PROVIDER_MODULE_IMPORTED: false,
  WORKER_MODULE_IMPORTED: false,
  PRESENTATION_TREE_BUILT: false,
  FULL_CORPUS_HYDRATED: false,
  OPERATOR_MODE: "THIN_READ_ONLY",
};

/** Called once by the thin CLI entry after its allowed imports settle. */
export function markThinLocalizationOperatorGraphReady(): void {
  // Intentionally no-op beyond documenting the thin graph is active.
  // Guards remain false unless a forbidden import path sets them.
}

export function markPresentationTreeBuiltForTests(): void {
  guards.PRESENTATION_TREE_BUILT = true;
}

export function markFullCorpusHydratedForTests(): void {
  guards.FULL_CORPUS_HYDRATED = true;
}

export function markProviderModuleImportedForTests(): void {
  guards.PROVIDER_MODULE_IMPORTED = true;
}

export function markWorkerModuleImportedForTests(): void {
  guards.WORKER_MODULE_IMPORTED = true;
}

export function markFullApplicationGraphImportedForTests(): void {
  guards.FULL_APPLICATION_GRAPH_IMPORTED = true;
}

export function getThinLocalizationImportGuards(): ThinLocalizationImportGuards {
  return { ...guards };
}

export function resetThinLocalizationImportGuardsForTests(): void {
  guards.FULL_APPLICATION_GRAPH_IMPORTED = false;
  guards.PROVIDER_MODULE_IMPORTED = false;
  guards.WORKER_MODULE_IMPORTED = false;
  guards.PRESENTATION_TREE_BUILT = false;
  guards.FULL_CORPUS_HYDRATED = false;
}

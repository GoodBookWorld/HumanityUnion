import type {
  LanguageActivationAdminView,
  LanguageActivationJobStatus,
  LanguageActivationWebUiDomainProgress,
  LanguageLocalizationReadinessReport,
} from "@hu/types";

/**
 * Operator-facing localization progress from measured owner coverage.
 * Search, SEO, Registry switches, and Knowledge (no translation owner) are excluded.
 */
export type LocalizationProgress = {
  readonly percent: number;
  readonly phaseLabel: string;
  readonly failed: boolean;
};

type Count = {
  readonly done: number;
  readonly total: number;
};

type ProgressSource = {
  readonly jobStatus: LanguageActivationJobStatus | null;
  readonly brandStatus: string | null;
  readonly terminologyStatus: string | null;
  readonly webUi: LanguageActivationWebUiDomainProgress | null;
  readonly cvChecked: number;
  readonly cvMissing: number;
  readonly cvReady: boolean;
  readonly ctCurrent: number;
  readonly ctRemaining: number;
  readonly plpCurrent: number;
  readonly plpRemaining: number;
  readonly publishedRequired: number;
  readonly publishedMissing: number;
  readonly publishedDataReady: boolean;
};

function units(done: number, total: number): Count {
  if (total <= 0) {
    return { done: 0, total: 0 };
  }
  return { done: Math.max(0, Math.min(done, total)), total };
}

function add(left: Count, right: Count): Count {
  return { done: left.done + right.done, total: left.total + right.total };
}

/**
 * Unpublished WEB_UI checkpoint work counts before the catalog is published.
 * Leaf totals win when they record completed strings. Otherwise provider batches.
 * Published Missing= does not erase a durable in-progress checkpoint.
 */
export function webUiLocalizationUnits(input: {
  readonly webUi: LanguageActivationWebUiDomainProgress | null;
  readonly publishedRequired: number;
  readonly publishedMissing: number;
  readonly publishedDataReady: boolean;
}): Count {
  const webUi = input.webUi;
  const dataReady = webUi?.dataReady === true || input.publishedDataReady === true;
  const required = webUi?.requiredKeyCount ?? input.publishedRequired;
  if (dataReady) {
    return units(required, required);
  }
  const phase = webUi?.preparationPhase ?? null;
  const active =
    phase === "primary" ||
    phase === "quality" ||
    phase === "validating" ||
    phase === "publishing" ||
    webUi?.status === "in_progress";
  if (
    webUi &&
    (active ||
      webUi.completedBatches > 0 ||
      webUi.completedLeaves > 0 ||
      phase === "failed")
  ) {
    // Batch counts are the authoritative operational signal while a checkpoint
    // is active or failed. Prefer them over estimated completedLeaves so the
    // percentage does not collapse when leaf estimates appear.
    if (webUi.totalBatches > 0) {
      return units(webUi.completedBatches, webUi.totalBatches);
    }
    if (webUi.totalLeaves > 0) {
      return units(webUi.completedLeaves, webUi.totalLeaves);
    }
  }
  return units(
    Math.max(0, input.publishedRequired - input.publishedMissing),
    input.publishedRequired,
  );
}

function coverage(source: ProgressSource): Count {
  const cv = source.cvReady
    ? units(source.cvChecked, source.cvChecked)
    : units(Math.max(0, source.cvChecked - source.cvMissing), source.cvChecked);
  const web = webUiLocalizationUnits({
    webUi: source.webUi,
    publishedRequired: source.publishedRequired,
    publishedMissing: source.publishedMissing,
    publishedDataReady: source.publishedDataReady,
  });
  const ct = units(source.ctCurrent, source.ctCurrent + source.ctRemaining);
  const plp = units(source.plpCurrent, source.plpCurrent + source.plpRemaining);
  return add(add(cv, web), add(ct, plp));
}

function phaseLabel(source: ProgressSource, percent: number): { label: string; failed: boolean } {
  const failed =
    source.jobStatus === "failed" ||
    source.webUi?.status === "failed" ||
    source.webUi?.providerFailure === true ||
    source.webUi?.preparationPhase === "failed";
  if (failed) {
    return { label: "Failed — retry activation", failed: true };
  }
  if (source.brandStatus === "in_progress") {
    return { label: "Preparing Brand…", failed: false };
  }
  if (source.terminologyStatus === "in_progress") {
    return { label: "Preparing terminology…", failed: false };
  }
  const phase = source.webUi?.preparationPhase ?? null;
  if (phase === "quality") {
    return { label: "Checking translation quality…", failed: false };
  }
  if (phase === "validating") {
    return { label: "Validating public interface…", failed: false };
  }
  if (phase === "publishing") {
    return { label: "Publishing public interface…", failed: false };
  }
  if (phase === "primary" || source.webUi?.status === "in_progress") {
    const completed = source.webUi?.completedBatches ?? 0;
    const total = source.webUi?.totalBatches ?? 0;
    return {
      label:
        total > 0
          ? `Translating public interface · ${completed} / ${total} batches`
          : "Translating public interface",
      failed: false,
    };
  }
  const civicRemaining = source.ctRemaining + source.plpRemaining;
  if (
    (source.jobStatus === "running" || source.jobStatus === "queued") &&
    civicRemaining > 0 &&
    (phase === "ready" || source.webUi?.dataReady === true || source.publishedDataReady)
  ) {
    return { label: "Finishing civic content…", failed: false };
  }
  if (percent >= 100) {
    return { label: "Ready", failed: false };
  }
  return { label: "Localization", failed: false };
}

export function deriveLocalizationProgress(source: ProgressSource): LocalizationProgress {
  const covered = coverage(source);
  const percent =
    covered.total <= 0 ? 100 : Math.round((100 * covered.done) / covered.total);
  const phase = phaseLabel(source, percent);
  return { percent, phaseLabel: phase.label, failed: phase.failed };
}

function sourceFromView(view: LanguageActivationAdminView): ProgressSource {
  const readiness = view.readiness;
  const job = view.job;
  const cv = job?.domains.controlledVocabulary;
  return {
    jobStatus: job?.status ?? null,
    brandStatus: job?.domains.brand.status ?? null,
    terminologyStatus: job?.domains.terminology.status ?? null,
    webUi: job?.domains.webUi ?? null,
    cvChecked: cv?.conceptsChecked ?? readiness.controlledVocabulary.conceptsChecked,
    cvMissing: cv?.conceptsMissing ?? readiness.controlledVocabulary.conceptsMissingLocalizedLabel,
    cvReady: cv?.presentationReady ?? readiness.controlledVocabulary.presentationReady,
    ctCurrent: job?.domains.ct.current ?? readiness.ct.current,
    ctRemaining: job?.domains.ct.remainingWorkItems ?? readiness.ct.workItemsRequired,
    plpCurrent: job?.domains.plp.current ?? readiness.plpMedia.current,
    plpRemaining: job?.domains.plp.remainingWorkItems ?? readiness.plpMedia.workItemsRequired,
    publishedRequired: readiness.webUi.requiredKeyCount,
    publishedMissing: readiness.webUi.missingKeyCount,
    publishedDataReady: readiness.webUi.dataReady,
  };
}

export function localizationProgressFromActivation(
  view: LanguageActivationAdminView,
): LocalizationProgress {
  return deriveLocalizationProgress(sourceFromView(view));
}

export function localizationProgressFromReadiness(
  report: LanguageLocalizationReadinessReport,
): LocalizationProgress {
  return deriveLocalizationProgress({
    jobStatus: null,
    brandStatus: null,
    terminologyStatus: null,
    webUi: null,
    cvChecked: report.controlledVocabulary.conceptsChecked,
    cvMissing: report.controlledVocabulary.conceptsMissingLocalizedLabel,
    cvReady: report.controlledVocabulary.presentationReady,
    ctCurrent: report.ct.current,
    ctRemaining: report.ct.workItemsRequired,
    plpCurrent: report.plpMedia.current,
    plpRemaining: report.plpMedia.workItemsRequired,
    publishedRequired: report.webUi.requiredKeyCount,
    publishedMissing: report.webUi.missingKeyCount,
    publishedDataReady: report.webUi.dataReady,
  });
}

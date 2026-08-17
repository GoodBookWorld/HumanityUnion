/**
 * Lifecycle Finalization Phase 05A —
 * Bootstrap Initiative version (v1 "Initial published version.") is Initiative
 * content history, NOT Revision-stage lifecycle publication evidence.
 *
 * Counting it as a published `revision` stage artifact incorrectly advances
 * the resolver past Discussion / Analysis / Proposals and marks those stages
 * "Not applicable" when empty.
 */

const BOOTSTRAP_REVISION_SUMMARY = "Initial published version.";

export interface LifecycleProgressRevisionLike {
  readonly version: number;
  readonly revisionSummary: string;
  readonly changes?: readonly unknown[];
}

/**
 * Returns true only for Author-published Revision-stage artifacts that should
 * count toward lifecycle progress / completion evidence.
 */
export function isLifecycleProgressRevision(revision: LifecycleProgressRevisionLike): boolean {
  const changeCount = revision.changes?.length ?? 0;
  if (
    revision.version === 1 &&
    revision.revisionSummary === BOOTSTRAP_REVISION_SUMMARY &&
    changeCount === 0
  ) {
    return false;
  }
  return true;
}

export function filterLifecycleProgressRevisions<T extends LifecycleProgressRevisionLike>(
  revisions: readonly T[],
): T[] {
  return revisions.filter((revision) => isLifecycleProgressRevision(revision));
}

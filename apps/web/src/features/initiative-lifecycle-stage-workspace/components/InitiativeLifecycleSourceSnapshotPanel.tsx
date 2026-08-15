import type { InitiativeLifecycleSourceSnapshotSummary } from "@hu/types";

/**
 * Initiative Lifecycle — Part A Completion Part 13: source-snapshot UI
 * boundary. Renders whatever `InitiativeLifecycleSourceSnapshotSummary`
 * the caller supplies — Part A never aggregates real sources itself (no
 * Analysis source aggregation yet, per scope protection), so every stage
 * shows the honest empty/missing-source state today.
 */
export function InitiativeLifecycleSourceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeLifecycleSourceSnapshotSummary;
}) {
  const capturedAtLabel = (() => {
    try {
      return new Date(snapshot.capturedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  })();

  return (
    <section className="lsw-sources" aria-labelledby="lsw-sources-title">
      <h3 id="lsw-sources-title" className="lsw-sources__title">
        Sources Used
      </h3>

      {snapshot.isEmpty ? (
        <p className="lsw-sources__missing" role="status">
          No sources have been collected for this stage yet.
        </p>
      ) : (
        <ul className="lsw-sources__list" aria-label="Sources used for this draft">
          {snapshot.items.map((item) => (
            <li key={item.sourceId} className="lsw-sources__item">
              <span className="lsw-sources__item-label">{item.label}</span>
              <span className="lsw-sources__item-summary">{item.summary}</span>
            </li>
          ))}
        </ul>
      )}

      {capturedAtLabel ? <p className="lsw-sources__captured-at">Collected {capturedAtLabel}</p> : null}
    </section>
  );
}

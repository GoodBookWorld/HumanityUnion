import type { Implementation } from "@hu/types";

import { deriveNextMeaningfulObservation } from "../implementation-utils";

interface NextMeaningfulObservationSectionProps {
  implementation: Implementation;
}

export function NextMeaningfulObservationSection({
  implementation,
}: NextMeaningfulObservationSectionProps) {
  const observation = deriveNextMeaningfulObservation(implementation);
  const latestSnapshot = implementation.progressSnapshots.at(-1);
  const previousSnapshot =
    implementation.progressSnapshots.length >= 2 ? implementation.progressSnapshots.at(-2) : null;

  return (
    <div className="next-meaningful-observation">
      <p className="next-meaningful-observation__title">{observation.title}</p>
      <p className="next-meaningful-observation__detail">{observation.detail}</p>
      {latestSnapshot && previousSnapshot ? (
        <div className="implementation-progress-change">
          <p className="implementation-list__meta">
            Previous state: {previousSnapshot.collectiveProgressSummary}
          </p>
          <p className="implementation-list__meta">
            Current state: {latestSnapshot.collectiveProgressSummary}
          </p>
          <p className="implementation-list__meta">
            Snapshot recorded: {new Date(latestSnapshot.snapshotAt).toLocaleString()}
          </p>
        </div>
      ) : null}
      <p className="implementation-section__note">
        One contextual observation only. Observations explain what changed — they never recommend
        work or assign tasks.
      </p>
    </div>
  );
}

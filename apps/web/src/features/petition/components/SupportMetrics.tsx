import type { Petition } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

interface SupportMetricsProps {
  petition: Petition;
}

export function SupportMetrics({ petition }: SupportMetricsProps) {
  const { supportMetrics, status } = petition;
  const { supportThresholdStatus } = supportMetrics;
  const isFinal = status === "Closed" || status === "Archived";

  return (
    <div className="support-metrics">
      <ProfileField
        label={isFinal ? "Final Support Count" : "Support Count"}
        value={String(supportMetrics.totalSignatures)}
      />
      <ProfileField
        label="Participant Signatures"
        value={String(supportMetrics.participantSignatures)}
      />
      {supportThresholdStatus.thresholdDefined ? (
        <>
          <ProfileField
            label="Threshold Progress"
            value={`${supportThresholdStatus.currentCount} of ${supportThresholdStatus.thresholdCount ?? 0}`}
          />
          <ProfileField
            label="Threshold Reached"
            value={supportThresholdStatus.thresholdReached ? "Yes" : "No"}
          />
        </>
      ) : (
        <ProfileField label="Threshold" value="No threshold defined" />
      )}
      {supportMetrics.dailyActivity.length > 0 ? (
        <ProfileField
          label="Recent Activity"
          value={supportMetrics.dailyActivity
            .slice(-3)
            .map((entry) => `${entry.date}: ${entry.signatureCount}`)
            .join("; ")}
        />
      ) : (
        <p className="support-metrics__empty">
          {status === "Open"
            ? "No signatures recorded yet."
            : "Support activity will appear here as signatures are recorded."}
        </p>
      )}
    </div>
  );
}

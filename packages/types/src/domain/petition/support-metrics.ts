export interface DailyActivitySummary {
  date: string;
  signatureCount: number;
}

export interface SupportThresholdStatus {
  thresholdDefined: boolean;
  thresholdReached: boolean;
  currentCount: number;
  thresholdCount: number | null;
}

export interface SupportMetrics {
  totalSignatures: number;
  participantSignatures: number;
  dailyActivity: DailyActivitySummary[];
  supportThresholdStatus: SupportThresholdStatus;
}

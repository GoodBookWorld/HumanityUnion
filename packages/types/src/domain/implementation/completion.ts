/** Derived indicator that Implementation has reached closed execution state. */
export interface Completion {
  completionReached: boolean;
  derivedAt: string;
  explanation: string;
}

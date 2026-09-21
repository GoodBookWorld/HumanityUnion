import type { LanguageActivationJobStatus } from "@hu/types";

/** Poll only while automatic activation work is claimed. Never poll terminal or blocked jobs. */
export const LANGUAGE_ACTIVATION_POLL_INTERVAL_MS = 2500;

export function shouldPollLanguageActivationJob(
  status: LanguageActivationJobStatus | null | undefined,
): boolean {
  return status === "queued" || status === "running";
}

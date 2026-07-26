import type { PublicCivicArchiveRecord } from "@hu/types";

const TASK107_TITLE_PATTERNS = [
  "task-107 archive results fixture",
  "task-107b archive runtime search fixture",
  "task-107c horizontal results fixture",
  "archive results fixture record",
  "archive runtime search fixture record",
  "horizontal results fixture record",
] as const;

export function isPublicVerificationFixtureRecord(record: PublicCivicArchiveRecord): boolean {
  if (record.verification?.isVerificationFixture) {
    return true;
  }

  const verificationTask = record.verification?.verificationTask?.trim().toLowerCase() ?? "";

  if (verificationTask.includes("task-107")) {
    return true;
  }

  const title = record.title.trim().toLowerCase();

  return TASK107_TITLE_PATTERNS.some((pattern) => title.includes(pattern));
}

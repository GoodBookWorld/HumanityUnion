/**
 * Participant directory selection and sequential moderation.
 * Selection is keyed by memberId. Select-all applies only to the current page.
 */

export const PARTICIPANT_SELECTION_CAP = 25;

export interface SelectionUpdate {
  selectedIds: string[];
  limitReached: boolean;
}

export type PageCheckboxState = "checked" | "unchecked" | "indeterminate";

export interface ParticipantSelectionRecord {
  memberId: string;
  status: "active" | "disabled";
  role: "member" | "admin";
}

export interface ClassifiedParticipantSelection<T extends ParticipantSelectionRecord> {
  eligible: T[];
  skipped: T[];
}

export interface ParticipantMutationSuccess {
  memberId: string;
  emailQueued: boolean;
  emailWarning?: string;
}

export interface ParticipantMutationFailure {
  memberId: string;
  message: string;
}

export interface ParticipantMutationBatchResult {
  succeeded: ParticipantMutationSuccess[];
  failed: ParticipantMutationFailure[];
  blockedDuplicate: boolean;
}

export function toggleParticipantSelection(
  selectedIds: readonly string[],
  memberId: string,
  cap = PARTICIPANT_SELECTION_CAP,
): SelectionUpdate {
  const current = new Set(selectedIds);

  if (current.has(memberId)) {
    current.delete(memberId);
    return { selectedIds: [...current], limitReached: false };
  }

  if (current.size >= cap) {
    return { selectedIds: [...current], limitReached: true };
  }

  current.add(memberId);
  return { selectedIds: [...current], limitReached: false };
}

export function selectAllParticipantsOnPage(
  selectedIds: readonly string[],
  pageMemberIds: readonly string[],
  cap = PARTICIPANT_SELECTION_CAP,
): SelectionUpdate {
  const current = new Set(selectedIds);
  const pageIds = pageMemberIds.filter((memberId) => memberId.length > 0);
  const allPageSelected = pageIds.length > 0 && pageIds.every((memberId) => current.has(memberId));

  if (allPageSelected) {
    for (const memberId of pageIds) {
      current.delete(memberId);
    }
    return { selectedIds: [...current], limitReached: false };
  }

  let limitReached = false;
  for (const memberId of pageIds) {
    if (current.has(memberId)) {
      continue;
    }
    if (current.size >= cap) {
      limitReached = true;
      break;
    }
    current.add(memberId);
  }

  return { selectedIds: [...current], limitReached };
}

export function pageCheckboxState(
  selectedIds: readonly string[],
  pageMemberIds: readonly string[],
): PageCheckboxState {
  const selected = new Set(selectedIds);
  const pageIds = pageMemberIds.filter((memberId) => memberId.length > 0);

  if (pageIds.length === 0) {
    return "unchecked";
  }

  const selectedOnPage = pageIds.filter((memberId) => selected.has(memberId)).length;

  if (selectedOnPage === 0) {
    return "unchecked";
  }

  if (selectedOnPage === pageIds.length) {
    return "checked";
  }

  return "indeterminate";
}

export function classifySuspendTargets<T extends ParticipantSelectionRecord>(
  records: readonly T[],
  actorMemberId: string,
): ClassifiedParticipantSelection<T> {
  const eligible: T[] = [];
  const skipped: T[] = [];

  for (const record of records) {
    const canSuspend =
      record.status === "active" &&
      record.role !== "admin" &&
      record.memberId !== actorMemberId;

    if (canSuspend) {
      eligible.push(record);
    } else {
      skipped.push(record);
    }
  }

  return { eligible, skipped };
}

export function classifyRestoreTargets<T extends ParticipantSelectionRecord>(
  records: readonly T[],
): ClassifiedParticipantSelection<T> {
  const eligible: T[] = [];
  const skipped: T[] = [];

  for (const record of records) {
    if (record.status === "disabled") {
      eligible.push(record);
    } else {
      skipped.push(record);
    }
  }

  return { eligible, skipped };
}

export function createSequentialParticipantMutationRunner(max = PARTICIPANT_SELECTION_CAP) {
  let running = false;

  return {
    isRunning(): boolean {
      return running;
    },
    async run<T extends { emailQueued: boolean; emailWarning?: string }>(
      memberIds: readonly string[],
      runOne: (memberId: string) => Promise<T>,
    ): Promise<ParticipantMutationBatchResult> {
      if (running) {
        return { succeeded: [], failed: [], blockedDuplicate: true };
      }

      running = true;
      const succeeded: ParticipantMutationSuccess[] = [];
      const failed: ParticipantMutationFailure[] = [];

      try {
        const boundedIds = memberIds.slice(0, max);

        for (const memberId of boundedIds) {
          try {
            const result = await runOne(memberId);
            succeeded.push({
              memberId,
              emailQueued: result.emailQueued,
              ...(result.emailWarning ? { emailWarning: result.emailWarning } : {}),
            });
          } catch (error) {
            failed.push({
              memberId,
              message: error instanceof Error ? error.message : "Request failed.",
            });
          }
        }

        return { succeeded, failed, blockedDuplicate: false };
      } finally {
        running = false;
      }
    },
  };
}

export function countEmailWarnings(succeeded: readonly ParticipantMutationSuccess[]): number {
  return succeeded.filter((row) => !row.emailQueued || Boolean(row.emailWarning)).length;
}

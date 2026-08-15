/**
 * Communication UX Pack 03.6 — Collaboration Sessions: the official
 * meeting-scheduling system for every Initiative (Part 1). Sessions belong
 * to the Initiative itself, exactly like the Collaboration Channel
 * (Pack 03.5) — never a global Workspace meeting. This pack schedules
 * meetings only (Part 9): the platform stores an external meeting link and
 * never manages built-in video, screen sharing, or recording.
 */

/**
 * `"scheduled"`/`"cancelled"` are the only two states ever persisted. The
 * externally-visible three-value contract (Part 3: Upcoming / Completed /
 * Cancelled) is always derived at read time from `scheduledAtUtc` +
 * `estimatedDurationMinutes` compared against "now" — there is no
 * automation pack yet to flip a persisted status when a meeting's time
 * passes (Part 8 defers all time-based automation), so "Completed" must
 * never be a value that can go stale in storage.
 */
export type InitiativeCollaborationSessionStatus = "upcoming" | "completed" | "cancelled";

export type InitiativeCollaborationSessionAttendanceResponse = "accepted" | "maybe" | "declined";

/** The durable record (Part 3). No attachments, no recordings (Part 15) — every field is plain text, a link, or a number. */
export interface InitiativeCollaborationSession {
  sessionId: string;
  initiativeId: string;
  title: string;
  agenda?: string;
  description?: string;
  /** `YYYY-MM-DD`, the wall-clock date in `timezone`. */
  meetingDate: string;
  /** `HH:mm` (24h), the wall-clock time in `timezone`. */
  meetingTime: string;
  /** IANA timezone identifier (e.g. `"Europe/Berlin"`, `"UTC"`) — validated server-side via `Intl`. */
  timezone: string;
  estimatedDurationMinutes: number;
  /** Part 9 — a generic external link (Google Meet/Teams/Zoom/Jitsi/BigBlueButton/...); never validated against a provider allowlist, never authenticated by this platform. */
  externalMeetingLink?: string;
  /**
   * Derived once at create/update time from `meetingDate` + `meetingTime` +
   * `timezone` (never independently editable) — the single instant used
   * for sort order, status derivation, and the Part 8/10 reminder
   * extension point.
   */
  scheduledAtUtc: string;
  createdByParticipantId: string;
  createdAt: string;
  updatedAt: string;
  /** Present only once cancelled (Part 5 "Cancel Session"); otherwise absent. */
  cancelledAt?: string;
}

export interface InitiativeCollaborationSessionAttendance {
  sessionId: string;
  initiativeId: string;
  participantId: string;
  response: InitiativeCollaborationSessionAttendanceResponse;
  respondedAt: string;
}

/** Part 6 — totals only; `noResponse` counts current Active Allies who have not yet answered (the Author is never included — they organize, they do not RSVP). */
export interface InitiativeCollaborationSessionAttendanceTotals {
  accepted: number;
  maybe: number;
  declined: number;
  noResponse: number;
}

export interface InitiativeCollaborationSessionAttendanceRosterEntry {
  participantId: string;
  displayName: string;
  avatarUrl?: string;
  response: InitiativeCollaborationSessionAttendanceResponse | null;
}

/** The full projection returned to an authorized viewer (Author or Active Ally) for one session. */
export interface InitiativeCollaborationSessionView extends InitiativeCollaborationSession {
  /** Part 3 — always derived, never trusted from storage (see `InitiativeCollaborationSessionStatus`). */
  status: InitiativeCollaborationSessionStatus;
  createdBy: {
    displayName: string;
    avatarUrl?: string;
    profileUrl?: string;
  };
  attendanceTotals: InitiativeCollaborationSessionAttendanceTotals;
  /** The requesting viewer's own response; `null` for the Author (never RSVPs) or an Ally who has not yet answered. */
  viewerResponse: InitiativeCollaborationSessionAttendanceResponse | null;
  /** Part 5/2 — true only for the Author; Active Allies can view and RSVP but never edit/cancel. */
  canEdit: boolean;
  /** Part 2 — true only for an Active Ally viewer (the Author organizes, they do not RSVP to their own session). */
  canRespond: boolean;
  /** Part 6 — visible to the Author only (who responded what); `undefined` for an Active Ally viewer. */
  attendanceRoster?: InitiativeCollaborationSessionAttendanceRosterEntry[];
}

export interface InitiativeCollaborationSessionListResult {
  initiativeId: string;
  /** Part 4 — Upcoming first (soonest first), then Completed/Cancelled history (most recent first). */
  sessions: InitiativeCollaborationSessionView[];
  viewerRole: "author" | "active_ally";
  /** Part 5 — true only for the Author. */
  canCreate: boolean;
}

/** Part 3/5 — the fields an Author supplies when creating or editing/rescheduling a Session. */
export interface InitiativeCollaborationSessionInput {
  title: string;
  agenda?: string;
  description?: string;
  meetingDate: string;
  meetingTime: string;
  timezone: string;
  estimatedDurationMinutes: number;
  externalMeetingLink?: string;
}

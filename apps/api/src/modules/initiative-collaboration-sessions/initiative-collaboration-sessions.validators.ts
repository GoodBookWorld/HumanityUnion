import { InitiativeCollaborationSessionValidationError } from "./initiative-collaboration-sessions.errors.js";

/**
 * Communication UX Pack 03.6 Part 3 — field limits for the Session model.
 * Deliberately generous but bounded; no attachment/emoji/reaction fields
 * exist anywhere in this module (Part 15).
 */
export const MAX_SESSION_TITLE_LENGTH = 140;
export const MAX_SESSION_AGENDA_LENGTH = 2000;
export const MAX_SESSION_DESCRIPTION_LENGTH = 4000;
export const MIN_SESSION_DURATION_MINUTES = 5;
export const MAX_SESSION_DURATION_MINUTES = 480;
export const MAX_SESSION_MEETING_LINK_LENGTH = 2000;

const HTML_SIGNIFICANT_CHARACTERS = /[<>]/;
/** Every Unicode control character except tab (\t), newline (\n), carriage return (\r). */
// eslint-disable-next-line no-control-regex -- intentional: detects disallowed control-only content.
const DISALLOWED_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MEETING_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MEETING_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function assertTextSafe(value: string, fieldLabel: string): void {
  if (HTML_SIGNIFICANT_CHARACTERS.test(value) || DISALLOWED_CONTROL_CHARACTERS.test(value)) {
    throw new InitiativeCollaborationSessionValidationError(`${fieldLabel} contains invalid characters.`);
  }
}

export function validateSessionTitle(rawTitle: unknown): string {
  if (typeof rawTitle !== "string") {
    throw new InitiativeCollaborationSessionValidationError("Session title is required.");
  }

  assertTextSafe(rawTitle, "Session title");
  const normalized = rawTitle.trim();

  if (normalized.length === 0) {
    throw new InitiativeCollaborationSessionValidationError("Session title cannot be empty.");
  }

  if (normalized.length > MAX_SESSION_TITLE_LENGTH) {
    throw new InitiativeCollaborationSessionValidationError(
      `Session title must be at most ${MAX_SESSION_TITLE_LENGTH} characters.`,
    );
  }

  return normalized;
}

export function validateOptionalSessionText(
  rawValue: unknown,
  fieldLabel: string,
  maxLength: number,
): string | undefined {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return undefined;
  }

  if (typeof rawValue !== "string") {
    throw new InitiativeCollaborationSessionValidationError(`${fieldLabel} must be text.`);
  }

  assertTextSafe(rawValue, fieldLabel);
  const normalized = rawValue.replace(/\r\n/g, "\n").trim();

  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized.length > maxLength) {
    throw new InitiativeCollaborationSessionValidationError(`${fieldLabel} must be at most ${maxLength} characters.`);
  }

  return normalized;
}

export function validateMeetingDate(rawDate: unknown): string {
  if (typeof rawDate !== "string" || !MEETING_DATE_PATTERN.test(rawDate)) {
    throw new InitiativeCollaborationSessionValidationError("Meeting date must be in YYYY-MM-DD format.");
  }

  const [year, month, day] = rawDate.split("-").map((part) => Number.parseInt(part, 10));
  const probe = new Date(Date.UTC(year!, month! - 1, day!));

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month! - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new InitiativeCollaborationSessionValidationError("Meeting date is not a valid calendar date.");
  }

  return rawDate;
}

export function validateMeetingTime(rawTime: unknown): string {
  if (typeof rawTime !== "string" || !MEETING_TIME_PATTERN.test(rawTime)) {
    throw new InitiativeCollaborationSessionValidationError("Meeting time must be in HH:mm (24h) format.");
  }

  return rawTime;
}

export function validateTimezone(rawTimezone: unknown): string {
  if (typeof rawTimezone !== "string" || rawTimezone.trim().length === 0) {
    throw new InitiativeCollaborationSessionValidationError("Timezone is required.");
  }

  const normalized = rawTimezone.trim();

  try {
    // Constructed only to validate the IANA identifier; throws RangeError if invalid.
    void new Intl.DateTimeFormat("en-US", { timeZone: normalized });
  } catch {
    throw new InitiativeCollaborationSessionValidationError(`"${normalized}" is not a recognized timezone.`);
  }

  return normalized;
}

export function validateEstimatedDurationMinutes(rawDuration: unknown): number {
  const duration = typeof rawDuration === "number" ? rawDuration : Number(rawDuration);

  if (!Number.isFinite(duration) || !Number.isInteger(duration)) {
    throw new InitiativeCollaborationSessionValidationError("Estimated duration must be a whole number of minutes.");
  }

  if (duration < MIN_SESSION_DURATION_MINUTES || duration > MAX_SESSION_DURATION_MINUTES) {
    throw new InitiativeCollaborationSessionValidationError(
      `Estimated duration must be between ${MIN_SESSION_DURATION_MINUTES} and ${MAX_SESSION_DURATION_MINUTES} minutes.`,
    );
  }

  return duration;
}

/** Part 9 — a generic link only; any http(s) URL is accepted, no provider allowlist, no embedding, no authentication. */
export function validateExternalMeetingLink(rawLink: unknown): string | undefined {
  if (rawLink === undefined || rawLink === null || rawLink === "") {
    return undefined;
  }

  if (typeof rawLink !== "string") {
    throw new InitiativeCollaborationSessionValidationError("External meeting link must be text.");
  }

  const normalized = rawLink.trim();

  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized.length > MAX_SESSION_MEETING_LINK_LENGTH) {
    throw new InitiativeCollaborationSessionValidationError("External meeting link is too long.");
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new InitiativeCollaborationSessionValidationError("External meeting link must be a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InitiativeCollaborationSessionValidationError("External meeting link must use http or https.");
  }

  return normalized;
}

/**
 * Derives the single UTC instant a `meetingDate` + `meetingTime` wall clock
 * reading in `timezone` refers to, without a timezone-database dependency.
 * Standard technique: guess the instant by treating the wall-clock
 * components as UTC, read back what wall-clock time that guess actually
 * renders as in the target zone, then correct the guess by the
 * difference. One correction pass is sufficient outside of the exact
 * clock second of a DST transition, which is an acceptable edge case for
 * meeting scheduling (Part 8/10 — reminders are a future automation pack;
 * they are not affected by a same-second edge case here).
 */
export function resolveScheduledAtUtc(meetingDate: string, meetingTime: string, timezone: string): string {
  const [year, month, day] = meetingDate.split("-").map((part) => Number.parseInt(part, 10));
  const [hour, minute] = meetingTime.split(":").map((part) => Number.parseInt(part, 10));

  const wallClockAsUtcMs = Date.UTC(year!, month! - 1, day!, hour!, minute!, 0);
  const offsetMinutes = resolveTimezoneOffsetMinutes(timezone, wallClockAsUtcMs);
  const correctedMs = wallClockAsUtcMs - offsetMinutes * 60_000;
  const offsetMinutesAtCorrected = resolveTimezoneOffsetMinutes(timezone, correctedMs);

  return new Date(wallClockAsUtcMs - offsetMinutesAtCorrected * 60_000).toISOString();
}

/** Positive when the zone is ahead of UTC (e.g. `+120` for UTC+2), matching `Date.getTimezoneOffset()`'s sign convention inverted. */
function resolveTimezoneOffsetMinutes(timezone: string, atUtcMs: number): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(new Date(atUtcMs));
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const asUtcMs = Date.UTC(
    Number.parseInt(lookup.get("year") ?? "1970", 10),
    Number.parseInt(lookup.get("month") ?? "1", 10) - 1,
    Number.parseInt(lookup.get("day") ?? "1", 10),
    Number.parseInt(lookup.get("hour") ?? "0", 10),
    Number.parseInt(lookup.get("minute") ?? "0", 10),
    Number.parseInt(lookup.get("second") ?? "0", 10),
  );

  return Math.round((asUtcMs - atUtcMs) / 60_000);
}

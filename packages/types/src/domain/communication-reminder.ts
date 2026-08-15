/**
 * Communication UX Pack 03.4 Part 7 — a generic Reminder model.
 *
 * Lifecycle UX Correction Pack 01 Part 6/7 gives this model a real backend
 * (persistence, service, routes — see `apps/api/src/modules/reminders`) and
 * a reusable generation architecture so any feature module can create a
 * Reminder without inventing its own storage. `category` stays deliberately
 * generic (never tied to one Initiative stage's internals) so new
 * generation sources can reuse the exact same shape.
 */
export type CommunicationReminderCategory =
  | "initiative"
  | "discussion"
  | "analysis"
  | "proposal"
  | "revision"
  | "petition"
  | "decision"
  | "collective_decision"
  | "implementation"
  | "official_response"
  | "public_impact"
  | "collaboration"
  | "session";

/**
 * Lifecycle UX Correction Pack 01 Part 6 — clicking a Reminder marks it
 * completed and moves it into Archive in one step, so there is no separate
 * "completed but still active" state to model: a Reminder is either
 * `"active"` (shown in the Reminders section) or `"archived"` (shown only
 * in the Archive section, with `completedAt` recording when the
 * Participant acted on it).
 */
export type CommunicationReminderStatus = "active" | "archived";

/** One personal civic reminder row — deliberately generic (Part 7), never tied to one Initiative stage's internals. */
export interface CommunicationReminder {
  reminderId: string;
  recipientProfileId: string;
  recipientUserId: string;
  category: CommunicationReminderCategory;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedUrl: string;
  status: CommunicationReminderStatus;
  createdAt: string;
  /** Optional target date the reminder is nudging the Participant toward (e.g. an upcoming Session). */
  dueAt?: string;
  completedAt?: string;
  archivedAt?: string;
  /**
   * Community Intelligence Pack 02 — optional generation fingerprint so a
   * materially changed relationship can become eligible again after cooldown
   * while identical rediscovery stays suppressed. Not exposed on public views.
   */
  generationKey?: string;
}

/** Public view of a Reminder for its own recipient — never exposes recipient identity fields (mirrors `MemberNotificationView`). */
export interface CommunicationReminderView {
  reminderId: string;
  category: CommunicationReminderCategory;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedUrl: string;
  status: CommunicationReminderStatus;
  createdAt: string;
  dueAt?: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface CommunicationReminderListResponse {
  reminders: CommunicationReminderView[];
}

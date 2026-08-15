import "./communication-summary.css";

export interface CommunicationSummaryProps {
  unreadNotifications: number;
  unreadMessages: number;
  pendingReminders: number;
}

/**
 * Communication UX Pack 03.4 Part 4 — a compact summary at the top of the
 * Notification Center. Every count is derived from data the page already
 * fetched for its three sections (Part 11 — no new aggregation service, no
 * duplicated projection, no extra network round trip).
 */
export function CommunicationSummary({
  unreadNotifications,
  unreadMessages,
  pendingReminders,
}: CommunicationSummaryProps) {
  return (
    <dl className="communication-summary" aria-label="Communication summary">
      <div className="communication-summary__item">
        <dt className="communication-summary__label">Unread Notifications</dt>
        <dd className="communication-summary__value">{unreadNotifications}</dd>
      </div>
      <div className="communication-summary__item">
        <dt className="communication-summary__label">Unread Messages</dt>
        <dd className="communication-summary__value">{unreadMessages}</dd>
      </div>
      <div className="communication-summary__item">
        <dt className="communication-summary__label">Pending Reminders</dt>
        <dd className="communication-summary__value">{pendingReminders}</dd>
      </div>
    </dl>
  );
}

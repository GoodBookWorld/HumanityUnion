"use client";

import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { WorkspaceStatusBadge } from "../../initiative-workspace-ux/components/WorkspaceStatusBadge";
import {
  integrityMediaAuthorConnectionLabel,
  type IntegrityMediaAuthorDeliveryStatus,
  type IntegrityMediaAuthorListState,
  type IntegrityMediaAuthorRow,
} from "../admin-integrity-media-authors-model";

export interface AdminIntegrityAuthorsPanelProps {
  phase: "loading" | "error" | "ready";
  errorMessage?: string | null;
  authors: readonly IntegrityMediaAuthorRow[];
  state: IntegrityMediaAuthorListState;
  offset: number;
  total: number;
  hasMore: boolean;
  onStateChange: (state: IntegrityMediaAuthorListState) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSend: (row: IntegrityMediaAuthorRow) => void;
}

export function AdminIntegrityAuthorsPanel({
  phase,
  errorMessage,
  authors,
  state,
  offset,
  total,
  hasMore,
  onStateChange,
  onPrevious,
  onNext,
  onSend,
}: AdminIntegrityAuthorsPanelProps) {
  const pageEnd = authors.length === 0 ? offset : offset + authors.length;

  return (
    <div className="admin-integrity-authors">
      <p className="hu-caption admin-panel__note">
        Names and photos are the linked Humanity Union Participant. This is not an Integrity
        Media profile. Blog administration stays in{" "}
        <a className="admin-panel__link" href="/admin/publishing">
          Publishing
        </a>
        .
      </p>

      <label className="admin-panel__label" htmlFor="admin-integrity-author-state">
        Connection
        <select
          id="admin-integrity-author-state"
          value={state}
          onChange={(event) => onStateChange(event.target.value as IntegrityMediaAuthorListState)}
        >
          <option value="all">All</option>
          <option value="linked">Linked</option>
          <option value="setup_pending">Setup pending</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>

      {phase === "loading" ? <p className="hu-body">Loading Integrity Authors…</p> : null}

      {phase === "error" ? (
        <StatusBanner
          title="Integrity Authors unavailable"
          message={errorMessage ?? "Integrity authors could not be loaded."}
        />
      ) : null}

      {phase === "ready" && authors.length === 0 ? (
        <p className="hu-body">No Integrity Media authors match this filter.</p>
      ) : null}

      {phase === "ready" && authors.length > 0 ? (
        <>
          <div className="admin-participants-table-wrap">
            <table className="admin-participants-table admin-integrity-authors-table">
              <thead>
                <tr>
                  <th scope="col">Participant</th>
                  <th scope="col">Connection</th>
                  <th scope="col">First linked</th>
                  <th scope="col">Messages</th>
                  <th scope="col">Latest delivery</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {authors.map((row) => {
                  const initial = (row.participantDisplayName[0] ?? "?").toUpperCase();
                  const connection = integrityMediaAuthorConnectionLabel(row);
                  const latest = row.latestMessage;

                  return (
                    <tr key={row.memberId}>
                      <td>
                        <div className="admin-participants-table__identity">
                          {row.participantAvatarUrl ? (
                            <img
                              src={row.participantAvatarUrl}
                              alt=""
                              width={32}
                              height={32}
                              className="admin-participants-table__avatar"
                            />
                          ) : (
                            <span
                              className="admin-participants-table__avatar-fallback"
                              aria-hidden="true"
                            >
                              {initial}
                            </span>
                          )}
                          <div>
                            <p className="hu-caption">Humanity Union Participant</p>
                            <p className="admin-participants-table__name">
                              {row.participantDisplayName}
                            </p>
                            {row.participantProfileHref ? (
                              <a className="admin-panel__link" href={row.participantProfileHref}>
                                View profile
                              </a>
                            ) : null}
                            <p className="hu-caption admin-participants-table__secondary">
                              Reference {row.externalAuthorId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <WorkspaceStatusBadge status={connection} label={connection} />
                      </td>
                      <td>
                        <time dateTime={row.createdAt}>{formatCompactDate(row.createdAt)}</time>
                      </td>
                      <td>{row.messageCount}</td>
                      <td>
                        {latest ? (
                          <div>
                            <p className="admin-participants-table__name">{latest.title}</p>
                            <WorkspaceStatusBadge
                              status={latest.status}
                              label={deliveryLabel(latest.status)}
                            />
                            <p className="hu-caption">
                              <time dateTime={latest.deliveredAt ?? latest.createdAt}>
                                {formatCompactDate(latest.deliveredAt ?? latest.createdAt)}
                              </time>
                            </p>
                            {latest.lastErrorCode ? (
                              <p className="hu-caption">Error {latest.lastErrorCode}</p>
                            ) : null}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div className="admin-participants-table__actions">
                          {row.canSend ? (
                            <Button
                              type="button"
                              variant="primary"
                              aria-label={`Send message to ${row.participantDisplayName}`}
                              onClick={() => onSend(row)}
                            >
                              Send Message
                            </Button>
                          ) : (
                            <span className="hu-caption">Send unavailable</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="admin-participants-pagination">
            <p className="hu-caption">
              Showing {authors.length === 0 ? 0 : offset + 1}–{pageEnd} of {total}
            </p>
            <div className="admin-participants-pagination__actions">
              <Button type="button" disabled={offset <= 0} onClick={onPrevious}>
                Previous
              </Button>
              <Button type="button" disabled={!hasMore} onClick={onNext}>
                Next
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function deliveryLabel(status: IntegrityMediaAuthorDeliveryStatus): string {
  if (status === "delivered") {
    return "Delivered";
  }
  if (status === "pending") {
    return "Pending";
  }
  return "Failed";
}

function formatCompactDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

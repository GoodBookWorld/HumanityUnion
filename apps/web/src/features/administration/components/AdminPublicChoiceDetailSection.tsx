"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type {
  AdminPublicChoiceCandidateRow,
  AdminPublicChoiceDetail,
  AuthUserPublic,
} from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { WorkspaceStatusBadge } from "../../initiative-workspace-ux/components/WorkspaceStatusBadge";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import {
  blockAdminPublicChoiceCandidate,
  blockAdminPublicChoiceElection,
  getAdminPublicChoiceDetail,
  unblockAdminPublicChoiceCandidate,
  unblockAdminPublicChoiceElection,
  updateAdminPublicChoiceCandidate,
} from "../admin-public-choice-api";
import { AdminMetricDetailsGrid } from "./AdminMetricDetailsGrid";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";
import "./admin-public-choice.css";

interface AdminPublicChoiceDetailSectionProps {
  user: AuthUserPublic;
  initiativeId: string;
}

type PendingModeration =
  | { kind: "block-election" }
  | { kind: "unblock-election" }
  | { kind: "block-candidate"; candidate: AdminPublicChoiceCandidateRow }
  | { kind: "unblock-candidate"; candidate: AdminPublicChoiceCandidateRow }
  | null;

function formatCompactDate(value?: string): string {
  if (!value) {
    return "—";
  }
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

/**
 * Fix 08C — Admin Public Choice election detail + candidate moderation.
 */
export function AdminPublicChoiceDetailSection({
  user: _user,
  initiativeId,
}: AdminPublicChoiceDetailSectionProps) {
  const [detail, setDetail] = useState<AdminPublicChoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [pending, setPending] = useState<PendingModeration>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCampaignPageUrl, setEditCampaignPageUrl] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [editPending, setEditPending] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDenied(false);

    try {
      const response = await getAdminPublicChoiceDetail(initiativeId);
      setDetail(response);
    } catch (loadError: unknown) {
      setDetail(null);
      if (isForbiddenError(loadError)) {
        setDenied(true);
        setError("Public Choice inspection requires an Administrator account.");
      } else {
        setError(formatAuthFormError(loadError));
      }
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  function beginEdit(candidate: AdminPublicChoiceCandidateRow) {
    setEditingCandidateId(candidate.candidateId);
    setEditName(candidate.name);
    setEditCampaignPageUrl(candidate.campaignPageUrl ?? "");
    setEditPhotoUrl(candidate.photoUrl ?? "");
    setActionError(null);
    setActionMessage(null);
  }

  function cancelEdit() {
    setEditingCandidateId(null);
    setEditName("");
    setEditCampaignPageUrl("");
    setEditPhotoUrl("");
  }

  async function saveCandidateEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingCandidateId || !editName.trim()) {
      return;
    }

    setEditPending(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const photoTrimmed = editPhotoUrl.trim();
      await updateAdminPublicChoiceCandidate({
        initiativeId,
        candidateId: editingCandidateId,
        name: editName.trim(),
        campaignPageUrl: editCampaignPageUrl.trim() || null,
        photoUrl: photoTrimmed ? photoTrimmed : null,
      });
      setActionMessage("Candidate updated.");
      cancelEdit();
      await loadDetail();
    } catch (commandError: unknown) {
      setActionError(formatAuthFormError(commandError));
    } finally {
      setEditPending(false);
    }
  }

  async function confirmModeration() {
    if (!pending) {
      return;
    }

    setConfirming(true);
    setActionError(null);
    setActionMessage(null);

    try {
      switch (pending.kind) {
        case "block-election":
          await blockAdminPublicChoiceElection({ initiativeId });
          setActionMessage("Election blocked. Interaction is frozen until an administrator unblocks it.");
          break;
        case "unblock-election":
          await unblockAdminPublicChoiceElection({ initiativeId });
          setActionMessage("Election unblocked. Lifecycle open/closed state is unchanged.");
          break;
        case "block-candidate":
          await blockAdminPublicChoiceCandidate({
            initiativeId,
            candidateId: pending.candidate.candidateId,
          });
          setActionMessage(`Blocked candidate “${pending.candidate.name}”.`);
          break;
        case "unblock-candidate":
          await unblockAdminPublicChoiceCandidate({
            initiativeId,
            candidateId: pending.candidate.candidateId,
          });
          setActionMessage(`Unblocked candidate “${pending.candidate.name}”.`);
          break;
      }
      setPending(null);
      await loadDetail();
    } catch (commandError: unknown) {
      setActionError(formatAuthFormError(commandError));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <p className="hu-caption admin-panel__note">
        <Link className="admin-panel__link" href="/admin/public-choice">
          ← Public Choice directory
        </Link>
      </p>

      {loading ? <p className="hu-body">Loading Public Choice detail…</p> : null}
      {error ? (
        <StatusBanner
          title={denied ? "Access restricted" : "Detail unavailable"}
          message={error}
        />
      ) : null}

      {actionMessage ? (
        <StatusBanner title="Action completed" message={actionMessage} />
      ) : null}
      {actionError ? <StatusBanner title="Action failed" message={actionError} /> : null}

      {detail ? (
        <>
          <ProfileSection title="Election">
            <AdminMetricDetailsGrid
              aria-label="Election identity"
              cells={[
                { label: "Election", value: detail.electionTitle },
                {
                  label: "Author / steward",
                  value: detail.stewardUniqueName
                    ? `${detail.stewardDisplayName} (@${detail.stewardUniqueName})`
                    : detail.stewardDisplayName,
                },
                { label: "Country", value: detail.countrySlug ?? "—" },
                {
                  label: "Start / End",
                  value: `${formatCompactDate(detail.openedAt)} / ${formatCompactDate(detail.closesAt ?? detail.closedAt)}`,
                },
                {
                  label: "Voting status",
                  value: <WorkspaceStatusBadge status={detail.votingStatus} />,
                },
                {
                  label: "Admin status",
                  value: (
                    <WorkspaceStatusBadge
                      status={detail.administrativelyBlocked ? "blocked" : "active"}
                    />
                  ),
                },
                {
                  label: "Public page",
                  value: (
                    <Link className="admin-panel__link" href={detail.publicUrl}>
                      Open public page
                    </Link>
                  ),
                },
                {
                  label: "Initiative ID",
                  value: <code>{detail.initiativeId}</code>,
                },
              ]}
            />
            <p className="hu-body" style={{ marginTop: "0.85rem" }}>
              {detail.descriptionPreview}
            </p>

            <div className="admin-public-choice-actions" style={{ marginTop: "0.85rem" }}>
              {detail.administrativelyBlocked ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setActionError(null);
                    setActionMessage(null);
                    setPending({ kind: "unblock-election" });
                  }}
                >
                  Unblock election
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setActionError(null);
                    setActionMessage(null);
                    setPending({ kind: "block-election" });
                  }}
                >
                  Block election
                </Button>
              )}
            </div>
          </ProfileSection>

          <ProfileSection title="Result summary">
            <AdminMetricDetailsGrid
              aria-label="Result summary"
              cells={[
                { label: "Ballot mode", value: detail.resultSummary.ballotMode },
                {
                  label: "Effective voters",
                  value:
                    detail.resultSummary.totalEffectiveVoters === null &&
                    detail.effectiveVoterCount === null
                      ? "—"
                      : String(
                          detail.resultSummary.totalEffectiveVoters ??
                            detail.effectiveVoterCount ??
                            0,
                        ),
                },
                { label: "Candidates", value: String(detail.candidateCount) },
                {
                  label: "Decision ID",
                  value: detail.decisionId ? <code>{detail.decisionId}</code> : "—",
                },
              ]}
            />
          </ProfileSection>

          <ProfileSection title="Candidate roster">
            <p className="hu-caption admin-panel__note">
              Admin may edit candidate fields even while a candidate is blocked. Election-wide
              block still freezes public interaction.
            </p>

            <div className="admin-initiatives-table-wrap">
              <table className="admin-initiatives-table">
                <thead>
                  <tr>
                    <th scope="col">Photo</th>
                    <th scope="col">Name</th>
                    <th scope="col">Campaign page</th>
                    <th scope="col">Votes</th>
                    <th scope="col">Blocked</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.candidates.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No candidates in this election.</td>
                    </tr>
                  ) : (
                    detail.candidates.map((candidate) => {
                      const photoSrc = resolveMediaUrl(candidate.photoUrl);
                      const isEditing = editingCandidateId === candidate.candidateId;

                      return (
                        <tr key={candidate.candidateId}>
                          <td>
                            {photoSrc ? (
                              <img
                                className="admin-public-choice-candidate-photo"
                                src={photoSrc}
                                alt=""
                              />
                            ) : (
                              <span className="admin-public-choice-candidate-photo admin-public-choice-candidate-photo--empty">
                                —
                              </span>
                            )}
                          </td>
                          <td>
                            <p className="admin-initiatives-table__title">{candidate.name}</p>
                            {isEditing ? (
                              <form
                                className="admin-public-choice-edit-form"
                                onSubmit={(event) => {
                                  void saveCandidateEdit(event);
                                }}
                              >
                                <div className="admin-public-choice-edit-form__fields">
                                  <label>
                                    Name
                                    <input
                                      type="text"
                                      value={editName}
                                      onChange={(event) => setEditName(event.target.value)}
                                      required
                                      maxLength={120}
                                    />
                                  </label>
                                  <label>
                                    Campaign page URL
                                    <input
                                      type="url"
                                      value={editCampaignPageUrl}
                                      onChange={(event) =>
                                        setEditCampaignPageUrl(event.target.value)
                                      }
                                      placeholder="https://"
                                    />
                                  </label>
                                  <label>
                                    Photo URL (optional)
                                    <input
                                      type="text"
                                      value={editPhotoUrl}
                                      onChange={(event) => setEditPhotoUrl(event.target.value)}
                                      placeholder="https:// or /media/…"
                                    />
                                  </label>
                                </div>
                                <div className="admin-public-choice-edit-form__actions">
                                  <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={editPending || !editName.trim()}
                                  >
                                    {editPending ? "Saving…" : "Save"}
                                  </Button>
                                  <Button
                                    type="button"
                                    disabled={editPending}
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </form>
                            ) : null}
                          </td>
                          <td>
                            {candidate.campaignPageUrl ? (
                              <a
                                className="admin-panel__link"
                                href={candidate.campaignPageUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{candidate.voteCount}</td>
                          <td>{candidate.isBlocked ? "Yes" : "No"}</td>
                          <td>
                            <div className="admin-public-choice-actions">
                              {!isEditing ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => beginEdit(candidate)}
                                >
                                  Edit
                                </Button>
                              ) : null}
                              {candidate.isBlocked ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => {
                                    setActionError(null);
                                    setActionMessage(null);
                                    setPending({
                                      kind: "unblock-candidate",
                                      candidate,
                                    });
                                  }}
                                >
                                  Unblock
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="danger"
                                  onClick={() => {
                                    setActionError(null);
                                    setActionMessage(null);
                                    setPending({
                                      kind: "block-candidate",
                                      candidate,
                                    });
                                  }}
                                >
                                  Block
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </ProfileSection>
        </>
      ) : null}

      <ConfirmDialog
        isOpen={pending?.kind === "block-election"}
        title="Block election?"
        description="This will stop participant interaction with this election until an administrator unblocks it."
        confirmLabel="Block election"
        isConfirming={confirming}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          void confirmModeration();
        }}
      />

      <ConfirmDialog
        isOpen={pending?.kind === "unblock-election"}
        title="Unblock election?"
        description="This will restore interaction if the election is otherwise open."
        confirmLabel="Unblock election"
        destructive={false}
        isConfirming={confirming}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          void confirmModeration();
        }}
      />

      <ConfirmDialog
        isOpen={pending?.kind === "block-candidate"}
        title="Block candidate?"
        description="This candidate will remain visible in the election results, but new votes will not be accepted."
        confirmLabel="Block candidate"
        isConfirming={confirming}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          void confirmModeration();
        }}
      />

      <ConfirmDialog
        isOpen={pending?.kind === "unblock-candidate"}
        title="Unblock candidate?"
        description="This candidate will become available for selection if the parent election is open."
        confirmLabel="Unblock candidate"
        destructive={false}
        isConfirming={confirming}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          void confirmModeration();
        }}
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { AdminInitiativeDetail, AuthUserPublic } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { WorkspaceStatusBadge } from "../../initiative-workspace-ux/components/WorkspaceStatusBadge";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import {
  getAdminInitiativeDetail,
  hideAdminInitiativeFromPublic,
  restoreAdminInitiativePublicVisibility,
} from "../admin-initiative-directory-api";
import { AdminCapabilityGap } from "./AdminCapabilityGap";
import { AdminMetricDetailsGrid } from "./AdminMetricDetailsGrid";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";

interface AdminInitiativeDetailSectionProps {
  user: AuthUserPublic;
  initiativeId: string;
}

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

export function AdminInitiativeDetailSection({
  user: _user,
  initiativeId,
}: AdminInitiativeDetailSectionProps) {
  const [detail, setDetail] = useState<AdminInitiativeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [techOpen, setTechOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDenied(false);

    try {
      const response = await getAdminInitiativeDetail(initiativeId);
      setDetail(response);
    } catch (loadError: unknown) {
      setDetail(null);
      if (isForbiddenError(loadError)) {
        setDenied(true);
        setError("Initiative inspection requires an Administrator account.");
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

  async function runVisibilityAction(kind: "hide" | "restore") {
    setActionError(null);
    setActionMessage(null);
    setActionPending(true);

    try {
      if (kind === "hide") {
        await hideAdminInitiativeFromPublic({ initiativeId, reason });
        setActionMessage("Initiative hidden from public visibility. Ownership and content unchanged.");
      } else {
        await restoreAdminInitiativePublicVisibility({ initiativeId, reason });
        setActionMessage("Public visibility restored. Ownership and content unchanged.");
      }
      setReason("");
      await loadDetail();
    } catch (commandError: unknown) {
      setActionError(formatAuthFormError(commandError));
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <p className="hu-caption admin-panel__note">
        <Link className="admin-panel__link" href="/admin/initiatives">
          ← Initiative directory
        </Link>
      </p>

      {loading ? <p className="hu-body">Loading Initiative detail…</p> : null}
      {error ? (
        <StatusBanner
          title={denied ? "Access restricted" : "Detail unavailable"}
          message={error}
        />
      ) : null}

      {detail ? (
        <>
          <ProfileSection title="Identity">
            <AdminMetricDetailsGrid
              aria-label="Initiative identity"
              cells={[
                { label: "Title", value: detail.title },
                {
                  label: "Author / steward",
                  value: detail.stewardUniqueName
                    ? `${detail.stewardDisplayName} (@${detail.stewardUniqueName})`
                    : detail.stewardDisplayName,
                },
                {
                  label: "Geography",
                  value: [
                    detail.geography.countrySlug,
                    detail.geography.regionSlug,
                    detail.geography.region,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—",
                },
                {
                  label: "Created / updated",
                  value: `${formatCompactDate(detail.createdAt)} / ${formatCompactDate(detail.updatedAt)}`,
                },
              ]}
            />
            <p className="hu-body" style={{ marginTop: "0.85rem" }}>
              {detail.descriptionPreview}
            </p>
            <details
              className="admin-panel__tech-details"
              open={techOpen}
              onToggle={(event) => setTechOpen(event.currentTarget.open)}
            >
              <summary>Technical details</summary>
              <dl className="admin-panel__tech-list">
                <div>
                  <dt>Initiative ID</dt>
                  <dd>
                    <code>{detail.initiativeId}</code>
                  </dd>
                </div>
                <div>
                  <dt>Steward Participant ID</dt>
                  <dd>
                    <code>{detail.stewardId}</code>
                  </dd>
                </div>
              </dl>
            </details>
          </ProfileSection>

          <ProfileSection title="Lifecycle">
            <p className="hu-caption admin-panel__note">
              Stages are marked present only when canonical related records exist (or a
              discussion status signal). Nothing is fabricated as complete.
            </p>
            <ul className="admin-initiative-lifecycle">
              {detail.lifecycleStages.map((stage) => (
                <li
                  key={stage.stageId}
                  className={`admin-initiative-lifecycle__item admin-initiative-lifecycle__item--${stage.state}`}
                >
                  <span className="admin-initiative-lifecycle__marker" aria-hidden="true" />
                  <span>{stage.label}</span>
                  <span className="hu-caption admin-initiative-lifecycle__evidence">
                    {stage.state === "current" ? "Current · " : ""}
                    {stage.evidence}
                  </span>
                </li>
              ))}
            </ul>
          </ProfileSection>

          <ProfileSection title="Public state">
            <AdminMetricDetailsGrid
              aria-label="Public state"
              cells={[
                {
                  label: "Visibility",
                  value: <WorkspaceStatusBadge status={detail.visibility} />,
                },
                {
                  label: "Public projection",
                  value: detail.publiclyProjected ? "Eligible and exposed" : "Not publicly projected",
                },
                {
                  label: "Lifecycle phase",
                  value: <WorkspaceStatusBadge status={detail.lifecyclePhase} />,
                },
                {
                  label: "Public URL",
                  value: detail.publicUrl ? (
                    <Link className="admin-panel__link" href={detail.publicUrl}>
                      Open public page
                    </Link>
                  ) : (
                    "—"
                  ),
                },
              ]}
            />
          </ProfileSection>

          <ProfileSection title="Civic relationships">
            <AdminMetricDetailsGrid
              aria-label="Civic relationships"
              cells={[
                { label: "Proposals", value: String(detail.relationships.proposalCount) },
                {
                  label: "Petition",
                  value: detail.relationships.petitionStatus ?? "None",
                },
                {
                  label: "Collective Decision",
                  value: detail.relationships.collectiveDecisionSummary ?? "None",
                },
                {
                  label: "Commitments",
                  value: String(detail.relationships.commitmentCount),
                },
                {
                  label: "Official Responses",
                  value: String(detail.relationships.officialResponseCount),
                },
                {
                  label: "Civic Archive",
                  value: String(detail.relationships.civicArchiveCount),
                },
              ]}
            />
            <p className="hu-caption admin-panel__note">
              Analyses: {detail.relationships.analysisCount} · Revisions:{" "}
              {detail.relationships.revisionCount} · Decision sessions:{" "}
              {detail.relationships.decisionSessionCount} · Tracking:{" "}
              {detail.relationships.trackingCount} · Public impact:{" "}
              {detail.relationships.publicImpactCount}
            </p>
          </ProfileSection>

          <ProfileSection title="Integrity">
            <ul className="admin-panel__gap-list">
              {detail.integrity.map((finding) => (
                <li key={finding.code}>
                  <strong>{finding.severity}</strong> — {finding.message}
                </li>
              ))}
            </ul>
          </ProfileSection>

          <ProfileSection title="Administrative actions">
            <p className="hu-caption admin-panel__note">
              Visibility moderation preserves Author ownership and authored content. A reason
              is required. Archive and authored-content edits remain steward Workspace
              operations.
            </p>

            {actionMessage ? (
              <StatusBanner title="Action completed" message={actionMessage} />
            ) : null}
            {actionError ? <StatusBanner title="Action failed" message={actionError} /> : null}

            {detail.adminActions.canHideFromPublic || detail.adminActions.canRestorePublicVisibility ? (
              <form
                className="admin-initiative-action-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runVisibilityAction(
                    detail.adminActions.canHideFromPublic ? "hide" : "restore",
                  );
                }}
              >
                <label className="admin-panel__label" htmlFor="admin-initiative-reason">
                  Administrator reason
                </label>
                <textarea
                  id="admin-initiative-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  minLength={8}
                  maxLength={500}
                  placeholder="Explain why this visibility change is required"
                />
                {detail.adminActions.canHideFromPublic ? (
                  <Button type="submit" variant="primary" disabled={actionPending}>
                    Hide from public
                  </Button>
                ) : null}
                {detail.adminActions.canRestorePublicVisibility ? (
                  <Button type="submit" variant="primary" disabled={actionPending}>
                    Restore public visibility
                  </Button>
                ) : null}
              </form>
            ) : (
              <p className="hu-body">
                Visibility hide/restore is available only for projected Initiatives.
              </p>
            )}

            <AdminCapabilityGap
              title="Archive / force-edit / reassignment"
              message="These administrative mutations are not implemented as admin commands."
              details={[
                "Steward archive remains the canonical lifecycle archive operation.",
                "Authored title/body edits stay in Author Workspace.",
                "Steward reassignment is not supported.",
              ]}
            />
          </ProfileSection>
        </>
      ) : null}
    </div>
  );
}

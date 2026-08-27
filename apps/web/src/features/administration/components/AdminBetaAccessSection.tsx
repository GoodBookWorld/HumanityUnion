"use client";

import { useEffect, useState } from "react";

import type { AuthUserPublic, BetaInvitePublic, PlatformConfigPublic } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import { getPlatformConfig } from "../../closed-beta/platform-api";
import {
  createBetaInviteForAdmin,
  listBetaInvitesForAdmin,
  revokeBetaInviteForAdmin,
} from "../beta-invite-api";
import {
  betaInviteStatusClassName,
  canRevokeBetaInvite,
  countBetaInvitesByStatus,
  formatBetaInviteStatusLabel,
} from "../beta-invite-labels";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-publishing.css";

interface AdminBetaAccessSectionProps {
  user: AuthUserPublic;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function AdminBetaAccessSection({ user }: AdminBetaAccessSectionProps) {
  const [invites, setInvites] = useState<readonly BetaInvitePublic[] | null>(null);
  const [platform, setPlatform] = useState<PlatformConfigPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<BetaInvitePublic | null>(null);
  const [revoking, setRevoking] = useState(false);

  async function reloadInvites() {
    const listed = await listBetaInvitesForAdmin();
    setInvites(listed);
  }

  useEffect(() => {
    let cancelled = false;

    void Promise.all([listBetaInvitesForAdmin(), getPlatformConfig().catch(() => null)])
      .then(([listed, config]) => {
        if (!cancelled) {
          setInvites(listed);
          setPlatform(config);
          setError(null);
          setDenied(false);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setInvites(null);
        if (isForbiddenError(loadError)) {
          setDenied(true);
          setError("Beta invite management requires an Administrator account.");
        } else {
          setError(formatAuthFormError(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setActionMessage(null);
    setCreatedCode(null);

    try {
      const result = await createBetaInviteForAdmin(email.trim());
      setCreatedCode(result.code);
      setActionMessage(
        `Invite created for ${result.invite.email}. Copy the code now — it is shown once.`,
      );
      setEmail("");
      await reloadInvites();
    } catch (createError: unknown) {
      if (isForbiddenError(createError)) {
        setDenied(true);
        setError("Beta invite management requires an Administrator account.");
      } else {
        setActionMessage(formatAuthFormError(createError));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) {
      return;
    }
    setRevoking(true);
    setActionMessage(null);
    try {
      await revokeBetaInviteForAdmin(revokeTarget.inviteId);
      setActionMessage(`Invite for ${revokeTarget.email} was revoked.`);
      setRevokeTarget(null);
      await reloadInvites();
    } catch (revokeError: unknown) {
      if (isForbiddenError(revokeError)) {
        setDenied(true);
        setError("Beta invite management requires an Administrator account.");
        setRevokeTarget(null);
      } else {
        setActionMessage(formatAuthFormError(revokeError));
      }
    } finally {
      setRevoking(false);
    }
  }

  const counts = invites ? countBetaInvitesByStatus(invites) : null;

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Beta Access">
        <p className="hu-caption admin-panel__note">
          Controlled-access invitations for restricted registration, emergency invite-only mode,
          and limited pilots. Invite codes appear only at creation time and are never re-fetched.
          Platform mode remains deployment configuration — it is not changed from this page.
        </p>

        {platform ? (
          <div className="admin-panel__entity-card" style={{ marginBottom: "1rem" }}>
            <ProfileField label="Platform mode" value={platform.platformMode} />
            <ProfileField
              label="Registration requires invite"
              value={platform.registrationRequiresInvite ? "Yes" : "No"}
            />
          </div>
        ) : null}

        {loading ? <p className="hu-body">Loading beta invites…</p> : null}
        {error ? (
          <StatusBanner
            title={denied ? "Access restricted" : "Beta Access unavailable"}
            message={error}
          />
        ) : null}

        {counts ? (
          <dl className="admin-publishing__stats" aria-label="Invite status summary">
            <div>
              <dt>Pending</dt>
              <dd>{counts.pending}</dd>
            </div>
            <div>
              <dt>Used</dt>
              <dd>{counts.used}</dd>
            </div>
            <div>
              <dt>Expired</dt>
              <dd>{counts.expired}</dd>
            </div>
            <div>
              <dt>Revoked</dt>
              <dd>{counts.revoked}</dd>
            </div>
          </dl>
        ) : null}

        {!denied ? (
          <form className="admin-panel__form" onSubmit={(event) => void handleCreate(event)}>
            <h3 className="hu-heading-4">Create invitation</h3>
            <label className="admin-panel__label" htmlFor="beta-invite-email">
              Invite email
            </label>
            <input
              id="beta-invite-email"
              className="admin-panel__input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
            />
            <Button type="submit" disabled={submitting || !email.trim()}>
              {submitting ? "Creating…" : "Create invite"}
            </Button>
          </form>
        ) : null}

        {actionMessage ? <p className="hu-body">{actionMessage}</p> : null}
        {createdCode ? (
          <ProfileField label="One-time invite code" value={createdCode} />
        ) : null}
      </ProfileSection>

      <ProfileSection title="Invitations">
        {invites && invites.length === 0 ? (
          <p className="hu-body">No invitations yet.</p>
        ) : null}
        {invites && invites.length > 0 ? (
          <div className="admin-publishing-table-wrap">
            <table className="admin-publishing-table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Created by</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.inviteId}>
                    <td>{invite.email}</td>
                    <td>
                      <span className={betaInviteStatusClassName(invite.status)}>
                        {formatBetaInviteStatusLabel(invite.status)}
                      </span>
                    </td>
                    <td>{formatTimestamp(invite.createdAt)}</td>
                    <td>{formatTimestamp(invite.expiresAt)}</td>
                    <td>
                      {invite.createdBy === user.userId
                        ? "You"
                        : invite.createdBy.slice(0, 8)}
                    </td>
                    <td>
                      {canRevokeBetaInvite(invite.status) ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setRevokeTarget(invite)}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <span className="hu-caption">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </ProfileSection>

      <ConfirmDialog
        isOpen={revokeTarget !== null}
        title="Revoke invitation?"
        description={
          revokeTarget
            ? `Revoke the pending invite for ${revokeTarget.email}? The invite code will stop working. This cannot be undone.`
            : null
        }
        confirmLabel="Revoke"
        isConfirming={revoking}
        onCancel={() => {
          if (!revoking) {
            setRevokeTarget(null);
          }
        }}
        onConfirm={() => {
          void confirmRevoke();
        }}
      />
    </div>
  );
}

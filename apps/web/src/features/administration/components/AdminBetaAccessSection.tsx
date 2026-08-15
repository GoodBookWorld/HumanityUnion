"use client";

import { useEffect, useState } from "react";

import type { AuthUserPublic, BetaInvitePublic } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import { createBetaInviteForAdmin, listBetaInvitesForAdmin } from "../beta-invite-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";

interface AdminBetaAccessSectionProps {
  user: AuthUserPublic;
}

export function AdminBetaAccessSection({ user: _user }: AdminBetaAccessSectionProps) {
  const [invites, setInvites] = useState<readonly BetaInvitePublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function reloadInvites() {
    const listed = await listBetaInvitesForAdmin();
    setInvites(listed);
  }

  useEffect(() => {
    let cancelled = false;

    void listBetaInvitesForAdmin()
      .then((listed) => {
        if (!cancelled) {
          setInvites(listed);
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
      setActionMessage(`Invite created for ${result.invite.email}. Copy the code now — it is shown once.`);
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

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Beta Access">
        <p className="hu-caption admin-panel__note">
          Uses the existing admin-authorized `/api/v1/beta-invites` API. Invite codes appear
          only at creation time and are never re-fetched.
        </p>

        {loading ? <p className="hu-body">Loading beta invites…</p> : null}
        {error ? (
          <StatusBanner
            title={denied ? "Access restricted" : "Beta Access unavailable"}
            message={error}
          />
        ) : null}

        {!denied ? (
          <form className="admin-panel__form" onSubmit={(event) => void handleCreate(event)}>
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

      <ProfileSection title="Invites you created">
        {invites && invites.length === 0 ? (
          <p className="hu-body">No invites created yet.</p>
        ) : null}
        {invites && invites.length > 0 ? (
          <ul className="admin-panel__entity-list">
            {invites.map((invite) => (
              <li key={invite.inviteId}>
                <div className="admin-panel__entity-card">
                  <ProfileField label="Email" value={invite.email} />
                  <ProfileField label="Status" value={invite.status} />
                  <ProfileField label="Created" value={invite.createdAt} />
                  <ProfileField label="Expires" value={invite.expiresAt} />
                  {invite.usedAt ? <ProfileField label="Used" value={invite.usedAt} /> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </ProfileSection>
    </div>
  );
}

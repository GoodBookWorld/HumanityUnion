"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AuthUserPublic, Initiative } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Card } from "../../../design-system/components/Card";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import { listInitiatives } from "../../initiatives/api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";

interface AdminInitiativesSectionProps {
  user: AuthUserPublic;
}

function initiativeViewHref(initiative: Initiative): string {
  if (initiative.visibility.policy === "public") {
    return `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`;
  }

  return `/initiatives/${encodeURIComponent(initiative.initiativeId)}`;
}

/**
 * Lists Initiatives via the existing operational read (`GET /api/v1/initiatives`).
 * Read-only — no admin correction writes (none exist safely).
 */
export function AdminInitiativesSection({ user: _user }: AdminInitiativesSectionProps) {
  const [items, setItems] = useState<readonly Initiative[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void listInitiatives()
      .then((initiatives) => {
        if (!cancelled) {
          setItems(initiatives);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setItems(null);
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

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Initiatives">
        <p className="hu-caption admin-panel__note">
          Operational inventory from the existing Initiatives list API. Editing and
          archival remain steward/owner workflows — no admin force-edit API exists.
        </p>

        {loading ? <p className="hu-body">Loading initiatives…</p> : null}
        {error ? <StatusBanner title="Initiatives unavailable" message={error} /> : null}

        {items && items.length === 0 ? (
          <p className="hu-body">No initiatives found.</p>
        ) : null}

        {items && items.length > 0 ? (
          <ul className="admin-panel__entity-list">
            {items.map((initiative) => {
              const href = initiativeViewHref(initiative);

              return (
                <li key={initiative.initiativeId}>
                  <Card className="admin-panel__entity-card">
                    <p className="hu-body admin-panel__entity-title">
                      <Link className="admin-panel__link" href={href}>
                        {initiative.title}
                      </Link>
                    </p>
                    <p className="hu-caption">
                      Status: {initiative.status} · Lifecycle: {initiative.lifecyclePhase} ·
                      Visibility: {initiative.visibility.policy}
                    </p>
                    <p className="hu-caption">
                      Steward (Participant / Member ID): {initiative.stewardId}
                    </p>
                    <p className="hu-caption">Updated: {initiative.updatedAt}</p>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Deferred admin correction">
        <p className="hu-body">
          Administrative force-edit, reassignment, or moderation of Initiatives requires a
          new explicit admin-authorized command API. Do not use steward draft/update routes
          to bypass ownership.
        </p>
      </ProfileSection>
    </div>
  );
}

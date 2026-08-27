"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AuthUserPublic } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import { fetchAdminPlatformReadiness } from "../admin-platform-readiness-api";
import {
  buildAdminPlatformReadinessView,
  formatAdminPlatformReadinessLevel,
  formatAdminPlatformServiceState,
  formatRegistrationAccessLabel,
  type AdminPlatformReadinessView,
} from "../admin-platform-readiness-model";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-publishing.css";
import "./admin-platform.css";

interface AdminPlatformSectionProps {
  user: AuthUserPublic;
}

function serviceChipClass(state: string): string {
  if (state === "configured" || state === "enabled") {
    return "admin-publishing-table__status admin-publishing-table__status--active";
  }
  if (state === "incomplete" || state === "disabled") {
    return "admin-publishing-table__status admin-publishing-table__status--pending";
  }
  return "admin-publishing-table__status admin-publishing-table__status--blocked";
}

function overallChipClass(level: AdminPlatformReadinessView["overall"]): string {
  if (level === "ready") {
    return "admin-publishing-table__status admin-publishing-table__status--active";
  }
  if (level === "attention") {
    return "admin-publishing-table__status admin-publishing-table__status--pending";
  }
  return "admin-publishing-table__status admin-publishing-table__status--blocked";
}

export function AdminPlatformSection({ user: _user }: AdminPlatformSectionProps) {
  const [view, setView] = useState<AdminPlatformReadinessView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetchAdminPlatformReadiness()
      .then((readiness) => {
        if (!cancelled) {
          setView(buildAdminPlatformReadinessView(readiness));
          setError(null);
          setDenied(false);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setView(null);
        if (isForbiddenError(loadError)) {
          setDenied(true);
          setError("Platform readiness requires an Administrator account.");
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

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Platform">
        <p className="hu-caption admin-panel__note">
          Deployment configuration identity — what this environment is configured to be.
          Runtime health lives in Diagnostics. Search indexing details live in SEO. Platform
          mode and origins are not editable here.
        </p>

        {loading ? <p className="hu-body">Loading platform readiness…</p> : null}
        {error ? (
          <StatusBanner
            title={denied ? "Access restricted" : "Platform unavailable"}
            message={error}
          />
        ) : null}

        {view ? (
          <>
            <div className="admin-platform__overall">
              <span className={overallChipClass(view.overall)}>
                {formatAdminPlatformReadinessLevel(view.overall)}
              </span>
              <span className="hu-caption">Production readiness (configuration)</span>
            </div>

            <h3 className="hu-heading-4">Deployment</h3>
            <div className="admin-platform__grid">
              <ProfileField label="Platform mode" value={view.platformMode} />
              <ProfileField label="Version" value={view.platformVersion} />
              <ProfileField
                label="Public site origin"
                value={view.siteOriginConfigured ? "Configured" : "Missing"}
              />
              <ProfileField
                label="Search indexing"
                value={
                  view.indexingAllowed
                    ? `Allowed (${view.indexingMode})`
                    : `Protected / noindex (${view.indexingMode})`
                }
              />
              <ProfileField
                label="Registration / access"
                value={formatRegistrationAccessLabel({
                  platformMode: view.platformMode,
                  registrationRequiresInvite: view.registrationRequiresInvite,
                })}
              />
              <ProfileField
                label="Invite gate"
                value={view.registrationRequiresInvite ? "Enabled" : "Disabled"}
              />
              <ProfileField
                label="Cookie / CORS security"
                value="External deployment configuration"
              />
            </div>

            {view.registrationRequiresInvite ? (
              <p className="hu-caption admin-panel__note">
                Invite-gated registration is active. Manage invitations in{" "}
                <Link className="admin-panel__link" href="/admin/beta-access">
                  Beta Access
                </Link>
                .
              </p>
            ) : null}

            <h3 className="hu-heading-4">Services configuration</h3>
            <p className="hu-caption admin-panel__note">
              Configuration presence only — not live health. Check Diagnostics for runtime
              status.
            </p>
            <ul className="admin-platform__services" aria-label="Service configuration status">
              {(
                [
                  ["Web", view.services.web],
                  ["API", view.services.api],
                  ["MongoDB", view.services.mongodb],
                  ["Email", view.services.email],
                  ["Media / R2", view.services.media],
                  ["AI", view.services.ai],
                ] as const
              ).map(([label, state]) => (
                <li key={label} className="admin-platform__service">
                  <span className="admin-platform__service-label">{label}</span>
                  <span className={serviceChipClass(state)}>
                    {formatAdminPlatformServiceState(state)}
                  </span>
                </li>
              ))}
            </ul>

            <h3 className="hu-heading-4">Production readiness</h3>
            {view.warnings.length === 0 ? (
              <p className="hu-body">No configuration warnings for the current deployment mode.</p>
            ) : (
              <ul className="admin-platform__warnings">
                {view.warnings.map((warning) => (
                  <li key={warning.code} className="admin-platform__warning">
                    <div className="admin-platform__warning-header">
                      <span
                        className={
                          warning.level === "missing_configuration"
                            ? "admin-publishing-table__status admin-publishing-table__status--blocked"
                            : "admin-publishing-table__status admin-publishing-table__status--pending"
                        }
                      >
                        {formatAdminPlatformReadinessLevel(warning.level)}
                      </span>
                      <strong>{warning.title}</strong>
                    </div>
                    <p className="hu-body">{warning.detail}</p>
                    {warning.href && warning.hrefLabel ? (
                      <Link className="admin-panel__link" href={warning.href}>
                        {warning.hrefLabel}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <p className="hu-caption admin-panel__note admin-platform__boundary">
              Related:{" "}
              <Link className="admin-panel__link" href="/admin/seo">
                SEO
              </Link>
              {" · "}
              <Link className="admin-panel__link" href="/admin/diagnostics">
                Diagnostics
              </Link>
              {" · "}
              <Link className="admin-panel__link" href="/admin/beta-access">
                Beta Access
              </Link>
            </p>
          </>
        ) : null}
      </ProfileSection>
    </div>
  );
}

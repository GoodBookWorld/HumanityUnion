"use client";

import { useEffect, useState } from "react";

import type { PlatformSupportLink, PlatformSupportLinkId } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  clearAdminPlatformSupportLink,
  fetchAdminPlatformSupportLinks,
  saveAdminPlatformSupportLink,
} from "../admin-platform-support-links-api";

import "./admin-platform-social-accounts.css";

interface RowState {
  url: string;
  saving: boolean;
  clearing: boolean;
  message: string | null;
  error: string | null;
}

function emptyRowState(): RowState {
  return { url: "", saving: false, clearing: false, message: null, error: null };
}

/**
 * Production Completion Pack 01 — Admin Overview block for Support operational links.
 * Reuses Platform Social Accounts visual pattern.
 */
export function AdminPlatformSupportLinksPanel() {
  const [links, setLinks] = useState<readonly PlatformSupportLink[]>([]);
  const [rows, setRows] = useState<Partial<Record<PlatformSupportLinkId, RowState>>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchAdminPlatformSupportLinks()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setLinks(response.links);
        const nextRows: Partial<Record<PlatformSupportLinkId, RowState>> = {};
        for (const link of response.links) {
          nextRows[link.linkId] = {
            ...emptyRowState(),
            url: link.url ?? "",
          };
        }
        setRows(nextRows);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setLoadError(formatAuthFormError(err));
        setLinks([]);
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

  function patchRow(linkId: PlatformSupportLinkId, patch: Partial<RowState>) {
    setRows((prev) => ({
      ...prev,
      [linkId]: {
        ...(prev[linkId] ?? emptyRowState()),
        ...patch,
      },
    }));
  }

  async function handleSave(link: PlatformSupportLink) {
    const row = rows[link.linkId] ?? emptyRowState();
    patchRow(link.linkId, { saving: true, error: null, message: null });
    try {
      const saved = await saveAdminPlatformSupportLink({
        linkId: link.linkId,
        url: row.url.trim(),
      });
      setLinks((prev) => prev.map((item) => (item.linkId === saved.linkId ? saved : item)));
      patchRow(link.linkId, {
        saving: false,
        url: saved.url ?? "",
        message: `${saved.label} URL saved.`,
        error: null,
      });
    } catch (err: unknown) {
      patchRow(link.linkId, {
        saving: false,
        error: formatAuthFormError(err),
        message: null,
      });
    }
  }

  async function handleClear(link: PlatformSupportLink) {
    patchRow(link.linkId, { clearing: true, error: null, message: null });
    try {
      const saved = await clearAdminPlatformSupportLink(link.linkId);
      setLinks((prev) => prev.map((item) => (item.linkId === saved.linkId ? saved : item)));
      patchRow(link.linkId, {
        clearing: false,
        url: "",
        message: `${saved.label} URL cleared.`,
        error: null,
      });
    } catch (err: unknown) {
      patchRow(link.linkId, {
        clearing: false,
        error: formatAuthFormError(err),
        message: null,
      });
    }
  }

  if (loading) {
    return <p className="hu-caption">Loading Support operational links…</p>;
  }

  if (loadError) {
    return <p className="hu-caption admin-platform-social__error">{loadError}</p>;
  }

  return (
    <div className="admin-platform-social">
      <p className="admin-platform-social__lede">
        Support page operational destinations (Donation, Volunteer, Regional Program). HTTPS URLs
        or same-site relative paths only — no credentials.
      </p>
      <ul className="admin-platform-social__list" aria-label="Support operational links">
        {links.map((link) => {
          const row = rows[link.linkId] ?? emptyRowState();
          const busy = row.saving || row.clearing;
          const inputId = `platform-support-url-${link.linkId}`;
          return (
            <li key={link.linkId} className="admin-platform-social__row">
              <div className="admin-platform-social__identity">
                <label className="admin-platform-social__label" htmlFor={inputId}>
                  {link.label}
                </label>
              </div>
              <div className="admin-platform-social__controls">
                <input
                  id={inputId}
                  className="admin-panel__input admin-platform-social__input"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https:// or /path"
                  value={row.url}
                  disabled={busy}
                  onChange={(event) =>
                    patchRow(link.linkId, {
                      url: event.target.value,
                      error: null,
                      message: null,
                    })
                  }
                />
                <div className="admin-platform-social__actions">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={busy || !row.url.trim()}
                    onClick={() => {
                      void handleSave(link);
                    }}
                  >
                    {row.saving ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || (!link.url && !row.url.trim())}
                    onClick={() => {
                      void handleClear(link);
                    }}
                  >
                    {row.clearing ? "Clearing…" : "Clear"}
                  </Button>
                </div>
              </div>
              {row.message ? (
                <p className="hu-caption admin-platform-social__success" role="status">
                  {row.message}
                </p>
              ) : null}
              {row.error ? (
                <p className="hu-caption admin-platform-social__error" role="alert">
                  {row.error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

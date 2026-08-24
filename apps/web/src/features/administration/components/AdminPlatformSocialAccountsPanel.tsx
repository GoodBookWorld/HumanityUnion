"use client";

import { useEffect, useState } from "react";

import type { PlatformSocialAccount, PlatformSocialNetworkId } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  clearAdminPlatformSocialAccount,
  fetchAdminPlatformSocialAccounts,
  saveAdminPlatformSocialAccount,
} from "../admin-platform-social-accounts-api";
import { PLATFORM_SOCIAL_NETWORK_ICON_PATHS } from "../../platform-social-accounts/platform-social-network-icons";

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
 * Pack 17C — Admin Overview block for official platform social account URLs.
 */
export function AdminPlatformSocialAccountsPanel() {
  const [accounts, setAccounts] = useState<readonly PlatformSocialAccount[]>([]);
  const [rows, setRows] = useState<Partial<Record<PlatformSocialNetworkId, RowState>>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchAdminPlatformSocialAccounts()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setAccounts(response.accounts);
        const nextRows: Partial<Record<PlatformSocialNetworkId, RowState>> = {};
        for (const account of response.accounts) {
          nextRows[account.networkId] = {
            ...emptyRowState(),
            url: account.url ?? "",
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
        setAccounts([]);
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

  function patchRow(networkId: PlatformSocialNetworkId, patch: Partial<RowState>) {
    setRows((prev) => ({
      ...prev,
      [networkId]: {
        ...(prev[networkId] ?? emptyRowState()),
        ...patch,
      },
    }));
  }

  async function handleSave(account: PlatformSocialAccount) {
    const row = rows[account.networkId] ?? emptyRowState();
    patchRow(account.networkId, { saving: true, error: null, message: null });
    try {
      const saved = await saveAdminPlatformSocialAccount({
        networkId: account.networkId,
        url: row.url.trim(),
      });
      setAccounts((prev) =>
        prev.map((item) => (item.networkId === saved.networkId ? saved : item)),
      );
      patchRow(account.networkId, {
        saving: false,
        url: saved.url ?? "",
        message: `${saved.label} URL saved.`,
        error: null,
      });
    } catch (err: unknown) {
      patchRow(account.networkId, {
        saving: false,
        error: formatAuthFormError(err),
        message: null,
      });
    }
  }

  async function handleClear(account: PlatformSocialAccount) {
    patchRow(account.networkId, { clearing: true, error: null, message: null });
    try {
      const saved = await clearAdminPlatformSocialAccount(account.networkId);
      setAccounts((prev) =>
        prev.map((item) => (item.networkId === saved.networkId ? saved : item)),
      );
      patchRow(account.networkId, {
        clearing: false,
        url: "",
        message: `${saved.label} URL cleared.`,
        error: null,
      });
    } catch (err: unknown) {
      patchRow(account.networkId, {
        clearing: false,
        error: formatAuthFormError(err),
        message: null,
      });
    }
  }

  if (loading) {
    return <p className="hu-caption">Loading platform social accounts…</p>;
  }

  if (loadError) {
    return <p className="hu-caption admin-platform-social__error">{loadError}</p>;
  }

  return (
    <div className="admin-platform-social">
      <p className="admin-platform-social__lede">
        Official Humanity Union social destinations shown in the public footer. URLs only — no
        credentials or publishing tokens.
      </p>
      <ul className="admin-platform-social__list" aria-label="Platform social accounts">
        {accounts.map((account) => {
          const row = rows[account.networkId] ?? emptyRowState();
          const busy = row.saving || row.clearing;
          const inputId = `platform-social-url-${account.networkId}`;
          return (
            <li key={account.networkId} className="admin-platform-social__row">
              <div className="admin-platform-social__identity">
                <img
                  src={PLATFORM_SOCIAL_NETWORK_ICON_PATHS[account.networkId]}
                  alt=""
                  className="admin-platform-social__icon"
                  width={24}
                  height={24}
                />
                <label className="admin-platform-social__label" htmlFor={inputId}>
                  {account.label}
                </label>
              </div>
              <div className="admin-platform-social__controls">
                <input
                  id={inputId}
                  className="admin-panel__input admin-platform-social__input"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://"
                  value={row.url}
                  disabled={busy}
                  onChange={(event) =>
                    patchRow(account.networkId, {
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
                      void handleSave(account);
                    }}
                  >
                    {row.saving ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || (!account.url && !row.url.trim())}
                    onClick={() => {
                      void handleClear(account);
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

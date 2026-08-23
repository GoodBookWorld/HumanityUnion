"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import type { AdminEditorDirectoryItem, AuthUserPublic, EditorGrantStatus } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import {
  activateAdminEditor,
  deactivateAdminEditor,
  listAdminEditors,
} from "../admin-editors-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-editors.css";

interface AdminEditorsSectionProps {
  user: AuthUserPublic;
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

function AdminEditorsSectionInner({ user: _user }: AdminEditorsSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<readonly AdminEditorDirectoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"" | EditorGrantStatus>("");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminEditors({
        status: statusFilter || undefined,
        limit: 50,
        offset: 0,
      });
      setRows(result.editors);
      setTotal(result.total);
      setActiveCount(result.activeCount);
      setDenied(false);
    } catch (err: unknown) {
      if (isForbiddenError(err)) {
        setDenied(true);
      }
      setError(formatAuthFormError(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Pack 12E1/12E2 — durable confirmation after Assign/Save redirect; list uses no-store fetch.
  useEffect(() => {
    const assigned = searchParams.get("assigned");
    const updated = searchParams.get("updated");
    const notify = searchParams.get("notify");
    const notifySuffix =
      notify === "0"
        ? " Notification could not be delivered."
        : notify === "1"
          ? " Notification sent."
          : "";
    if (assigned === "1") {
      setActionMessage(`Editor assigned successfully.${notifySuffix}`);
      router.replace("/admin/editors", { scroll: false });
    } else if (updated === "1") {
      setActionMessage(`Editor updated successfully.${notifySuffix}`);
      router.replace("/admin/editors", { scroll: false });
    }
  }, [router, searchParams]);

  async function handleActivate(editorGrantId: string) {
    setActionBusyId(editorGrantId);
    setActionMessage(null);
    try {
      await activateAdminEditor(editorGrantId);
      setActionMessage("Editor activated.");
      await load();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDeactivate(editorGrantId: string) {
    setActionBusyId(editorGrantId);
    setActionMessage(null);
    try {
      await deactivateAdminEditor(editorGrantId);
      setActionMessage("Editor deactivated.");
      await load();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Editors">
        <p className="hu-caption admin-editors__lede">
          Assign delegated editing access to existing Participants. Editors never receive Admin
          Panel access.
        </p>
        <div className="admin-editors__toolbar">
          <label className="admin-editors__filter">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "" | EditorGrantStatus)
              }
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <p className="hu-caption" aria-live="polite">
            {loading
              ? "Loading…"
              : `${total} grant${total === 1 ? "" : "s"} · ${activeCount} active`}
          </p>
          <Button href="/admin/editors/new" variant="primary">
            Add Editor
          </Button>
        </div>

        {denied ? (
          <StatusBanner
            title="Access denied"
            message="Administrator access is required to manage Editors."
          />
        ) : null}
        {actionMessage ? (
          <StatusBanner title="Action completed" message={actionMessage} />
        ) : null}
        {error && !denied ? (
          <StatusBanner title="Editors unavailable" message={error} />
        ) : null}

        <div className="admin-editors-table-wrap">
          <table className="admin-editors-table">
            <thead>
              <tr>
                <th scope="col">Editor</th>
                <th scope="col">Status</th>
                <th scope="col">Editing permissions</th>
                <th scope="col">Editing area</th>
                <th scope="col">Assigned/updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Loading Editors…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>No Editor grants yet. Add an Editor to get started.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.editorGrantId}>
                    <td>
                      <div className="admin-editors-table__identity">
                        {row.avatarUrl ? (
                          <img
                            src={row.avatarUrl}
                            alt=""
                            className="admin-editors-table__avatar"
                            width={32}
                            height={32}
                          />
                        ) : (
                          <span className="admin-editors-table__avatar admin-editors-table__avatar--empty" />
                        )}
                        <div>
                          <strong>{row.displayName}</strong>
                          {row.uniqueName ? (
                            <div className="hu-caption">@{row.uniqueName}</div>
                          ) : null}
                          <div className="hu-caption">{row.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={
                          row.status === "ACTIVE"
                            ? "admin-editors-table__status admin-editors-table__status--active"
                            : "admin-editors-table__status admin-editors-table__status--inactive"
                        }
                      >
                        {row.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{row.capabilityLabels.join(", ")}</td>
                    <td>
                      <div>{row.geographicScope.levelLabel}</div>
                      <div className="hu-caption">{row.geographicScope.summary}</div>
                    </td>
                    <td>{formatCompactDate(row.updatedAt)}</td>
                    <td>
                      <div className="admin-editors-table__actions">
                        <Link
                          className="admin-panel__link"
                          href={`/admin/editors/${row.editorGrantId}`}
                        >
                          Edit
                        </Link>
                        {row.status === "ACTIVE" ? (
                          <Button
                            variant="tertiary"
                            disabled={actionBusyId === row.editorGrantId}
                            onClick={() => void handleDeactivate(row.editorGrantId)}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="tertiary"
                            disabled={actionBusyId === row.editorGrantId}
                            onClick={() => void handleActivate(row.editorGrantId)}
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ProfileSection>
    </div>
  );
}

/**
 * Pack 12E1 — Suspense boundary required for useSearchParams in the App Router client tree.
 */
export function AdminEditorsSection(props: AdminEditorsSectionProps) {
  return (
    <Suspense
      fallback={
        <div className="admin-panel">
          <AdminPanelNavigation />
          <p className="hu-caption">Loading Editors…</p>
        </div>
      }
    >
      <AdminEditorsSectionInner {...props} />
    </Suspense>
  );
}

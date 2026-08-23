"use client";

import { useEffect, useState } from "react";

import type { AdminEditorDirectoryItem, AuthUserPublic } from "@hu/types";

import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import { getAdminEditor } from "../admin-editors-api";
import { AdminEditorFormSection } from "./AdminEditorFormSection";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";

interface AdminEditorEditSectionProps {
  user: AuthUserPublic;
  editorGrantId: string;
}

export function AdminEditorEditSection({
  user: _user,
  editorGrantId,
}: AdminEditorEditSectionProps) {
  const [initial, setInitial] = useState<AdminEditorDirectoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getAdminEditor(editorGrantId)
      .then((editor) => {
        if (!cancelled) {
          setInitial(editor);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            isForbiddenError(err)
              ? "Administrator access is required."
              : formatAuthFormError(err),
          );
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
  }, [editorGrantId]);

  if (loading) {
    return (
      <div className="admin-panel">
        <AdminPanelNavigation />
        <p className="hu-caption">Loading Editor…</p>
      </div>
    );
  }

  if (error || !initial) {
    return (
      <div className="admin-panel">
        <AdminPanelNavigation />
        <StatusBanner
          title="Editor unavailable"
          message={error ?? "Editor grant not found."}
        />
      </div>
    );
  }

  return <AdminEditorFormSection mode="edit" initial={initial} />;
}

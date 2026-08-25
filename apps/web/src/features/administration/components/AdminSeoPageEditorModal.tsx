"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { SeoPageOverrideFamily, SeoPageOverrideFields } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { trapTabKey } from "../../../design-system/focus-trap";
import { formatAuthFormError } from "../../../lib/api-client";
import { shouldDisallowSearchIndexing } from "../../../lib/platform-indexing";
import { mergePageSeoOverrideIntoAutomatic } from "../../../lib/seo/apply-page-seo-override";
import { resolvePublicSiteOrigin, toAbsolutePublicUrl } from "../../../lib/seo/public-site-url";
import {
  clearAdminSeoPageOverride,
  fetchAdminSeoPageOverride,
  saveAdminSeoPageOverride,
} from "../admin-seo-page-override-api";
import {
  formatSeoModeLabel,
  type SeoPageInventoryRow,
} from "../admin-seo-console-model";

import "../../../design-system/components/confirm-dialog.css";
import "./admin-seo-console.css";

const TITLE_MAX = 70;
const DESCRIPTION_MAX = 320;

interface AdminSeoPageEditorModalProps {
  row: SeoPageInventoryRow | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface DraftFields {
  seoTitle: string;
  seoDescription: string;
  socialTitle: string;
  socialDescription: string;
  socialImageUrl: string;
}

function emptyDraft(): DraftFields {
  return {
    seoTitle: "",
    seoDescription: "",
    socialTitle: "",
    socialDescription: "",
    socialImageUrl: "",
  };
}

function fieldsToDraft(fields: SeoPageOverrideFields | undefined): DraftFields {
  return {
    seoTitle: fields?.seoTitle ?? "",
    seoDescription: fields?.seoDescription ?? "",
    socialTitle: fields?.socialTitle ?? "",
    socialDescription: fields?.socialDescription ?? "",
    socialImageUrl: fields?.socialImageUrl ?? "",
  };
}

function draftToFields(draft: DraftFields): SeoPageOverrideFields {
  return {
    ...(draft.seoTitle.trim() ? { seoTitle: draft.seoTitle.trim() } : {}),
    ...(draft.seoDescription.trim() ? { seoDescription: draft.seoDescription.trim() } : {}),
    ...(draft.socialTitle.trim() ? { socialTitle: draft.socialTitle.trim() } : {}),
    ...(draft.socialDescription.trim()
      ? { socialDescription: draft.socialDescription.trim() }
      : {}),
    ...(draft.socialImageUrl.trim() ? { socialImageUrl: draft.socialImageUrl.trim() } : {}),
  };
}

/**
 * Pack 07 — compact Admin Page SEO Editor for Country / Initiative / Knowledge / Civic Archive.
 */
export function AdminSeoPageEditorModal({
  row,
  isOpen,
  onClose,
  onSaved,
}: AdminSeoPageEditorModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [draft, setDraft] = useState<DraftFields>(emptyDraft());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const indexingDisallowed = shouldDisallowSearchIndexing();
  const origin = resolvePublicSiteOrigin();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      "button, [href], input, textarea",
    );
    focusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (dialogRef.current) {
        trapTabKey(event, dialogRef.current);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !row) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessage(null);
    setDraft(emptyDraft());

    void fetchAdminSeoPageOverride({
      family: row.family as SeoPageOverrideFamily,
      entityKey: row.descriptor.entityKey,
    })
      .then((result) => {
        if (!cancelled) {
          setDraft(fieldsToDraft(result.fields));
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
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
  }, [isOpen, row]);

  const automatic = useMemo(() => {
    if (!row) {
      return { title: "", description: "" };
    }
    return {
      title: row.title,
      description: row.note?.includes("lack") ? "" : `${row.title} on Humanity Union`,
      socialTitle: row.title,
      socialDescription: `${row.title} on Humanity Union`,
      imageUrl: null as string | null,
    };
  }, [row]);

  const effective = useMemo(
    () => mergePageSeoOverrideIntoAutomatic(automatic, draftToFields(draft)),
    [automatic, draft],
  );

  const mode =
    draft.seoTitle.trim() ||
    draft.seoDescription.trim() ||
    draft.socialTitle.trim() ||
    draft.socialDescription.trim() ||
    draft.socialImageUrl.trim()
      ? "customized"
      : "automatic";

  const previewUrl = row
    ? origin
      ? toAbsolutePublicUrl(row.canonicalPath, origin)
      : row.canonicalPath
    : "";

  if (!isOpen || !row) {
    return null;
  }

  async function handleSave() {
    if (!row) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await saveAdminSeoPageOverride({
        family: row.family as SeoPageOverrideFamily,
        entityKey: row.descriptor.entityKey,
        canonicalPath: row.canonicalPath,
        fields: draftToFields(draft),
      });
      setDraft(fieldsToDraft(result.fields));
      setMessage(result.mode === "automatic" ? "Restored automatic SEO." : "SEO override saved.");
      onSaved();
    } catch (saveError: unknown) {
      setError(formatAuthFormError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreAutomatic() {
    if (!row) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await clearAdminSeoPageOverride({
        family: row.family as SeoPageOverrideFamily,
        entityKey: row.descriptor.entityKey,
      });
      setDraft(emptyDraft());
      setMessage("Restored automatic SEO.");
      onSaved();
    } catch (clearError: unknown) {
      // Clearing when none exists is fine — treat as restore.
      const messageText = formatAuthFormError(clearError);
      if (/not found/i.test(messageText)) {
        setDraft(emptyDraft());
        setMessage("Restored automatic SEO.");
        onSaved();
      } else {
        setError(messageText);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="confirm-dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="confirm-dialog admin-seo-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="admin-seo-editor__header">
          <h2 id={titleId} className="hu-heading-3">
            Edit SEO
          </h2>
          <p className="hu-caption">
            {row.familyLabel} · {formatSeoModeLabel(mode)}
          </p>
        </header>

        {error ? <StatusBanner title="Unable to save SEO" message={error} /> : null}
        {message ? <p className="hu-body admin-seo-editor__message">{message}</p> : null}

        <section className="admin-seo-editor__section">
          <h3 className="hu-heading-4">Page</h3>
          <p className="admin-seo-console__title">{row.title}</p>
          <p className="admin-seo-console__path">{row.canonicalPath}</p>
        </section>

        <section className="admin-seo-editor__section">
          <h3 className="hu-heading-4">Search preview</h3>
          <p className="hu-caption">Effective values (override when set, otherwise automatic).</p>
          <div className="admin-seo-editor__preview">
            <p className="admin-seo-editor__preview-title">{effective.title || row.title}</p>
            <p className="admin-seo-editor__preview-url">{previewUrl}</p>
            <p className="admin-seo-editor__preview-description">
              {effective.description || "No description yet."}
            </p>
          </div>
        </section>

        <section className="admin-seo-editor__section">
          <h3 className="hu-heading-4">Editable SEO</h3>
          {loading ? <p className="hu-body">Loading override…</p> : null}
          <label className="hu-label" htmlFor="seo-editor-title">
            SEO Title
          </label>
          <input
            id="seo-editor-title"
            className="admin-seo-editor__input"
            maxLength={TITLE_MAX}
            value={draft.seoTitle}
            disabled={loading || saving}
            placeholder={automatic.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, seoTitle: event.target.value }))}
          />
          <p className="hu-caption">{draft.seoTitle.length}/{TITLE_MAX}</p>

          <label className="hu-label" htmlFor="seo-editor-description">
            Meta Description
          </label>
          <textarea
            id="seo-editor-description"
            className="admin-seo-editor__textarea"
            maxLength={DESCRIPTION_MAX}
            rows={3}
            value={draft.seoDescription}
            disabled={loading || saving}
            placeholder="Automatic description from entity content"
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, seoDescription: event.target.value }))
            }
          />
          <p className="hu-caption">{draft.seoDescription.length}/{DESCRIPTION_MAX}</p>
        </section>

        <section className="admin-seo-editor__section">
          <h3 className="hu-heading-4">Social</h3>
          <label className="hu-label" htmlFor="seo-editor-social-title">
            Social Title
          </label>
          <input
            id="seo-editor-social-title"
            className="admin-seo-editor__input"
            maxLength={TITLE_MAX}
            value={draft.socialTitle}
            disabled={loading || saving}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, socialTitle: event.target.value }))
            }
          />

          <label className="hu-label" htmlFor="seo-editor-social-description">
            Social Description
          </label>
          <textarea
            id="seo-editor-social-description"
            className="admin-seo-editor__textarea"
            maxLength={DESCRIPTION_MAX}
            rows={3}
            value={draft.socialDescription}
            disabled={loading || saving}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, socialDescription: event.target.value }))
            }
          />

          <label className="hu-label" htmlFor="seo-editor-social-image">
            Social Image URL
          </label>
          <input
            id="seo-editor-social-image"
            className="admin-seo-editor__input"
            value={draft.socialImageUrl}
            disabled={loading || saving}
            placeholder="https://… or /brand/…"
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, socialImageUrl: event.target.value }))
            }
          />
        </section>

        <section className="admin-seo-editor__section">
          <h3 className="hu-heading-4">Read-only</h3>
          <p className="hu-body">
            Canonical: <code>{row.canonicalPath}</code>
          </p>
          <p className="hu-body">
            Indexing: {indexingDisallowed ? "Protected (platform noindex)" : "Allowed by platform"}
          </p>
          <p className="hu-body">Structured Data: {row.structuredData}</p>
          <p className="hu-caption">
            Canonical and indexing cannot be edited here. Platform environment protection remains
            authoritative.
          </p>
        </section>

        <footer className="admin-seo-editor__footer">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading || saving}
            onClick={() => {
              void handleRestoreAutomatic();
            }}
          >
            Restore automatic SEO
          </Button>
          <Button
            type="button"
            disabled={loading || saving}
            onClick={() => {
              void handleSave();
            }}
          >
            {saving ? "Saving…" : "Save SEO"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

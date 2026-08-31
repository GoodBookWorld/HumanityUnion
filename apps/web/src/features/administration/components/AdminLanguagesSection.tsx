"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  AuthUserPublic,
  LanguageRegistryAdmin,
  LanguageTextDirection,
  LanguageUiTranslationStatus,
} from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  createAdminLanguage,
  fetchAdminLanguages,
  updateAdminLanguage,
  type AdminLanguageCreateInput,
  type AdminLanguagePatchInput,
} from "../admin-languages-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";
import "./admin-languages.css";

interface AdminLanguagesSectionProps {
  user: AuthUserPublic;
}

interface LanguageFormState {
  locale: string;
  englishName: string;
  nativeName: string;
  textDirection: LanguageTextDirection;
  fallbackLocale: string;
  enabled: boolean;
  uiTranslationStatus: LanguageUiTranslationStatus;
  contentTranslationEnabled: boolean;
  searchEnabled: boolean;
  seoIndexingEnabled: boolean;
  aliasesText: string;
}

const UI_STATUSES: readonly LanguageUiTranslationStatus[] = ["none", "partial", "complete"];

function emptyForm(fallbackLocale = "en"): LanguageFormState {
  return {
    locale: "",
    englishName: "",
    nativeName: "",
    textDirection: "ltr",
    fallbackLocale,
    enabled: false,
    uiTranslationStatus: "none",
    contentTranslationEnabled: false,
    searchEnabled: false,
    seoIndexingEnabled: false,
    aliasesText: "",
  };
}

function toForm(row: LanguageRegistryAdmin): LanguageFormState {
  return {
    locale: row.locale,
    englishName: row.englishName,
    nativeName: row.nativeName,
    textDirection: row.textDirection,
    fallbackLocale: row.fallbackLocale,
    enabled: row.enabled,
    uiTranslationStatus: row.uiTranslationStatus,
    contentTranslationEnabled: row.contentTranslationEnabled,
    searchEnabled: row.searchEnabled,
    seoIndexingEnabled: row.seoIndexingEnabled,
    aliasesText: row.aliases.join(", "),
  };
}

function parseAliases(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function isEnglishLocale(locale: string): boolean {
  return locale.trim().toLowerCase() === "en";
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function AdminLanguagesSection({ user: _user }: AdminLanguagesSectionProps) {
  const [items, setItems] = useState<LanguageRegistryAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LanguageFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminLanguages();
      setItems([...response.languages]);
    } catch (loadError) {
      setError(formatAuthFormError(loadError));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm("en"));
    setFormOpen(true);
    setStatus(null);
    setError(null);
  }

  function openEdit(row: LanguageRegistryAdmin) {
    setEditingId(row.languageId);
    setForm(toForm(row));
    setFormOpen(true);
    setStatus(null);
    setError(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const aliases = parseAliases(form.aliasesText);
      if (editingId) {
        const patch: AdminLanguagePatchInput = {
          englishName: form.englishName.trim(),
          nativeName: form.nativeName.trim(),
          textDirection: form.textDirection,
          fallbackLocale: form.fallbackLocale.trim() || "en",
          enabled: form.enabled,
          uiTranslationStatus: form.uiTranslationStatus,
          contentTranslationEnabled: form.contentTranslationEnabled,
          searchEnabled: form.searchEnabled,
          seoIndexingEnabled: form.seoIndexingEnabled,
          aliases,
        };
        await updateAdminLanguage(editingId, patch);
        setStatus("Language updated.");
      } else {
        const createBody: AdminLanguageCreateInput = {
          locale: form.locale.trim(),
          englishName: form.englishName.trim(),
          nativeName: form.nativeName.trim(),
          textDirection: form.textDirection,
          fallbackLocale: form.fallbackLocale.trim() || "en",
          enabled: form.enabled,
          uiTranslationStatus: form.uiTranslationStatus,
          contentTranslationEnabled: form.contentTranslationEnabled,
          searchEnabled: form.searchEnabled,
          seoIndexingEnabled: form.seoIndexingEnabled,
          aliases,
        };
        await createAdminLanguage(createBody);
        setStatus("Language created.");
      }
      closeForm();
      await load();
    } catch (saveError) {
      setError(formatAuthFormError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled(row: LanguageRegistryAdmin) {
    if (isEnglishLocale(row.locale) && row.enabled) {
      setError("English (en) cannot be disabled.");
      return;
    }
    setTogglingId(row.languageId);
    setError(null);
    setStatus(null);
    try {
      await updateAdminLanguage(row.languageId, { enabled: !row.enabled });
      setStatus(row.enabled ? `${row.locale} disabled.` : `${row.locale} enabled.`);
      await load();
    } catch (toggleError) {
      setError(formatAuthFormError(toggleError));
    } finally {
      setTogglingId(null);
    }
  }

  const editingEnglish = Boolean(editingId && isEnglishLocale(form.locale));

  return (
    <main className="admin-panel">
      <AdminPanelNavigation />
      <ProfileSection title="Languages">
        <p className="hu-caption admin-languages__lede">
          Canonical Language Registry — Admin-managed locales for platform selection, translation,
          and SEO readiness. Runtime pickers and Translate Draft use enabled languages only. Locale
          is immutable after creation. Backend policy is authoritative for conflicts and fallbacks.
        </p>

        <div className="admin-languages__toolbar">
          <Button type="button" variant="primary" onClick={openCreate} disabled={saving}>
            Add Language
          </Button>
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>

        {status ? <StatusBanner title="Languages" message={status} /> : null}
        {error ? <StatusBanner title="Languages error" message={error} /> : null}

        {formOpen ? (
          <div className="admin-languages__form" role="region" aria-label={editingId ? "Edit language" : "Add language"}>
            <h3 className="hu-subtitle">{editingId ? "Edit language" : "Add language"}</h3>
            <div className="admin-languages__form-grid">
              <label>
                Locale {editingId ? "(immutable)" : ""}
                <input
                  className={`admin-panel__input${editingId ? " admin-languages__readonly" : ""}`}
                  value={form.locale}
                  disabled={Boolean(editingId) || saving}
                  onChange={(event) => setForm((prev) => ({ ...prev, locale: event.target.value }))}
                  placeholder="e.g. uk, zh-Hant, ar"
                  autoComplete="off"
                />
              </label>
              <label>
                English name
                <input
                  className="admin-panel__input"
                  value={form.englishName}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, englishName: event.target.value }))
                  }
                />
              </label>
              <label>
                Native name
                <input
                  className="admin-panel__input"
                  value={form.nativeName}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, nativeName: event.target.value }))
                  }
                />
              </label>
              <label>
                Direction
                <select
                  className="admin-panel__input"
                  value={form.textDirection}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      textDirection: event.target.value as LanguageTextDirection,
                    }))
                  }
                >
                  <option value="ltr">ltr</option>
                  <option value="rtl">rtl</option>
                </select>
              </label>
              <label>
                Fallback locale
                <input
                  className="admin-panel__input"
                  value={form.fallbackLocale}
                  disabled={saving || editingEnglish}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, fallbackLocale: event.target.value }))
                  }
                />
              </label>
              <label>
                UI translation status
                <select
                  className="admin-panel__input"
                  value={form.uiTranslationStatus}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      uiTranslationStatus: event.target.value as LanguageUiTranslationStatus,
                    }))
                  }
                >
                  {UI_STATUSES.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Aliases (comma-separated)
                <input
                  className="admin-panel__input"
                  value={form.aliasesText}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, aliasesText: event.target.value }))
                  }
                  placeholder="zh-TW, zh-HK"
                />
              </label>
              <label className="admin-languages__form-check">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  disabled={saving || (editingEnglish && form.enabled)}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, enabled: event.target.checked }))
                  }
                />
                Enabled
              </label>
              <label className="admin-languages__form-check">
                <input
                  type="checkbox"
                  checked={form.contentTranslationEnabled}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      contentTranslationEnabled: event.target.checked,
                    }))
                  }
                />
                Content translation
              </label>
              <label className="admin-languages__form-check">
                <input
                  type="checkbox"
                  checked={form.searchEnabled}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, searchEnabled: event.target.checked }))
                  }
                />
                Search
              </label>
              <label className="admin-languages__form-check">
                <input
                  type="checkbox"
                  checked={form.seoIndexingEnabled}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, seoIndexingEnabled: event.target.checked }))
                  }
                />
                SEO indexing
              </label>
            </div>
            {!editingId ? (
              <p className="hu-caption admin-languages__form-note">
                Locale becomes immutable after creation. Feature flags require Enabled.
              </p>
            ) : null}
            {editingEnglish ? (
              <p className="hu-caption admin-languages__form-note">
                English cannot be disabled and must keep English as fallback.
              </p>
            ) : null}
            <div className="admin-languages__form-actions">
              <Button type="button" variant="primary" disabled={saving} onClick={() => void handleSave()}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create language"}
              </Button>
              <Button type="button" variant="tertiary" disabled={saving} onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? <p className="hu-caption">Loading languages…</p> : null}

        {!loading ? (
          <div className="admin-languages__table-wrap">
            <table className="admin-initiatives-table admin-languages-table">
              <thead>
                <tr>
                  <th>English</th>
                  <th>Native</th>
                  <th>Locale</th>
                  <th>Dir</th>
                  <th>Enabled</th>
                  <th>UI</th>
                  <th>Content</th>
                  <th>Search</th>
                  <th>SEO</th>
                  <th>Fallback</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const english = isEnglishLocale(row.locale);
                  const busy = togglingId === row.languageId;
                  return (
                    <tr key={row.languageId}>
                      <td>{row.englishName}</td>
                      <td>{row.nativeName}</td>
                      <td>
                        <code>{row.locale}</code>
                        {row.aliases.length > 0 ? (
                          <div className="hu-caption">aliases: {row.aliases.join(", ")}</div>
                        ) : null}
                      </td>
                      <td>{row.textDirection}</td>
                      <td>{yesNo(row.enabled)}</td>
                      <td>{row.uiTranslationStatus}</td>
                      <td>{yesNo(row.contentTranslationEnabled)}</td>
                      <td>{yesNo(row.searchEnabled)}</td>
                      <td>{yesNo(row.seoIndexingEnabled)}</td>
                      <td>
                        <code>{row.fallbackLocale}</code>
                      </td>
                      <td>
                        <div className="admin-languages__row-actions">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={saving || busy}
                            onClick={() => openEdit(row)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="tertiary"
                            disabled={saving || busy || (english && row.enabled)}
                            aria-label={
                              english && row.enabled
                                ? "English cannot be disabled"
                                : row.enabled
                                  ? `Disable ${row.locale}`
                                  : `Enable ${row.locale}`
                            }
                            onClick={() => {
                              void handleToggleEnabled(row);
                            }}
                          >
                            {busy ? "…" : row.enabled ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </ProfileSection>
    </main>
  );
}

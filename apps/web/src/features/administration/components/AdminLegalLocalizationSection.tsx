"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AuthUserPublic,
  LegalDocumentType,
  LegalLocalizationAdminListItem,
  LegalLocalizationStatus,
  LanguageRegistryAdmin,
} from "@hu/types";
import { CANONICAL_LEGAL_SOURCE_VERSIONS } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  fetchAdminLegalLocalizations,
  publishAdminLegalLocalization,
  upsertAdminLegalLocalization,
} from "../admin-legal-localization-api";
import { fetchAdminLanguages } from "../admin-languages-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";
import "./admin-languages.css";

interface AdminLegalLocalizationSectionProps {
  user: AuthUserPublic;
}

interface LegalFormState {
  documentType: LegalDocumentType;
  locale: string;
  localizedBody: string;
  canonicalSourceVersion: string;
  status: LegalLocalizationStatus;
}

const DOCUMENT_TYPES: readonly LegalDocumentType[] = ["privacy", "terms"];
const STATUSES: readonly LegalLocalizationStatus[] = ["draft", "approved", "published"];

function emptyForm(
  documentType: LegalDocumentType = "privacy",
  locale = "uk",
): LegalFormState {
  return {
    documentType,
    locale,
    localizedBody: "",
    canonicalSourceVersion: CANONICAL_LEGAL_SOURCE_VERSIONS[documentType],
    status: "draft",
  };
}

function toForm(row: LegalLocalizationAdminListItem): LegalFormState {
  return {
    documentType: row.documentType,
    locale: row.locale,
    localizedBody: row.localizedBody,
    canonicalSourceVersion: row.canonicalSourceVersion,
    status: row.status,
  };
}

function recordKey(documentType: LegalDocumentType, locale: string): string {
  return `${documentType}::${locale}`;
}

export function AdminLegalLocalizationSection({
  user: _user,
}: AdminLegalLocalizationSectionProps) {
  const [localizations, setLocalizations] = useState<LegalLocalizationAdminListItem[]>([]);
  const [languages, setLanguages] = useState<LanguageRegistryAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState<LegalFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const localizationByKey = useMemo(() => {
    const map = new Map<string, LegalLocalizationAdminListItem>();
    for (const row of localizations) {
      map.set(recordKey(row.documentType, row.locale), row);
    }
    return map;
  }, [localizations]);

  const selectedLanguage = languages.find((row) => row.locale === form.locale) ?? null;
  const existing = localizationByKey.get(recordKey(form.documentType, form.locale)) ?? null;
  const currentCanonicalVersion = CANONICAL_LEGAL_SOURCE_VERSIONS[form.documentType];
  const isStale =
    existing?.isStaleRelativeToCanonical === true ||
    (existing != null && existing.canonicalSourceVersion !== currentCanonicalVersion);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [legalResponse, languageResponse] = await Promise.all([
        fetchAdminLegalLocalizations(),
        fetchAdminLanguages(),
      ]);
      setLocalizations([...legalResponse.localizations]);
      setLanguages([...languageResponse.languages]);
      setForm((current) => {
        const match = legalResponse.localizations.find(
          (row) =>
            row.documentType === current.documentType && row.locale === current.locale,
        );
        return match ? toForm(match) : current;
      });
    } catch (loadError) {
      setError(formatAuthFormError(loadError));
      setLocalizations([]);
      setLanguages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function selectDocumentType(documentType: LegalDocumentType) {
    const found = localizationByKey.get(recordKey(documentType, form.locale));
    if (found) {
      setForm(toForm(found));
    } else {
      setForm(emptyForm(documentType, form.locale));
    }
    setStatus(null);
    setError(null);
  }

  function selectLocale(locale: string) {
    const found = localizationByKey.get(recordKey(form.documentType, locale));
    if (found) {
      setForm(toForm(found));
    } else {
      setForm(emptyForm(form.documentType, locale));
    }
    setStatus(null);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const saved = await upsertAdminLegalLocalization({
        documentType: form.documentType,
        locale: form.locale.trim(),
        localizedBody: form.localizedBody,
        canonicalSourceVersion: form.canonicalSourceVersion.trim() || currentCanonicalVersion,
        status: form.status,
      });
      setStatus(`Saved ${saved.documentType}/${saved.locale} (${saved.status}).`);
      await load();
      setForm({
        documentType: saved.documentType,
        locale: saved.locale,
        localizedBody: saved.localizedBody,
        canonicalSourceVersion: saved.canonicalSourceVersion,
        status: saved.status,
      });
    } catch (saveError) {
      setError(formatAuthFormError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!form.locale.trim()) {
      return;
    }
    setPublishing(true);
    setError(null);
    setStatus(null);
    try {
      await upsertAdminLegalLocalization({
        documentType: form.documentType,
        locale: form.locale.trim(),
        localizedBody: form.localizedBody,
        canonicalSourceVersion: form.canonicalSourceVersion.trim() || currentCanonicalVersion,
        status: form.status === "published" ? "published" : "approved",
      });
      const published = await publishAdminLegalLocalization(
        form.documentType,
        form.locale.trim(),
      );
      setStatus(`Published ${published.documentType}/${published.locale}.`);
      await load();
      setForm({
        documentType: published.documentType,
        locale: published.locale,
        localizedBody: published.localizedBody,
        canonicalSourceVersion: published.canonicalSourceVersion,
        status: published.status,
      });
    } catch (publishError) {
      setError(formatAuthFormError(publishError));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <ProfileSection title="Legal Localization">
        <p className="hu-caption admin-languages__lede">
          Counsel-approved localized Privacy Policy and Terms of Use HTML only. Never
          machine-translated. English legal documents remain the canonical authoritative source.
          Public surfaces serve a published locale body only when its{" "}
          <code>canonicalSourceVersion</code> matches the current English source version;
          otherwise they fall back to English (<code>expected_legal_fallback</code>). Alias
          locales (e.g. zh-TW) canonicalize to Registry locale (zh-Hant).
        </p>

        {error ? <StatusBanner title="Legal Localization error" message={error} /> : null}
        {status ? <StatusBanner title="Legal Localization" message={status} /> : null}
        {isStale ? (
          <StatusBanner
            title="Stale relative to canonical English"
            message={`This record’s version (${existing?.canonicalSourceVersion ?? form.canonicalSourceVersion}) does not match the current canonical ${form.documentType} version (${currentCanonicalVersion}). Public surfaces will not serve this body until it is updated and re-published for the current version.`}
          />
        ) : null}

        {loading ? (
          <p className="hu-caption">Loading legal localizations…</p>
        ) : (
          <>
            <div className="admin-languages__toolbar">
              <label>
                <span>Document</span>
                <select
                  value={form.documentType}
                  onChange={(event) =>
                    selectDocumentType(event.target.value as LegalDocumentType)
                  }
                >
                  {DOCUMENT_TYPES.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry === "privacy" ? "Privacy Policy" : "Terms of Use"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Locale</span>
                <select
                  value={form.locale}
                  onChange={(event) => selectLocale(event.target.value)}
                >
                  {languages.map((language) => {
                    const row = localizationByKey.get(
                      recordKey(form.documentType, language.locale),
                    );
                    const publishedMark = row?.status === "published" ? " · published" : "";
                    const staleMark = row?.isStaleRelativeToCanonical ? " · stale" : "";
                    return (
                      <option key={language.languageId} value={language.locale}>
                        {language.nativeName} ({language.locale})
                        {publishedMark}
                        {staleMark}
                      </option>
                    );
                  })}
                </select>
              </label>
              {selectedLanguage ? (
                <p className="hu-caption">
                  Native: {selectedLanguage.nativeName}
                  {existing
                    ? ` · current status: ${existing.status}`
                    : " · no record yet (will create on save)"}
                  {" · "}
                  current canonical version: <code>{currentCanonicalVersion}</code>
                </p>
              ) : null}
            </div>

            <div className="admin-languages__form">
              <div className="admin-languages__form-grid">
                <label>
                  <span>Canonical source version</span>
                  <input
                    value={form.canonicalSourceVersion}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        canonicalSourceVersion: event.target.value,
                      }))
                    }
                  />
                  <span className="hu-caption">
                    Must match <code>{currentCanonicalVersion}</code> for public serve. Defaults
                    to the current English source version on create.
                  </span>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as LegalLocalizationStatus,
                      }))
                    }
                  >
                    {STATUSES.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-languages__form-span">
                  <span>Localized body (HTML)</span>
                  <textarea
                    rows={16}
                    value={form.localizedBody}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        localizedBody: event.target.value,
                      }))
                    }
                  />
                  <span className="hu-caption">
                    Paste counsel-approved HTML only. Do not use machine translation. English
                    remains canonical until a matching published version exists for this locale.
                  </span>
                </label>
              </div>

              <div className="admin-languages__form-actions">
                <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handlePublish()}
                  disabled={publishing || saving}
                >
                  {publishing ? "Publishing…" : "Publish"}
                </Button>
              </div>
            </div>

            <div className="admin-languages__table-wrap">
              <table className="admin-languages-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Locale</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Stale</th>
                  </tr>
                </thead>
                <tbody>
                  {localizations.map((row) => (
                    <tr key={row.legalId}>
                      <td>
                        <button
                          type="button"
                          className="admin-panel__link"
                          onClick={() => {
                            setForm(toForm(row));
                            setStatus(null);
                            setError(null);
                          }}
                        >
                          {row.documentType}
                        </button>
                      </td>
                      <td>{row.locale}</td>
                      <td>
                        <code>{row.canonicalSourceVersion}</code>
                      </td>
                      <td>{row.status}</td>
                      <td>{row.isStaleRelativeToCanonical ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ProfileSection>
    </div>
  );
}

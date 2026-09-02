"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AuthUserPublic,
  BrandLocalizationRecord,
  BrandLocalizationStatus,
  LanguageRegistryAdmin,
} from "@hu/types";
import { CANONICAL_ENGLISH_BRAND_FALLBACK } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  fetchAdminBrandLocalizations,
  publishAdminBrandLocalization,
  upsertAdminBrandLocalization,
} from "../admin-brand-localization-api";
import { fetchAdminLanguages } from "../admin-languages-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";
import "./admin-languages.css";

interface AdminBrandLocalizationSectionProps {
  user: AuthUserPublic;
}

interface BrandFormState {
  locale: string;
  siteName: string;
  shortName: string;
  slogan: string;
  heroUnityQuote: string;
  seoSiteName: string;
  seoTitleSuffix: string;
  defaultMetaDescription: string;
  openGraphBrandName: string;
  status: BrandLocalizationStatus;
}

const STATUSES: readonly BrandLocalizationStatus[] = ["draft", "approved", "published"];

function emptyForm(locale = ""): BrandFormState {
  return {
    locale,
    siteName: CANONICAL_ENGLISH_BRAND_FALLBACK.siteName,
    shortName: CANONICAL_ENGLISH_BRAND_FALLBACK.shortName,
    slogan: CANONICAL_ENGLISH_BRAND_FALLBACK.slogan,
    heroUnityQuote: CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote,
    seoSiteName: CANONICAL_ENGLISH_BRAND_FALLBACK.seoSiteName,
    seoTitleSuffix: CANONICAL_ENGLISH_BRAND_FALLBACK.seoTitleSuffix,
    defaultMetaDescription: CANONICAL_ENGLISH_BRAND_FALLBACK.defaultMetaDescription,
    openGraphBrandName: CANONICAL_ENGLISH_BRAND_FALLBACK.openGraphBrandName,
    status: "draft",
  };
}

function toForm(row: BrandLocalizationRecord): BrandFormState {
  return {
    locale: row.locale,
    siteName: row.siteName,
    shortName: row.shortName ?? "",
    slogan: row.slogan,
    heroUnityQuote: row.heroUnityQuote ?? "",
    seoSiteName: row.seoSiteName,
    seoTitleSuffix: row.seoTitleSuffix ?? "",
    defaultMetaDescription: row.defaultMetaDescription,
    openGraphBrandName: row.openGraphBrandName ?? "",
    status: row.status,
  };
}

export function AdminBrandLocalizationSection({
  user: _user,
}: AdminBrandLocalizationSectionProps) {
  const [brands, setBrands] = useState<BrandLocalizationRecord[]>([]);
  const [languages, setLanguages] = useState<LanguageRegistryAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState<BrandFormState>(emptyForm("en"));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const brandByLocale = useMemo(() => {
    const map = new Map<string, BrandLocalizationRecord>();
    for (const row of brands) {
      map.set(row.locale, row);
    }
    return map;
  }, [brands]);

  const selectedLanguage = languages.find((row) => row.locale === form.locale) ?? null;
  const existing = brandByLocale.get(form.locale) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [brandResponse, languageResponse] = await Promise.all([
        fetchAdminBrandLocalizations(),
        fetchAdminLanguages(),
      ]);
      setBrands([...brandResponse.brands]);
      setLanguages([...languageResponse.languages]);
      const preferred =
        brandResponse.brands.find((row) => row.locale === "en") ?? brandResponse.brands[0];
      if (preferred) {
        setForm(toForm(preferred));
      }
    } catch (loadError) {
      setError(formatAuthFormError(loadError));
      setBrands([]);
      setLanguages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function selectLocale(locale: string) {
    const found = brandByLocale.get(locale);
    if (found) {
      setForm(toForm(found));
    } else {
      setForm(emptyForm(locale));
    }
    setStatus(null);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const saved = await upsertAdminBrandLocalization({
        locale: form.locale.trim(),
        siteName: form.siteName.trim(),
        shortName: form.shortName.trim() || undefined,
        slogan: form.slogan.trim(),
        heroUnityQuote: form.heroUnityQuote.trim(),
        seoSiteName: form.seoSiteName.trim(),
        seoTitleSuffix: form.seoTitleSuffix.trim() || undefined,
        defaultMetaDescription: form.defaultMetaDescription.trim(),
        openGraphBrandName: form.openGraphBrandName.trim() || undefined,
        status: form.status,
      });
      setStatus(`Saved ${saved.locale} (${saved.status}).`);
      await load();
      setForm(toForm(saved));
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
      // Ensure latest form values exist before publish.
      await upsertAdminBrandLocalization({
        locale: form.locale.trim(),
        siteName: form.siteName.trim(),
        shortName: form.shortName.trim() || undefined,
        slogan: form.slogan.trim(),
        heroUnityQuote: form.heroUnityQuote.trim(),
        seoSiteName: form.seoSiteName.trim(),
        seoTitleSuffix: form.seoTitleSuffix.trim() || undefined,
        defaultMetaDescription: form.defaultMetaDescription.trim(),
        openGraphBrandName: form.openGraphBrandName.trim() || undefined,
        status: form.status === "published" ? "published" : "approved",
      });
      const published = await publishAdminBrandLocalization(form.locale.trim());
      setStatus(`Published ${published.locale}.`);
      await load();
      setForm(toForm(published));
    } catch (publishError) {
      setError(formatAuthFormError(publishError));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <ProfileSection title="Brand Localization">
        <p className="hu-caption admin-languages__lede">
          Admin-managed localized brand identity. Separate from Terminology Glossary. Never
          machine-translated. Resolve order for public surfaces: published locale → published
          English → builtin English fallback. Alias locales (e.g. zh-TW) canonicalize to Registry
          locale (zh-Hant).
        </p>

        {error ? <StatusBanner title="Brand Localization error" message={error} /> : null}
        {status ? <StatusBanner title="Brand Localization" message={status} /> : null}

        {loading ? (
          <p className="hu-caption">Loading brand localizations…</p>
        ) : (
          <>
            <div className="admin-languages__toolbar">
              <label>
                <span>Locale</span>
                <select
                  value={form.locale}
                  onChange={(event) => selectLocale(event.target.value)}
                >
                  {languages.map((language) => {
                    const brand = brandByLocale.get(language.locale);
                    const publishedMark = brand?.status === "published" ? " · published" : "";
                    return (
                      <option key={language.languageId} value={language.locale}>
                        {language.nativeName} ({language.locale})
                        {publishedMark}
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
                  {form.locale !== "en" && !existing ? (
                    <> · fallback hint: unpublished locales resolve to published English</>
                  ) : null}
                </p>
              ) : null}
            </div>

            <div className="admin-languages__form">
              <div className="admin-languages__form-grid">
                <label>
                  <span>Site name</span>
                  <input
                    value={form.siteName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, siteName: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Short name</span>
                  <input
                    value={form.shortName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, shortName: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Slogan</span>
                  <input
                    value={form.slogan}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, slogan: event.target.value }))
                    }
                  />
                </label>
                <label className="admin-languages__form-span">
                  <span>Hero unity quote</span>
                  <textarea
                    rows={4}
                    value={form.heroUnityQuote}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        heroUnityQuote: event.target.value,
                      }))
                    }
                  />
                  <span className="hu-caption">
                    Participant-facing Home Hero quote for this language. Manually controlled —
                    enter a faithful translation or a different approved quote. Machine
                    translation is not used. Use line breaks for intentional visual lines.
                  </span>
                </label>
                <label>
                  <span>SEO site name</span>
                  <input
                    value={form.seoSiteName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, seoSiteName: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>SEO title suffix</span>
                  <input
                    value={form.seoTitleSuffix}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        seoTitleSuffix: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Open Graph brand name</span>
                  <input
                    value={form.openGraphBrandName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        openGraphBrandName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as BrandLocalizationStatus,
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
                <label>
                  <span>Default meta description</span>
                  <textarea
                    rows={3}
                    value={form.defaultMetaDescription}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        defaultMetaDescription: event.target.value,
                      }))
                    }
                  />
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
                    <th>Locale</th>
                    <th>Site name</th>
                    <th>Slogan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map((row) => (
                    <tr key={row.brandId}>
                      <td>
                        <button
                          type="button"
                          className="admin-panel__link"
                          onClick={() => selectLocale(row.locale)}
                        >
                          {row.locale}
                        </button>
                      </td>
                      <td>{row.siteName}</td>
                      <td>{row.slogan}</td>
                      <td>{row.status}</td>
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

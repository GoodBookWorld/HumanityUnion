"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { toGeographyCountryOptions } from "@hu/geography";
import type {
  AuthUserPublic,
  MediaResource,
  MediaResourceScopeType,
  MediaResourceType,
  TrustedMediaCategoryId,
} from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import { PersonImageUploadField } from "../../media-upload/components/PersonImageUploadField";
import { uploadMediaResourceLogo } from "../../media-upload/media-upload-api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import {
  activateAdminMediaResource,
  createAdminMediaResource,
  deactivateAdminMediaResource,
  deleteAdminMediaResource,
  listAdminMediaResources,
  updateAdminMediaResource,
  type AdminMediaResourceWriteInput,
} from "../admin-media-resources-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";
import "./admin-media-resources.css";

interface AdminMediaResourcesSectionProps {
  user: AuthUserPublic;
}

const RESOURCE_TYPES: readonly MediaResourceType[] = [
  "TRUSTED_MEDIA",
  "NEWS_SOURCE",
  "FACT_CHECKING",
  "PROPAGANDA_ANALYSIS",
];

const TRUSTED_CATEGORIES: readonly TrustedMediaCategoryId[] = [
  "international-wire-service",
  "public-broadcaster",
  "independent-investigative",
  "regional-public-media",
  "scientific-publisher",
  "academic-resource",
];

const RESOURCE_TYPE_LABELS: Record<MediaResourceType, string> = {
  TRUSTED_MEDIA: "Trusted Media",
  NEWS_SOURCE: "News / RSS",
  FACT_CHECKING: "Fact-Checking",
  PROPAGANDA_ANALYSIS: "Propaganda Analysis",
};

function emptyForm(resourceType: MediaResourceType = "TRUSTED_MEDIA"): AdminMediaResourceWriteInput {
  return {
    resourceType,
    scopeType: "WORLD",
    countryCode: null,
    name: "",
    logoLabel: "",
    logoUrl: null,
    websiteUrl: "",
    rssUrl: null,
    categoryId: resourceType === "TRUSTED_MEDIA" ? "international-wire-service" : null,
    description: "",
    secondaryText: "",
    language: resourceType === "NEWS_SOURCE" ? "en" : null,
    active: true,
    sortOrder: 100,
  };
}

function toForm(resource: MediaResource): AdminMediaResourceWriteInput {
  return {
    resourceType: resource.resourceType,
    scopeType: resource.scopeType,
    countryCode: resource.countryCode,
    name: resource.name,
    logoLabel: resource.logoLabel,
    logoUrl: resource.logoUrl ?? null,
    websiteUrl: resource.websiteUrl,
    rssUrl: resource.rssUrl ?? null,
    categoryId: resource.categoryId ?? null,
    description: resource.description ?? "",
    secondaryText: resource.secondaryText ?? "",
    language: resource.language ?? null,
    providerId: resource.providerId ?? null,
    active: resource.active,
    sortOrder: resource.sortOrder,
  };
}

export function AdminMediaResourcesSection({ user: _user }: AdminMediaResourcesSectionProps) {
  const [items, setItems] = useState<MediaResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<MediaResourceType | "">("");
  const [scopeFilter, setScopeFilter] = useState<MediaResourceScopeType | "">("");
  const [countryFilter, setCountryFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AdminMediaResourceWriteInput>(emptyForm());
  const [saving, setSaving] = useState(false);

  const countryOptions = useMemo(
    () => [...toGeographyCountryOptions()].sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listAdminMediaResources({
        resourceType: resourceTypeFilter,
        scopeType: scopeFilter,
        countryCode: countryFilter,
        active: activeFilter,
      });
      setItems(rows);
    } catch (loadError) {
      setError(formatAuthFormError(loadError));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, countryFilter, resourceTypeFilter, scopeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(resourceTypeFilter || "TRUSTED_MEDIA"));
    setFormOpen(true);
    setStatus(null);
  }

  function openEdit(resource: MediaResource) {
    setEditingId(resource.id);
    setForm(toForm(resource));
    setFormOpen(true);
    setStatus(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const payload: AdminMediaResourceWriteInput = {
        ...form,
        countryCode: form.scopeType === "WORLD" ? null : form.countryCode,
        rssUrl: form.resourceType === "NEWS_SOURCE" ? form.rssUrl : null,
        categoryId: form.resourceType === "TRUSTED_MEDIA" ? form.categoryId : null,
        language: form.resourceType === "NEWS_SOURCE" ? form.language || "en" : null,
        logoLabel: form.logoLabel.trim() || form.name.trim().slice(0, 3).toUpperCase(),
      };

      if (editingId) {
        const { resourceType: _ignored, ...update } = payload;
        await updateAdminMediaResource(editingId, update);
        setStatus("Media resource updated.");
      } else {
        await createAdminMediaResource(payload);
        setStatus("Media resource created.");
      }
      setFormOpen(false);
      await load();
    } catch (saveError) {
      setError(formatAuthFormError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: string) {
    setError(null);
    try {
      await activateAdminMediaResource(id);
      setStatus("Resource activated.");
      await load();
    } catch (activateError) {
      setError(formatAuthFormError(activateError));
    }
  }

  async function handleDeactivate(id: string) {
    setError(null);
    try {
      await deactivateAdminMediaResource(id);
      setStatus("Resource deactivated.");
      await load();
    } catch (deactivateError) {
      setError(formatAuthFormError(deactivateError));
    }
  }

  async function handleRemove(resource: MediaResource) {
    const confirmMessage =
      resource.resourceType === "NEWS_SOURCE"
        ? "Deactivate this news source? Historical articles will be kept."
        : resource.active
          ? "Deactivate this resource?"
          : "Permanently remove this inactive resource?";
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    try {
      await deleteAdminMediaResource(resource.id, {
        hard: !resource.active && resource.resourceType !== "NEWS_SOURCE",
      });
      setStatus(
        resource.resourceType === "NEWS_SOURCE" || resource.active
          ? "Resource deactivated."
          : "Resource removed.",
      );
      await load();
    } catch (removeError) {
      setError(formatAuthFormError(removeError));
    }
  }

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Media Resources">
        <p className="admin-panel__note">
          Manage Recommended Trusted Media, RSS news sources, Fact-Checking, and Propaganda
          Analysis. WORLD resources feed global Media experiences; COUNTRY resources feed the
          matching Country page.
        </p>

        {error ? <StatusBanner title="Media Resources error" message={error} /> : null}
        {status ? <StatusBanner title="Media Resources" message={status} /> : null}

        <div className="admin-initiatives-filters">
          <div className="admin-initiatives-filters__row">
            <label>
              Resource type
              <select
                value={resourceTypeFilter}
                onChange={(event) =>
                  setResourceTypeFilter(event.target.value as MediaResourceType | "")
                }
              >
                <option value="">All</option>
                {RESOURCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {RESOURCE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Scope
              <select
                value={scopeFilter}
                onChange={(event) =>
                  setScopeFilter(event.target.value as MediaResourceScopeType | "")
                }
              >
                <option value="">All</option>
                <option value="WORLD">WORLD</option>
                <option value="COUNTRY">COUNTRY</option>
              </select>
            </label>
            <label>
              Country
              <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
                <option value="">All</option>
                {countryOptions.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label} ({country.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Active
              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value as "" | "true" | "false")}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
          </div>
          <div className="admin-initiatives-filters__row">
            <Button type="button" variant="primary" onClick={openCreate}>
              + Add media resource
            </Button>
          </div>
        </div>

        {formOpen ? (
          <div className="admin-media-resources__form">
            <h3>{editingId ? "Edit media resource" : "Add media resource"}</h3>
            <div className="admin-media-resources__form-grid">
              <label>
                Resource type
                <select
                  value={form.resourceType}
                  disabled={Boolean(editingId)}
                  onChange={(event) => {
                    const nextType = event.target.value as MediaResourceType;
                    setForm((current) => ({
                      ...emptyForm(nextType),
                      name: current.name,
                      websiteUrl: current.websiteUrl,
                      logoUrl: current.logoUrl,
                      logoLabel: current.logoLabel,
                      scopeType: current.scopeType,
                      countryCode: current.countryCode,
                      active: current.active,
                      sortOrder: current.sortOrder,
                    }));
                  }}
                >
                  {RESOURCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {RESOURCE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Scope
                <select
                  value={form.scopeType}
                  onChange={(event) => {
                    const scopeType = event.target.value as MediaResourceScopeType;
                    setForm((current) => ({
                      ...current,
                      scopeType,
                      countryCode: scopeType === "WORLD" ? null : current.countryCode,
                    }));
                  }}
                >
                  <option value="WORLD">WORLD</option>
                  <option value="COUNTRY">COUNTRY</option>
                </select>
              </label>
              {form.scopeType === "COUNTRY" ? (
                <label>
                  Country
                  <select
                    value={form.countryCode ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        countryCode: event.target.value || null,
                      }))
                    }
                  >
                    <option value="">Select country</option>
                    {countryOptions.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.label} ({country.code})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                Name
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Website URL
                <input
                  value={form.websiteUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, websiteUrl: event.target.value }))
                  }
                />
              </label>
              {form.resourceType === "NEWS_SOURCE" ? (
                <label>
                  RSS URL
                  <input
                    value={form.rssUrl ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, rssUrl: event.target.value }))
                    }
                  />
                </label>
              ) : null}
              {form.resourceType === "TRUSTED_MEDIA" ? (
                <label>
                  Category
                  <select
                    value={form.categoryId ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, categoryId: event.target.value }))
                    }
                  >
                    {TRUSTED_CATEGORIES.map((categoryId) => (
                      <option key={categoryId} value={categoryId}>
                        {categoryId}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                Description
                <textarea
                  value={form.description ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={3}
                />
              </label>
              <label>
                Secondary text
                <textarea
                  value={form.secondaryText ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, secondaryText: event.target.value }))
                  }
                  rows={2}
                />
              </label>
              <label>
                Display order
                <input
                  type="number"
                  value={form.sortOrder ?? 100}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sortOrder: Number.parseInt(event.target.value, 10) || 0,
                    }))
                  }
                />
              </label>
              <label className="admin-media-resources__checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(form.active)}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, active: event.target.checked }))
                  }
                />
                Active
              </label>
            </div>

            <PersonImageUploadField
              label="Logo"
              variant="landscape"
              imageUrl={resolveMediaUrl(form.logoUrl) ?? form.logoUrl}
              chooseLabel="Choose logo"
              replaceLabel="Replace logo"
              removeLabel="Remove logo"
              emptyLabel="No logo selected"
              helperText="Landscape logo preview. Existing static logos may be kept without re-upload."
              onUpload={async (file) => {
                const uploaded = await uploadMediaResourceLogo(file);
                setForm((current) => ({
                  ...current,
                  logoUrl: uploaded.mediaUrl,
                  logoLabel: current.logoLabel || current.name.slice(0, 3).toUpperCase(),
                }));
                return uploaded.mediaUrl;
              }}
              onRemove={() => {
                setForm((current) => ({ ...current, logoUrl: null }));
              }}
            />

            <div className="admin-media-resources__form-actions">
              <Button type="button" variant="primary" disabled={saving} onClick={() => void handleSave()}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create resource"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? <p className="hu-body">Loading media resources…</p> : null}

        {!loading ? (
          <div className="admin-initiatives-table-wrap">
            <table className="admin-initiatives-table admin-media-resources-table">
              <thead>
                <tr>
                  <th>Logo</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Scope</th>
                  <th>Website</th>
                  <th>RSS</th>
                  <th>State</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((resource) => {
                  const logoSrc = resolveMediaUrl(resource.logoUrl) ?? resource.logoUrl;
                  return (
                    <tr key={resource.id}>
                      <td>
                        {logoSrc ? (
                          <img
                            className="admin-media-resources__logo"
                            src={logoSrc}
                            alt=""
                            width={56}
                            height={36}
                          />
                        ) : (
                          <span className="admin-media-resources__logo-fallback">
                            {resource.logoLabel}
                          </span>
                        )}
                      </td>
                      <td>
                        <p className="admin-initiatives-table__title">{resource.name}</p>
                        <p className="admin-initiatives-table__meta">{resource.id}</p>
                      </td>
                      <td>{RESOURCE_TYPE_LABELS[resource.resourceType]}</td>
                      <td>
                        {resource.scopeType}
                        {resource.countryCode ? ` · ${resource.countryCode}` : ""}
                      </td>
                      <td>
                        <a
                          className="admin-panel__link"
                          href={resource.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {resource.websiteUrl.replace(/^https?:\/\//, "").slice(0, 36)}
                        </a>
                      </td>
                      <td>
                        {resource.resourceType === "NEWS_SOURCE"
                          ? resource.rssUrl
                            ? "Configured"
                            : "Missing"
                          : "—"}
                      </td>
                      <td>{resource.active ? "Active" : "Inactive"}</td>
                      <td>
                        <div className="admin-media-resources__row-actions">
                          <Button type="button" variant="secondary" onClick={() => openEdit(resource)}>
                            Edit
                          </Button>
                          {resource.active ? (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => void handleDeactivate(resource.id)}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => void handleActivate(resource.id)}
                            >
                              Activate
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleRemove(resource)}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {items.length === 0 ? <p className="hu-body">No media resources match these filters.</p> : null}
          </div>
        ) : null}
      </ProfileSection>
    </div>
  );
}

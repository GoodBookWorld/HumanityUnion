"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { toGeographyCountryOptions } from "@hu/geography";
import type {
  AuthUserPublic,
  CountryAffiliationEntry,
  CountryAffiliationEntryType,
} from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import { PersonImageUploadField } from "../../media-upload/components/PersonImageUploadField";
import { uploadMediaResourceLogo } from "../../media-upload/media-upload-api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import {
  activateAdminCountryPerson,
  createAdminCountryPerson,
  deactivateAdminCountryPerson,
  deleteAdminCountryPerson,
  listAdminCountryPeople,
  updateAdminCountryPerson,
  type AdminCountryPeopleWriteInput,
} from "../admin-country-people-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";
import "./admin-country-people.css";

interface AdminCountryPeopleSectionProps {
  user: AuthUserPublic;
}

const ENTRY_TYPE_LABELS: Record<CountryAffiliationEntryType, string> = {
  TEAM_MEMBER: "Team member",
  PARTNER: "Partner",
};

function emptyForm(): AdminCountryPeopleWriteInput {
  return {
    countryCode: "CA",
    entryType: "TEAM_MEMBER",
    name: "",
    roleOrPosition: "",
    imageUrl: null,
    email: "",
    websiteUrl: "",
    sortOrder: 100,
    active: true,
  };
}

function toForm(entry: CountryAffiliationEntry): AdminCountryPeopleWriteInput {
  return {
    countryCode: entry.countryCode,
    entryType: entry.entryType,
    name: entry.name,
    roleOrPosition: entry.roleOrPosition ?? "",
    imageUrl: entry.imageUrl ?? null,
    email: entry.email ?? "",
    websiteUrl: entry.websiteUrl ?? "",
    sortOrder: entry.sortOrder,
    active: entry.active,
  };
}

export function AdminCountryPeopleSection({ user: _user }: AdminCountryPeopleSectionProps) {
  const [items, setItems] = useState<CountryAffiliationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<CountryAffiliationEntryType | "">("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AdminCountryPeopleWriteInput>(emptyForm());
  const [saving, setSaving] = useState(false);

  const countryOptions = useMemo(
    () => [...toGeographyCountryOptions()].sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listAdminCountryPeople({
        countryCode: countryFilter,
        entryType: typeFilter,
        active: activeFilter,
      });
      setItems(rows);
    } catch (loadError) {
      setError(formatAuthFormError(loadError));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, countryFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      countryCode: countryFilter || "CA",
      entryType: typeFilter || "TEAM_MEMBER",
    });
    setFormOpen(true);
    setStatus(null);
  }

  function openEdit(entry: CountryAffiliationEntry) {
    setEditingId(entry.entryId);
    setForm(toForm(entry));
    setFormOpen(true);
    setStatus(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const payload: AdminCountryPeopleWriteInput = {
        ...form,
        email: form.email?.trim() || null,
        websiteUrl: form.websiteUrl?.trim() || null,
        roleOrPosition: form.roleOrPosition?.trim() || null,
        imageUrl: form.imageUrl || null,
      };
      if (editingId) {
        await updateAdminCountryPerson(editingId, payload);
        setStatus("Entry updated.");
      } else {
        await createAdminCountryPerson(payload);
        setStatus("Entry created.");
      }
      setFormOpen(false);
      await load();
    } catch (saveError) {
      setError(formatAuthFormError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(entryId: string) {
    try {
      await activateAdminCountryPerson(entryId);
      setStatus("Entry activated.");
      await load();
    } catch (activateError) {
      setError(formatAuthFormError(activateError));
    }
  }

  async function handleDeactivate(entryId: string) {
    try {
      await deactivateAdminCountryPerson(entryId);
      setStatus("Entry deactivated.");
      await load();
    } catch (deactivateError) {
      setError(formatAuthFormError(deactivateError));
    }
  }

  async function handleRemove(entry: CountryAffiliationEntry) {
    const message = entry.active
      ? "Deactivate this entry? It will leave the public Country page."
      : "Permanently remove this inactive entry?";
    if (!window.confirm(message)) {
      return;
    }
    try {
      await deleteAdminCountryPerson(entry.entryId, { hard: !entry.active });
      setStatus(entry.active ? "Entry deactivated." : "Entry removed.");
      await load();
    } catch (removeError) {
      setError(formatAuthFormError(removeError));
    }
  }

  const imageVariant = form.entryType === "PARTNER" ? "landscape" : "person";

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Country Team & Partners">
        <p className="admin-panel__note">
          Manage public Country-page Team members and Partners. Entries are country-scoped and
          only appear when Active.
        </p>

        {error ? <StatusBanner title="Country people error" message={error} /> : null}
        {status ? <StatusBanner title="Country people" message={status} /> : null}

        <div className="admin-initiatives-filters">
          <div className="admin-initiatives-filters__row">
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
              Type
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as CountryAffiliationEntryType | "")
                }
              >
                <option value="">All</option>
                <option value="TEAM_MEMBER">Team member</option>
                <option value="PARTNER">Partner</option>
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
              + Add entry
            </Button>
          </div>
        </div>

        {formOpen ? (
          <div className="admin-country-people__form">
            <h3>{editingId ? "Edit entry" : "Add entry"}</h3>
            <div className="admin-country-people__form-grid">
              <label>
                Country
                <select
                  value={form.countryCode}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, countryCode: event.target.value }))
                  }
                >
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.label} ({country.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select
                  value={form.entryType}
                  disabled={Boolean(editingId)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      entryType: event.target.value as CountryAffiliationEntryType,
                    }))
                  }
                >
                  <option value="TEAM_MEMBER">Team member</option>
                  <option value="PARTNER">Partner</option>
                </select>
              </label>
              <label>
                Name
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Role / Position
                <input
                  value={form.roleOrPosition ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, roleOrPosition: event.target.value }))
                  }
                />
              </label>
              <label>
                Public email
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
              <label>
                Website URL
                <input
                  value={form.websiteUrl ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, websiteUrl: event.target.value }))
                  }
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
              <label className="admin-country-people__checkbox">
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
              label={form.entryType === "PARTNER" ? "Logo" : "Photo"}
              variant={imageVariant}
              imageUrl={resolveMediaUrl(form.imageUrl) ?? form.imageUrl}
              chooseLabel={form.entryType === "PARTNER" ? "Choose logo" : "Choose photo"}
              replaceLabel={form.entryType === "PARTNER" ? "Replace logo" : "Replace photo"}
              removeLabel={form.entryType === "PARTNER" ? "Remove logo" : "Remove photo"}
              emptyLabel={form.entryType === "PARTNER" ? "No logo selected" : "No photo selected"}
              onUpload={async (file) => {
                const uploaded = await uploadMediaResourceLogo(file);
                setForm((current) => ({ ...current, imageUrl: uploaded.mediaUrl }));
                return uploaded.mediaUrl;
              }}
              onRemove={() => setForm((current) => ({ ...current, imageUrl: null }))}
            />

            <div className="admin-country-people__form-actions">
              <Button type="button" variant="primary" disabled={saving} onClick={() => void handleSave()}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create entry"}
              </Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? <p className="hu-body">Loading country people…</p> : null}

        {!loading ? (
          <div className="admin-initiatives-table-wrap">
            <table className="admin-initiatives-table admin-country-people-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Country</th>
                  <th>Role</th>
                  <th>State</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => {
                  const imageSrc = resolveMediaUrl(entry.imageUrl) ?? entry.imageUrl;
                  return (
                    <tr key={entry.entryId}>
                      <td>
                        {imageSrc ? (
                          <img
                            className={
                              entry.entryType === "TEAM_MEMBER"
                                ? "admin-country-people__photo"
                                : "admin-country-people__logo"
                            }
                            src={imageSrc}
                            alt=""
                            width={48}
                            height={48}
                          />
                        ) : (
                          <span className="admin-country-people__fallback">
                            {entry.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td>
                        <p className="admin-initiatives-table__title">{entry.name}</p>
                      </td>
                      <td>{ENTRY_TYPE_LABELS[entry.entryType]}</td>
                      <td>{entry.countryCode}</td>
                      <td>{entry.roleOrPosition || "—"}</td>
                      <td>{entry.active ? "Active" : "Inactive"}</td>
                      <td>
                        <div className="admin-country-people__row-actions">
                          <Button type="button" variant="secondary" onClick={() => openEdit(entry)}>
                            Edit
                          </Button>
                          {entry.active ? (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => void handleDeactivate(entry.entryId)}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => void handleActivate(entry.entryId)}
                            >
                              Activate
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleRemove(entry)}
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
            {items.length === 0 ? <p className="hu-body">No entries match these filters.</p> : null}
          </div>
        ) : null}
      </ProfileSection>
    </div>
  );
}

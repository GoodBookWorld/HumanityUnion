"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type {
  AdminEditorDirectoryItem,
  AdminParticipantDirectoryItem,
  EditorCapabilityId,
  EditorGeographicScopeLevel,
  EditorGrantStatus,
} from "@hu/types";
import { EDITOR_ASSIGNABLE_CAPABILITY_IDS, EDITOR_CAPABILITY_LABELS } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import { CitySelect } from "../../geography-integrity/CitySelect";
import { CountrySelect } from "../../geography-integrity/CountrySelect";
import { RegionSelect } from "../../geography-integrity/RegionSelect";
import {
  assignAdminEditor,
  updateAdminEditor,
} from "../admin-editors-api";
import { listAdminParticipants } from "../admin-participant-directory-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-editors.css";

interface AdminEditorFormSectionProps {
  mode: "create" | "edit";
  initial?: AdminEditorDirectoryItem | null;
}

function participantLabel(row: AdminParticipantDirectoryItem): string {
  const name = row.profileDisplayName || row.displayName || row.publicName || row.email;
  const handle = row.uniqueName ? ` @${row.uniqueName}` : "";
  return `${name}${handle} · ${row.email}`;
}

export function AdminEditorFormSection({ mode, initial }: AdminEditorFormSectionProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<readonly AdminParticipantDirectoryItem[]>(
    [],
  );
  const [searching, setSearching] = useState(false);
  const [selectedParticipant, setSelectedParticipant] =
    useState<AdminParticipantDirectoryItem | null>(null);

  const [capabilities, setCapabilities] = useState<Set<EditorCapabilityId>>(
    () => new Set(initial?.capabilities ?? []),
  );
  const [level, setLevel] = useState<EditorGeographicScopeLevel>(
    initial?.geographicScope.level ?? "WORLD",
  );
  const [countryCode, setCountryCode] = useState(initial?.geographicScope.countryCode ?? "");
  const [regionCode, setRegionCode] = useState(initial?.geographicScope.regionCode ?? "");
  const [communityCode, setCommunityCode] = useState(
    initial?.geographicScope.communityCode ?? "",
  );
  const [status, setStatus] = useState<EditorGrantStatus>(initial?.status ?? "ACTIVE");
  /** Pack 12E1 — Assign Editor: idle → submitting → success | back to idle on failure. */
  const [submitPhase, setSubmitPhase] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "create") {
      return;
    }
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void listAdminParticipants({ search: trimmed, limit: 10, status: "active" })
        .then((result) => {
          if (!cancelled) {
            setSearchResults(result.participants);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, search]);

  const selectedCapabilityList = useMemo(
    () => EDITOR_ASSIGNABLE_CAPABILITY_IDS.filter((id) => capabilities.has(id)),
    [capabilities],
  );

  function toggleCapability(id: EditorCapabilityId) {
    setCapabilities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitPhase === "submitting" || submitPhase === "success") {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    if (selectedCapabilityList.length === 0) {
      setError("Select at least one editing permission.");
      return;
    }

    if (mode === "create" && !selectedParticipant) {
      setError("Select an existing registered Participant.");
      return;
    }

    const geographicScope =
      level === "WORLD"
        ? { level: "WORLD" as const }
        : level === "COUNTRY"
          ? { level: "COUNTRY" as const, countryCode }
          : level === "REGION"
            ? { level: "REGION" as const, countryCode, regionCode }
            : {
                level: "CITY" as const,
                countryCode,
                regionCode,
                communityCode,
              };

    setSubmitPhase("submitting");
    try {
      if (mode === "create" && selectedParticipant) {
        const created = await assignAdminEditor({
          participantId: selectedParticipant.memberId,
          capabilities: selectedCapabilityList,
          geographicScope,
          status,
        });
        setSubmitPhase("success");
        const success = created.notificationDelivered
          ? "Editor assigned successfully. Notification sent."
          : "Editor assigned successfully. Notification could not be delivered.";
        setSuccessMessage(success);
        // Preferred UX: return to Editors list so the new grant is visible immediately.
        router.push(
          `/admin/editors?assigned=1&notify=${created.notificationDelivered ? "1" : "0"}`,
        );
        return;
      }

      if (mode === "edit" && initial) {
        const updated = await updateAdminEditor(initial.editorGrantId, {
          capabilities: selectedCapabilityList,
          geographicScope,
          status,
        });
        setSubmitPhase("success");
        const success = updated.notificationDelivered
          ? "Editor updated successfully. Notification sent."
          : "Editor updated successfully. Notification could not be delivered.";
        setSuccessMessage(success);
        router.push(
          `/admin/editors?updated=1&notify=${updated.notificationDelivered ? "1" : "0"}`,
        );
        return;
      }

      setSubmitPhase("idle");
    } catch (err: unknown) {
      setSubmitPhase("idle");
      setError(formatAuthFormError(err));
    }
  }

  const submitBusy = submitPhase === "submitting" || submitPhase === "success";
  const submitLabel =
    mode === "create"
      ? submitPhase === "submitting"
        ? "Assigning…"
        : submitPhase === "success"
          ? "Assigned"
          : "Assign Editor"
      : submitPhase === "submitting"
        ? "Saving…"
        : submitPhase === "success"
          ? "Saved"
          : "Save changes";

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title={mode === "create" ? "Add Editor" : "Edit Editor"}>
        <p className="hu-caption">
          Editor access is delegated authority on an existing Participant account. Passwords and
          Admin Panel access are never assigned here.
        </p>

        {error ? (
          <StatusBanner title="Could not save Editor" message={error} />
        ) : null}
        {successMessage ? (
          <StatusBanner title="Action completed" message={successMessage} />
        ) : null}

        <form className="admin-editor-form" onSubmit={(event) => void handleSubmit(event)}>
          {mode === "create" ? (
            <fieldset className="admin-editor-form__fieldset">
              <legend>Participant</legend>
              {selectedParticipant ? (
                <div className="admin-editor-form__selected">
                  <strong>{participantLabel(selectedParticipant)}</strong>
                  <Button
                    type="button"
                    variant="tertiary"
                    onClick={() => {
                      setSelectedParticipant(null);
                      setSearch("");
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <label className="admin-editor-form__label" htmlFor="editor-participant-search">
                    Find by email, display name, or username
                  </label>
                  <input
                    id="editor-participant-search"
                    className="admin-editor-form__input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search registered Participants…"
                    autoComplete="off"
                  />
                  {searching ? <p className="hu-caption">Searching…</p> : null}
                  {searchResults.length > 0 ? (
                    <ul className="admin-editor-form__results" role="listbox">
                      {searchResults.map((row) => (
                        <li key={row.memberId}>
                          <button
                            type="button"
                            className="admin-editor-form__result"
                            onClick={() => {
                              setSelectedParticipant(row);
                              setSearchResults([]);
                              setSearch("");
                            }}
                          >
                            {participantLabel(row)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </fieldset>
          ) : (
            <fieldset className="admin-editor-form__fieldset">
              <legend>Participant</legend>
              <p>
                <strong>{initial?.displayName}</strong>
                {initial?.uniqueName ? (
                  <span className="hu-caption"> @{initial.uniqueName}</span>
                ) : null}
              </p>
              <p className="hu-caption">{initial?.email}</p>
            </fieldset>
          )}

          <fieldset className="admin-editor-form__fieldset">
            <legend>Editing permissions</legend>
            <ul className="admin-editor-form__capabilities">
              {EDITOR_ASSIGNABLE_CAPABILITY_IDS.map((id) => (
                <li key={id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={capabilities.has(id)}
                      onChange={() => toggleCapability(id)}
                    />{" "}
                    {EDITOR_CAPABILITY_LABELS[id]}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="admin-editor-form__fieldset">
            <legend>Editing area</legend>
            <label className="admin-editor-form__label" htmlFor="editor-scope-level">
              Geographic scope
            </label>
            <select
              id="editor-scope-level"
              className="admin-editor-form__input"
              value={level}
              onChange={(event) => {
                const next = event.target.value as EditorGeographicScopeLevel;
                setLevel(next);
                if (next === "WORLD") {
                  setCountryCode("");
                  setRegionCode("");
                  setCommunityCode("");
                }
              }}
            >
              <option value="WORLD">World</option>
              <option value="COUNTRY">Country</option>
              <option value="REGION">Region</option>
              <option value="CITY">City</option>
            </select>

            {level !== "WORLD" ? (
              <div className="admin-editor-form__geo">
                <CountrySelect
                  id="editor-scope-country"
                  value={countryCode}
                  onChange={(next) => {
                    setCountryCode(next);
                    setRegionCode("");
                    setCommunityCode("");
                  }}
                  required
                />
                {level === "REGION" || level === "CITY" ? (
                  <RegionSelect
                    id="editor-scope-region"
                    countryCode={countryCode}
                    value={regionCode}
                    onChange={(next) => {
                      setRegionCode(next);
                      setCommunityCode("");
                    }}
                    required
                  />
                ) : null}
                {level === "CITY" ? (
                  <CitySelect
                    id="editor-scope-city"
                    countryCode={countryCode}
                    regionCode={regionCode}
                    value={communityCode}
                    onChange={setCommunityCode}
                    required
                  />
                ) : null}
              </div>
            ) : (
              <p className="hu-caption">All countries, regions and cities</p>
            )}
          </fieldset>

          <fieldset className="admin-editor-form__fieldset">
            <legend>Activation status</legend>
            <label>
              <input
                type="radio"
                name="editor-status"
                checked={status === "ACTIVE"}
                onChange={() => setStatus("ACTIVE")}
              />{" "}
              Active
            </label>{" "}
            <label>
              <input
                type="radio"
                name="editor-status"
                checked={status === "INACTIVE"}
                onChange={() => setStatus("INACTIVE")}
              />{" "}
              Inactive
            </label>
          </fieldset>

          <div className="admin-editor-form__actions">
            <Button
              type="submit"
              variant="primary"
              disabled={submitBusy}
              aria-busy={submitBusy}
              ariaLive="polite"
            >
              {submitLabel}
            </Button>
            <Button href="/admin/editors" variant="tertiary">
              Cancel
            </Button>
          </div>
        </form>
      </ProfileSection>
    </div>
  );
}

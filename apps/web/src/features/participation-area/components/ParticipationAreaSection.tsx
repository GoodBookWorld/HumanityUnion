"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { fetchCommunitiesByRegion, toGeographyCommunityOptions } from "../../../data/geography";
import { Button } from "../../../design-system/components/Button";
import {
  GeographySearchSelect,
  OTHER_REGION_SLUG,
} from "../../../design-system/components/GeographySearchSelect";
import {
  cancelMyParticipationAreaTransition,
  createMyParticipationArea,
  getMyParticipationAreaWorkspace,
  requestMyParticipationAreaTransition,
  type ParticipationAreaWorkspaceResponse,
} from "../participation-area-api";

import "./participation-area-section.css";

function formatArea(labels: { country?: string; region?: string; community?: string }): string {
  const parts = [labels.community, labels.region, labels.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Not declared";
}

export function ParticipationAreaSection() {
  const [state, setState] = useState<ParticipationAreaWorkspaceResponse | null>(null);
  const [countrySlug, setCountrySlug] = useState("");
  const [regionSlug, setRegionSlug] = useState("");
  const [regionLabel, setRegionLabel] = useState("");
  const [communitySlug, setCommunitySlug] = useState("");
  const [communityOptions, setCommunityOptions] = useState<
    ReturnType<typeof toGeographyCommunityOptions>
  >([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hydratedFormRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void getMyParticipationAreaWorkspace()
      .then((loaded) => {
        if (!cancelled) {
          setState(loaded);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load Participation Area workspace.",
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
  }, []);

  useEffect(() => {
    if (hydratedFormRef.current || !state?.activeArea) {
      return;
    }

    hydratedFormRef.current = true;
    setCountrySlug(state.activeArea.countrySlug);
    setRegionSlug(state.activeArea.regionSlug ?? "");
    setCommunitySlug(state.activeArea.communitySlug ?? "");
    setRegionLabel(state.labels.region ?? "");
  }, [state]);

  useEffect(() => {
    if (!regionSlug || !countrySlug || regionSlug === OTHER_REGION_SLUG) {
      setCommunityOptions([]);
      return;
    }

    let cancelled = false;
    setCommunitiesLoading(true);

    void fetchCommunitiesByRegion(countrySlug, regionSlug)
      .then((communities) => {
        if (!cancelled) {
          setCommunityOptions(toGeographyCommunityOptions(countrySlug, regionSlug, communities));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommunityOptions(toGeographyCommunityOptions(countrySlug, regionSlug, []));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommunitiesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [countrySlug, regionSlug]);

  const regions = useMemo(
    () =>
      state?.geographyOptions.regions.filter((region) => region.countrySlug === countrySlug) ?? [],
    [countrySlug, state],
  );

  async function refreshState(nextState: ParticipationAreaWorkspaceResponse) {
    setState(nextState);
    setError(null);
  }

  async function submitAreaInput() {
    return {
      countrySlug,
      regionSlug: regionSlug || undefined,
      communitySlug: communitySlug || undefined,
      regionLabel: regionSlug === OTHER_REGION_SLUG ? regionLabel : undefined,
    };
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const nextState = await createMyParticipationArea(await submitAreaInput());
      await refreshState(nextState);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create area.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const nextState = await requestMyParticipationAreaTransition(await submitAreaInput());
      await refreshState(nextState);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to request change.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelTransition() {
    setSaving(true);
    setError(null);

    try {
      const nextState = await cancelMyParticipationAreaTransition();
      await refreshState(nextState);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to cancel change.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading Participation Area...</p>;
  }

  if (error && !state) {
    return <p>{error}</p>;
  }

  if (!state) {
    return null;
  }

  const hasActiveArea = Boolean(state.activeArea);

  return (
    <div className="participation-area-section">
      <ProfileSection title="Participation Area" id="participation-area">
        {hasActiveArea ? (
          <div className="participation-area-section__card">
            <h3 className="participation-area-section__card-title">Current Participation Area</h3>
            <ProfileField label="Area" value={formatArea(state.labels)} />
            <ProfileField
              label="Verification status"
              value={state.activeArea?.verificationStatus ?? "unverified"}
            />
            <ProfileField label="Status" value={state.activeArea?.status ?? "active"} />
          </div>
        ) : (
          <p>You have not declared a Participation Area yet.</p>
        )}

        {state.pendingTransition ? (
          <div className="participation-area-section__card participation-area-section__card--pending">
            <h3 className="participation-area-section__card-title">Pending Change</h3>
            <ProfileField label="Requested area" value={formatArea(state.pendingLabels ?? {})} />
            <ProfileField
              label="Effective at"
              value={new Date(state.pendingTransition.effectiveAt).toLocaleString()}
            />
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => void handleCancelTransition()}
            >
              Cancel pending change
            </Button>
          </div>
        ) : null}

        <form
          className="participation-area-section__form"
          onSubmit={(event) => void (hasActiveArea ? handleTransition(event) : handleCreate(event))}
        >
          <h3 className="participation-area-section__card-title">
            {hasActiveArea ? "Change Participation Area" : "Declare Participation Area"}
          </h3>
          <GeographySearchSelect
            id="participation-country"
            label="Participation country (not nationality)"
            helperText="Choose the country where you participate in civic activity."
            value={countrySlug}
            options={state.geographyOptions.countries}
            onChange={(nextCountry) => {
              setCountrySlug(nextCountry);
              setRegionSlug("");
              setRegionLabel("");
              setCommunitySlug("");
            }}
            required
          />
          <GeographySearchSelect
            id="participation-region"
            label="Participation region (optional)"
            value={regionSlug}
            options={regions}
            onChange={(nextRegion) => {
              setRegionSlug(nextRegion);
              setCommunitySlug("");
              if (nextRegion !== OTHER_REGION_SLUG) {
                setRegionLabel("");
              }
            }}
            disabled={!countrySlug}
          />
          {regionSlug === OTHER_REGION_SLUG ? (
            <label className="participation-area-section__field">
              <span>Region name</span>
              <input
                value={regionLabel}
                onChange={(event) => setRegionLabel(event.target.value)}
                required
              />
            </label>
          ) : null}
          <GeographySearchSelect
            id="participation-community"
            label="City / Community"
            value={communitySlug}
            options={communityOptions}
            onChange={setCommunitySlug}
            disabled={!regionSlug || regionSlug === OTHER_REGION_SLUG || communitiesLoading}
            helperText={
              !regionSlug
                ? "Select a region first."
                : communitiesLoading
                  ? "Loading cities for the selected region…"
                  : undefined
            }
          />
          {error ? <p className="participation-area-section__error">{error}</p> : null}
          <Button type="submit" variant="primary" disabled={saving}>
            {saving
              ? "Saving..."
              : hasActiveArea
                ? "Request area change"
                : "Create Participation Area"}
          </Button>
          {hasActiveArea ? (
            <p className="participation-area-section__note">{state.transitionPolicy.explanation}</p>
          ) : null}
        </form>

        <div className="participation-area-section__card participation-area-section__card--info">
          <h3 className="participation-area-section__card-title">How this affects voting</h3>
          <p>
            Participation Area is declared by you. Eligibility uses your declared civic geography,
            not IP address, VPN signals, or automatic geolocation.
          </p>
          <p>Verification status is shown for transparency only. It does not change vote weight.</p>
          <p>World-scope initiatives remain open to all registered participants.</p>
          <ul className="participation-area-section__eligibility">
            <li>World decisions</li>
            {state.eligibilityPreview.country ? (
              <li>Country decisions: {state.eligibilityPreview.country}</li>
            ) : null}
            {state.eligibilityPreview.region ? (
              <li>Region decisions: {state.eligibilityPreview.region}</li>
            ) : null}
            {state.eligibilityPreview.community ? (
              <li>Community decisions: {state.eligibilityPreview.community}</li>
            ) : null}
          </ul>
        </div>
      </ProfileSection>
    </div>
  );
}

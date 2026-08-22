"use client";

import { useEffect, useRef, useState } from "react";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import {
  CitySelect,
  CountrySelect,
  isCanonicalOtherRegion,
  RegionSelect,
} from "../../geography-integrity";
import {
  cancelMyParticipationAreaTransition,
  createMyParticipationArea,
  getMyParticipationAreaWorkspace,
  requestMyParticipationAreaTransition,
  type ParticipationAreaWorkspaceResponse,
} from "../participation-area-api";
import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const savePhase = useSaveButtonPhase();
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

  async function refreshState(nextState: ParticipationAreaWorkspaceResponse) {
    setState(nextState);
    setError(null);
  }

  async function submitAreaInput() {
    return {
      countrySlug,
      regionSlug: regionSlug || undefined,
      communitySlug: communitySlug || undefined,
      regionLabel: isCanonicalOtherRegion(regionSlug) ? regionLabel : undefined,
    };
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await savePhase.runSave(async () => {
        const nextState = await createMyParticipationArea(await submitAreaInput());
        await refreshState(nextState);
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create area.");
    }
  }

  async function handleTransition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await savePhase.runSave(async () => {
        const nextState = await requestMyParticipationAreaTransition(await submitAreaInput());
        await refreshState(nextState);
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to request change.");
    }
  }

  async function handleCancelTransition() {
    setCancelling(true);
    setError(null);

    try {
      const nextState = await cancelMyParticipationAreaTransition();
      await refreshState(nextState);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to cancel change.");
    } finally {
      setCancelling(false);
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
              disabled={cancelling}
              onClick={() => void handleCancelTransition()}
            >
              {cancelling ? "Cancelling..." : "Cancel pending change"}
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
          <CountrySelect
            id="participation-country"
            label="Participation country (not nationality)"
            helperText="Choose the country where you participate in civic activity."
            value={countrySlug}
            onChange={(nextCountry) => {
              setCountrySlug(nextCountry);
              setRegionSlug("");
              setRegionLabel("");
              setCommunitySlug("");
            }}
            required
          />
          <RegionSelect
            id="participation-region"
            label="Participation region (optional)"
            countryCode={countrySlug}
            value={regionSlug}
            includeOther
            onChange={(nextRegion) => {
              setRegionSlug(nextRegion);
              setCommunitySlug("");
              if (!isCanonicalOtherRegion(nextRegion)) {
                setRegionLabel("");
              }
            }}
          />
          {isCanonicalOtherRegion(regionSlug) ? (
            <label className="participation-area-section__field">
              <span>Region name</span>
              <input
                value={regionLabel}
                onChange={(event) => setRegionLabel(event.target.value)}
                required
              />
              <span className="participation-area-section__note">
                Free-text fallback — not a canonical region identifier.
              </span>
            </label>
          ) : null}
          <CitySelect
            id="participation-community"
            countryCode={countrySlug}
            regionCode={regionSlug}
            value={communitySlug}
            includeOther
            onChange={setCommunitySlug}
          />
          {error ? <p className="participation-area-section__error">{error}</p> : null}
          <Button type="submit" variant="primary" disabled={savePhase.isBusy} ariaLive="polite">
            {resolveSaveButtonLabel(
              savePhase.phase,
              hasActiveArea ? "Request area change" : "Create Participation Area",
            )}
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

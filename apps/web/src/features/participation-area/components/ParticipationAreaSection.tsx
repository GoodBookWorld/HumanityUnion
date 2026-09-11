"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

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

const KNOWN_TRANSITION_POLICY =
  "Your current area remains active until the change becomes effective.";

const STATUS_KEYS = ["unverified", "verified", "pending", "active"] as const;
type StatusKey = (typeof STATUS_KEYS)[number];

function isStatusKey(value: string): value is StatusKey {
  return (STATUS_KEYS as readonly string[]).includes(value);
}

function formatArea(
  labels: { country?: string; region?: string; community?: string },
  notDeclared: string,
): string {
  const parts = [labels.community, labels.region, labels.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : notDeclared;
}

export function ParticipationAreaSection() {
  const t = useTranslations("memberProfile.participationArea");
  const tProfile = useTranslations("memberProfile");
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

  function resolveStatusLabel(code: string | undefined, fallback: StatusKey): string {
    const value = code ?? fallback;
    return isStatusKey(value) ? t(`status.${value}`) : value;
  }

  function resolveTransitionPolicy(explanation: string): string {
    if (explanation.trim() === KNOWN_TRANSITION_POLICY) {
      return t("transitionPolicyNote");
    }
    return t("transitionPolicyGeneric");
  }

  useEffect(() => {
    let cancelled = false;

    void getMyParticipationAreaWorkspace()
      .then((loaded) => {
        if (!cancelled) {
          setState(loaded);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("loadError"));
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
  }, [t]);

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
    } catch {
      setError(t("createError"));
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
    } catch {
      setError(t("requestError"));
    }
  }

  async function handleCancelTransition() {
    setCancelling(true);
    setError(null);

    try {
      const nextState = await cancelMyParticipationAreaTransition();
      await refreshState(nextState);
    } catch {
      setError(t("cancelError"));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <p>{t("loading")}</p>;
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
      <ProfileSection title={tProfile("sections.participation-area")} id="participation-area">
        {hasActiveArea ? (
          <div className="participation-area-section__card">
            <h3 className="participation-area-section__card-title">{t("currentTitle")}</h3>
            <ProfileField
              label={t("areaLabel")}
              value={formatArea(state.labels, t("notDeclared"))}
            />
            <ProfileField
              label={t("verificationStatus")}
              value={resolveStatusLabel(state.activeArea?.verificationStatus, "unverified")}
            />
            <ProfileField
              label={t("statusLabel")}
              value={resolveStatusLabel(state.activeArea?.status, "active")}
            />
          </div>
        ) : (
          <p>{t("empty")}</p>
        )}

        {state.pendingTransition ? (
          <div className="participation-area-section__card participation-area-section__card--pending">
            <h3 className="participation-area-section__card-title">{t("pendingTitle")}</h3>
            <ProfileField
              label={t("requestedArea")}
              value={formatArea(state.pendingLabels ?? {}, t("notDeclared"))}
            />
            <ProfileField
              label={t("effectiveAt")}
              value={new Date(state.pendingTransition.effectiveAt).toLocaleString()}
            />
            <Button
              variant="secondary"
              disabled={cancelling}
              onClick={() => void handleCancelTransition()}
            >
              {cancelling ? t("cancelling") : t("cancelPending")}
            </Button>
          </div>
        ) : null}

        <form
          className="participation-area-section__form"
          onSubmit={(event) => void (hasActiveArea ? handleTransition(event) : handleCreate(event))}
        >
          <h3 className="participation-area-section__card-title">
            {hasActiveArea ? t("changeTitle") : t("declareTitle")}
          </h3>
          <CountrySelect
            id="participation-country"
            label={t("countryLabel")}
            helperText={t("countryHelper")}
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
            label={t("regionLabel")}
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
              <span>{t("regionName")}</span>
              <input
                value={regionLabel}
                onChange={(event) => setRegionLabel(event.target.value)}
                required
              />
              <span className="participation-area-section__note">{t("regionNameNote")}</span>
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
              hasActiveArea ? t("requestChange") : t("createArea"),
            )}
          </Button>
          {hasActiveArea ? (
            <p className="participation-area-section__note">
              {resolveTransitionPolicy(state.transitionPolicy.explanation)}
            </p>
          ) : null}
        </form>

        <div className="participation-area-section__card participation-area-section__card--info">
          <h3 className="participation-area-section__card-title">{t("votingTitle")}</h3>
          <p>{t("votingBody1")}</p>
          <p>{t("votingBody2")}</p>
          <p>{t("votingBody3")}</p>
          <ul className="participation-area-section__eligibility">
            <li>{t("worldDecisions")}</li>
            {state.eligibilityPreview.country ? (
              <li>{t("countryDecisions", { name: state.eligibilityPreview.country })}</li>
            ) : null}
            {state.eligibilityPreview.region ? (
              <li>{t("regionDecisions", { name: state.eligibilityPreview.region })}</li>
            ) : null}
            {state.eligibilityPreview.community ? (
              <li>{t("communityDecisions", { name: state.eligibilityPreview.community })}</li>
            ) : null}
          </ul>
        </div>
      </ProfileSection>
    </div>
  );
}

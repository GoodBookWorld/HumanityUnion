"use client";

import type {
  InitiativeCoverMedia,
  InitiativeLifecycleProfile,
  InitiativeMetadata,
  ParticipationScope,
  PublicChoiceBallotMode,
  PublicNewsArticleItem,
} from "@hu/types";
import {
  DEFAULT_PUBLIC_CHOICE_BALLOT_MODE,
  getInitiativeLifecycleProfilePresentation,
  resolveInitiativeCoverMedia,
  resolvePublicChoiceBallotMode,
} from "@hu/types";

import {
  getCountryLabel,
  getRegionLabel,
  OTHER_COMMUNITY_SLUG,
  OTHER_REGION_SLUG,
} from "@hu/geography";
import {
  INITIATIVE_ACTIVITY_AREA_OPTIONS,
  INITIATIVE_ACTIVITY_AREA_OTHER,
} from "../initiative-activity-areas";
import { useTranslations } from "next-intl";

import {
  CitySelect,
  CountrySelect,
  isCanonicalOtherRegion,
  patchAfterCountryChange,
  patchAfterRegionChange,
  RegionSelect,
} from "../../geography-integrity";
import { resolveActivityAreaDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { InitiativeCoverMediaField } from "../../media-upload/components/InitiativeCoverMediaField";
import { InitiativeNewsSourcePanel } from "./InitiativeNewsSourcePanel";

import "./initiative-form-fields.css";

export interface InitiativeFormValues {
  communityAssociation: string;
  activityArea: string;
  activityAreaOther: string;
  participationScope: ParticipationScope;
  countryCode: string;
  countryLabel: string;
  regionCode: string;
  regionLabel: string;
  communityCode: string;
  communityLabel: string;
  /** UX Evolution Pack 03 — the single source of truth for cover media; legacy `imageUrl` is derived server-side, see `resolveInitiativeCoverMedia`. */
  coverMedia?: InitiativeCoverMedia;
  imageAltText?: string;
  startDate?: string;
  completionDate?: string;
  /** Pack 02A — PUBLIC_CHOICE only; ignored for STANDARD. */
  ballotMode?: PublicChoiceBallotMode;
}

interface InitiativeFormFieldsProps {
  values: InitiativeFormValues;
  onChange: (patch: Partial<InitiativeFormValues>) => void;
  /** Public Choice Experience Pack 01 — profile-aware labels/validation presentation. */
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  initiativeId?: string;
  onImageUpload: (file: File) => Promise<string>;
  onVideoLinkSubmit: (url: string) => Promise<InitiativeCoverMedia>;
  onImageRemove?: () => Promise<void> | void;
  sourceArticle?: PublicNewsArticleItem | null;
  onSourceRemove?: () => void;
}

export function InitiativeFormFields({
  values,
  onChange,
  lifecycleProfile,
  initiativeId: _initiativeId,
  onImageUpload,
  onVideoLinkSubmit,
  onImageRemove,
  sourceArticle,
  onSourceRemove,
}: InitiativeFormFieldsProps) {
  const t = useTranslations("initiativeExperience");
  const presentation = getInitiativeLifecycleProfilePresentation(lifecycleProfile);

  const showGeography =
    presentation.requireCountry ||
    values.participationScope === "community" ||
    values.participationScope === "region" ||
    values.participationScope === "country";

  const associationLabel = presentation.isPublicChoice
    ? t("manage.fields.electionName")
    : t("manage.fields.communityAssociation");
  const associationHelper = presentation.isPublicChoice
    ? t("manage.fields.electionNameHelper")
    : t("manage.fields.communityAssociationHelper");

  return (
    <div className="initiative-form-fields">
      <label className="initiative-form-fields__field">
        <span>{associationLabel}</span>
        <input
          type="text"
          className="hu-form-control"
          value={values.communityAssociation}
          onChange={(event) => onChange({ communityAssociation: event.target.value })}
        />
        <span className="initiative-form-fields__helper">{associationHelper}</span>
      </label>

      {presentation.isPublicChoice ? (
        <p className="initiative-form-fields__helper" role="status">
          {t("manage.fields.electionCreateHelper")}
        </p>
      ) : null}

      <label className="initiative-form-fields__field">
        <span>{t("manage.fields.participationScope")}</span>
        <select
          className="hu-form-control"
          value={values.participationScope}
          onChange={(event) =>
            onChange({ participationScope: event.target.value as ParticipationScope })
          }
        >
          <option value="community">{t("manage.scopes.community")}</option>
          <option value="region">{t("manage.scopes.region")}</option>
          <option value="country">{t("manage.scopes.country")}</option>
          {presentation.requireCountry ? null : (
            <option value="world">{t("manage.scopes.world")}</option>
          )}
        </select>
      </label>

      {showGeography ? (
        <>
          <CountrySelect
            id="initiative-country"
            label={t("manage.fields.country")}
            placeholder={t("manage.fields.searchCountries")}
            value={values.countryCode}
            onChange={(nextCountry) => {
              onChange(
                patchAfterCountryChange(nextCountry, getCountryLabel(nextCountry) ?? ""),
              );
            }}
            required={presentation.requireCountry || values.participationScope !== "world"}
          />
          {(values.participationScope === "region" ||
            values.participationScope === "community") && (
            <>
              <RegionSelect
                id="initiative-region"
                label={t("manage.fields.region")}
                placeholder={t("manage.fields.searchRegions")}
                countryCode={values.countryCode}
                value={values.regionCode}
                includeOther
                onChange={(nextRegion) => {
                  onChange(
                    patchAfterRegionChange(
                      nextRegion,
                      isCanonicalOtherRegion(nextRegion)
                        ? values.regionLabel
                        : (getRegionLabel(values.countryCode, nextRegion) ?? ""),
                    ),
                  );
                }}
                required
              />
              {isCanonicalOtherRegion(values.regionCode) ? (
                <label className="initiative-form-fields__field">
                  <span>{t("manage.fields.regionName")}</span>
                  <input
                    type="text"
                    className="hu-form-control"
                    value={values.regionLabel}
                    onChange={(event) => onChange({ regionLabel: event.target.value })}
                    required
                  />
                  <span className="initiative-form-fields__helper">
                    {t("manage.fields.regionNameHelper")}
                  </span>
                </label>
              ) : null}
            </>
          )}
          {values.participationScope === "community" ? (
            <CitySelect
              id="initiative-community"
              label={t("manage.fields.cityCommunity")}
              placeholder={t("manage.fields.searchCities")}
              countryCode={values.countryCode}
              regionCode={values.regionCode}
              value={values.communityCode}
              includeOther
              onChange={(nextCommunity) => {
                onChange({
                  communityCode: nextCommunity,
                  communityLabel:
                    nextCommunity === OTHER_COMMUNITY_SLUG
                      ? t("manage.geography.otherNotListed")
                      : nextCommunity,
                });
              }}
              required
            />
          ) : null}
        </>
      ) : null}

      {presentation.showActivityArea ? (
        <>
          <label className="initiative-form-fields__field">
            <span>{t("manage.fields.activityArea")}</span>
            <select
              className="hu-form-control"
              value={values.activityArea}
              onChange={(event) => onChange({ activityArea: event.target.value })}
            >
              {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {resolveActivityAreaDisplayLabel(option, t)}
                </option>
              ))}
            </select>
          </label>

          {values.activityArea === INITIATIVE_ACTIVITY_AREA_OTHER ? (
            <label className="initiative-form-fields__field">
              <span>{t("manage.fields.activityAreaOther")}</span>
              <input
                type="text"
                className="hu-form-control"
                value={values.activityAreaOther}
                onChange={(event) => onChange({ activityAreaOther: event.target.value })}
              />
            </label>
          ) : null}
        </>
      ) : null}

      <label className="initiative-form-fields__field">
        <span>
          {presentation.isPublicChoice
            ? t("manage.fields.startOfVoting")
            : t("manage.fields.startDate")}
        </span>
        <input
          type="date"
          className="hu-form-control"
          value={values.startDate?.slice(0, 10) ?? ""}
          onChange={(event) =>
            onChange({ startDate: event.target.value ? `${event.target.value}T00:00:00.000Z` : "" })
          }
        />
      </label>

      <label className="initiative-form-fields__field">
        <span>
          {presentation.isPublicChoice
            ? t("manage.fields.endOfVoting")
            : t("manage.fields.completionDate")}
        </span>
        <input
          type="date"
          className="hu-form-control"
          value={values.completionDate?.slice(0, 10) ?? ""}
          onChange={(event) =>
            onChange({
              completionDate: event.target.value ? `${event.target.value}T00:00:00.000Z` : "",
            })
          }
        />
      </label>

      <div className="initiative-form-fields__media">
        {sourceArticle && onSourceRemove ? (
          <InitiativeNewsSourcePanel article={sourceArticle} onRemove={onSourceRemove} />
        ) : null}

        <InitiativeCoverMediaField
          coverMedia={values.coverMedia}
          altText={values.imageAltText}
          onAltTextChange={(imageAltText) => onChange({ imageAltText })}
          onImageUpload={async (file) => {
            const mediaUrl = await onImageUpload(file);
            const coverMedia: InitiativeCoverMedia = {
              type: "image",
              url: mediaUrl,
              verificationStatus: "approved",
            };
            onChange({ coverMedia });
            return coverMedia;
          }}
          onVideoLinkSubmit={async (url) => {
            const coverMedia = await onVideoLinkSubmit(url);
            onChange({ coverMedia });
            return coverMedia;
          }}
          onRemove={async () => {
            await onImageRemove?.();
            onChange({ coverMedia: undefined, imageAltText: "" });
          }}
        />
      </div>
    </div>
  );
}

export function buildInitiativeFormValuesFromMetadata(
  metadata: InitiativeMetadata,
): InitiativeFormValues {
  const countryCode = metadata.countrySlug ?? "";
  const regionCode = metadata.regionSlug ?? "";

  return {
    communityAssociation: metadata.communityAssociation ?? "",
    activityArea: metadata.activityArea || INITIATIVE_ACTIVITY_AREA_OPTIONS[0],
    activityAreaOther: metadata.activityAreaOther ?? "",
    participationScope: metadata.participationScope ?? "community",
    countryCode,
    countryLabel: countryCode ? (getCountryLabel(countryCode) ?? "") : "",
    regionCode,
    regionLabel: regionCode
      ? (getRegionLabel(countryCode, regionCode) ?? metadata.region ?? "")
      : (metadata.region ?? ""),
    communityCode: metadata.communitySlug ?? "",
    communityLabel: "",
    coverMedia: resolveInitiativeCoverMedia(metadata),
    imageAltText: metadata.imageAltText,
    startDate: metadata.startDate,
    completionDate: metadata.completionDate,
    ballotMode: metadata.ballotMode
      ? resolvePublicChoiceBallotMode(metadata.ballotMode)
      : DEFAULT_PUBLIC_CHOICE_BALLOT_MODE,
  };
}

export function initiativeFormValuesToSaveInput(
  values: InitiativeFormValues,
  options?: { isPublicChoice?: boolean },
): {
  communityAssociation: string | undefined;
  activityArea: string;
  activityAreaOther: string | undefined;
  participationScope: ParticipationScope;
  countrySlug: string | undefined;
  regionSlug: string | undefined;
  region: string | undefined;
  communitySlug: string | undefined;
  coverMedia: InitiativeFormValues["coverMedia"];
  clearCoverMedia: boolean;
  imageAltText: string | undefined;
  startDate: string | undefined;
  completionDate: string | undefined;
  ballotMode: PublicChoiceBallotMode | undefined;
} {
  return {
    communityAssociation: values.communityAssociation || undefined,
    activityArea: values.activityArea,
    activityAreaOther:
      values.activityArea === INITIATIVE_ACTIVITY_AREA_OTHER ? values.activityAreaOther : undefined,
    participationScope: values.participationScope,
    countrySlug: values.countryCode || undefined,
    regionSlug: values.regionCode || undefined,
    region: values.regionCode === OTHER_REGION_SLUG ? values.regionLabel || undefined : undefined,
    communitySlug: values.communityCode || undefined,
    coverMedia: values.coverMedia,
    clearCoverMedia: !values.coverMedia,
    imageAltText: values.imageAltText || undefined,
    startDate: values.startDate || undefined,
    completionDate: values.completionDate || undefined,
    ballotMode: options?.isPublicChoice ? ("SELECT_ONE_CANDIDATE" as const) : undefined,
  };
}

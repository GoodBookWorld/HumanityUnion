"use client";

import type {
  InitiativeCoverMedia,
  InitiativeMetadata,
  ParticipationScope,
  PublicNewsArticleItem,
} from "@hu/types";
import { resolveInitiativeCoverMedia } from "@hu/types";
import { useEffect, useMemo, useState } from "react";

import {
  fetchCommunitiesByRegion,
  getCountryLabel,
  getRegionLabel,
  OTHER_COMMUNITY_SLUG,
  OTHER_REGION_SLUG,
  toGeographyCommunityOptions,
  toGeographyCountryOptions,
  toGeographyRegionOptions,
} from "../../../data/geography";
import { GeographySearchSelect } from "../../../design-system/components/GeographySearchSelect";
import {
  INITIATIVE_ACTIVITY_AREA_OPTIONS,
  INITIATIVE_ACTIVITY_AREA_OTHER,
} from "../initiative-activity-areas";

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
}

interface InitiativeFormFieldsProps {
  values: InitiativeFormValues;
  onChange: (patch: Partial<InitiativeFormValues>) => void;
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
  onImageUpload,
  onVideoLinkSubmit,
  onImageRemove,
  sourceArticle,
  onSourceRemove,
}: InitiativeFormFieldsProps) {
  const countryOptions = useMemo(() => toGeographyCountryOptions(), []);
  const [communityOptions, setCommunityOptions] = useState<
    ReturnType<typeof toGeographyCommunityOptions>
  >([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);

  const showGeography =
    values.participationScope === "community" ||
    values.participationScope === "region" ||
    values.participationScope === "country";

  useEffect(() => {
    if (!showGeography || !values.regionCode || !values.countryCode) {
      setCommunityOptions([]);
      return;
    }

    let cancelled = false;
    setCommunitiesLoading(true);

    void fetchCommunitiesByRegion(values.countryCode, values.regionCode)
      .then((communities) => {
        if (cancelled) {
          return;
        }

        setCommunityOptions(
          toGeographyCommunityOptions(values.countryCode, values.regionCode, communities),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setCommunityOptions(
            toGeographyCommunityOptions(values.countryCode, values.regionCode, []),
          );
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
  }, [showGeography, values.countryCode, values.regionCode]);

  return (
    <div className="initiative-form-fields">
      <label className="initiative-form-fields__field">
        <span>Community association</span>
        <input
          type="text"
          className="hu-form-control"
          value={values.communityAssociation}
          onChange={(event) => onChange({ communityAssociation: event.target.value })}
        />
        <span className="initiative-form-fields__helper">
          Optional descriptive association with a community or organization. This does not replace
          your Participation Area eligibility scope.
        </span>
      </label>

      <label className="initiative-form-fields__field">
        <span>Participation scope</span>
        <select
          className="hu-form-control"
          value={values.participationScope}
          onChange={(event) =>
            onChange({ participationScope: event.target.value as ParticipationScope })
          }
        >
          <option value="community">Community</option>
          <option value="region">Region</option>
          <option value="country">Country</option>
          <option value="world">World</option>
        </select>
      </label>

      {showGeography ? (
        <>
          <GeographySearchSelect
            id="initiative-country"
            label="Country"
            value={values.countryCode}
            options={countryOptions}
            onChange={(nextCountry) => {
              onChange({
                countryCode: nextCountry,
                countryLabel: getCountryLabel(nextCountry) ?? "",
                regionCode: "",
                regionLabel: "",
                communityCode: "",
                communityLabel: "",
              });
            }}
            required
          />
          {(values.participationScope === "region" ||
            values.participationScope === "community") && (
            <>
              <GeographySearchSelect
                id="initiative-region"
                label="Region"
                value={values.regionCode}
                options={toGeographyRegionOptions(values.countryCode, true)}
                onChange={(nextRegion) => {
                  onChange({
                    regionCode: nextRegion,
                    regionLabel:
                      nextRegion === OTHER_REGION_SLUG
                        ? values.regionLabel
                        : (getRegionLabel(values.countryCode, nextRegion) ?? ""),
                    communityCode: "",
                    communityLabel: "",
                  });
                }}
                disabled={!values.countryCode}
                required
              />
              {values.regionCode === OTHER_REGION_SLUG ? (
                <label className="initiative-form-fields__field">
                  <span>Region name</span>
                  <input
                    type="text"
                    className="hu-form-control"
                    value={values.regionLabel}
                    onChange={(event) => onChange({ regionLabel: event.target.value })}
                    required
                  />
                </label>
              ) : null}
            </>
          )}
          {values.participationScope === "community" ? (
            <GeographySearchSelect
              id="initiative-community"
              label="City / Community"
              helperText={
                communitiesLoading
                  ? "Loading cities for the selected region…"
                  : "City, municipality, or district within the selected region."
              }
              value={values.communityCode}
              options={communityOptions}
              onChange={(nextCommunity) => {
                onChange({
                  communityCode: nextCommunity,
                  communityLabel:
                    communityOptions.find((option) => option.slug === nextCommunity)?.label ??
                    (nextCommunity === OTHER_COMMUNITY_SLUG ? "Other / Not listed" : ""),
                });
              }}
              disabled={!values.regionCode || communitiesLoading}
              required
            />
          ) : null}
        </>
      ) : null}

      <label className="initiative-form-fields__field">
        <span>Activity area</span>
        <select
          className="hu-form-control"
          value={values.activityArea}
          onChange={(event) => onChange({ activityArea: event.target.value })}
        >
          {INITIATIVE_ACTIVITY_AREA_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {values.activityArea === INITIATIVE_ACTIVITY_AREA_OTHER ? (
        <label className="initiative-form-fields__field">
          <span>Activity area (Other)</span>
          <input
            type="text"
            className="hu-form-control"
            value={values.activityAreaOther}
            onChange={(event) => onChange({ activityAreaOther: event.target.value })}
          />
        </label>
      ) : null}

      <label className="initiative-form-fields__field">
        <span>Start date</span>
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
        <span>Completion date</span>
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
  };
}

export function initiativeFormValuesToSaveInput(values: InitiativeFormValues) {
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
    // UX Evolution Pack 03 — coverMedia is now the single source of truth;
    // the legacy `imageUrl` field is derived server-side from it (see
    // `resolveCoverMediaUpdate` in `initiative.service.ts`) rather than sent
    // directly, so the two can never disagree.
    coverMedia: values.coverMedia,
    clearCoverMedia: !values.coverMedia,
    imageAltText: values.imageAltText || undefined,
    startDate: values.startDate || undefined,
    completionDate: values.completionDate || undefined,
  };
}

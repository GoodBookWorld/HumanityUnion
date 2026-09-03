"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { BC_MAP_COMMUNITIES, BC_MAP_SUBREGIONS } from "../content";

interface RegionalInteractiveMapEvidenceProps {
  regionName: string;
}

export function RegionalInteractiveMapEvidence({
  regionName,
}: RegionalInteractiveMapEvidenceProps) {
  const t = useTranslations("publicGeo.region.map");
  const tShared = useTranslations("publicGeo.shared");
  const [selectedSubRegionId, setSelectedSubRegionId] = useState<string | null>(null);
  const selectedSubRegion =
    BC_MAP_SUBREGIONS.find((subRegion) => subRegion.id === selectedSubRegionId) ?? null;
  const scopeStatusId = useId();
  const feedbackId = useId();

  return (
    <div className="regional-interactive-map">
      <p className="regional-interactive-map__scope" id={scopeStatusId} role="status">
        {selectedSubRegion
          ? t("selectedSubArea", { label: selectedSubRegion.label })
          : t("regionScopeLabel", { regionName })}
      </p>

      <div
        className="regional-interactive-map__canvas"
        role="group"
        aria-label={t("canvasAria", { regionName })}
        aria-describedby={`${scopeStatusId} ${feedbackId}`}
      >
        <svg
          className="regional-interactive-map__svg"
          viewBox="0 0 720 480"
          aria-hidden="true"
          focusable="false"
        >
          <rect className="regional-interactive-map__land" x="0" y="0" width="720" height="480" />
          <path
            className={`regional-interactive-map__subregion-shape${
              selectedSubRegionId === "central-kootenay"
                ? " regional-interactive-map__subregion-shape--selected"
                : ""
            }`}
            d="M180 160 L420 140 L460 360 L160 380 Z"
          />
          {BC_MAP_COMMUNITIES.map((community, index) => {
            const marker = COMMUNITY_MARKERS[community.id];

            return (
              <circle
                key={community.id}
                className="regional-interactive-map__community-marker"
                cx={marker.cx}
                cy={marker.cy}
                r="6"
                style={{ opacity: 0.35 + index * 0.15 }}
              />
            );
          })}
        </svg>

        <div className="regional-interactive-map__controls" role="group" aria-label={t("areasAria")}>
          {BC_MAP_SUBREGIONS.map((subRegion) => {
            const isSelected = selectedSubRegionId === subRegion.id;

            return (
              <button
                key={subRegion.id}
                type="button"
                className={`regional-interactive-map__subregion-button${
                  isSelected ? " regional-interactive-map__subregion-button--selected" : ""
                }`}
                aria-pressed={isSelected}
                aria-label={t("selectPreviewAria", { label: subRegion.label })}
                onClick={() =>
                  setSelectedSubRegionId((current) =>
                    current === subRegion.id ? null : subRegion.id,
                  )
                }
              >
                {subRegion.label} {t("previewSuffix")}
              </button>
            );
          })}
          {BC_MAP_COMMUNITIES.map((community) => (
            <Link
              key={community.id}
              className="regional-interactive-map__community-link"
              href={community.href}
            >
              {community.label}
            </Link>
          ))}
        </div>
      </div>

      <div
        id={feedbackId}
        className="regional-interactive-map__feedback"
        aria-live="polite"
        aria-atomic="true"
      >
        {selectedSubRegion ? (
          <>
            <p>
              {t("subUnavailableWithLabel", {
                message: t("subUnavailable"),
                label: selectedSubRegion.label,
              })}
            </p>
            <button
              type="button"
              className="regional-interactive-map__reset"
              onClick={() => setSelectedSubRegionId(null)}
            >
              {t("returnToRegion")}
            </button>
          </>
        ) : (
          <p>{tShared("mapDefaultFeedback")}</p>
        )}
      </div>
    </div>
  );
}

const COMMUNITY_MARKERS: Record<
  (typeof BC_MAP_COMMUNITIES)[number]["id"],
  { cx: number; cy: number }
> = {
  "nelson-community-garden": { cx: 280, cy: 260 },
  "kootenay-lake-protection-society": { cx: 340, cy: 300 },
};

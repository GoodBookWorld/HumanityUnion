"use client";

import { useId, useState } from "react";

import { CANADA_MAP_REGIONS, NATIONAL_INTERACTIVE_MAP_CONTENT } from "../content";

export function NationalInteractiveMapEvidence() {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const selectedRegion =
    CANADA_MAP_REGIONS.find((region) => region.id === selectedRegionId) ?? null;
  const scopeStatusId = useId();
  const feedbackId = useId();

  return (
    <div className="national-interactive-map">
      <p className="national-interactive-map__scope" id={scopeStatusId} role="status">
        {selectedRegion
          ? `Selected region: ${selectedRegion.label}`
          : NATIONAL_INTERACTIVE_MAP_CONTENT.countryScopeLabel}
      </p>

      <div
        className="national-interactive-map__canvas"
        role="group"
        aria-label="Canada civic activity map"
        aria-describedby={`${scopeStatusId} ${feedbackId}`}
      >
        <svg
          className="national-interactive-map__svg"
          viewBox="0 0 720 480"
          aria-hidden="true"
          focusable="false"
        >
          <rect className="national-interactive-map__land" x="0" y="0" width="720" height="480" />
          {CANADA_MAP_REGIONS.map((region) => {
            const geometry = REGION_GEOMETRY[region.id];
            const isSelected = selectedRegionId === region.id;

            return (
              <g key={region.id} aria-hidden="true">
                <path
                  className={`national-interactive-map__region-shape${
                    isSelected ? " national-interactive-map__region-shape--selected" : ""
                  }`}
                  d={geometry.path}
                />
                <circle
                  className="national-interactive-map__activity-marker"
                  cx={geometry.marker.cx}
                  cy={geometry.marker.cy}
                  r="5"
                />
              </g>
            );
          })}
        </svg>

        <div className="national-interactive-map__controls" role="group" aria-label="Map regions">
          {CANADA_MAP_REGIONS.map((region) => {
            const isSelected = selectedRegionId === region.id;

            return (
              <button
                key={region.id}
                type="button"
                className={`national-interactive-map__region-button${
                  isSelected ? " national-interactive-map__region-button--selected" : ""
                }`}
                aria-pressed={isSelected}
                aria-label={`Select ${region.label} to preview regional scope`}
                onClick={() =>
                  setSelectedRegionId((current) => (current === region.id ? null : region.id))
                }
              >
                {region.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={feedbackId}
        className="national-interactive-map__feedback"
        aria-live="polite"
        aria-atomic="true"
      >
        {selectedRegion ? (
          <>
            <p>
              {NATIONAL_INTERACTIVE_MAP_CONTENT.regionUnavailableMessage} Region:{" "}
              <strong>{selectedRegion.label}</strong>.
            </p>
            <button
              type="button"
              className="national-interactive-map__reset"
              onClick={() => setSelectedRegionId(null)}
            >
              {NATIONAL_INTERACTIVE_MAP_CONTENT.returnToCountryLabel}
            </button>
          </>
        ) : (
          <p>
            Select a region button to preview how regional scope exploration will work within
            Canada. Activity distribution will connect to public projections when Region Experience
            ships.
          </p>
        )}
      </div>
    </div>
  );
}

const REGION_GEOMETRY: Record<
  (typeof CANADA_MAP_REGIONS)[number]["id"],
  { path: string; marker: { cx: number; cy: number } }
> = {
  "central-kootenay": {
    path: "M120 260 L180 240 L210 300 L170 340 L110 320 Z",
    marker: { cx: 155, cy: 290 },
  },
  "british-columbia": {
    path: "M80 180 L220 160 L250 360 L90 380 Z",
    marker: { cx: 165, cy: 270 },
  },
  prairies: {
    path: "M260 220 L520 200 L540 360 L280 380 Z",
    marker: { cx: 400, cy: 290 },
  },
};

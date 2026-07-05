"use client";

import { useId, useState } from "react";

import { INTERACTIVE_WORLD_MAP_CONTENT, MAP_REGIONS } from "../content";

export function InteractiveWorldMapEvidence() {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const selectedRegion = MAP_REGIONS.find((region) => region.id === selectedRegionId) ?? null;
  const scopeStatusId = useId();
  const feedbackId = useId();

  return (
    <div className="interactive-world-map">
      <p className="interactive-world-map__scope" id={scopeStatusId} role="status">
        {selectedRegion
          ? `Selected place: ${selectedRegion.label}`
          : INTERACTIVE_WORLD_MAP_CONTENT.worldScopeLabel}
      </p>

      <div
        className="interactive-world-map__canvas"
        role="group"
        aria-label="World civic activity map"
        aria-describedby={`${scopeStatusId} ${feedbackId}`}
      >
        <svg
          className="interactive-world-map__svg"
          viewBox="0 0 720 360"
          aria-hidden="true"
          focusable="false"
        >
          <rect className="interactive-world-map__ocean" x="0" y="0" width="720" height="360" />
          {MAP_REGIONS.map((region) => {
            const geometry = REGION_GEOMETRY[region.id];
            const isSelected = selectedRegionId === region.id;

            return (
              <g key={region.id} aria-hidden="true">
                <path
                  className={`interactive-world-map__region-shape${
                    isSelected ? " interactive-world-map__region-shape--selected" : ""
                  }`}
                  d={geometry.path}
                />
                <circle
                  className="interactive-world-map__activity-marker"
                  cx={geometry.marker.cx}
                  cy={geometry.marker.cy}
                  r="5"
                />
              </g>
            );
          })}
        </svg>

        <div className="interactive-world-map__controls" role="group" aria-label="Map regions">
          {MAP_REGIONS.map((region) => {
            const isSelected = selectedRegionId === region.id;

            return (
              <button
                key={region.id}
                type="button"
                className={`interactive-world-map__region-button${
                  isSelected ? " interactive-world-map__region-button--selected" : ""
                }`}
                aria-pressed={isSelected}
                aria-label={`Select ${region.label} to preview geographic scope`}
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
        className="interactive-world-map__feedback"
        aria-live="polite"
        aria-atomic="true"
      >
        {selectedRegion ? (
          <>
            <p>
              {INTERACTIVE_WORLD_MAP_CONTENT.regionUnavailableMessage} Place:{" "}
              <strong>{selectedRegion.label}</strong>.
            </p>
            <button
              type="button"
              className="interactive-world-map__reset"
              onClick={() => setSelectedRegionId(null)}
            >
              {INTERACTIVE_WORLD_MAP_CONTENT.returnToWorldLabel}
            </button>
          </>
        ) : (
          <p>
            Select a region button to preview how geographic scope exploration will work. Activity
            distribution will connect to public projections in a later sprint.
          </p>
        )}
      </div>
    </div>
  );
}

const REGION_GEOMETRY: Record<
  (typeof MAP_REGIONS)[number]["id"],
  { path: string; marker: { cx: number; cy: number } }
> = {
  americas: {
    path: "M80 80 L170 60 L210 120 L190 220 L120 250 L70 180 Z",
    marker: { cx: 140, cy: 150 },
  },
  europe: {
    path: "M330 70 L390 65 L410 110 L380 150 L320 140 Z",
    marker: { cx: 360, cy: 105 },
  },
  africa: {
    path: "M340 150 L390 145 L410 230 L370 290 L330 260 Z",
    marker: { cx: 370, cy: 210 },
  },
  asia: {
    path: "M420 60 L560 70 L590 170 L520 210 L430 180 Z",
    marker: { cx: 510, cy: 130 },
  },
  oceania: {
    path: "M560 220 L650 210 L670 280 L590 300 L550 260 Z",
    marker: { cx: 610, cy: 250 },
  },
};

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { GEOGRAPHY_COUNTRIES } from "@hu/geography";
import { WORLD_MAP_ZOOM_BOUNDS } from "../world-map-zoom";

import "./interactive-world-map.css";

export interface InteractiveWorldMapProps {
  onCountrySelect?: (countryCode: string) => void;
}

const MAP_MESSAGE_SOURCE = "hu-world-map";
const MIN_SCALE = WORLD_MAP_ZOOM_BOUNDS.min;
const MAX_SCALE = WORLD_MAP_ZOOM_BOUNDS.max;

type MapViewState = {
  scale: number;
  x: number;
  y: number;
};

/**
 * WDCR interactive map embedded via iframe. Pack 03 adds same-origin zoom/pan/reset
 * controls without replacing the map library. Country fallback select remains for
 * keyboard and assistive technology access.
 *
 * Pinch-zoom is deferred — CSS/transform zoom + buttons cover touch and keyboard.
 */
export function InteractiveWorldMap({ onCountrySelect }: InteractiveWorldMapProps) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [view, setView] = useState<MapViewState>({ scale: MIN_SCALE, x: 0, y: 0 });

  const postToMap = useCallback((action: string, payload?: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      return;
    }
    win.postMessage({ source: MAP_MESSAGE_SOURCE, action, ...payload }, window.location.origin);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) {
        return;
      }
      const data = event.data as
        | { source?: string; type?: string; scale?: number; x?: number; y?: number }
        | undefined;
      if (!data || data.source !== MAP_MESSAGE_SOURCE || data.type !== "view") {
        return;
      }
      if (
        typeof data.scale === "number" &&
        typeof data.x === "number" &&
        typeof data.y === "number"
      ) {
        setView({ scale: data.scale, x: data.x, y: data.y });
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function navigateToCountry(countryCode: string) {
    onCountrySelect?.(countryCode);
    router.push(`/countries/${encodeURIComponent(countryCode.toUpperCase())}`);
  }

  function handleIframeLoad() {
    postToMap("sync");
  }

  return (
    <div className="interactive-world-map-boundary">
      <div className="interactive-world-map-boundary__toolbar" role="toolbar" aria-label="Map view">
        <button
          type="button"
          className="interactive-world-map-boundary__zoom-btn"
          aria-label="Zoom in"
          disabled={view.scale >= MAX_SCALE - 0.001}
          onClick={() => postToMap("zoomIn")}
        >
          +
        </button>
        <button
          type="button"
          className="interactive-world-map-boundary__zoom-btn"
          aria-label="Zoom out"
          disabled={view.scale <= MIN_SCALE + 0.001}
          onClick={() => postToMap("zoomOut")}
        >
          −
        </button>
        <button
          type="button"
          className="interactive-world-map-boundary__zoom-btn interactive-world-map-boundary__zoom-btn--reset"
          aria-label="Reset map view"
          disabled={view.scale === MIN_SCALE && view.x === 0 && view.y === 0}
          onClick={() => postToMap("reset")}
        >
          Reset
        </button>
        <span className="interactive-world-map-boundary__zoom-level" aria-live="polite">
          {Math.round(view.scale * 100)}%
        </span>
      </div>

      <div className="interactive-world-map-boundary__frame">
        <iframe
          ref={iframeRef}
          src="/wdcr-js-map/index.html"
          title="Interactive world map"
          className="interactive-world-map-boundary__iframe"
          loading="lazy"
          onLoad={handleIframeLoad}
        />
      </div>

      <p className="interactive-world-map-boundary__hint">
        {view.scale > MIN_SCALE
          ? "Drag the map to pan while zoomed. Country taps still open civic activity."
          : "Use Zoom in to explore regions. Select a country on the map or from the list below."}
      </p>

      <div className="interactive-world-map-boundary__controls">
        <label
          className="interactive-world-map-boundary__label"
          htmlFor="world-map-country-fallback"
        >
          Explore civic activity by country
        </label>
        <select
          id="world-map-country-fallback"
          className="interactive-world-map-boundary__select"
          defaultValue=""
          onChange={(event) => {
            const countryCode = event.target.value;

            if (countryCode) {
              navigateToCountry(countryCode);
            }
          }}
        >
          <option value="">Select a country</option>
          {GEOGRAPHY_COUNTRIES.map((country) => (
            <option key={country.slug} value={country.slug}>
              {country.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export { WORLD_MAP_ZOOM_BOUNDS } from "../world-map-zoom";

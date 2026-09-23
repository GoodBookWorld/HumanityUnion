/**
 * Pack 08K.3.3 / Step 15D.3.1 — Home interactive map shell.
 * UI chrome + pin legend via next-intl; country labels via geography display-name resolver.
 * Iframe tooltips receive locale-aware names/labels over postMessage.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { GEOGRAPHY_COUNTRIES, getLocalizedCountryDisplayName } from "@hu/geography";

import enMessages from "../../i18n/messages/en.json";
import {
  MAP_PIN_LEGEND_ENTRIES,
  type MapPinLegendLabelsById,
} from "../map-pin-legend";
import { WORLD_MAP_ZOOM_BOUNDS } from "../world-map-zoom";

import "./interactive-world-map.css";

function buildCanonicalPinLabelsFromEnglishCatalog(): MapPinLegendLabelsById {
  const legend = (
    enMessages as {
      publicHome: {
        interactiveMap: {
          legend: Record<string, { title: string; description: string }>;
        };
      };
    }
  ).publicHome.interactiveMap.legend;
  const map: Record<string, { title: string; description: string }> = {};
  for (const entry of MAP_PIN_LEGEND_ENTRIES) {
    const leaf = legend[entry.messageKey];
    if (!leaf || typeof leaf.title !== "string" || typeof leaf.description !== "string") {
      throw new Error(`Missing canonical pin legend copy for ${entry.messageKey}`);
    }
    map[entry.id] = {
      title: leaf.title,
      description: leaf.description,
    };
  }
  return map;
}

const CANONICAL_PIN_LABELS = buildCanonicalPinLabelsFromEnglishCatalog();

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

export function InteractiveWorldMap({ onCountrySelect }: InteractiveWorldMapProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("publicHome.interactiveMap");
  const tLegend = useTranslations("publicHome.interactiveMap.legend");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [view, setView] = useState<MapViewState>({ scale: MIN_SCALE, x: 0, y: 0 });

  const localizedCountries = useMemo(
    () =>
      GEOGRAPHY_COUNTRIES.map((country) => ({
        code: country.slug.toUpperCase(),
        label: getLocalizedCountryDisplayName(country.slug, locale, country.label),
      })).sort((a, b) => a.label.localeCompare(b.label, locale)),
    [locale],
  );

  const countryNamesByCode = useMemo(() => {
    const map: Record<string, string> = {};
    for (const country of localizedCountries) {
      map[country.code] = country.label;
    }
    return map;
  }, [localizedCountries]);

  const pinLabelsById = useMemo((): MapPinLegendLabelsById => {
    const map: Record<string, { title: string; description: string }> = {};
    for (const entry of MAP_PIN_LEGEND_ENTRIES) {
      map[entry.id] = {
        title: tLegend(`${entry.messageKey}.title`),
        description: tLegend(`${entry.messageKey}.description`),
      };
    }
    return map;
  }, [tLegend]);

  const postToMap = useCallback((action: string, payload?: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      return;
    }
    win.postMessage({ source: MAP_MESSAGE_SOURCE, action, ...payload }, window.location.origin);
  }, []);

  const pushLocaleNames = useCallback(() => {
    postToMap("setCountryNames", { names: countryNamesByCode, locale });
  }, [countryNamesByCode, locale, postToMap]);

  const pushPinLabels = useCallback(() => {
    postToMap("setPinLabels", {
      labels: pinLabelsById,
      canonicalLabels: CANONICAL_PIN_LABELS,
      locale,
    });
  }, [locale, pinLabelsById, postToMap]);

  const pushIframeLocalization = useCallback(() => {
    pushLocaleNames();
    pushPinLabels();
  }, [pushLocaleNames, pushPinLabels]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) {
        return;
      }
      const data = event.data as
        | {
            source?: string;
            type?: string;
            scale?: number;
            x?: number;
            y?: number;
            ready?: boolean;
          }
        | undefined;
      if (!data || data.source !== MAP_MESSAGE_SOURCE) {
        return;
      }
      if (data.type === "ready") {
        pushIframeLocalization();
        return;
      }
      if (data.type !== "view") {
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
  }, [pushIframeLocalization]);

  useEffect(() => {
    pushIframeLocalization();
  }, [pushIframeLocalization]);

  function navigateToCountry(countryCode: string) {
    onCountrySelect?.(countryCode);
    router.push(`/countries/${encodeURIComponent(countryCode.toUpperCase())}`);
  }

  function handleIframeLoad() {
    postToMap("sync");
    pushIframeLocalization();
  }

  return (
    <div
      className="interactive-world-map-boundary"
      data-hu-surface="home-interactive-map"
    >
      <div
        className="interactive-world-map-boundary__toolbar"
        role="toolbar"
        aria-label={t("toolbarAria")}
        data-hu-semantic="ui"
      >
        <button
          type="button"
          className="interactive-world-map-boundary__zoom-btn"
          aria-label={t("zoomIn")}
          disabled={view.scale >= MAX_SCALE - 0.001}
          onClick={() => postToMap("zoomIn")}
          data-hu-semantic="ui"
        >
          +
        </button>
        <button
          type="button"
          className="interactive-world-map-boundary__zoom-btn"
          aria-label={t("zoomOut")}
          disabled={view.scale <= MIN_SCALE + 0.001}
          onClick={() => postToMap("zoomOut")}
          data-hu-semantic="ui"
        >
          −
        </button>
        <button
          type="button"
          className="interactive-world-map-boundary__zoom-btn interactive-world-map-boundary__zoom-btn--reset"
          aria-label={t("reset")}
          disabled={view.scale === MIN_SCALE && view.x === 0 && view.y === 0}
          onClick={() => postToMap("reset")}
          data-hu-semantic="ui"
        >
          {t("reset")}
        </button>
        <span
          className="interactive-world-map-boundary__zoom-level"
          aria-live="polite"
          data-hu-semantic="ui"
        >
          {Math.round(view.scale * 100)}%
        </span>
      </div>

      <div className="interactive-world-map-boundary__frame">
        <iframe
          ref={iframeRef}
          src={`/wdcr-js-map/index.html?locale=${encodeURIComponent(locale)}`}
          title={t("iframeTitle")}
          className="interactive-world-map-boundary__iframe"
          loading="lazy"
          onLoad={handleIframeLoad}
        />
      </div>

      <p className="interactive-world-map-boundary__hint" data-hu-semantic="ui">
        {view.scale > MIN_SCALE ? t("hintZoomed") : t("hintDefault")}
      </p>

      <div className="interactive-world-map-boundary__controls">
        <label
          className="interactive-world-map-boundary__label"
          htmlFor="world-map-country-fallback"
          data-hu-semantic="ui"
        >
          {t("exploreByCountry")}
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
          data-hu-semantic="ui"
        >
          <option value="">{t("selectCountry")}</option>
          {localizedCountries.map((country) => (
            <option
              key={country.code}
              value={country.code}
              data-hu-semantic="auto"
              data-hu-geo="country"
            >
              {country.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export { WORLD_MAP_ZOOM_BOUNDS } from "../world-map-zoom";

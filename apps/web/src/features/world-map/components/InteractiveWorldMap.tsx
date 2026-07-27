"use client";

import { useRouter } from "next/navigation";

import { GEOGRAPHY_COUNTRIES } from "../../../data/geography";

import "./interactive-world-map.css";

export interface InteractiveWorldMapProps {
  onCountrySelect?: (countryCode: string) => void;
}

/**
 * WDCR interactive map embedded via iframe. Country fallback controls remain for
 * keyboard and assistive technology access.
 */
export function InteractiveWorldMap({ onCountrySelect }: InteractiveWorldMapProps) {
  const router = useRouter();

  function navigateToCountry(countryCode: string) {
    onCountrySelect?.(countryCode);
    router.push(`/countries/${encodeURIComponent(countryCode.toUpperCase())}`);
  }

  return (
    <div className="interactive-world-map-boundary">
      <div className="interactive-world-map-boundary__frame">
        <iframe
          src="/wdcr-js-map/index.html"
          title="Interactive world map"
          className="interactive-world-map-boundary__iframe"
          loading="lazy"
        />
      </div>
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

"use client";

/**
 * HYD-01B — server-resolved country display names for client components.
 *
 * Browser Intl data differs from Node's (and lacks some locales, e.g. Georgian),
 * so resolving names in the browser broke hydration. The root layout resolves
 * the active locale's list once on the server; client components read it here.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";

import {
  getLocalizedCountryDisplayName,
  listLocalizedCountries,
  type LocalizedCountryName,
} from "@hu/geography";

type GeographyDisplayValue = {
  readonly locale: string;
  readonly countries: readonly LocalizedCountryName[];
};

const GeographyDisplayContext = createContext<GeographyDisplayValue | null>(null);

export function GeographyDisplayProvider({
  locale,
  countries,
  children,
}: {
  locale: string;
  countries: readonly LocalizedCountryName[];
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, countries }), [locale, countries]);
  return createElement(GeographyDisplayContext.Provider, { value }, children);
}

/** Server list when it matches the interface locale; otherwise resolve here (never on first render). */
function useActiveGeographyDisplay(): GeographyDisplayValue {
  const locale = useLocale();
  const provided = useContext(GeographyDisplayContext);
  return useMemo(() => {
    if (provided && provided.locale === locale) {
      return provided;
    }
    return { locale, countries: listLocalizedCountries(locale) };
  }, [locale, provided]);
}

/** All countries with display names, sorted for the active locale. */
export function useLocalizedCountries(): readonly LocalizedCountryName[] {
  return useActiveGeographyDisplay().countries;
}

/** Display name for an ISO country code; `fallback` when the code is unknown. */
export function useCountryDisplayName(): (countryCode: string, fallback?: string) => string {
  const { locale, countries } = useActiveGeographyDisplay();
  const byCode = useMemo(
    () => new Map(countries.map((country) => [country.code, country.label])),
    [countries],
  );
  return useCallback(
    (countryCode: string, fallback?: string) =>
      byCode.get(countryCode.trim().toUpperCase()) ??
      getLocalizedCountryDisplayName(countryCode, locale, fallback),
    [byCode, locale],
  );
}

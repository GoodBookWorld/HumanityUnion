"use client";

import { COUNTRY_NEWS_RAIL_LIMIT } from "@hu/media-registry";
import { useCallback, useEffect, useState } from "react";

import { fetchCountryNewsSources } from "../country-experience/country-experience-api";
import { fetchPublicNewsArticles } from "./api";
import {
  loadCountryNewsRail,
  resolveCountryNewsProviderOptions,
  type CountryNewsProviderOptions,
  type CountryNewsRailResult,
  type FetchCountryNewsArticles,
} from "./country-news-rail";

const EMPTY_RESULT: CountryNewsRailResult = { articles: [], usedGlobalFallback: false };

/** Same English source corpus as the /media news rail. */
const fetchCountryNewsArticles: FetchCountryNewsArticles = async (sources) =>
  (
    await fetchPublicNewsArticles({
      sources,
      limit: COUNTRY_NEWS_RAIL_LIMIT,
      language: "en",
    })
  ).items;

export function useCountryNewsRail(input: {
  readonly enabled: boolean;
  readonly countryCode?: string;
  readonly provider: string;
}) {
  const { enabled, countryCode, provider } = input;
  const [options, setOptions] = useState<CountryNewsProviderOptions | null>(null);
  const [result, setResult] = useState<CountryNewsRailResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !countryCode) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setOptions(null);
    fetchCountryNewsSources(countryCode)
      .then((sources) => {
        if (!cancelled) {
          setOptions(resolveCountryNewsProviderOptions(sources));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult(EMPTY_RESULT);
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, countryCode, attempt]);

  useEffect(() => {
    if (!options) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    loadCountryNewsRail({ options, provider, fetchArticles: fetchCountryNewsArticles })
      .then((next) => {
        if (!cancelled) {
          setResult(next);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult(EMPTY_RESULT);
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [options, provider]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return {
    options,
    articles: result.articles,
    usedGlobalFallback: result.usedGlobalFallback,
    loading,
    failed,
    retry,
  };
}

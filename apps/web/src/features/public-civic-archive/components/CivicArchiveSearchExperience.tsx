"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { listPublicCivicArchiveIndex } from "../api";
import {
  buildCivicArchiveQueryKey,
  buildCivicArchiveSearchParams,
  deriveCivicArchiveResultsStatus,
  draftFiltersFromApplied,
  EMPTY_CIVIC_ARCHIVE_DRAFT_FILTERS,
  hasAppliedCivicArchiveFilters,
  hasDraftSearchCriteria,
  parseCivicArchiveAppliedFilters,
  type CivicArchiveDraftFilters,
  type CivicArchiveResultsStatus,
} from "../civic-archive-query";
import { CivicArchiveFiltersForm } from "./CivicArchiveFiltersForm";
import { CivicArchiveResultsFocus } from "./CivicArchiveResultsFocus";
import { CivicArchiveResultsPanel } from "./CivicArchiveResultsPanel";

export function CivicArchiveSearchExperience() {
  const t = useTranslations("initiativeExperience.civicArchivePublic");
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestVersionRef = useRef(0);
  const searchFieldRef = useRef<HTMLInputElement>(null);

  const appliedFilters = useMemo(
    () => parseCivicArchiveAppliedFilters(searchParams),
    [searchParams],
  );
  const queryKey = useMemo(() => buildCivicArchiveQueryKey(appliedFilters), [appliedFilters]);
  const hasSubmittedSearch = hasAppliedCivicArchiveFilters(appliedFilters);

  const [draftFilters, setDraftFilters] = useState<CivicArchiveDraftFilters>(() =>
    draftFiltersFromApplied(appliedFilters),
  );
  const [records, setRecords] = useState<
    Awaited<ReturnType<typeof listPublicCivicArchiveIndex>>["records"]
  >([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [emptySearchFeedback, setEmptySearchFeedback] = useState<string | null>(null);

  useEffect(() => {
    setDraftFilters(draftFiltersFromApplied(appliedFilters));
  }, [appliedFilters]);

  useEffect(() => {
    if (!hasSubmittedSearch) {
      setRecords([]);
      setTotal(0);
      setLoading(false);
      setApiUnavailable(false);
      return;
    }

    const controller = new AbortController();
    const requestVersion = ++requestVersionRef.current;

    setLoading(true);
    setApiUnavailable(false);
    setRecords([]);
    setTotal(0);

    void listPublicCivicArchiveIndex(appliedFilters, { signal: controller.signal })
      .then((response) => {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        setRecords(response.records);
        setTotal(response.total);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        setRecords([]);
        setTotal(0);
        setApiUnavailable(true);
        console.error(error);
      })
      .finally(() => {
        if (requestVersion === requestVersionRef.current) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [queryKey, appliedFilters, hasSubmittedSearch]);

  const status: CivicArchiveResultsStatus = deriveCivicArchiveResultsStatus({
    hasSubmittedSearch,
    loading,
    apiUnavailable,
    resultCount: records.length,
  });

  function navigateWithFilters(filters: CivicArchiveDraftFilters, focusResults = false): void {
    const params = buildCivicArchiveSearchParams(filters);
    const query = params.toString();
    const hash = focusResults ? "#civic-archive-results" : "";
    router.push(query ? `/civic-archive?${query}${hash}` : `/civic-archive${hash}`);
  }

  function handleSearch(): void {
    if (!hasDraftSearchCriteria(draftFilters)) {
      setEmptySearchFeedback(t("emptySearchFeedback"));
      return;
    }

    setEmptySearchFeedback(null);
    navigateWithFilters(draftFilters, true);
  }

  function handleClearFilters(): void {
    setDraftFilters(EMPTY_CIVIC_ARCHIVE_DRAFT_FILTERS);
    setEmptySearchFeedback(null);
    setRecords([]);
    setTotal(0);
    setLoading(false);
    setApiUnavailable(false);
    router.push("/civic-archive");
  }

  function handleAdjustSearch(): void {
    searchFieldRef.current?.focus();
    searchFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <>
      <CivicArchiveFiltersForm
        draftFilters={draftFilters}
        onDraftChange={(next) => {
          setDraftFilters(next);
          if (emptySearchFeedback) {
            setEmptySearchFeedback(null);
          }
        }}
        onSearch={handleSearch}
        onClearFilters={handleClearFilters}
        emptySearchFeedback={emptySearchFeedback}
        searchFieldRef={searchFieldRef}
      />
      <CivicArchiveResultsFocus />
      <CivicArchiveResultsPanel
        records={records}
        total={total}
        appliedFilters={appliedFilters}
        status={status}
        onClearFilters={handleClearFilters}
        onAdjustSearch={handleAdjustSearch}
      />
    </>
  );
}

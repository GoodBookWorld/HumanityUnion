"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import type {
  InitiativeDecisionSelectOneAggregates,
  InitiativeDecisionSupportOpposeAggregates,
  PublicChoiceBallotMode,
  PublicChoiceCandidatePublicProjection,
  PublicInitiativeCollectiveDecisionProjection,
  PublicInitiativeProjection,
} from "@hu/types";
import {
  resolvePublicChoiceBallotMode,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";
import { formatPublicGeography } from "@hu/geography";

import {
  CivicShareButton,
  resolveAbsoluteCivicShareUrl,
} from "../../civic-share";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { PublicChoiceElectionResultsBoard } from "../../public-choice-candidate/components/PublicChoiceElectionResultsBoard";
import {
  createZeroSelectOneAggregates,
  loadPublicChoiceElectionResultSurface,
} from "../../public-choice-candidate/public-choice-election-result-surface";
import { usePublicChoiceElectionRefresh } from "../../public-choice-candidate/public-choice-election-refresh";
import { downloadPublicChoiceResultsPdf } from "../../public-choice-results-retention/api";
import {
  resolveInitiativeDecisionVoteChoiceDisplayLabel,
  resolvePublicChoiceElectionVotingStatusDisplayLabel,
} from "../initiative-experience-i18n";

import "../public-initiative-experience.css";

function formatDateTime(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function SupportOpposeResults({
  aggregates,
  resultsLabel,
  votingOpen,
  fallback,
  downloadAvailable,
  onDownload,
  downloadBusy,
  shareSlot,
}: {
  aggregates: InitiativeDecisionSupportOpposeAggregates | null;
  resultsLabel: string;
  votingOpen: boolean;
  fallback: { support: number; doNotSupport: number; abstain: number; total: number };
  downloadAvailable: boolean;
  onDownload: () => void;
  downloadBusy: boolean;
  shareSlot?: ReactNode;
}) {
  const t = useTranslations("initiativeExperience");
  const support = aggregates?.total.support ?? fallback.support;
  const doNotSupport = aggregates?.total.doNotSupport ?? fallback.doNotSupport;
  const abstain = aggregates?.total.abstain ?? fallback.abstain;
  const total = aggregates?.total.totalVotes ?? fallback.total;

  const rows = [
    { label: resolveInitiativeDecisionVoteChoiceDisplayLabel("support", t), count: support },
    {
      label: resolveInitiativeDecisionVoteChoiceDisplayLabel("do_not_support", t),
      count: doNotSupport,
    },
    { label: resolveInitiativeDecisionVoteChoiceDisplayLabel("abstain", t), count: abstain },
  ];

  return (
    <section className="pie-election-results" aria-labelledby="pie-election-results-title">
      <header className="pie-election-results__heading">
        <div className="pie-election-results__heading-row">
          <h2 id="pie-election-results-title">{resultsLabel}</h2>
          <div className="pie-election-results__heading-actions">
            {shareSlot}
            {downloadAvailable ? (
              <button
                type="button"
                className="pie-election-results__download"
                onClick={onDownload}
                disabled={downloadBusy}
              >
                {downloadBusy
                  ? t("publicChoice.results.preparing")
                  : t("publicChoice.results.download")}
              </button>
            ) : null}
          </div>
        </div>
        {votingOpen ? (
          <p role="status">{t("author.collectiveDecision.public.votingOpenNote")}</p>
        ) : (
          <p role="status">{t("author.collectiveDecision.public.votingClosedNote")}</p>
        )}
      </header>
      <p className="pie-election-results__total">
        {t.rich("publicChoice.results.totalEffectiveVoters", {
          count: () => <strong>{total}</strong>,
        })}
      </p>
      <ul className="pie-election-results__ternary">
        {rows.map((row) => {
          const percentage = total > 0 ? (row.count / total) * 100 : 0;
          const percentLabel = formatPercent(percentage);
          return (
            <li key={row.label} className="pie-election-results__ternary-row">
              <strong>{row.label}</strong>
              <div
                className="pie-election-results__metrics"
                aria-label={t("publicChoice.results.votesMetricAria", {
                  count: row.count,
                  percent: percentLabel,
                })}
              >
                <div className="pie-election-results__count">
                  {t("publicChoice.results.votesCount", { count: row.count })}
                </div>
                <div className="pie-election-results__percent">{percentLabel}</div>
                <div
                  className="pie-election-results__bar"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Number(percentage.toFixed(1))}
                  aria-label={t("publicChoice.results.voteShareAria", { name: row.label })}
                >
                  <span style={{ width: `${percentage}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Pack 04 / Fix 07C — Public Choice election results page.
 * OPEN → live aggregates; CLOSED → frozen snapshot via the same public projection path.
 */
export function PublicChoiceElectionPage({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [initiative, setInitiative] = useState<PublicInitiativeProjection | null>(null);
  const [candidates, setCandidates] = useState<PublicChoiceCandidatePublicProjection[]>([]);
  const [decision, setDecision] = useState<PublicInitiativeCollectiveDecisionProjection | null>(
    null,
  );
  const [selectOneAggregates, setSelectOneAggregates] =
    useState<InitiativeDecisionSelectOneAggregates>(() => createZeroSelectOneAggregates([]));
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    try {
      const surface = await loadPublicChoiceElectionResultSurface(initiativeId);
      if (generation !== loadGenerationRef.current) {
        return;
      }

      setInitiative(surface.initiative);
      setCandidates(surface.candidates);
      setDecision(surface.decision);
      setSelectOneAggregates(surface.selectOneAggregates);
      setLoadState(
        surface.initiative || surface.candidates.length > 0 || surface.decision
          ? "ready"
          : surface.initiativeLoadFailed
            ? "error"
            : "ready",
      );
    } catch {
      if (generation !== loadGenerationRef.current) {
        return;
      }
      setLoadState("error");
    }
  }, [initiativeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  usePublicChoiceElectionRefresh(initiativeId, reload);

  const ballotMode: PublicChoiceBallotMode = resolvePublicChoiceBallotMode(
    decision?.ballotMode ?? initiative?.metadata.ballotMode,
  );

  const votingStatus = resolvePublicChoiceElectionVotingStatus({
    decisionStatus: decision?.status,
    openedAt: decision?.openedAt,
    closesAt: decision?.closesAt,
    closedAt: decision?.closedAt,
    resultsExpiredAt:
      decision?.resultsRetention?.resultsExpiredAt ??
      initiative?.metadata.publicChoiceResultsExpiredAt,
    resultsRetentionStatus: decision?.resultsRetention?.status,
  });
  const votingOpen = votingStatus === "OPEN";
  const resultsExpired = votingStatus === "EXPIRED";
  const electionStatusLabel = resolvePublicChoiceElectionVotingStatusDisplayLabel(
    votingStatus,
    t,
  );

  const resultsLabel = votingOpen
    ? t("author.collectiveDecision.public.resultsCurrent")
    : resultsExpired
      ? t("author.collectiveDecision.public.results")
      : decision?.status === "closed" || decision?.resultsRetention?.status === "results_available"
        ? t("author.collectiveDecision.public.resultsFinal")
        : t("author.collectiveDecision.public.results");

  const downloadAvailable =
    Boolean(decision?.resultsRetention?.downloadAvailable) && !resultsExpired;

  const totalVoters =
    ballotMode === "SELECT_ONE_CANDIDATE"
      ? selectOneAggregates.totalEffectiveVoters
      : decision?.ballotAggregates?.ballotMode === "SUPPORT_OPPOSE"
        ? decision.ballotAggregates.total.totalVotes
        : (decision?.statistics.totalVotesCast ?? 0);

  async function handleDownload(): Promise<void> {
    if (!decision || downloadBusy) {
      return;
    }
    setDownloadBusy(true);
    setDownloadError(null);
    try {
      await downloadPublicChoiceResultsPdf(initiativeId, decision.decisionId);
    } catch (error) {
      setDownloadError(
        error instanceof Error && error.message.trim()
          ? error.message
          : t("publicChoice.election.downloadFailed"),
      );
    } finally {
      setDownloadBusy(false);
    }
  }

  if (loadState === "loading") {
    return <p role="status">{t("publicChoice.election.loading")}</p>;
  }

  if (loadState === "error" && !initiative && candidates.length === 0 && !decision) {
    return <p role="alert">{t("publicChoice.election.loadFailed")}</p>;
  }

  const electionName =
    initiative?.metadata.communityAssociation?.trim() ||
    initiative?.title ||
    t("sidebar.election.election");
  const cover =
    resolveMediaUrl(
      initiative?.metadata.imageUrl ??
        initiative?.metadata.coverMedia?.thumbnailUrl ??
        initiative?.metadata.coverMedia?.url,
    ) ?? undefined;
  const aggregates = decision?.ballotAggregates;
  const initiativeHref = `/initiatives/public/${encodeURIComponent(initiativeId)}`;
  const overviewVoteHref = `${initiativeHref}#overview`;
  const electionPath = `/initiatives/public/${encodeURIComponent(initiativeId)}/election`;

  const startOfVoting =
    formatDateTime(decision?.openedAt) ?? formatDateTime(initiative?.metadata.startDate);
  const endOfVoting =
    formatDateTime(decision?.closedAt) ??
    formatDateTime(decision?.closesAt) ??
    formatDateTime(initiative?.metadata.completionDate);

  const geography = formatPublicGeography({
    countryCode: initiative?.metadata.countrySlug,
    regionCode: initiative?.metadata.regionSlug,
    communitySlug: initiative?.metadata.communitySlug,
    regionLabel: initiative?.metadata.region,
    communityAssociation: initiative?.metadata.communityAssociation,
  });

  const sharePayload = {
    url: resolveAbsoluteCivicShareUrl(electionPath),
    title: electionName,
    image: cover,
    optionalText: initiative?.description?.slice(0, 160),
    contentType: "initiative" as const,
    initiativeId,
  };

  const shareSlot = (
    <CivicShareButton
      payload={sharePayload}
      ariaLabel={t("publicChoice.election.shareAria", { title: electionName })}
    />
  );

  if (resultsExpired) {
    return (
      <article className="pie-election-page pie-election-page--expired">
        <p>
          <Link href={initiativeHref}>{t("publicChoice.election.backToInitiative")}</Link>
        </p>
        <header className="pie-election-page__header">
          <p className="pie-election-page__eyebrow">{t("publicChoice.election.eyebrow")}</p>
          <h1 className="pie-election-page__title">{electionName}</h1>
          <p role="status" className="pie-election-page__expired-message">
            {t("publicChoice.election.resultsExpiredTitle")}
          </p>
          <p>{t("publicChoice.election.resultsExpiredBody")}</p>
        </header>
        <p>
          <Link href={initiativeHref}>{t("publicChoice.election.backToInitiativePlain")}</Link>
        </p>
      </article>
    );
  }

  return (
    <article className="pie-election-page">
      <p>
        <Link href={initiativeHref}>{t("publicChoice.election.backToInitiative")}</Link>
      </p>

      <p className="pie-election-page__eyebrow">{t("publicChoice.election.eyebrow")}</p>
      <h1 className="pie-election-page__title">{electionName}</h1>

      <div className="pie-election-page__intro">
        <div className="pie-election-page__intro-media">
          {cover ? (
            <img src={cover} alt={initiative?.metadata.imageAltText || electionName} />
          ) : (
            <div className="pie-election-page__intro-media-empty" aria-hidden />
          )}
        </div>
        <div className="pie-election-page__intro-body">
          {initiative?.description ? <p>{initiative.description}</p> : null}
          <ul className="pie-election-page__meta">
            <li>
              {t("publicChoice.election.geography", { value: geography || "—" })}
            </li>
            <li>
              {t("publicChoice.election.startOfVoting", { value: startOfVoting ?? "—" })}
            </li>
            <li>
              {t("publicChoice.election.endOfVoting", { value: endOfVoting ?? "—" })}
            </li>
            <li>{t("publicChoice.election.status", { status: electionStatusLabel })}</li>
            <li>{t("publicChoice.election.totalVotersMeta", { count: totalVoters })}</li>
          </ul>
          {votingOpen ? (
            <p>
              <Link className="hu-button hu-button--primary" href={overviewVoteHref}>
                {t("publicChoice.results.voteOnOverview")}
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      {downloadError ? <p role="alert">{downloadError}</p> : null}

      {ballotMode === "SELECT_ONE_CANDIDATE" ? (
        <PublicChoiceElectionResultsBoard
          initiativeId={initiativeId}
          candidates={candidates}
          aggregates={selectOneAggregates}
          resultsLabel={resultsLabel}
          votingOpen={votingOpen}
          electionStatus={electionStatusLabel}
          downloadAvailable={downloadAvailable}
          onDownload={() => {
            void handleDownload();
          }}
          downloadBusy={downloadBusy}
          shareSlot={shareSlot}
          voteHref={overviewVoteHref}
          showDisclaimer={false}
        />
      ) : (
        <SupportOpposeResults
          aggregates={aggregates?.ballotMode === "SUPPORT_OPPOSE" ? aggregates : null}
          resultsLabel={resultsLabel}
          votingOpen={votingOpen}
          downloadAvailable={downloadAvailable}
          onDownload={() => {
            void handleDownload();
          }}
          downloadBusy={downloadBusy}
          shareSlot={shareSlot}
          fallback={{
            support: decision?.statistics.supportCount ?? 0,
            doNotSupport: decision?.statistics.doNotSupportCount ?? 0,
            abstain: decision?.statistics.abstainCount ?? 0,
            total: decision?.statistics.totalVotesCast ?? 0,
          }}
        />
      )}

      <section className="pie-election-page__disclaimer" role="note" aria-labelledby="pie-disclaimer-title">
        <h2 id="pie-disclaimer-title">{t("publicChoice.results.disclaimerTitle")}</h2>
        <p>{t("publicChoice.results.disclaimerBody")}</p>
      </section>
    </article>
  );
}

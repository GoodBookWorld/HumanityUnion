"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type {
  InitiativeOfficialResponsePackage,
  InitiativeOfficialResponseRecord,
} from "@hu/types";

import { getPublishedOfficialResponses } from "../api";
import { CivicPublicTranslatedSection } from "../../language";

import "./initiative-official-response-stage-workspace.css";

interface InitiativeOfficialResponsePublicResultProps {
  readonly initiativeId: string;
  readonly isPreview?: boolean;
}

/**
 * Initiative Lifecycle — Part K, Section 6/9. Read-only for every
 * viewer, including the Initiative's Author — editing a published
 * Response happens only via a new Publish cycle, never here.
 */
export function InitiativeOfficialResponsePublicResult({
  initiativeId,
  isPreview = false,
}: InitiativeOfficialResponsePublicResultProps) {
  const t = useTranslations("initiativeExperience");
  const [pkg, setPackage] = useState<InitiativeOfficialResponsePackage | null | undefined>(undefined);
  const [responses, setResponses] = useState<readonly InitiativeOfficialResponseRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await getPublishedOfficialResponses(initiativeId);
        if (!cancelled) {
          setPackage(result.package);
          setResponses(result.responses);
        }
      } catch {
        if (!cancelled) {
          setError(t("author.officialResponse.public.loadFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId, t]);

  if (error) {
    return <p className="ior-source-panel__empty">{error}</p>;
  }

  if (pkg === undefined || !responses) {
    return <p className="ior-source-panel__empty">{t("author.officialResponse.public.loading")}</p>;
  }

  if (!pkg) {
    return <p className="ior-source-panel__empty">{t("author.officialResponse.public.empty")}</p>;
  }

  const isNoResponse = pkg.outcomeKind === "no_official_response_received" || responses.length === 0;

  if (isNoResponse) {
    const noResponseBody =
      pkg.noResponseDetail?.note?.trim() || pkg.summary.trim() || null;
    const packageTitle =
      pkg.title?.trim() || t("lifecycleRecordTitles.official_response_package");

    return (
      <article
        className="ior-public"
        aria-label={t("author.officialResponse.sections.noOfficialResponse")}
      >
        {isPreview ? (
          <p className="ior-public__meta">{t("author.officialResponse.public.previewMeta")}</p>
        ) : null}
        <section className="ior-public__section">
          <h3>{packageTitle}</h3>
          <p className="ior-public__meta">{t("author.officialResponse.public.publishedOutcome")}</p>
          <h3>{t("author.officialResponse.sections.noOfficialResponse")}</h3>
          {noResponseBody ? (
            <CivicPublicTranslatedSection
              sourceKind="official_response"
              sourceRecordId={pkg.packageId}
              fallbackFields={{
                subject: packageTitle,
                summary: noResponseBody,
                organizationName: "",
                responseReference: "",
              }}
              fieldOrder={["summary"]}
            />
          ) : null}
          {pkg.noResponseDetail?.contactedOrganizations?.length ? (
            <p className="ior-public__meta">
              {t("author.officialResponse.public.contacted", {
                list: pkg.noResponseDetail.contactedOrganizations.join(", "),
              })}
            </p>
          ) : null}
          {pkg.noResponseDetail?.contactedDates?.length ? (
            <p className="ior-public__meta">
              {t("author.officialResponse.public.dates", {
                list: pkg.noResponseDetail.contactedDates.join(", "),
              })}
            </p>
          ) : null}
        </section>
      </article>
    );
  }

  return (
    <article className="ior-public" aria-label={t("author.officialResponse.public.aria")}>
      {isPreview ? (
        <p className="ior-public__meta">{t("author.officialResponse.public.previewMeta")}</p>
      ) : null}
      <section className="ior-public__section">
        <h3>{t("author.officialResponse.sections.receivedResponses")}</h3>
        <p className="ior-public__meta">
          {t("author.officialResponse.public.publishedCount", { count: responses.length })}
        </p>
      </section>

      {responses.map((response) => (
        <div className="ior-public__response" key={response.responseId}>
          <CivicPublicTranslatedSection
            sourceKind="official_response"
            sourceRecordId={response.responseId}
            fallbackFields={{
              subject: response.subject,
              summary: response.summary,
              organizationName:
                response.institution || response.organization || "",
              responseReference: "",
            }}
            fieldOrder={["subject", "summary", "organizationName"]}
          />
          <p className="ior-public__meta">
            {t("author.officialResponse.public.responseMeta", {
              org:
                response.institution ||
                response.organization ||
                t("author.officialResponse.public.institutionFallback"),
              date: response.receivedAt,
            })}
          </p>
          {response.documentIds.length > 0 || response.links.length > 0 ? (
            <p className="ior-public__meta">
              {t("author.officialResponse.public.docsLinks", {
                documents: response.documentIds.length,
                links: response.links.length,
              })}
            </p>
          ) : null}
        </div>
      ))}
    </article>
  );
}

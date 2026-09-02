import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../../features/brand-localization/resolve-brand-for-metadata";
import { CivicIntegrationPanel } from "../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getCivicArchiveLifecycleRecord } from "../../../features/public-civic-archive/api";
import { CivicArchiveLifecycleTimeline } from "../../../features/public-civic-archive/components/CivicArchiveLifecycleTimeline";
import { CivicArchiveTranslatedNarrative } from "../../../features/public-civic-archive/components/CivicArchiveTranslatedNarrative";
import { applyPageSeoOverrideToMetadataInput } from "../../../lib/seo/apply-page-seo-override";
import { buildPublicPageMetadata } from "../../../lib/seo/build-public-page-metadata";
import { fetchPublicSeoPageOverride } from "../../../lib/seo/fetch-public-seo-page-override";
import { JsonLdScript, buildWebPageJsonLd } from "../../../lib/seo/structured-data";

import "../civic-archive-page.css";

interface CivicArchiveDetailPageProps {
  params: Promise<{
    initiativeId: string;
  }>;
}

export async function generateMetadata({
  params,
}: CivicArchiveDetailPageProps): Promise<Metadata> {
  const { initiativeId } = await params;
  const canonicalPath = `/civic-archive/${encodeURIComponent(initiativeId)}`;
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("initiativeExperience.civicArchivePublic");
  const record = await getCivicArchiveLifecycleRecord(initiativeId);

  if (!record) {
    return buildPublicPageMetadata({
      title: t("detail.seoNotFoundTitle"),
      description: t("detail.seoDescriptionFallback", {
        title: t("detail.emptyTitle"),
        siteName: brand.seoSiteName,
      }),
      canonicalPath,
      openGraphType: "website",
      indexable: false,
      titleBrandSuffix: brand.seoTitleSuffix,
      openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
    });
  }

  const description =
    record.summary?.trim() ||
    t("detail.seoDescriptionFallback", {
      title: record.title,
      siteName: brand.seoSiteName,
    });
  const override = await fetchPublicSeoPageOverride({
    family: "civic-archive",
    entityKey: initiativeId,
  });

  return buildPublicPageMetadata(
    applyPageSeoOverrideToMetadataInput(
      {
        title: record.title,
        description,
        canonicalPath,
        socialTitle: record.title,
        socialDescription: description,
        openGraphType: "website",
        titleBrandSuffix: brand.seoTitleSuffix,
        openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
      },
      override?.fields,
    ),
  );
}

function formatDate(value: string | undefined, locale: string): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function CivicArchiveDetailPage({ params }: CivicArchiveDetailPageProps) {
  const { initiativeId } = await params;
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("initiativeExperience.civicArchivePublic");
  const tNav = await getTranslations("navigation");
  const record = await getCivicArchiveLifecycleRecord(initiativeId);

  if (!record) {
    return (
      <main className="civic-archive-page">
        <h1>{t("detail.emptyTitle")}</h1>
        <p className="civic-archive-page__empty">{t("detail.emptyBody")}</p>
        <p className="civic-archive-page__back">
          <Link href="/civic-archive">{t("detail.backToArchive")}</Link>
        </p>
      </main>
    );
  }

  const description =
    record.summary?.trim() ||
    t("detail.seoDescriptionFallback", {
      title: record.title,
      siteName: brand.seoSiteName,
    });
  const canonicalPath = `/civic-archive/${encodeURIComponent(initiativeId)}`;
  const override = await fetchPublicSeoPageOverride({
    family: "civic-archive",
    entityKey: initiativeId,
  });
  const effectiveTitle = override?.fields.seoTitle?.trim() || record.title;
  const effectiveDescription = override?.fields.seoDescription?.trim() || description;
  const effectiveImage = override?.fields.socialImageUrl?.trim() || undefined;
  const structuredData = buildWebPageJsonLd({
    name: effectiveTitle,
    description: effectiveDescription,
    canonicalPath,
    imageUrl: effectiveImage,
    breadcrumbs: [
      { name: tNav("home"), path: "/" },
      { name: tNav("civicArchive"), path: "/civic-archive" },
      { name: effectiveTitle, path: canonicalPath },
    ],
  });

  return (
    <>
      <JsonLdScript data={structuredData} />
      <main className="civic-archive-page civic-archive-page--detail">
      <header className="civic-archive-detail__header">
        <p className="civic-archive-detail__eyebrow">
          {t("detail.eyebrow", { siteName: brand.siteName })}
        </p>
        <h1>{record.title}</h1>
        <p className="civic-archive-detail__summary">{record.summary}</p>
        <dl className="civic-archive-detail__meta-grid">
          <div>
            <dt>{t("detail.metaOutcome")}</dt>
            <dd>{record.outcomeStatusLabel}</dd>
          </div>
          <div>
            <dt>{t("detail.metaGeography")}</dt>
            <dd>{[record.community, record.region, record.country].filter(Boolean).join(" · ")}</dd>
          </div>
          <div>
            <dt>{t("detail.metaActivityArea")}</dt>
            <dd>{record.activityArea}</dd>
          </div>
          <div>
            <dt>{t("detail.metaStarted")}</dt>
            <dd>{formatDate(record.startedAt, locale)}</dd>
          </div>
          <div>
            <dt>{t("detail.metaCompleted")}</dt>
            <dd>{formatDate(record.completedAt, locale)}</dd>
          </div>
          <div>
            <dt>{t("detail.metaArchived")}</dt>
            <dd>{formatDate(record.archivedAt, locale)}</dd>
          </div>
        </dl>
      </header>

      <section className="civic-archive-detail__section">
        <h2>{t("detail.sectionArchiveNarrative")}</h2>
        <CivicArchiveTranslatedNarrative
          archiveRecordId={record.archiveRecordId}
          titleFallback={record.title}
          summaryFallback={record.summary}
        />
      </section>

      <section className="civic-archive-detail__section">
        <h2>{t("detail.sectionFinalOutcome")}</h2>
        <p>{record.finalOutcomeSummary}</p>
      </section>

      {record.decisionSummary ? (
        <section className="civic-archive-detail__section">
          <h2>{t("detail.sectionDecisionSummary")}</h2>
          <p>{record.decisionSummary}</p>
        </section>
      ) : null}

      {record.implementationSummary ? (
        <section className="civic-archive-detail__section">
          <h2>{t("detail.sectionImplementationSummary")}</h2>
          <p>{record.implementationSummary}</p>
        </section>
      ) : null}

      {record.publicImpactSummary ? (
        <section className="civic-archive-detail__section">
          <h2>{t("detail.sectionPublicImpactSummary")}</h2>
          <p>{record.publicImpactSummary}</p>
        </section>
      ) : null}

      {record.officialResponseSummaries.length > 0 ? (
        <section className="civic-archive-detail__section">
          <h2>{t("detail.sectionOfficialResponses")}</h2>
          <ul>
            {record.officialResponseSummaries.map((summary) => (
              <li key={summary}>{summary}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <CivicArchiveLifecycleTimeline record={record} />

      {record.evidenceLinks.length > 0 ? (
        <section className="civic-archive-detail__section">
          <h2>{t("detail.sectionArchiveEvidence")}</h2>
          <ul>
            {record.evidenceLinks.map((link) => (
              <li key={link.url}>
                <Link href={link.url}>{link.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className="civic-archive-detail__nav" aria-label={t("detail.relatedNavAria")}>
        <Link href={`/initiatives/public/${encodeURIComponent(record.initiativeId)}`}>
          {t("detail.viewPublicInitiative")}
        </Link>
        <Link href="/civic-archive">{t("detail.backToArchive")}</Link>
      </nav>

      <CivicIntegrationPanel entityType="civic-archive" entityId={record.archiveRecordId} />
    </main>
    </>
  );
}

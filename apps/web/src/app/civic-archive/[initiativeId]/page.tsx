import Link from "next/link";
import type { Metadata } from "next";

import { CivicIntegrationPanel } from "../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getCivicArchiveLifecycleRecord } from "../../../features/public-civic-archive/api";
import { CivicArchiveLifecycleTimeline } from "../../../features/public-civic-archive/components/CivicArchiveLifecycleTimeline";
import { CivicArchiveTranslatedNarrative } from "../../../features/public-civic-archive/components/CivicArchiveTranslatedNarrative";
import { applyPageSeoOverrideToMetadataInput } from "../../../lib/seo/apply-page-seo-override";
import { buildPublicPageMetadata } from "../../../lib/seo/build-public-page-metadata";
import { fetchPublicSeoPageOverride } from "../../../lib/seo/fetch-public-seo-page-override";
import { buildUnavailablePublicMetadata } from "../../../lib/seo/public-surface-copy";
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
  const record = await getCivicArchiveLifecycleRecord(initiativeId);

  if (!record) {
    return buildUnavailablePublicMetadata("Civic Archive record not found | Humanity Union");
  }

  const description =
    record.summary?.trim() || `${record.title} — Civic Archive on Humanity Union`;
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
      },
      override?.fields,
    ),
  );
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function CivicArchiveDetailPage({ params }: CivicArchiveDetailPageProps) {
  const { initiativeId } = await params;
  const record = await getCivicArchiveLifecycleRecord(initiativeId);

  if (!record) {
    return (
      <main className="civic-archive-page">
        <h1>Public Civic Archive</h1>
        <p className="civic-archive-page__empty">Archive record is not available.</p>
        <p className="civic-archive-page__back">
          <Link href="/civic-archive">Back to Civic Archive</Link>
        </p>
      </main>
    );
  }

  const description =
    record.summary?.trim() || `${record.title} — Civic Archive on Humanity Union`;
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
      { name: "Home", path: "/" },
      { name: "Civic Archive", path: "/civic-archive" },
      { name: effectiveTitle, path: canonicalPath },
    ],
  });

  return (
    <>
      <JsonLdScript data={structuredData} />
      <main className="civic-archive-page civic-archive-page--detail">
      <header className="civic-archive-detail__header">
        <p className="civic-archive-detail__eyebrow">Humanity Union Public Civic Archive</p>
        <h1>{record.title}</h1>
        <p className="civic-archive-detail__summary">{record.summary}</p>
        <dl className="civic-archive-detail__meta-grid">
          <div>
            <dt>Outcome</dt>
            <dd>{record.outcomeStatusLabel}</dd>
          </div>
          <div>
            <dt>Geography</dt>
            <dd>{[record.community, record.region, record.country].filter(Boolean).join(" · ")}</dd>
          </div>
          <div>
            <dt>Activity area</dt>
            <dd>{record.activityArea}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{formatDate(record.startedAt)}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{formatDate(record.completedAt)}</dd>
          </div>
          <div>
            <dt>Archived</dt>
            <dd>{formatDate(record.archivedAt)}</dd>
          </div>
        </dl>
      </header>

      <section className="civic-archive-detail__section">
        <h2>Archive narrative</h2>
        <CivicArchiveTranslatedNarrative
          archiveRecordId={record.archiveRecordId}
          titleFallback={record.title}
          summaryFallback={record.summary}
        />
      </section>

      <section className="civic-archive-detail__section">
        <h2>Final outcome</h2>
        <p>{record.finalOutcomeSummary}</p>
      </section>

      {record.decisionSummary ? (
        <section className="civic-archive-detail__section">
          <h2>Decision summary</h2>
          <p>{record.decisionSummary}</p>
        </section>
      ) : null}

      {record.implementationSummary ? (
        <section className="civic-archive-detail__section">
          <h2>Implementation summary</h2>
          <p>{record.implementationSummary}</p>
        </section>
      ) : null}

      {record.publicImpactSummary ? (
        <section className="civic-archive-detail__section">
          <h2>Public impact summary</h2>
          <p>{record.publicImpactSummary}</p>
        </section>
      ) : null}

      {record.officialResponseSummaries.length > 0 ? (
        <section className="civic-archive-detail__section">
          <h2>Official responses</h2>
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
          <h2>Archive evidence</h2>
          <ul>
            {record.evidenceLinks.map((link) => (
              <li key={link.url}>
                <Link href={link.url}>{link.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className="civic-archive-detail__nav" aria-label="Related civic records">
        <Link href={`/initiatives/public/${encodeURIComponent(record.initiativeId)}`}>
          View Public Initiative
        </Link>
        <Link href="/civic-archive">Back to Civic Archive</Link>
      </nav>

      <CivicIntegrationPanel entityType="civic-archive" entityId={record.archiveRecordId} />
    </main>
    </>
  );
}

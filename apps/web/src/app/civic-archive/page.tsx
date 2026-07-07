import Link from "next/link";

import { listPublicCivicArchiveIndex } from "../../features/public-civic-archive/api";

import "./civic-archive-page.css";

interface CivicArchiveIndexPageProps {
  searchParams: Promise<{
    search?: string;
    country?: string;
    region?: string;
    community?: string;
    activityArea?: string;
    implementationYear?: string;
  }>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function CivicArchiveIndexPage({ searchParams }: CivicArchiveIndexPageProps) {
  const params = await searchParams;
  const implementationYear = params.implementationYear
    ? Number.parseInt(params.implementationYear, 10)
    : undefined;

  let index = null;

  try {
    index = await listPublicCivicArchiveIndex({
      search: params.search,
      country: params.country,
      region: params.region,
      community: params.community,
      activityArea: params.activityArea,
      implementationYear: Number.isNaN(implementationYear) ? undefined : implementationYear,
    });
  } catch {
    index = null;
  }

  if (!index) {
    return (
      <main className="civic-archive-page">
        <h1>Humanity Union Public Civic Archive</h1>
        <p className="civic-archive-page__empty">Public civic archive is not available.</p>
        <p className="civic-archive-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="civic-archive-page">
      <header>
        <h1>Humanity Union Public Civic Archive</h1>
        <p className="civic-archive-page__intro">
          Permanent institutional memory of completed civic initiatives and their verified public
          outcomes. This is a constitutional historical archive — not a news feed, document
          repository, or social timeline.
        </p>
      </header>

      <form className="civic-archive-page__filters" method="get">
        <label>
          Search
          <input
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Search archive records"
          />
        </label>
        <label>
          Country
          <input name="country" defaultValue={params.country ?? ""} placeholder="Country" />
        </label>
        <label>
          Region
          <input name="region" defaultValue={params.region ?? ""} placeholder="Region" />
        </label>
        <label>
          Community
          <input name="community" defaultValue={params.community ?? ""} placeholder="Community" />
        </label>
        <label>
          Activity area
          <input
            name="activityArea"
            defaultValue={params.activityArea ?? ""}
            placeholder="Activity area"
          />
        </label>
        <label>
          Implementation year
          <input
            name="implementationYear"
            defaultValue={params.implementationYear ?? ""}
            placeholder="YYYY"
          />
        </label>
        <button type="submit">Apply filters</button>
      </form>

      <p className="civic-archive-page__metrics">
        {index.metrics.archiveRecordCount} archive record
        {index.metrics.archiveRecordCount === 1 ? "" : "s"} · {index.metrics.countriesRepresented}{" "}
        countries · {index.metrics.regionsRepresented} regions ·{" "}
        {index.metrics.communitiesRepresented} communities
      </p>

      {index.records.length === 0 ? (
        <p className="civic-archive-page__empty">No archive records match these filters yet.</p>
      ) : (
        <ul className="civic-archive-page__list">
          {index.records.map((record) => (
            <li key={record.archiveRecordId} className="civic-archive-page__item">
              <Link href={`/civic-archive/${encodeURIComponent(record.archiveRecordId)}`}>
                {record.title}
              </Link>
              <p>{record.summary}</p>
              <p className="civic-archive-page__item-meta">
                {record.community} · {record.region} · {record.country} · {record.activityArea} ·
                Version {record.archivedVersion} · Archived {formatDate(record.archivedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="civic-archive-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}

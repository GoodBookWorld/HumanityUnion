import {
  buildSearchProviderKpis,
  buildSearchTrendPoints,
  describeSearchProviderStatus,
  describeUnsupportedMetric,
  formatSearchCount,
  formatSearchCtr,
  formatSearchDateTime,
  formatSearchDay,
  formatSearchDayRange,
  formatSearchPosition,
  latestBingCrawlDay,
  NO_DATA_LABEL,
  SEARCH_PROVIDER_SHORT_LABELS,
  type AdminSearchProviderView,
  type SearchTopRowsSnapshot,
} from "../admin-seo-search-performance-model";
import { SearchPerformanceTrendChart } from "./SearchPerformanceTrendChart";

interface AdminSeoSearchProviderPanelProps {
  view: AdminSearchProviderView;
  syncEnabled: boolean;
}

const CLICKS_COLOR = "var(--hu-color-primary, #0174b0)";
const IMPRESSIONS_COLOR = "var(--hu-color-accent, #df9815)";

/**
 * SEO-12B.2 — one provider's search performance, never mixed with the other
 * provider. Rendered inside the provider's ProfileSection (h2).
 */
export function AdminSeoSearchProviderPanel({
  view,
  syncEnabled,
}: AdminSeoSearchProviderPanelProps) {
  const name = SEARCH_PROVIDER_SHORT_LABELS[view.provider];
  const status = describeSearchProviderStatus(view, syncEnabled);
  const kpis = buildSearchProviderKpis(view);

  return (
    <div className="admin-seo-search__provider" data-provider={view.provider}>
      <p className="admin-seo-search__status">
        <span
          className={`admin-seo-diagnostics__badge admin-seo-diagnostics__badge--${status.badge}`}
        >
          {status.label}
        </span>{" "}
        {status.message}
      </p>
      <ul className="admin-seo-search__meta">
        {view.siteUrl ? <li>Property: {view.siteUrl}</li> : null}
        <li>Data through: {formatSearchDay(view.dataThrough)}</li>
        {view.lastAttemptAt ? (
          <li>Last attempt: {formatSearchDateTime(view.lastAttemptAt)}</li>
        ) : null}
      </ul>
      {view.configurationIssues.length > 0 ? (
        <div className="admin-seo-search__issues">
          <p className="hu-caption">Missing or invalid API settings:</p>
          <ul>
            {view.configurationIssues.map((issue) => (
              <li key={issue}>
                <code>{issue}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <h3 className="admin-traffic__section-title">Search results</h3>
      {kpis ? (
        <>
          <ul
            className="admin-traffic__summary admin-seo-search__kpis"
            aria-label={`${name} totals`}
          >
            <li className="admin-traffic__card">
              <p className="admin-traffic__card-label">Clicks</p>
              <p className="admin-traffic__card-value">{formatSearchCount(kpis.clicks)}</p>
            </li>
            <li className="admin-traffic__card admin-traffic__card--alt">
              <p className="admin-traffic__card-label">Impressions</p>
              <p className="admin-traffic__card-value">{formatSearchCount(kpis.impressions)}</p>
            </li>
            <li className="admin-traffic__card">
              <p className="admin-traffic__card-label">CTR</p>
              <p className="admin-traffic__card-value">{formatSearchCtr(kpis.ctr)}</p>
              <p className="hu-caption">
                {kpis.ctrSource === "provider"
                  ? `Reported by ${name}`
                  : kpis.ctrSource === "calculated"
                    ? "Calculated: clicks ÷ impressions"
                    : "No impressions in this period"}
              </p>
            </li>
            <li className="admin-traffic__card admin-traffic__card--alt">
              <p className="admin-traffic__card-label">Average position</p>
              <p className="admin-traffic__card-value">{formatSearchPosition(kpis.position)}</p>
              {kpis.positionNote ? <p className="hu-caption">{kpis.positionNote}</p> : null}
            </li>
          </ul>
          <p className="hu-caption admin-panel__note">
            {formatSearchDayRange(kpis.startDay, kpis.endDay)} ·{" "}
            {kpis.source === "provider"
              ? "Totals reported by Google for finalized days."
              : `Sum of daily values reported by ${name}; ${kpis.availableDays} of ${kpis.expectedDays} days have data.`}
          </p>
          {view.previous && view.previous.availableDays > 0 ? (
            <p className="hu-caption admin-panel__note">
              Previous period ({formatSearchDayRange(view.previous.startDay, view.previous.endDay)}
              ): {formatSearchCount(view.previous.clicks)} clicks ·{" "}
              {formatSearchCount(view.previous.impressions)} impressions ·{" "}
              {view.previous.availableDays} of {view.previous.expectedDays} days have data.
            </p>
          ) : null}
        </>
      ) : (
        <p className="hu-body">{NO_DATA_LABEL} for this period.</p>
      )}

      <h3 className="admin-traffic__section-title">Daily trend</h3>
      <div className="admin-seo-search__charts">
        <div>
          <p className="admin-seo-search__chart-title">Clicks</p>
          <SearchPerformanceTrendChart
            title={`${name} clicks`}
            points={buildSearchTrendPoints(view.series, "clicks")}
            color={CLICKS_COLOR}
            emptyMessage={`${NO_DATA_LABEL}.`}
          />
        </div>
        <div>
          <p className="admin-seo-search__chart-title">Impressions</p>
          <SearchPerformanceTrendChart
            title={`${name} impressions`}
            points={buildSearchTrendPoints(view.series, "impressions")}
            color={IMPRESSIONS_COLOR}
            emptyMessage={`${NO_DATA_LABEL}.`}
          />
        </div>
      </div>

      <TopRowsTable
        title="Top queries"
        keyLabel="Query"
        providerName={name}
        snapshot={view.topQueries}
      />
      <TopRowsTable
        title="Top pages"
        keyLabel="Page"
        providerName={name}
        snapshot={view.topPages}
      />

      <h3 className="admin-traffic__section-title">Indexing and crawl</h3>
      {view.provider === "google" ? <GoogleSitemaps view={view} /> : <BingCrawl view={view} />}

      {view.unavailableMetrics.length > 0 ? (
        <>
          <h3 className="admin-traffic__section-title">Not available from {name}</h3>
          <ul className="admin-seo-search__unsupported">
            {view.unavailableMetrics.map((code) => (
              <li key={code}>{describeUnsupportedMetric(code)}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function TopRowsTable({
  title,
  keyLabel,
  providerName,
  snapshot,
}: {
  title: string;
  keyLabel: string;
  providerName: string;
  snapshot: SearchTopRowsSnapshot | null;
}) {
  return (
    <>
      <h3 className="admin-traffic__section-title">{title}</h3>
      {!snapshot || snapshot.rows.length === 0 ? (
        <p className="hu-body">{NO_DATA_LABEL}.</p>
      ) : (
        <>
          <p className="hu-caption admin-panel__note">
            {formatSearchDayRange(snapshot.startDay, snapshot.endDay)} ·{" "}
            {snapshot.metricsSource === "provider"
              ? `CTR and position reported by ${providerName}.`
              : `Combined from ${providerName} rows: CTR = clicks ÷ impressions, position weighted by impressions.`}
          </p>
          <div
            className="admin-traffic__table-wrap admin-seo-search__table-scroll"
            role="region"
            aria-label={`${providerName} ${title.toLowerCase()}`}
            tabIndex={0}
          >
            <table className="admin-traffic__table">
              <caption className="hu-visually-hidden">
                {providerName} {title.toLowerCase()}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{keyLabel}</th>
                  <th scope="col">Clicks</th>
                  <th scope="col">Impressions</th>
                  <th scope="col">CTR</th>
                  <th scope="col">Position</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.rows.map((row) => (
                  <tr key={row.key}>
                    <td className="admin-seo-search__key">{row.key}</td>
                    <td>{formatSearchCount(row.clicks)}</td>
                    <td>{formatSearchCount(row.impressions)}</td>
                    <td>{formatSearchCtr(row.ctr)}</td>
                    <td>{formatSearchPosition(row.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function GoogleSitemaps({ view }: { view: AdminSearchProviderView }) {
  const sitemaps = view.googleSitemaps;
  return (
    <>
      {!sitemaps || sitemaps.length === 0 ? (
        <p className="hu-body">{NO_DATA_LABEL}: no sitemap status collected.</p>
      ) : (
        <div className="admin-traffic__table-wrap">
          <table className="admin-traffic__table">
            <caption className="hu-visually-hidden">Google sitemap status</caption>
            <thead>
              <tr>
                <th scope="col">Sitemap</th>
                <th scope="col">Status</th>
                <th scope="col">Last downloaded</th>
                <th scope="col">Submitted URLs</th>
                <th scope="col">Errors</th>
                <th scope="col">Warnings</th>
              </tr>
            </thead>
            <tbody>
              {sitemaps.map((sitemap) => (
                <tr key={sitemap.path}>
                  <td className="admin-seo-search__key">{sitemap.path}</td>
                  <td>{sitemap.isPending ? "Pending" : "Processed"}</td>
                  <td>{formatSearchDateTime(sitemap.lastDownloaded)}</td>
                  <td>{formatSearchCount(sitemap.submittedUrls)}</td>
                  <td>{formatSearchCount(sitemap.errors)}</td>
                  <td>{formatSearchCount(sitemap.warnings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="hu-caption admin-panel__note">
        Google&apos;s API reports sitemap processing only; it has no site-wide indexed page count.
      </p>
    </>
  );
}

function BingCrawl({ view }: { view: AdminSearchProviderView }) {
  const latest = latestBingCrawlDay(view);
  if (!latest) {
    return <p className="hu-body">{NO_DATA_LABEL}: no crawl statistics collected.</p>;
  }
  const facts: ReadonlyArray<[string, number | null]> = [
    ["Pages in index", latest.inIndex],
    ["Crawled pages", latest.crawledPages],
    ["Crawl errors", latest.crawlErrors],
    ["Blocked by robots.txt", latest.blockedByRobotsTxt],
    ["4xx responses", latest.code4xx],
    ["5xx responses", latest.code5xx],
  ];
  return (
    <>
      <ul
        className="admin-traffic__summary admin-seo-search__crawl"
        aria-label="Bing crawl statistics"
      >
        {facts.map(([label, value], index) => (
          <li
            key={label}
            className={
              index % 2 ? "admin-traffic__card admin-traffic__card--alt" : "admin-traffic__card"
            }
          >
            <p className="admin-traffic__card-label">{label}</p>
            <p className="admin-traffic__card-value">{formatSearchCount(value)}</p>
          </li>
        ))}
      </ul>
      <p className="hu-caption admin-panel__note">
        Reported by Bing for {formatSearchDay(latest.day)}.
      </p>
    </>
  );
}

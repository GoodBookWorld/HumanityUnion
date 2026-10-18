"use client";

import { useEffect, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  fetchAdminWebMemorySnapshot,
  fetchAdminWebSystemHealthEvents,
  formatByteCount,
  formatInstanceId,
  formatPressure,
  formatUptime,
  type AdminWebMemorySnapshot,
  type AdminWebMemorySnapshotView,
  type AdminWebSystemHealthEvent,
  type AdminWebSystemHealthEventList,
} from "../admin-system-health-api";

import "./admin-system-health.css";

export function AdminWebMemoryCriticalLoads() {
  const [snapshot, setSnapshot] = useState<AdminWebMemorySnapshotView | null>(null);
  const [events, setEvents] = useState<AdminWebSystemHealthEventList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void loadSystemHealth()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setSnapshot(result.snapshot);
        setEvents(result.events);
        setError(result.error);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRefresh() {
    setLoading(true);
    const result = await loadSystemHealth();
    setSnapshot(result.snapshot);
    setEvents(result.events);
    setError(result.error);
    setLoading(false);
  }

  const reading = snapshot?.available ? snapshot.snapshot : null;

  return (
    <ProfileSection id="web-memory-critical-loads" title="Web Memory & Critical Loads">
      <div className="admin-system-health">
      <p className="hu-body admin-system-health__intro">
        This block reads the current Web process and critical Web events. Platform Health and
        Services describe API health. Event Infrastructure describes Outbox status.
      </p>

      <div className="admin-system-health__toolbar">
        <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleRefresh()}>
          {loading ? "Loading…" : "Refresh Web memory"}
        </Button>
      </div>

      {error ? <StatusBanner title="Web memory unavailable" message={error} /> : null}

      <h3 className="admin-system-health__subhead">Current Web process</h3>
        {loading && !snapshot ? <p className="hu-body">Loading the current Web process…</p> : null}
        <dl className="admin-system-health__facts">
          <Fact label="RSS" value={reading ? formatByteCount(reading.rss) : "UNKNOWN"} />
          <Fact label="Heap used" value={reading ? formatByteCount(reading.heapUsed) : "UNKNOWN"} />
          <Fact label="Heap total" value={reading ? formatByteCount(reading.heapTotal) : "UNKNOWN"} />
          <Fact label="External" value={reading ? formatByteCount(reading.external) : "UNKNOWN"} />
          <Fact label="Configured memory limit" value={formatLimit(reading)} />
          <Fact label="Pressure" value={reading ? formatPressure(reading.pressure) : "UNKNOWN"} />
          <Fact label="Uptime" value={reading ? formatUptime(reading.uptimeSeconds) : "UNKNOWN"} />
          <Fact label="Process started" value={reading?.processStartedAt ?? "UNKNOWN"} />
          <Fact label="Render instance id" value={formatInstanceId(reading?.instanceId)} />
          <Fact label="Process id" value={reading ? String(reading.pid) : "UNKNOWN"} />
          <Fact label="Render termination reason" value="UNKNOWN" />
        </dl>
        <p className="hu-caption admin-system-health__note">
          {snapshotUnavailableNote(snapshot)} Memory pressure stays UNKNOWN until a limit is
          configured on the Web service. This reading does not assume a hosting plan size, and it
          does not change the Platform Health status above.
        </p>

      <h3 className="admin-system-health__subhead">How to read an event</h3>
        <div className="admin-system-health__explanations">
          <Explanation
            title="Confirmed failure"
            text="A sitemap provider failed and that provider’s URLs were omitted. The event names the provider. It does not include the exception text, a URL, or a request."
          />
          <Explanation
            title="Memory threshold"
            text="RSS at a sitemap sample was at least 90% of the configured limit. A threshold crossing is a measurement. It is not evidence that Render stopped the process, and it is not recorded when the limit is UNKNOWN."
          />
          <Explanation
            title="Correlated operation"
            text="Each event names the operation that was running, currently a sitemap build. The name says the sample or failure happened during that operation. It does not prove the operation caused a restart."
          />
          <Explanation
            title="Unknown cause"
            text="Render’s termination reason is UNKNOWN. A missing event does not prove a build did not run. Logs can be lost if the process is killed before the write finishes."
          />
        </div>

      <h3 className="admin-system-health__subhead">Critical events</h3>
        <p className="hu-caption admin-system-health__note">
          Showing the latest {events?.maxEvents ?? 100} critical events from the last{" "}
          {events?.retentionDays ?? 7} days. Healthy sitemap builds are not stored.
        </p>
        {loading && !events ? <p className="hu-body">Loading critical events…</p> : null}
        {events && events.events.length === 0 ? (
          <p className="hu-body">No critical events in the retention window.</p>
        ) : null}
        <div className="admin-system-health__events">
          {events?.events.map((event) => (
            <EventCard key={event.eventId} event={event} />
          ))}
        </div>
      </div>
    </ProfileSection>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-system-health__fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Explanation({ title, text }: { title: string; text: string }) {
  return (
    <section className="admin-system-health__explanation">
      <h3>{title}</h3>
      <p className="hu-body">{text}</p>
    </section>
  );
}

function EventCard({ event }: { event: AdminWebSystemHealthEvent }) {
  const failure = event.eventTypes.includes("sitemap_failure");
  const threshold = event.eventTypes.includes("memory_threshold");
  return (
    <article className="admin-system-health__event">
      <header>
        <h3>{formatEventTitle(failure, threshold)}</h3>
        <p className="hu-caption">{event.occurredAt}</p>
      </header>
      <dl>
        <div>
          <dt>Correlated operation</dt>
          <dd>sitemap build</dd>
        </div>
        <div>
          <dt>Confirmed failure</dt>
          <dd>{failure ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Memory threshold</dt>
          <dd>{threshold ? "Crossed" : "Not crossed"}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{event.durationMs === null ? "UNKNOWN" : `${event.durationMs} ms`}</dd>
        </div>
        <div>
          <dt>Failed providers</dt>
          <dd>{event.failedProviderIds.length > 0 ? event.failedProviderIds.join(", ") : "None"}</dd>
        </div>
        <div>
          <dt>Partial providers</dt>
          <dd>{event.partialProviderIds.length > 0 ? event.partialProviderIds.join(", ") : "None"}</dd>
        </div>
        <div>
          <dt>Canonical paths</dt>
          <dd>{event.counts.canonicalPathCount}</dd>
        </div>
        <div>
          <dt>SEO locales</dt>
          <dd>{event.counts.seoLocaleCount}</dd>
        </div>
        <div>
          <dt>Entity resolves</dt>
          <dd>{event.counts.entityResolveCount}</dd>
        </div>
        <div>
          <dt>Overlapping builds</dt>
          <dd>{event.counts.overlappingSitemapBuilds}</dd>
        </div>
        <div>
          <dt>RSS</dt>
          <dd>{formatByteCount(event.memory.rss)}</dd>
        </div>
        <div>
          <dt>Pressure</dt>
          <dd>{formatPressure(event.memory.pressure)}</dd>
        </div>
        <div>
          <dt>Limit</dt>
          <dd>{event.memory.limitBytes === null ? "UNKNOWN" : formatByteCount(event.memory.limitBytes)}</dd>
        </div>
        <div>
          <dt>Instance id</dt>
          <dd>{formatInstanceId(event.instanceId)}</dd>
        </div>
        <div>
          <dt>Render termination reason</dt>
          <dd>UNKNOWN</dd>
        </div>
        <PhaseFact label="RSS at start" phase={event.phases.start} />
        <PhaseFact label="RSS after inventory" phase={event.phases.afterInventory} />
        <PhaseFact label="RSS after eligibility" phase={event.phases.afterEligibility} />
      </dl>
    </article>
  );
}

function PhaseFact({
  label,
  phase,
}: {
  label: string;
  phase: AdminWebSystemHealthEvent["phases"]["start"];
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{phase ? formatByteCount(phase.rss) : "Not sampled"}</dd>
    </div>
  );
}

function formatEventTitle(failure: boolean, threshold: boolean): string {
  if (failure && threshold) {
    return "Sitemap failure and memory threshold";
  }
  if (failure) {
    return "Sitemap failure";
  }
  if (threshold) {
    return "Memory threshold";
  }
  return "Critical event";
}

function formatLimit(reading: AdminWebMemorySnapshot | null): string {
  if (!reading || reading.limitBytes === null) {
    return "UNKNOWN";
  }
  return formatByteCount(reading.limitBytes);
}

function snapshotUnavailableNote(snapshot: AdminWebMemorySnapshotView | null): string {
  if (!snapshot || snapshot.available) {
    return "The figures are from this Web process at the moment the page loaded.";
  }
  if (snapshot.unavailableReason === "NOT_CONFIGURED") {
    return "The current Web process reading is UNKNOWN because the internal reading bridge is not configured.";
  }
  return "The current Web process reading is UNKNOWN because the Web process did not return a reading.";
}

async function loadSystemHealth(): Promise<{
  snapshot: AdminWebMemorySnapshotView | null;
  events: AdminWebSystemHealthEventList | null;
  error: string | null;
}> {
  const [snapshotResult, eventsResult] = await Promise.allSettled([
    fetchAdminWebMemorySnapshot(),
    fetchAdminWebSystemHealthEvents(),
  ]);
  const errors = [snapshotResult, eventsResult]
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => formatAuthFormError(result.reason));
  return {
    snapshot: snapshotResult.status === "fulfilled" ? snapshotResult.value : null,
    events: eventsResult.status === "fulfilled" ? eventsResult.value : null,
    error: errors[0] ?? null,
  };
}

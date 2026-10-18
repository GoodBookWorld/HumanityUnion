/**
 * HU-MEM-04B — Web memory snapshot, sitemap diagnostics, and admin page contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { dedupeSitemapPathEntries } from "./sitemap/dedupe-sitemap-entries";
import { expandPublicSitemapEntriesForSeoLocales } from "./sitemap/expand-public-sitemap-for-seo-locales";
import {
  buildPublicSitemap,
  collectPublicSitemapPathEntries,
  toMetadataRouteSitemap,
} from "./sitemap/build-public-sitemap";
import { listCountrySitemapEntries } from "./sitemap/providers/countries";
import { listStaticPublicSitemapEntries } from "./sitemap/providers/static-public-pages";
import { countSitemapEntityResolves } from "../system-health/sitemap-entity-resolve-count";
import { resetSitemapBuildOverlapForTests } from "../system-health/sitemap-build-diagnostic";
import {
  readWebProcessMemorySnapshot,
  resolveWebMemoryPressure,
} from "../system-health/web-process-memory";
import { GET as readInternalSnapshot } from "../../app/api/internal/system-health/snapshot/route";
import { GET as readPublicWebHealth } from "../../app/health/route";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TOKEN = "web-system-health-test-token-0123456789";
const SECRET_URL = "https://user:secret@evil.example/private?token=abc&id=42";

function read(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function envelope(data: unknown): Response {
  return Response.json({
    success: true,
    data,
    meta: {},
    links: {},
    message: "",
  });
}

describe("HU-MEM-04B web process memory", () => {
  it("keeps pressure UNKNOWN until a limit is explicitly configured", () => {
    const unknown = readWebProcessMemorySnapshot(
      {} as NodeJS.ProcessEnv,
      { rss: 400_000_000, heapUsed: 1, heapTotal: 2, external: 3, arrayBuffers: 0 },
      Date.parse("2026-10-18T00:00:00.000Z"),
      90,
      44,
    );
    assert.equal(unknown.limitBytes, null);
    assert.equal(unknown.pressure, "unknown");
    assert.equal(unknown.instanceId, null);
    assert.equal(unknown.pid, 44);
    assert.equal(unknown.rss, 400_000_000);
    assert.equal(unknown.uptimeSeconds, 90);
    assert.equal(unknown.processStartedAt, "2026-10-17T23:58:30.000Z");

    const below = readWebProcessMemorySnapshot(
      { WEB_PROCESS_MEMORY_LIMIT_BYTES: "1000", RENDER_INSTANCE_ID: "srv-web-1" } as unknown as NodeJS.ProcessEnv,
      { rss: 100, heapUsed: 1, heapTotal: 2, external: 3, arrayBuffers: 0 },
    );
    assert.equal(below.limitBytes, 1000);
    assert.equal(below.pressure, "below");
    assert.equal(below.instanceId, "srv-web-1");

    const critical = readWebProcessMemorySnapshot(
      { WEB_PROCESS_MEMORY_LIMIT_BYTES: "1000" } as unknown as NodeJS.ProcessEnv,
      { rss: 900, heapUsed: 1, heapTotal: 2, external: 3, arrayBuffers: 0 },
    );
    assert.equal(critical.pressure, "critical");
    assert.equal(resolveWebMemoryPressure(899, 1000), "below");
    assert.equal(
      readWebProcessMemorySnapshot({ WEB_PROCESS_MEMORY_LIMIT_BYTES: "512mb" } as unknown as NodeJS.ProcessEnv).pressure,
      "unknown",
    );
    assert.equal(
      readWebProcessMemorySnapshot({ RENDER_INSTANCE_ID: "https://render.example/id" } as unknown as NodeJS.ProcessEnv).instanceId,
      null,
    );

    const source = read("lib/system-health/web-process-memory.ts");
    assert.doesNotMatch(source, /512\s*\*\s*1024|536870912|512mb/i);
  });

  it("returns the snapshot only when the internal token matches", async () => {
    const previous = process.env.WEB_SYSTEM_HEALTH_TOKEN;
    delete process.env.WEB_SYSTEM_HEALTH_TOKEN;
    try {
      const closed = await readInternalSnapshot(new Request("http://web.local/snapshot"));
      assert.equal(closed.status, 404);
      assert.equal(await closed.text(), "");

      process.env.WEB_SYSTEM_HEALTH_TOKEN = TOKEN;
      const denied = await readInternalSnapshot(
        new Request("http://web.local/snapshot", {
          headers: { "x-hu-system-health-token": "wrong-token-value-0123456789abcd" },
        }),
      );
      assert.equal(denied.status, 401);
      assert.equal(await denied.text(), "");

      const allowed = await readInternalSnapshot(
        new Request("http://web.local/snapshot", {
          headers: { "x-hu-system-health-token": TOKEN },
        }),
      );
      assert.equal(allowed.status, 200);
      const body = (await allowed.json()) as { rss: number; pressure: string; limitBytes: number | null };
      assert.equal(typeof body.rss, "number");
      assert.equal(body.limitBytes, null);
      assert.equal(JSON.stringify(body).includes("cookie"), false);
    } finally {
      if (previous === undefined) delete process.env.WEB_SYSTEM_HEALTH_TOKEN;
      else process.env.WEB_SYSTEM_HEALTH_TOKEN = previous;
    }
  });

  it("leaves the public web health route redacted", async () => {
    const response = await readPublicWebHealth();
    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ["service", "status", "timestamp"]);
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes("rss"), false);
    assert.equal(serialized.includes("heap"), false);
    assert.doesNotMatch(read("app/health/route.ts"), /system-health|memoryUsage|heapUsed/);
  });
});

describe("HU-MEM-04B sitemap diagnostics", () => {
  it("counts entity resolves without calling the eligibility loader", () => {
    assert.equal(
      countSitemapEntityResolves(
        ["/blog/hello", "/initiatives/public/init-1", "/knowledge/guide", "/"],
        ["en", "uk", " uk "],
      ),
      4,
    );
    assert.equal(countSitemapEntityResolves(["/contact"], ["en", "uk"]), 0);
  });

  it("preserves urls, order, lastModified, locale prefixes, and fail-closed omission", async () => {
    const previousMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
    const previousFetch = globalThis.fetch;
    const previousLog = console.log;
    const logs: string[] = [];
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://huws.org";
    delete process.env.WEB_SYSTEM_HEALTH_TOKEN;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/public/blog?")) {
        return envelope({
          items: [{ slug: "hello", publishedAt: "2026-01-02T00:00:00.000Z" }],
          total: 1,
          totalPages: 1,
          pageSize: 100,
        });
      }
      if (url.includes("/api/v1/public/sitemap/initiatives")) {
        return envelope({
          entries: [{ initiativeId: "init-1", updatedAt: "2026-03-04T00:00:00.000Z" }],
        });
      }
      if (url.includes("/api/v1/public/knowledge")) {
        return envelope({
          categories: [{ articles: [{ slug: "guide", updatedAt: "2026-05-06T00:00:00.000Z" }] }],
        });
      }
      if (url.includes("/api/v1/public/civic-archive")) {
        return Response.json({
          success: true,
          data: [{ initiativeId: "init-9", archivedAt: "2026-07-08T00:00:00.000Z" }],
          meta: { total: 1 },
        });
      }
      if (url.includes("/api/v1/public/sitemap/participant-profiles")) {
        return envelope({
          entries: [{ publicName: "ada", updatedAt: "2026-09-10T00:00:00.000Z" }],
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    try {
      const locales = ["en", "uk"] as const;
      const entries = await collectPublicSitemapPathEntries({ seoIndexableLocales: locales });
      const expected = expandPublicSitemapEntriesForSeoLocales({
        entries: dedupeSitemapPathEntries([
          ...listStaticPublicSitemapEntries(),
          ...listCountrySitemapEntries(),
          { path: "/blog/hello", lastModified: "2026-01-02T00:00:00.000Z" },
          { path: "/initiatives/public/init-1", lastModified: "2026-03-04T00:00:00.000Z" },
          { path: "/knowledge/guide", lastModified: "2026-05-06T00:00:00.000Z" },
          { path: "/civic-archive/init-9", lastModified: "2026-07-08T00:00:00.000Z" },
          { path: "/member/ada", lastModified: "2026-09-10T00:00:00.000Z" },
        ]),
        seoIndexableLocales: locales,
      });
      assert.deepEqual(
        entries.map((entry) => ({ path: entry.path, lastModified: entry.lastModified ?? null })),
        expected.map((entry) => ({ path: entry.path, lastModified: entry.lastModified ?? null })),
      );
      assert.ok(entries.some((entry) => entry.path === "/uk/blog/hello"));
      assert.equal(entries.some((entry) => entry.path.startsWith("/en/")), false);
      const blog = entries.find((entry) => entry.path === "/blog/hello");
      const localizedBlog = entries.find((entry) => entry.path === "/uk/blog/hello");
      assert.equal(blog?.lastModified, "2026-01-02T00:00:00.000Z");
      assert.equal(localizedBlog?.lastModified, "2026-01-02T00:00:00.000Z");

      const metadata = toMetadataRouteSitemap(entries, "https://huws.org");
      assert.equal(metadata.length, entries.length);
      assert.equal(metadata[0]?.url, "https://huws.org/");
      assert.equal(Object.hasOwn(metadata[0] ?? {}, "alternates"), false);
      assert.ok(metadata.some((entry) => entry.url === "https://huws.org/uk/blog/hello"));

      const again = await collectPublicSitemapPathEntries({ seoIndexableLocales: locales });
      assert.deepEqual(
        again.map((entry) => entry.path),
        entries.map((entry) => entry.path),
      );
    } finally {
      globalThis.fetch = previousFetch;
      console.log = previousLog;
      if (previousMode === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = previousMode;
      if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
    }

    assert.equal(logs.some((line) => line.includes(SECRET_URL)), false);
  });

  it("omits only the failed provider and does not log or store the exception", async () => {
    const previousMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
    const previousToken = process.env.WEB_SYSTEM_HEALTH_TOKEN;
    const previousLimit = process.env.WEB_PROCESS_MEMORY_LIMIT_BYTES;
    const previousFetch = globalThis.fetch;
    const previousLog = console.log;
    const previousError = console.error;
    const logs: string[] = [];
    const errors: string[] = [];
    let ingestBody = "";
    let releaseIngest: () => void = () => undefined;
    const ingestGate = new Promise<void>((resolve) => {
      releaseIngest = resolve;
    });

    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://huws.org";
    process.env.WEB_SYSTEM_HEALTH_TOKEN = TOKEN;
    delete process.env.WEB_PROCESS_MEMORY_LIMIT_BYTES;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v1/internal/system-health/events")) {
        ingestBody = String(init?.body ?? "");
        await ingestGate;
        throw new Error("database unavailable");
      }
      if (url.includes("/api/v1/public/blog?")) {
        throw new Error(SECRET_URL);
      }
      if (url.includes("/api/v1/public/sitemap/initiatives")) {
        return envelope({
          entries: [{ initiativeId: "init-1", updatedAt: "2026-03-04T00:00:00.000Z" }],
        });
      }
      if (url.includes("/api/v1/public/knowledge")) {
        return envelope({ categories: [] });
      }
      if (url.includes("/api/v1/public/civic-archive")) {
        return Response.json({ success: true, data: [], meta: { total: 0 } });
      }
      if (url.includes("/api/v1/public/sitemap/participant-profiles")) {
        return envelope({ entries: [] });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    try {
      const sitemap = await Promise.race([
        buildPublicSitemap({ seoIndexableLocales: [] }),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error("sitemap waited on event delivery")), 300);
        }),
      ]);
      assert.ok(sitemap.some((entry) => entry.url === "https://huws.org/initiatives/public/init-1"));
      assert.equal(sitemap.some((entry) => entry.url.includes("/blog/hello")), false);
      assert.equal(logs.some((line) => line.includes("blog-posts")), true);
      assert.equal(logs.some((line) => line.includes(SECRET_URL) || line.includes(TOKEN)), false);
      assert.equal(errors.some((line) => line.includes(SECRET_URL) || line.includes("evil.example")), false);
      assert.match(ingestBody, /blog-posts/);
      assert.equal(ingestBody.includes(SECRET_URL), false);
      assert.equal(ingestBody.includes(TOKEN), false);
      assert.equal(ingestBody.includes("userId"), false);
    } finally {
      releaseIngest();
      globalThis.fetch = previousFetch;
      console.log = previousLog;
      console.error = previousError;
      if (previousMode === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = previousMode;
      if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
      if (previousToken === undefined) delete process.env.WEB_SYSTEM_HEALTH_TOKEN;
      else process.env.WEB_SYSTEM_HEALTH_TOKEN = previousToken;
      if (previousLimit === undefined) delete process.env.WEB_PROCESS_MEMORY_LIMIT_BYTES;
      else process.env.WEB_PROCESS_MEMORY_LIMIT_BYTES = previousLimit;
    }
  });

  it("does not fetch or enable indexing when indexing is disallowed", async () => {
    const previousMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
    const previousFetch = globalThis.fetch;
    let fetches = 0;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example";
    globalThis.fetch = async () => {
      fetches += 1;
      throw new Error("indexing must stay disabled");
    };
    try {
      assert.deepEqual(await buildPublicSitemap(), []);
      assert.equal(fetches, 0);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousMode === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = previousMode;
      if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
    }
  });

  it("persists a memory threshold only when the configured limit is crossed", async () => {
    const previousMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const previousToken = process.env.WEB_SYSTEM_HEALTH_TOKEN;
    const previousLimit = process.env.WEB_PROCESS_MEMORY_LIMIT_BYTES;
    const previousFetch = globalThis.fetch;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    process.env.WEB_SYSTEM_HEALTH_TOKEN = TOKEN;
    resetSitemapBuildOverlapForTests();

    const bodies: string[] = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v1/internal/system-health/events")) {
        bodies.push(String(init?.body ?? ""));
        return new Response("{}", { status: 202 });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    try {
      delete process.env.WEB_PROCESS_MEMORY_LIMIT_BYTES;
      await collectPublicSitemapPathEntries({
        includeDynamicProviders: false,
        seoIndexableLocales: [],
      });
      assert.equal(bodies.length, 0);

      process.env.WEB_PROCESS_MEMORY_LIMIT_BYTES = "1";
      await collectPublicSitemapPathEntries({
        includeDynamicProviders: false,
        seoIndexableLocales: [],
      });
      assert.equal(bodies.length, 1);
      const event = JSON.parse(bodies[0] ?? "{}") as { eventTypes: string[]; memory: { pressure: string } };
      assert.deepEqual(event.eventTypes, ["memory_threshold"]);
      assert.equal(event.memory.pressure, "critical");
      assert.equal(JSON.stringify(event).includes("http"), false);
    } finally {
      globalThis.fetch = previousFetch;
      resetSitemapBuildOverlapForTests();
      if (previousMode === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = previousMode;
      if (previousToken === undefined) delete process.env.WEB_SYSTEM_HEALTH_TOKEN;
      else process.env.WEB_SYSTEM_HEALTH_TOKEN = previousToken;
      if (previousLimit === undefined) delete process.env.WEB_PROCESS_MEMORY_LIMIT_BYTES;
      else process.env.WEB_PROCESS_MEMORY_LIMIT_BYTES = previousLimit;
    }
  });

  it("does not add sitemap timers or continuous sampling", () => {
    const builder = read("lib/seo/sitemap/build-public-sitemap.ts");
    const diagnostic = read("lib/system-health/sitemap-build-diagnostic.ts");
    const page = read("features/administration/components/AdminSystemHealthSection.tsx");
    assert.doesNotMatch(builder, /setInterval|setTimeout|AbortSignal\.timeout|15000|15_000/);
    assert.doesNotMatch(diagnostic, /setInterval/);
    assert.match(diagnostic, /AbortSignal\.timeout\(INGEST_TIMEOUT_MS\)/);
    assert.doesNotMatch(page, /setInterval/);
    assert.match(page, /Web Memory & Critical Loads/);
    assert.match(page, /Refresh Web memory/);
    assert.match(page, /Render termination reason/);
    assert.match(page, /fetchAdminWebMemorySnapshot/);
    assert.match(page, /fetchAdminWebSystemHealthEvents/);
    assert.match(
      read("features/administration/components/AdminDiagnosticsSection.tsx"),
      /AdminWebMemoryCriticalLoads/,
    );
    assert.match(read("app/admin/diagnostics/page.tsx"), /AdminAccessGate/);
    assert.match(read("app/admin/system-health/page.tsx"), /permanentRedirect\("\/admin\/diagnostics#web-memory-critical-loads"\)/);
    assert.doesNotMatch(read("features/administration/admin-panel-sections.ts"), /\/admin\/system-health/);
    const diagnostics = read("features/administration/components/AdminDiagnosticsSection.tsx");
    const platform = diagnostics.indexOf('title="Platform Health"');
    const services = diagnostics.indexOf('title="Services"');
    const events = diagnostics.indexOf('title="Event Infrastructure"');
    const integrity = diagnostics.indexOf('title="Data Integrity"');
    const webMemory = diagnostics.indexOf("<AdminWebMemoryCriticalLoads");
    assert.ok(platform >= 0 && services > platform && events > services && integrity > events);
    assert.ok(webMemory > integrity);
    assert.doesNotMatch(diagnostics, /setInterval/);
  });
});

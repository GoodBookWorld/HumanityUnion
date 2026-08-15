/* PWA Experience Pack 01 — conservative service worker.
 * Static shell + offline fallback only. Never persistently cache private data.
 */
/* eslint-env serviceworker */

const SW_VERSION = "hu-pwa-v2";
const STATIC_CACHE = `${SW_VERSION}-static`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/brand/app-192.png",
  "/brand/app-512.png",
  "/brand/favicon.ico",
  "/brand/apple-touch-icon.png",
  "/icons/messenger/work-mob.svg",
  "/icons/messenger/init-mob.svg",
  "/icons/messenger/add-mob.svg",
  "/icons/messenger/not-mob.svg",
  "/icons/messenger/ai-mob.svg",
];

const PRIVATE_API_PREFIXES = [
  "/api/v1/auth",
  "/api/v1/direct-messages",
  "/api/v1/notifications",
  "/api/v1/reminders",
  "/api/v1/preferences",
  "/api/v1/workspace",
  "/api/v1/assistant",
  "/api/v1/member-profile",
  "/api/v1/member",
  "/api/v1/media",
  "/api/v1/blog",
  "/api/v1/shared-documents",
  "/api/v1/initiatives",
];

function isPrivateApiRequest(url, request) {
  if (request.headers.has("Authorization")) {
    return true;
  }

  const cookie = request.headers.get("Cookie") || "";
  if (cookie.includes("hu_access_token=") || cookie.includes("hu_refresh_token=")) {
    // Authenticated browser traffic — never put API responses in SW cache.
    if (url.pathname.startsWith("/api/")) {
      return true;
    }
  }

  return PRIVATE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/illustrations/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname === OFFLINE_URL
  );
}

self.addEventListener("install", (event) => {
  // Conservative update policy: do not skipWaiting. The new worker activates
  // after the previous controlling worker is released (typically next navigation
  // / app relaunch), avoiding disruptive reload loops.
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (isPrivateApiRequest(url, request)) {
    // Network only — no SW response caching for private/authenticated traffic.
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }

        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return cached || Response.error();
        }
      }),
    );
    return;
  }

  // Navigations: network-first with offline fallback document.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }),
    );
  }
});

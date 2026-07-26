import type { Request } from "express";

import type { ApproximateIpGeography } from "@hu/types";
import {
  getCountryLabel,
  getRegionLabel,
  normalizeCountryInput,
  normalizeRegionInput,
} from "@hu/geography";

const DEV_FIXTURE_ENV = "IP_GEOLOCATION_DEV_FIXTURE";

function parseDevFixture(value: string): ApproximateIpGeography | null {
  const trimmed = value.trim();

  if (!trimmed || trimmed.toLowerCase() === "world") {
    return { source: "dev_fixture" };
  }

  const parts = trimmed.split("::").map((part) => part.trim());

  if (parts.length === 1 && parts[0]) {
    const countryCode = normalizeCountryInput(parts[0]);

    if (!countryCode) {
      return null;
    }

    return {
      countryCode,
      countryName: getCountryLabel(countryCode),
      source: "dev_fixture",
    };
  }

  if (parts.length >= 2 && parts[0] && parts[1]) {
    const countryCode = normalizeCountryInput(parts[0]);
    const regionCode = countryCode ? normalizeRegionInput(countryCode, parts[1]) : undefined;

    if (!countryCode || !regionCode) {
      return null;
    }

    return {
      countryCode,
      countryName: getCountryLabel(countryCode),
      regionCode,
      regionName: getRegionLabel(countryCode, regionCode),
      cityName: parts[2]?.trim() || undefined,
      source: "dev_fixture",
    };
  }

  return null;
}

function readHeaderValue(headers: Request["headers"], name: string): string | undefined {
  const value = headers[name];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value) && value[0]?.trim()) {
    return value[0].trim();
  }

  return undefined;
}

function resolveClientIp(req: Request): string | undefined {
  const forwarded = readHeaderValue(req.headers, "x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim();
  }

  return req.ip;
}

function isLocalAddress(ip: string | undefined): boolean {
  if (!ip) {
    return true;
  }

  const normalized = ip.replace("::ffff:", "");

  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.startsWith("127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

function resolveFromHostingHeaders(req: Request): ApproximateIpGeography | null {
  const countryCodeRaw =
    readHeaderValue(req.headers, "cf-ipcountry") ??
    readHeaderValue(req.headers, "x-vercel-ip-country") ??
    readHeaderValue(req.headers, "cloudfront-viewer-country");

  if (!countryCodeRaw) {
    return null;
  }

  const countryCode = normalizeCountryInput(countryCodeRaw);

  if (!countryCode) {
    return null;
  }

  const regionRaw =
    readHeaderValue(req.headers, "cf-region-code") ??
    readHeaderValue(req.headers, "x-vercel-ip-country-region") ??
    readHeaderValue(req.headers, "cloudfront-viewer-country-region");

  const cityName =
    readHeaderValue(req.headers, "cf-ipcity") ??
    readHeaderValue(req.headers, "x-vercel-ip-city") ??
    readHeaderValue(req.headers, "cloudfront-viewer-city");

  const regionCode = regionRaw ? normalizeRegionInput(countryCode, regionRaw) : undefined;

  return {
    countryCode,
    countryName: getCountryLabel(countryCode),
    regionCode,
    regionName: regionCode ? getRegionLabel(countryCode, regionCode) : regionRaw,
    cityName,
    source: "hosting_header",
  };
}

export function resolveApproximateIpGeography(req: Request): ApproximateIpGeography {
  const devFixture = process.env[DEV_FIXTURE_ENV];

  if (devFixture) {
    const parsed = parseDevFixture(devFixture);

    if (parsed) {
      return parsed;
    }
  }

  const hostingResult = resolveFromHostingHeaders(req);

  if (hostingResult) {
    return hostingResult;
  }

  const clientIp = resolveClientIp(req);

  if (isLocalAddress(clientIp)) {
    return { source: "unavailable" };
  }

  return { source: "unavailable" };
}

export function resetApproximateIpGeographyForTests(): void {
  delete process.env[DEV_FIXTURE_ENV];
}

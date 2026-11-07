import type { MediaResource, NewsArticleRecord, PublicNewsArticleItem } from "@hu/types";
import {
  getMediaRegistryProviderById,
  resolveMediaCarouselPrioritySource,
  TRUSTED_GLOBAL_MEDIA_REGISTRY,
} from "@hu/media-registry";

import { listMediaResources } from "../media-resources/persistence/media-resource.repository.js";
import { sanitizePublicLogoUrl } from "./public-news-logo-url.js";
import { isUrlOnApprovedDomains, resolveSourceArticleDomains } from "./public-news-source-trust.js";
import { normalizeArticleUrl } from "./public-news.normalize.js";
import { findPublicNewsCarouselCandidates } from "./public-news.repository.js";

/**
 * MEDIA-NEWS-01B — the /media news carousel selection (also the Media PLP prebuild
 * selection) and publisher logo resolution for public news items.
 */

/** At most this many articles per priority publisher. */
export const MEDIA_CAROUSEL_MAX_PER_PRIORITY_SOURCE = 2;
/**
 * Newest articles fetched per source: enough for one source to fill every slot in
 * Pass 3 (other sources are uncapped), with a floor that leaves spares for duplicates.
 */
function candidatesPerSource(limit: number): number {
  return Math.max(limit, 3);
}

function hostOf(url: string | null | undefined): string | null {
  try {
    return url ? new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/**
 * Maps articles to active NEWS_SOURCE resources: by MediaResource id, or (legacy
 * articles without one) by exact name only when the article URL is also on that
 * resource's approved domains, so a shared display name cannot admit another source.
 */
export class ActiveNewsSourceIndex {
  private readonly byId = new Map<string, MediaResource>();
  private readonly byName = new Map<string, MediaResource[]>();

  constructor(resources: readonly MediaResource[]) {
    const active = resources
      .filter((resource) => resource.resourceType === "NEWS_SOURCE" && resource.active)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
    for (const resource of active) {
      this.byId.set(resource.id, resource);
      this.byName.set(resource.name, [...(this.byName.get(resource.name) ?? []), resource]);
    }
  }

  resolve(record: Pick<NewsArticleRecord, "mediaResourceId" | "sourceName" | "articleUrl">) {
    if (record.mediaResourceId) {
      return this.byId.get(record.mediaResourceId) ?? null;
    }
    return (
      (this.byName.get(record.sourceName) ?? []).find((resource) =>
        isUrlOnApprovedDomains(record.articleUrl, resolveSourceArticleDomains(resource)),
      ) ?? null
    );
  }
}

interface CarouselEntry {
  record: NewsArticleRecord;
  resource: MediaResource;
  /** Priority publisher key (any scope): Passes 1–2 and the per-publisher cap. */
  publisherKey: string | null;
  priorityRank: number | null;
  normalizedUrl: string;
}

function normalizedUrlOf(record: NewsArticleRecord): string {
  if (record.normalizedArticleUrl) {
    return record.normalizedArticleUrl;
  }
  try {
    return normalizeArticleUrl(record.articleUrl).normalizedArticleUrl;
  } catch {
    return record.articleUrl.trim().toLowerCase();
  }
}

function compareEntries(left: CarouselEntry, right: CarouselEntry): number {
  return (
    right.record.publishedAt.localeCompare(left.record.publishedAt) ||
    (left.priorityRank ?? Number.MAX_SAFE_INTEGER) -
      (right.priorityRank ?? Number.MAX_SAFE_INTEGER) ||
    left.record.id.localeCompare(right.record.id)
  );
}

function groupBy(entries: readonly CarouselEntry[], key: (entry: CarouselEntry) => string) {
  const groups = new Map<string, CarouselEntry[]>();
  for (const entry of entries) {
    groups.set(key(entry), [...(groups.get(key(entry)) ?? []), entry]);
  }
  return [...groups.values()];
}

/**
 * Pass 1: newest article of each available priority publisher (WORLD or COUNTRY scope).
 * Pass 2: a second article per priority publisher.
 * Pass 3: other active sources (other COUNTRY sources only here), round-robin, newest first.
 * Deduplicated by id and normalized URL; at most two per priority publisher; the
 * result is sorted newest-first (ties: list order, then id) for display.
 */
export function selectMediaCarouselArticles(input: {
  candidates: readonly NewsArticleRecord[];
  index: ActiveNewsSourceIndex;
  limit: number;
}): NewsArticleRecord[] {
  const entries: CarouselEntry[] = [];
  for (const record of input.candidates) {
    const resource = input.index.resolve(record);
    if (!resource) {
      continue;
    }
    const publisher = resolveMediaCarouselPrioritySource(resource.websiteUrl);
    entries.push({
      record,
      resource,
      publisherKey: publisher?.source.key ?? null,
      priorityRank: publisher?.rank ?? null,
      normalizedUrl: normalizedUrlOf(record),
    });
  }
  entries.sort(compareEntries);

  const selected: CarouselEntry[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const perPublisher = new Map<string, number>();
  const canTake = (entry: CarouselEntry) =>
    !seenIds.has(entry.record.id) &&
    !seenUrls.has(entry.normalizedUrl) &&
    (!entry.publisherKey ||
      (perPublisher.get(entry.publisherKey) ?? 0) < MEDIA_CAROUSEL_MAX_PER_PRIORITY_SOURCE);
  const take = (entry: CarouselEntry) => {
    selected.push(entry);
    seenIds.add(entry.record.id);
    seenUrls.add(entry.normalizedUrl);
    if (entry.publisherKey) {
      perPublisher.set(entry.publisherKey, (perPublisher.get(entry.publisherKey) ?? 0) + 1);
    }
  };
  const runRound = (
    groups: CarouselEntry[][],
    takenFrom: Map<CarouselEntry[], number>,
    round: number,
  ) => {
    const picks: CarouselEntry[] = [];
    for (const group of groups) {
      if ((takenFrom.get(group) ?? 0) !== round) {
        continue;
      }
      const next = group.find(canTake);
      if (next) {
        picks.push(next);
      }
    }
    let progressed = false;
    for (const entry of picks.sort(compareEntries)) {
      if (selected.length >= input.limit || !canTake(entry)) {
        continue;
      }
      take(entry);
      const group = groups.find((candidate) => candidate.includes(entry))!;
      takenFrom.set(group, (takenFrom.get(group) ?? 0) + 1);
      progressed = true;
    }
    return progressed;
  };

  const priorityGroups = groupBy(
    entries.filter((entry) => entry.priorityRank !== null),
    (entry) => entry.publisherKey!,
  );
  const priorityTaken = new Map<CarouselEntry[], number>();
  for (const round of [0, 1]) {
    runRound(priorityGroups, priorityTaken, round);
  }

  const otherGroups = groupBy(
    entries.filter((entry) => entry.priorityRank === null),
    (entry) => entry.resource.id,
  );
  const otherTaken = new Map<CarouselEntry[], number>();
  for (let round = 0; selected.length < input.limit; round += 1) {
    if (!runRound(otherGroups, otherTaken, round)) {
      break;
    }
  }

  return selected.sort(compareEntries).map((entry) => entry.record);
}

/** Shared by GET /public/news?carousel=media and the Media PLP prebuild selection. */
export async function selectMediaCarouselNewsRecords(input: {
  limit: number;
  language: string;
  now?: string;
  /** Active resources already loaded by the caller (avoids a second query). */
  resources?: readonly MediaResource[];
}): Promise<NewsArticleRecord[]> {
  const resources =
    input.resources ?? (await listMediaResources({ resourceType: "NEWS_SOURCE", active: true }));
  const candidates = await findPublicNewsCarouselCandidates({
    language: input.language,
    perSource: candidatesPerSource(input.limit),
    now: input.now,
  });
  return selectMediaCarouselArticles({
    candidates,
    index: new ActiveNewsSourceIndex(resources),
    limit: input.limit,
  });
}

function sameSite(left: string | null, right: string | null): boolean {
  return Boolean(
    left && right && (left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`)),
  );
}

export type NewsSourceLogo = Pick<PublicNewsArticleItem, "sourceLogoUrl" | "sourceLogoLabel">;

/**
 * Publisher logo for a news record: 1) its active NEWS_SOURCE logo, 2) the trusted
 * registry provider logo, 3) the logo of the active Trusted Media resource for the
 * same website. Without a usable URL only the label is returned (clients fall back).
 */
export function createNewsSourceLogoResolver(
  resources: readonly MediaResource[],
): (record: NewsArticleRecord) => NewsSourceLogo {
  const index = new ActiveNewsSourceIndex(resources);
  const trusted = resources.filter(
    (resource) => resource.resourceType === "TRUSTED_MEDIA" && resource.active,
  );

  return (record) => {
    const resource = index.resolve(record);
    const label = resource?.logoLabel?.trim() || undefined;
    const withLabel = (url: string, fallbackLabel?: string): NewsSourceLogo => ({
      sourceLogoUrl: url,
      ...((label ?? fallbackLabel?.trim())
        ? { sourceLogoLabel: label ?? fallbackLabel!.trim() }
        : {}),
    });

    const own = sanitizePublicLogoUrl(resource?.logoUrl);
    if (own) {
      return withLabel(own);
    }

    const articleHost = hostOf(record.articleUrl);
    const provider =
      (resource?.providerId ? getMediaRegistryProviderById(resource.providerId) : undefined) ??
      TRUSTED_GLOBAL_MEDIA_REGISTRY.find((entry) =>
        entry.sourceDomains.some((domain) => sameSite(articleHost, domain.toLowerCase())),
      );
    const registryLogo = sanitizePublicLogoUrl(provider?.logoUrl);
    if (registryLogo) {
      return withLabel(registryLogo, provider?.logoLabel);
    }

    const publisherHost = hostOf(resource?.websiteUrl) ?? articleHost;
    const trustedMatch = trusted.find((entry) => sameSite(hostOf(entry.websiteUrl), publisherHost));
    const trustedLogo = sanitizePublicLogoUrl(trustedMatch?.logoUrl);
    if (trustedLogo) {
      return withLabel(trustedLogo, trustedMatch?.logoLabel);
    }

    return label ? { sourceLogoLabel: label } : {};
  };
}

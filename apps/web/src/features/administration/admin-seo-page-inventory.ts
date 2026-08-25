/**
 * SEO Pack 07 — load safe public/admin enumerations for the Pages inventory.
 * No unsafe full-database queries; deferred families stay family-level rows.
 */

import { getCountries } from "@hu/geography";

import { fetchKnowledgeListing } from "../knowledge-center/api";
import { listPublicCivicArchiveIndex } from "../public-civic-archive/api";
import { listAdminInitiatives } from "./admin-initiative-directory-api";
import { listAdminPublishingPublications } from "./admin-publishing-api";
import { listAdminSeoPageOverrideIds } from "./admin-seo-page-override-api";
import {
  buildBlogSeoInventoryRow,
  buildCivicArchiveSeoInventoryRow,
  buildCountrySeoInventoryRows,
  buildHomeSeoInventoryRow,
  buildInitiativeSeoInventoryRow,
  buildKnowledgeSeoInventoryRow,
  buildParticipantProfileFamilyDeferredRow,
  buildParticipantProfileSeoInventoryRow,
  buildPetitionFamilyDeferredRow,
  resolveBlogSeoMode,
  type SeoPageInventoryRow,
} from "./admin-seo-console-model";
import { listPublicSitemapParticipantProfiles } from "./admin-seo-participant-profile-inventory-api";

const LIST_PAGE_SIZE = 100;

export async function loadAdminSeoPageInventory(): Promise<SeoPageInventoryRow[]> {
  const customizedPageIds = await loadCustomizedOverridePageIds();
  const countries = buildCountrySeoInventoryRows(getCountries(), customizedPageIds);
  const home = buildHomeSeoInventoryRow();
  const petitionDeferred = buildPetitionFamilyDeferredRow();

  const [blogRows, initiativeRows, knowledgeRows, civicRows, profileRows] = await Promise.all([
    loadBlogInventoryRows(),
    loadInitiativeInventoryRows(customizedPageIds),
    loadKnowledgeInventoryRows(customizedPageIds),
    loadCivicArchiveInventoryRows(customizedPageIds),
    loadParticipantProfileInventoryRows(),
  ]);

  return [
    home,
    ...countries,
    ...blogRows,
    ...initiativeRows,
    ...profileRows,
    petitionDeferred,
    ...knowledgeRows,
    ...civicRows,
  ];
}

async function loadCustomizedOverridePageIds(): Promise<ReadonlySet<string>> {
  try {
    const result = await listAdminSeoPageOverrideIds();
    return new Set(result.pageIds);
  } catch {
    return new Set();
  }
}

async function loadBlogInventoryRows(): Promise<SeoPageInventoryRow[]> {
  try {
    const rows: SeoPageInventoryRow[] = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total && offset < 500) {
      const page = await listAdminPublishingPublications({
        status: "published",
        limit: LIST_PAGE_SIZE,
        offset,
      });
      total = page.total;
      for (const publication of page.publications) {
        if (!publication.publicHref || publication.administrativelyBlocked) {
          continue;
        }
        rows.push(
          buildBlogSeoInventoryRow({
            postId: publication.postId,
            title: publication.title,
            slug: publication.slug,
            seoMode: publication.seoMode ?? resolveBlogSeoMode({}),
          }),
        );
      }
      offset += page.publications.length;
      if (page.publications.length === 0) {
        break;
      }
    }

    return rows;
  } catch {
    return [];
  }
}

async function loadInitiativeInventoryRows(
  customizedPageIds: ReadonlySet<string>,
): Promise<SeoPageInventoryRow[]> {
  try {
    const rows: SeoPageInventoryRow[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && offset < 500) {
      const page = await listAdminInitiatives({
        visibility: "public",
        limit: LIST_PAGE_SIZE,
        offset,
        sort: "updatedAt",
        order: "desc",
      });

      for (const initiative of page.initiatives) {
        if (!initiative.publiclyProjected || initiative.administrativelyBlocked) {
          continue;
        }
        const pageId = `initiative:${initiative.initiativeId}`;
        rows.push(
          buildInitiativeSeoInventoryRow({
            initiativeId: initiative.initiativeId,
            title: initiative.title,
            seoMode: customizedPageIds.has(pageId) ? "customized" : "automatic",
          }),
        );
      }

      offset += page.initiatives.length;
      hasMore = page.hasMore && page.initiatives.length > 0;
    }

    return rows;
  } catch {
    return [];
  }
}

async function loadKnowledgeInventoryRows(
  customizedPageIds: ReadonlySet<string>,
): Promise<SeoPageInventoryRow[]> {
  try {
    const listing = await fetchKnowledgeListing();
    const rows: SeoPageInventoryRow[] = [];
    for (const category of listing.categories) {
      for (const article of category.articles) {
        const slug = article.slug?.trim();
        if (!slug) {
          continue;
        }
        const pageId = `knowledge:${slug}`;
        rows.push(
          buildKnowledgeSeoInventoryRow({
            slug,
            title: article.title,
            seoMode: customizedPageIds.has(pageId) ? "customized" : "automatic",
          }),
        );
      }
    }
    return rows;
  } catch {
    return [];
  }
}

async function loadParticipantProfileInventoryRows(): Promise<SeoPageInventoryRow[]> {
  try {
    const entries = await listPublicSitemapParticipantProfiles();
    return entries.map((entry) =>
      buildParticipantProfileSeoInventoryRow({ publicName: entry.publicName }),
    );
  } catch {
    return [buildParticipantProfileFamilyDeferredRow()];
  }
}

async function loadCivicArchiveInventoryRows(
  customizedPageIds: ReadonlySet<string>,
): Promise<SeoPageInventoryRow[]> {
  try {
    const index = await listPublicCivicArchiveIndex({});
    return index.records.map((record) => {
      const pageId = `civic-archive:${record.initiativeId}`;
      return buildCivicArchiveSeoInventoryRow({
        initiativeId: record.initiativeId,
        title: record.title,
        seoMode: customizedPageIds.has(pageId) ? "customized" : "automatic",
      });
    });
  } catch {
    return [];
  }
}

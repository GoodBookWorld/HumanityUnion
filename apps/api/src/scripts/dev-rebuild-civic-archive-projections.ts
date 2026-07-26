import { getCountryLabel, getRegionLabel } from "@hu/geography";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { bootstrapMongoPersistence } from "../infrastructure/mongodb/bootstrap-mongo-persistence.js";
import { getKnownInitiativeCommunity } from "../modules/initiatives/initiative-communities.js";
import { getInitiativeById } from "../modules/initiatives/initiative.store.js";
import { isPublicVerificationFixtureRecord } from "../modules/public-civic-archive/public-civic-archive-fixture-guard.js";
import {
  getPersistenceMode,
  listArchiveRecords,
  reloadArchiveRecordsFromPersistence,
  updateArchiveRecord,
} from "../modules/public-civic-archive/public-civic-archive.store.js";

loadApiEnvironment();

function resolveArchiveCountryLabel(
  initiative: NonNullable<ReturnType<typeof getInitiativeById>>,
): string {
  const countryCode = initiative.metadata.countrySlug?.trim();

  if (countryCode) {
    return getCountryLabel(countryCode) ?? countryCode;
  }

  const knownCommunity = initiative.metadata.communitySlug
    ? getKnownInitiativeCommunity(initiative.metadata.communitySlug)
    : undefined;

  return knownCommunity?.countryLabel ?? initiative.metadata.region ?? "Canada";
}

function resolveArchiveRegionLabel(
  initiative: NonNullable<ReturnType<typeof getInitiativeById>>,
): string {
  if (initiative.metadata.region?.trim()) {
    return initiative.metadata.region.trim();
  }

  const countryCode = initiative.metadata.countrySlug?.trim();
  const regionSlug = initiative.metadata.regionSlug?.trim();

  if (countryCode && regionSlug) {
    return getRegionLabel(countryCode, regionSlug) ?? regionSlug;
  }

  return "";
}

function resolveArchiveCommunityLabel(
  initiative: NonNullable<ReturnType<typeof getInitiativeById>>,
): string {
  if (initiative.metadata.communitySlug?.trim()) {
    const knownCommunity = getKnownInitiativeCommunity(initiative.metadata.communitySlug);

    return knownCommunity?.name ?? initiative.metadata.communitySlug;
  }

  return "";
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to rebuild civic archive projections in production.");
  }

  await bootstrapMongoPersistence();

  const database = process.env.MONGODB_DATABASE?.trim() || "unset";
  const persistence = getPersistenceMode();

  console.log(`[civic-archive-rebuild] database=${database} persistence=${persistence}`);

  let updated = 0;
  let skippedFixtures = 0;
  let skippedMissingInitiative = 0;
  let skippedDraft = 0;
  let unchanged = 0;

  for (const record of listArchiveRecords()) {
    if (isPublicVerificationFixtureRecord(record)) {
      skippedFixtures += 1;
      continue;
    }

    if (record.status !== "published") {
      skippedDraft += 1;
      continue;
    }

    const initiative = getInitiativeById(record.initiativeId);

    if (!initiative) {
      skippedMissingInitiative += 1;
      continue;
    }

    const nextCountry = resolveArchiveCountryLabel(initiative);
    const nextRegion = resolveArchiveRegionLabel(initiative);
    const nextCommunity = resolveArchiveCommunityLabel(initiative);
    const nextActivityArea = initiative.metadata.activityArea ?? record.activityArea;

    if (
      record.country === nextCountry &&
      record.region === nextRegion &&
      record.community === nextCommunity &&
      record.activityArea === nextActivityArea
    ) {
      unchanged += 1;
      continue;
    }

    updateArchiveRecord(record.archiveRecordId, {
      country: nextCountry,
      region: nextRegion,
      community: nextCommunity,
      activityArea: nextActivityArea,
    });

    updated += 1;
  }

  reloadArchiveRecordsFromPersistence();

  console.log(`Updated published archive projections: ${updated}`);
  console.log(`Unchanged published archive projections: ${unchanged}`);
  console.log(`Skipped fixtures: ${skippedFixtures}`);
  console.log(`Skipped drafts: ${skippedDraft}`);
  console.log(`Skipped missing initiatives: ${skippedMissingInitiative}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

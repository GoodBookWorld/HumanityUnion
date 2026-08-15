import { normalizeCountryInput } from "@hu/geography";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { bootstrapMongoPersistence } from "../infrastructure/mongodb/bootstrap-mongo-persistence.js";
import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import { assessPublicCivicArchiveEligibility } from "../modules/public-civic-archive/public-civic-archive-eligibility.js";
import { isPublicVerificationFixtureRecord } from "../modules/public-civic-archive/public-civic-archive-fixture-guard.js";
import { getPersistenceMode } from "../modules/public-civic-archive/public-civic-archive.store.js";
import { listCivicArchiveLifecycleRecords } from "../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js";

loadApiEnvironment();

function parseCountryArg(argv: string[]): string {
  const match = argv.find((entry) => entry.startsWith("--country="));

  if (!match) {
    return "CA";
  }

  return match.slice("--country=".length).trim() || "CA";
}

function resolveInitiativeCountryCode(initiative: {
  metadata?: {
    countrySlug?: string;
    regionSlug?: string;
    communitySlug?: string;
    region?: string;
  };
}): string | undefined {
  if (initiative.metadata?.countrySlug) {
    return (
      normalizeCountryInput(initiative.metadata.countrySlug) ?? initiative.metadata.countrySlug
    );
  }

  return undefined;
}

function matchesCountryFilter(countryCode: string, initiativeCountryCode?: string): boolean {
  if (!initiativeCountryCode) {
    return false;
  }

  return initiativeCountryCode.toUpperCase() === countryCode.toUpperCase();
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run civic archive audit in production.");
  }

  const countryCode = parseCountryArg(process.argv.slice(2));

  await bootstrapMongoPersistence();

  const { listArchiveRecords } =
    await import("../modules/public-civic-archive/public-civic-archive.store.js");
  const { listPublicImpactsByInitiative } =
    await import("../modules/initiative-public-impact/initiative-public-impact.store.js");
  const { listInitiatives } = await import("../modules/initiatives/initiative.store.js");

  const persistence = getPersistenceMode();
  const database = process.env.MONGODB_DATABASE?.trim() || "unset";

  console.log(`[civic-archive-audit] database=${database} persistence=${persistence}`);
  console.log(`[civic-archive-audit] collection=${MONGO_COLLECTIONS.publicCivicArchiveRecords}`);
  console.log(`[civic-archive-audit] countryFilter=${countryCode}`);
  console.log("");

  const archiveRecords = listArchiveRecords();
  const fixtureCount = archiveRecords.filter((record) =>
    isPublicVerificationFixtureRecord(record),
  ).length;
  const publishedRecords = archiveRecords.filter(
    (record) => record.status === "published" && !isPublicVerificationFixtureRecord(record),
  );

  console.log(
    `Archive store summary: total=${archiveRecords.length} fixtures=${fixtureCount} publishedReal=${publishedRecords.length}`,
  );
  console.log("");

  const initiatives = listInitiatives().filter((initiative) => {
    if (
      /TASK-107|Verify|Persistence Test|Archive Runtime|Horizontal Results Fixture/i.test(
        initiative.title,
      )
    ) {
      return false;
    }

    return matchesCountryFilter(countryCode, resolveInitiativeCountryCode(initiative));
  });

  console.log(`Candidate initiatives for ${countryCode}: ${initiatives.length}`);
  console.log("");

  const lifecycleRecordsForCountry = await listCivicArchiveLifecycleRecords({
    country: countryCode,
  });

  for (const initiative of initiatives) {
    const impacts = listPublicImpactsByInitiative(initiative.initiativeId);
    const verifiedImpact = impacts.find((impact) => impact.status === "verified");
    const publishedArchive = publishedRecords.find(
      (record) => record.initiativeId === initiative.initiativeId,
    );
    const lifecycleMatch = lifecycleRecordsForCountry.find(
      (record) => record.initiativeId === initiative.initiativeId,
    );

    let archiveEligible = false;
    let exclusionReason = "missing verified public impact";

    if (verifiedImpact) {
      const eligibility = assessPublicCivicArchiveEligibility(
        verifiedImpact.impactId,
        verifiedImpact.participantId,
      );
      archiveEligible = eligibility.eligible;
      exclusionReason = eligibility.eligible ? "eligible" : eligibility.reasons.join("; ");
    } else if (
      initiative.lifecyclePhase === "projected" &&
      initiative.visibility?.policy === "public"
    ) {
      exclusionReason =
        "public projected initiative without verified public impact and published civic archive record";
    }

    const includedInArchiveIndex = Boolean(lifecycleMatch);

    console.log(`initiativeId=${initiative.initiativeId}`);
    console.log(`title=${initiative.title}`);
    console.log(`countryCode=${resolveInitiativeCountryCode(initiative) ?? "unknown"}`);
    console.log(`region=${initiative.metadata.region ?? ""}`);
    console.log(`community=${initiative.metadata.communitySlug ?? ""}`);
    console.log(`publicStatus=${initiative.visibility?.policy ?? initiative.status}`);
    console.log(`lifecycleStage=${initiative.lifecyclePhase}`);
    console.log(`impactStatus=${verifiedImpact?.status ?? "none"}`);
    console.log(`archiveRecordStatus=${publishedArchive?.status ?? "none"}`);
    console.log(`projectionPresent=${includedInArchiveIndex ? "true" : "false"}`);
    console.log(`archiveEligible=${archiveEligible ? "true" : "false"}`);
    console.log(
      `reason=${includedInArchiveIndex ? "included in civic archive index" : exclusionReason}`,
    );
    console.log("");
  }

  const indexedForCountry = lifecycleRecordsForCountry;
  console.log(`Indexed civic archive records for ${countryCode}: ${indexedForCountry.length}`);

  for (const record of indexedForCountry) {
    console.log(
      `indexed initiativeId=${record.initiativeId} title=${record.title} country=${record.country}`,
    );
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

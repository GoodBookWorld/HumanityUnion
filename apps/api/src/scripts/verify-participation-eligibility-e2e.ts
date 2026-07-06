/**
 * TASK-027 — Participation eligibility engine verification.
 * Run: npm run verify:participation-eligibility
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { DecisionParticipationEligibilityInput } from "@hu/types";
import {
  evaluateDecisionParticipationEligibility,
  getTransparencyCohort,
  isParticipationAreaMatch,
  participationAreaSlugTriple,
} from "@hu/types";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

const FORBIDDEN_ELIGIBILITY_TERMS = [
  "ipAddress",
  "ip_address",
  "vpn",
  "geolocation",
  "geoLocation",
  "latitude",
  "longitude",
  "deviceFingerprint",
  "networkLocation",
];

const INITIATIVE_SCOPE = {
  countrySlug: "canada",
  regionSlug: "british-columbia",
  communitySlug: "nelson-community-garden",
  isGlobal: false,
};

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function futureIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

function pastIsoDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function baseInput(
  overrides: Partial<DecisionParticipationEligibilityInput> = {},
): DecisionParticipationEligibilityInput {
  const openedAt = pastIsoDate(1);
  const closesAt = futureIsoDate(14);

  return {
    participantId: "member-test-001",
    isRegistered: true,
    participantStatus: "active",
    activeParticipationArea: participationAreaSlugTriple(
      "canada",
      "british-columbia",
      "nelson-community-garden",
    ),
    verificationStatus: "verified",
    pendingTransition: null,
    decisionParticipationScope: "community",
    initiativeScopeMetadata: INITIATIVE_SCOPE,
    decisionStatus: "opened",
    openedAt,
    closesAt,
    currentTime: new Date().toISOString(),
    priorVoteExists: false,
    ...overrides,
  };
}

async function runPureEligibilityVerification(): Promise<void> {
  console.log("1. World scope — registered active participant eligible");

  const worldEligible = evaluateDecisionParticipationEligibility(
    baseInput({
      decisionParticipationScope: "world",
      activeParticipationArea: participationAreaSlugTriple("germany", "bavaria", "munich"),
    }),
  );
  assert(worldEligible.eligible, "World scope should be eligible");
  assert(worldEligible.reasonCode === "eligible", "World scope reason should be eligible");

  console.log("2. Country match — eligible");

  const countryEligible = evaluateDecisionParticipationEligibility(
    baseInput({
      decisionParticipationScope: "country",
      activeParticipationArea: participationAreaSlugTriple("canada"),
    }),
  );
  assert(countryEligible.eligible, "Country match should be eligible");

  console.log("3. Country mismatch — rejected");

  const countryMismatch = evaluateDecisionParticipationEligibility(
    baseInput({
      decisionParticipationScope: "country",
      activeParticipationArea: participationAreaSlugTriple("mexico"),
    }),
  );
  assert(!countryMismatch.eligible, "Country mismatch should be ineligible");
  assert(countryMismatch.reasonCode === "country_mismatch", "Country mismatch reason");

  console.log("4. Region match — eligible");

  const regionEligible = evaluateDecisionParticipationEligibility(
    baseInput({
      decisionParticipationScope: "region",
      activeParticipationArea: participationAreaSlugTriple("canada", "british-columbia"),
    }),
  );
  assert(regionEligible.eligible, "Region match should be eligible");

  console.log("5. Region mismatch — rejected");

  const regionMismatch = evaluateDecisionParticipationEligibility(
    baseInput({
      decisionParticipationScope: "region",
      activeParticipationArea: participationAreaSlugTriple("canada", "ontario"),
    }),
  );
  assert(!regionMismatch.eligible, "Region mismatch should be ineligible");
  assert(regionMismatch.reasonCode === "region_mismatch", "Region mismatch reason");

  console.log("6. Community match — eligible");

  const communityEligible = evaluateDecisionParticipationEligibility(
    baseInput({ decisionParticipationScope: "community" }),
  );
  assert(communityEligible.eligible, "Community match should be eligible");

  console.log("7. Community mismatch — rejected");

  const communityMismatch = evaluateDecisionParticipationEligibility(
    baseInput({
      decisionParticipationScope: "community",
      activeParticipationArea: participationAreaSlugTriple(
        "canada",
        "british-columbia",
        "kootenay-lake-protection-society",
      ),
    }),
  );
  assert(!communityMismatch.eligible, "Community mismatch should be ineligible");
  assert(communityMismatch.reasonCode === "community_mismatch", "Community mismatch reason");

  console.log("8. Unverified participant — eligible with transparency cohort");

  const unverifiedEligible = evaluateDecisionParticipationEligibility(
    baseInput({ verificationStatus: "unverified" }),
  );
  assert(unverifiedEligible.eligible, "Unverified participant should remain eligible");
  assert(
    unverifiedEligible.transparencyCohort === "unverified",
    "Transparency cohort should be unverified",
  );
  assert(
    getTransparencyCohort("unverified") === "unverified",
    "getTransparencyCohort should mirror verification status",
  );

  console.log("9. Pending area change ignored before effectiveAt");

  const pendingBeforeEffective = evaluateDecisionParticipationEligibility(
    baseInput({
      decisionParticipationScope: "community",
      activeParticipationArea: participationAreaSlugTriple(
        "canada",
        "british-columbia",
        "kootenay-lake-protection-society",
      ),
      pendingTransition: {
        transitionId: "transition-pending-001",
        participantId: "member-test-001",
        fromArea: participationAreaSlugTriple(
          "canada",
          "british-columbia",
          "kootenay-lake-protection-society",
        ),
        toArea: participationAreaSlugTriple(
          "canada",
          "british-columbia",
          "nelson-community-garden",
        ),
        requestedAt: pastIsoDate(2),
        effectiveAt: futureIsoDate(7),
        status: "pending",
      },
    }),
  );
  assert(
    pendingBeforeEffective.reasonCode === "pending_area_change_not_effective",
    "Pending area change before effectiveAt should return pending_area_change_not_effective",
  );

  console.log(
    "10. Pending area change active after effectiveAt via resolveActiveParticipationArea",
  );

  const {
    createParticipationArea,
    requestParticipationAreaTransition,
    resolveActiveParticipationArea,
  } = await import("../modules/participation-area/participation-area.store.js");
  const { evaluateStoredDecisionParticipationEligibility } =
    await import("../modules/participation-eligibility/participation-eligibility.service.js");

  createParticipationArea({
    participantId: "member-transition-001",
    countrySlug: "canada",
    regionSlug: "british-columbia",
    communitySlug: "kootenay-lake-protection-society",
    verificationStatus: "verified",
  });

  requestParticipationAreaTransition({
    participantId: "member-transition-001",
    toArea: participationAreaSlugTriple("canada", "british-columbia", "nelson-community-garden"),
    effectiveAt: pastIsoDate(1),
  });

  const resolvedArea = resolveActiveParticipationArea(
    "member-transition-001",
    new Date().toISOString(),
  );
  assert(
    resolvedArea?.communitySlug === "nelson-community-garden",
    "Effective transition should activate new Participation Area",
  );

  const afterEffective = evaluateStoredDecisionParticipationEligibility({
    participantId: "member-transition-001",
    isRegistered: true,
    participantStatus: "active",
    decisionParticipationScope: "community",
    initiativeCommunitySlug: "nelson-community-garden",
    decisionStatus: "opened",
    openedAt: pastIsoDate(2),
    closesAt: futureIsoDate(10),
    currentTime: new Date().toISOString(),
    priorVoteExists: false,
  });
  assert(afterEffective.eligible, "Participant should be eligible after transition becomes active");

  console.log("11. Duplicate vote rejected");

  const duplicateVote = evaluateDecisionParticipationEligibility(
    baseInput({ priorVoteExists: true }),
  );
  assert(!duplicateVote.eligible, "Duplicate vote should be rejected");
  assert(duplicateVote.reasonCode === "already_voted", "Duplicate vote reason");

  console.log("12. Decision not opened rejected");

  const notOpen = evaluateDecisionParticipationEligibility(baseInput({ decisionStatus: "draft" }));
  assert(!notOpen.eligible, "Draft decision should reject participation");
  assert(notOpen.reasonCode === "decision_not_open", "Decision not open reason");

  console.log("13. Outside decision window rejected");

  const outsideWindow = evaluateDecisionParticipationEligibility(
    baseInput({
      currentTime: futureIsoDate(30),
    }),
  );
  assert(!outsideWindow.eligible, "Outside window should reject participation");
  assert(outsideWindow.reasonCode === "outside_decision_window", "Outside window reason");

  console.log("14. isParticipationAreaMatch helper");

  assert(
    isParticipationAreaMatch(
      "community",
      participationAreaSlugTriple("canada", "british-columbia", "nelson-community-garden"),
      INITIATIVE_SCOPE,
    ),
    "isParticipationAreaMatch should confirm community match",
  );
  assert(
    !isParticipationAreaMatch(
      "community",
      participationAreaSlugTriple("canada", "british-columbia", "other-community"),
      INITIATIVE_SCOPE,
    ),
    "isParticipationAreaMatch should reject community mismatch",
  );

  console.log("15. IP/VPN/geolocation absent from eligibility model");

  const eligibilityTypesSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../../../../packages/types/src/domain/participation-eligibility.ts",
    ),
    "utf-8",
  );
  const eligibilityServiceSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/participation-eligibility/participation-eligibility.service.ts",
    ),
    "utf-8",
  );
  const participationAreaStoreSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/participation-area/participation-area.store.ts",
    ),
    "utf-8",
  );

  for (const source of [
    eligibilityTypesSource,
    eligibilityServiceSource,
    participationAreaStoreSource,
  ]) {
    for (const term of FORBIDDEN_ELIGIBILITY_TERMS) {
      assert(!source.includes(term), `Eligibility implementation must not include ${term}`);
    }
  }

  const serializedInput = JSON.stringify(baseInput());
  for (const term of FORBIDDEN_ELIGIBILITY_TERMS) {
    assert(!serializedInput.includes(term), `Eligibility input must not include ${term}`);
  }
}

function assertParticipationAreaReloadsFromFile(
  participantId: string,
  expectedCountrySlug: string,
  expectedVerificationStatus: "verified" | "unverified",
  filePath: string,
): void {
  const reloadScriptPath = path.resolve(
    path.dirname(SCRIPT_PATH),
    "verify-participation-area-store-reload.ts",
  );
  const result = spawnSync(
    "npx",
    ["tsx", reloadScriptPath, participantId, expectedCountrySlug, expectedVerificationStatus],
    {
      cwd: path.resolve(path.dirname(SCRIPT_PATH), "../.."),
      env: {
        ...process.env,
        PARTICIPATION_AREA_PERSISTENCE: "file",
        PARTICIPATION_AREA_PERSISTENCE_PATH: filePath,
      },
      stdio: "pipe",
      encoding: "utf-8",
    },
  );

  assert(result.status === 0, "Participation Area should reload from file after API restart");
}

async function runPersistenceVerification(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-participation-area-e2e-"));
  const persistencePath = path.join(tempDir, "participation-areas.json");

  process.env.PARTICIPATION_AREA_PERSISTENCE = "file";
  process.env.PARTICIPATION_AREA_PERSISTENCE_PATH = persistencePath;

  const { createFileParticipationAreaPersistenceAdapter } =
    await import("../modules/participation-area/persistence/participation-area-file.persistence.js");
  const { createParticipationArea } =
    await import("../modules/participation-area/participation-area.store.js");

  createParticipationArea({
    participantId: "member-persistence-001",
    countrySlug: "canada",
    regionSlug: "british-columbia",
    communitySlug: "nelson-community-garden",
    verificationStatus: "unverified",
  });

  assert(
    createFileParticipationAreaPersistenceAdapter().load().areas &&
      Object.values(createFileParticipationAreaPersistenceAdapter().load().areas).some(
        (area) => area.participantId === "member-persistence-001",
      ),
    "Participation Area should persist to file",
  );

  assertParticipationAreaReloadsFromFile(
    "member-persistence-001",
    "canada",
    "unverified",
    persistencePath,
  );

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log("16. Persistence — Participation Area survives API restart");
}

async function main(): Promise<void> {
  if (process.env.VERIFY_PARTICIPATION_ELIGIBILITY_PERSISTENCE === "1") {
    await runPersistenceVerification();
    console.log("Participation eligibility persistence checks passed.");
    return;
  }

  await runPureEligibilityVerification();

  const persistenceResult = spawnSync("npx", ["tsx", SCRIPT_PATH], {
    env: {
      ...process.env,
      VERIFY_PARTICIPATION_ELIGIBILITY_PERSISTENCE: "1",
      PARTICIPATION_AREA_PERSISTENCE: "memory",
    },
    stdio: "inherit",
  });

  assert(persistenceResult.status === 0, "Persistence verification subprocess failed");

  console.log("All participation eligibility checks passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Participation eligibility verification FAILED: ${message}`);
  process.exit(1);
});

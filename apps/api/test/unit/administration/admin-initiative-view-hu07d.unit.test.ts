/**
 * HU-INIT-07D — protected election totals stay on the administrator response.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readApi(relative: string): string {
  return readFileSync(path.join(apiRoot, relative), "utf8");
}

describe("HU-INIT-07D administrator election totals", () => {
  it("copies already computed support, opposition, and abstain totals", () => {
    const service = readApi("src/modules/administration/admin-public-choice.service.ts");
    const detailStart = service.indexOf("export async function getAdminPublicChoiceDetail");
    const detailEnd = service.indexOf("export async function blockAdminPublicChoiceCandidate");
    const detail = service.slice(detailStart, detailEnd);

    assert.match(detail, /supportCount = aggregates\.total\.support/);
    assert.match(detail, /oppositionCount = aggregates\.total\.doNotSupport/);
    assert.match(detail, /abstainCount = aggregates\.total\.abstain/);
    assert.match(detail, /voteCounts\.set\(row\.candidateId, row\.count\)/);
    assert.match(detail, /supportCount,\s*oppositionCount,\s*abstainCount/);
    assert.doesNotMatch(detail, /percentage/);
    assert.doesNotMatch(detail, /ensurePublicChoiceElectionVotingDecision/);
    assert.doesNotMatch(detail, /listPublicChoiceCandidatesForInitiative/);
    assert.doesNotMatch(detail, /updateInitiative\(/);
  });

  it("does not add the totals to the public initiative projection", () => {
    const projection = readApi("src/modules/initiatives/public-initiative.projection.ts");
    const eligibility = readApi("src/modules/initiatives/initiative-public-projection.access.ts");
    assert.doesNotMatch(projection, /administrativeBlockReason/);
    assert.doesNotMatch(projection, /supportCount/);
    assert.match(eligibility, /!isInitiativeAdministrativelyBlocked\(initiative\)/);
  });

  it("keeps the administrator experience read free of public writes", () => {
    const directory = readApi("src/modules/administration/admin-initiative-directory.service.ts");
    const experienceStart = directory.indexOf("export async function getAdminInitiativeExperience");
    const experience = directory.slice(experienceStart);
    assert.match(experience, /buildPublicInitiativeExperienceProjection\(\{\s*initiative: record\s*\}\)/);
    assert.doesNotMatch(experience, /viewerKey/);
    assert.doesNotMatch(experience, /updateInitiative\(/);
    assert.doesNotMatch(experience, /ensurePublicChoiceElectionVotingDecision/);
    assert.doesNotMatch(experience, /listPublicChoiceCandidatesForInitiative/);
  });
});

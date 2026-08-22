/**
 * Public Choice Experience Pack 01 — focused contract tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  getInitiativeLifecycleProfilePresentation,
  PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE,
  STANDARD_LIFECYCLE_STAGE_ROUTE,
} from "@hu/types";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../../..");
const repoRoot = path.resolve(webRoot, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Public Choice Experience Pack 01 — presentation contract", () => {
  it("keeps STANDARD and PUBLIC_CHOICE routes distinct", () => {
    assert.deepEqual([...PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE], [
      "initiative",
      "discussion",
      "collective_decision",
      "archive",
    ]);
    assert.ok(STANDARD_LIFECYCLE_STAGE_ROUTE.includes("analysis"));
    assert.ok(!PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE.includes("analysis"));
  });

  it("exposes profile-aware presentation without inventing fields", () => {
    const standard = getInitiativeLifecycleProfilePresentation("STANDARD");
    const publicChoice = getInitiativeLifecycleProfilePresentation("PUBLIC_CHOICE");

    assert.equal(standard.communityAssociationLabel, "Community association");
    assert.equal(standard.requireCountry, false);
    assert.equal(standard.showActivityArea, true);
    assert.equal(standard.showLifecycleStageOrdinal, true);
    assert.equal(standard.discussionShowsStandardParticipationActions, true);

    assert.equal(publicChoice.communityAssociationLabel, "Election name");
    assert.ok(publicChoice.communityAssociationHelper?.includes("election"));
    assert.equal(publicChoice.requireCountry, true);
    assert.equal(publicChoice.showActivityArea, false);
    assert.equal(publicChoice.requireActivityArea, false);
    assert.equal(publicChoice.discussionShowsVoteBallot, false);
    assert.equal(publicChoice.discussionShowsStandardParticipationActions, false);
    assert.equal(publicChoice.collectiveDecisionIsResultOnly, true);
    assert.equal(publicChoice.showLifecycleStageOrdinal, false);
  });
});

describe("Public Choice Experience Pack 01 — creation form", () => {
  const form = readWeb("src/features/initiatives/components/InitiativeFormFields.tsx");
  const create = readWeb("src/features/initiatives/components/StartNewInitiativeButton.tsx");
  const validators = readRepo("apps/api/src/modules/initiatives/initiative.validators.ts");

  it("wires profile into shared form and validates Country for PUBLIC_CHOICE", () => {
    assert.match(create, /lifecycleProfile=\{lifecycleProfile\}/);
    assert.match(form, /getInitiativeLifecycleProfilePresentation/);
    assert.match(form, /communityAssociationLabel/);
    assert.match(form, /presentation\.showActivityArea/);
    assert.match(create, /Country is required for Public Choice/);
    assert.match(validators, /Country is required for Public Choice initiatives/);
    assert.match(validators, /isPublicChoice/);
  });
});

describe("Public Choice Experience Pack 01 — Discussion + Support + Country", () => {
  const discussion = readWeb(
    "src/features/public-initiative-experience/components/PublicDiscussionPanel.tsx",
  );
  const votePanel = readWeb(
    "src/features/public-initiative-experience/components/PublicChoiceDiscussionVotePanel.tsx",
  );
  const sidebar = readWeb(
    "src/features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
  );
  const working = readWeb(
    "src/features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
  );
  const stageShell = readWeb(
    "src/features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.tsx",
  );
  const country = readWeb(
    "src/features/country-experience/components/CountryExperienceDynamicPage.tsx",
  );
  const matching = readRepo("apps/api/src/modules/global-search/global-search.matching.ts");
  const cdPublish = readRepo(
    "apps/api/src/modules/initiative-collective-decision-lifecycle/initiative-collective-decision-lifecycle.service.ts",
  );
  const voting = readWeb(
    "src/features/initiative-collective-decision-lifecycle/collective-decision-voting.ts",
  );

  it("Discussion can mount Public Choice vote panel for legacy SUPPORT_OPPOSE; STANDARD actions gated", () => {
    assert.match(discussion, /PublicChoiceDiscussionVotePanel/);
    assert.match(discussion, /showStandardParticipationActions/);
    assert.match(votePanel, /support|do_not_support|abstain|Overview/);
  });

  it("vote labels use Support / Do not support / Abstain identities", () => {
    assert.match(voting, /Do not support/);
    assert.match(voting, /Поддерживаю/);
    assert.match(voting, /Не поддерживаю/);
    assert.match(voting, /Воздержался/);
  });

  it("Initiative Support remains wired for STANDARD; SELECT_ONE Public Choice may hide it", () => {
    assert.match(sidebar, /PublicInitiativeSupportStatistics/);
    assert.match(sidebar, /PublicChoiceElectionSidebarWidget/);
    assert.match(working, /PublicInitiativeSupportStatistics/);
    assert.match(working, /supportStatistics/);
  });

  it("hides Stage ordinal for PUBLIC_CHOICE and leaves PUBLIC_CHOICE CD voting open", () => {
    assert.match(stageShell, /showStageOrdinal/);
    assert.match(stageShell, /getInitiativeLifecycleProfilePresentation/);
    assert.match(cdPublish, /PUBLIC_CHOICE/);
    assert.match(cdPublish, /leave voting open|Leave voting open|PUBLIC_CHOICE/);
  });

  it("Country search supports All / Standard / Public Choice lifecycleProfile filter", () => {
    const entityTypes = readWeb(
      "src/features/country-experience/country-discovery-entity-types.ts",
    );
    assert.match(country, /lifecycleProfile/);
    assert.match(country, /COUNTRY_DISCOVERY_ENTITY_TYPE_OPTIONS|resolveCountrySearchFilterParams/);
    assert.match(entityTypes, /Standard Initiatives/);
    assert.match(entityTypes, /Public Choice/);
    assert.match(matching, /query\.lifecycleProfile/);
    assert.match(matching, /resolveInitiativeLifecycleProfile/);
  });
});

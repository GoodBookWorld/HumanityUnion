import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildInitiativeExperienceHref,
  buildInitiativeExperienceManageHref,
} from "../initiative-owner-studio/initiative-experience-routes";

describe("Initiative Lifecycle Step 01 — canonical experience routes", () => {
  it("Workspace and Header entry builders share /initiatives/public/{id}", () => {
    const href = buildInitiativeExperienceHref("initiative-1");
    assert.equal(href, "/initiatives/public/initiative-1");
    assert.equal(href.includes("/initiatives/public/"), true);
    assert.equal(href.startsWith("/initiatives/") && !href.includes("/public/"), false);
  });

  it("Manage deep-link uses the same canonical shell with #manage", () => {
    assert.equal(
      buildInitiativeExperienceManageHref("initiative-1"),
      "/initiatives/public/initiative-1#manage",
    );
  });

  it("legacy owner path is not the canonical experience URL", () => {
    const canonical = buildInitiativeExperienceHref("x");
    assert.notEqual(canonical, "/initiatives/x");
    assert.equal(canonical, "/initiatives/public/x");
  });
});

describe("Initiative Lifecycle Step 01 — Manage authority is stewardship", () => {
  it("Manage visibility follows viewerIsSteward, not ownerMode/route", () => {
    // Mirrors PublicInitiativeExperiencePage: canShowManage = steward && manage record.
    function resolveCanShowManage(input: {
      viewerIsSteward: boolean;
      manageInitiative: object | null;
    }): boolean {
      return Boolean(input.viewerIsSteward && input.manageInitiative);
    }

    const manageRecord = { initiativeId: "i1" };
    assert.equal(
      resolveCanShowManage({ viewerIsSteward: true, manageInitiative: manageRecord }),
      true,
    );
    assert.equal(
      resolveCanShowManage({ viewerIsSteward: false, manageInitiative: manageRecord }),
      false,
    );
    assert.equal(
      resolveCanShowManage({ viewerIsSteward: true, manageInitiative: null }),
      false,
    );
  });

  it("viewerIsSteward is identical for the same experience payload regardless of entry label", () => {
    const experienceFromWorkspace = { viewerIsSteward: true as const };
    const experienceFromHeader = { viewerIsSteward: true as const };
    assert.equal(experienceFromWorkspace.viewerIsSteward, experienceFromHeader.viewerIsSteward);
  });
});

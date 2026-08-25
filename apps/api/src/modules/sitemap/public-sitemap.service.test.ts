/**
 * SEO Pack 02/11 — public sitemap Initiative + Participant Profile inventory (API).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Initiative, MemberProfile } from "@hu/types";

import {
  listPublicSitemapInitiatives,
  listPublicSitemapParticipantProfiles,
  toPublicSitemapParticipantProfileEntry,
} from "./public-sitemap.service.js";

function makeInitiative(
  overrides: Partial<Initiative> & Pick<Initiative, "initiativeId">,
): Initiative {
  const { initiativeId, ...rest } = overrides;
  return {
    initiativeId,
    title: "Test",
    description: "Desc",
    stewardId: "member_1",
    status: "active",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-02-01T00:00:00.000Z",
    metadata: {},
    ...rest,
  } as Initiative;
}

function makeProfile(
  overrides: Partial<MemberProfile> & Pick<MemberProfile, "publicName">,
): Pick<MemberProfile, "publicName" | "updatedAt" | "profileVisibility" | "status"> {
  return {
    publicName: overrides.publicName,
    updatedAt: overrides.updatedAt ?? "2024-03-01T00:00:00.000Z",
    profileVisibility: overrides.profileVisibility ?? "public",
    status: overrides.status ?? "active",
  };
}

describe("SEO Pack 02 — listPublicSitemapInitiatives", () => {
  it("includes public projected initiatives only", () => {
    const entries = listPublicSitemapInitiatives([
      makeInitiative({
        initiativeId: "pub_1",
        lifecyclePhase: "projected",
        visibility: { policy: "public" },
      }),
      makeInitiative({
        initiativeId: "draft_1",
        lifecyclePhase: "draft",
        visibility: { policy: "public" },
      }),
      makeInitiative({
        initiativeId: "private_1",
        lifecyclePhase: "projected",
        visibility: { policy: "steward_only" },
      }),
    ]);

    assert.deepEqual(entries, [
      { initiativeId: "pub_1", updatedAt: "2024-02-01T00:00:00.000Z" },
    ]);
  });

  it("excludes non-public lifecycle phases from sitemap inventory", () => {
    const entries = listPublicSitemapInitiatives([
      makeInitiative({ initiativeId: "published_only", lifecyclePhase: "published" }),
      makeInitiative({ initiativeId: "archived", lifecyclePhase: "archived" }),
    ]);
    assert.equal(entries.length, 0);
  });
});

describe("SEO Pack 11 — Participant Profile sitemap inventory", () => {
  it("maps only active public profiles with non-empty publicName", () => {
    assert.deepEqual(
      toPublicSitemapParticipantProfileEntry(
        makeProfile({ publicName: "ada-lovelace", profileVisibility: "public" }),
      ),
      { publicName: "ada-lovelace", updatedAt: "2024-03-01T00:00:00.000Z" },
    );
    assert.equal(
      toPublicSitemapParticipantProfileEntry(
        makeProfile({ publicName: "hidden", profileVisibility: "members_only" }),
      ),
      null,
    );
    assert.equal(
      toPublicSitemapParticipantProfileEntry(
        makeProfile({ publicName: "secret", profileVisibility: "private" }),
      ),
      null,
    );
    assert.equal(
      toPublicSitemapParticipantProfileEntry(
        makeProfile({ publicName: "gone", status: "suspended" }),
      ),
      null,
    );
    assert.equal(
      toPublicSitemapParticipantProfileEntry(makeProfile({ publicName: "   " })),
      null,
    );
  });

  it("enumerates public profiles only and dedupes by publicName", async () => {
    const entries = await listPublicSitemapParticipantProfiles([
      { publicName: "zeta", updatedAt: "2024-01-01T00:00:00.000Z" },
      { publicName: "ada", updatedAt: "2024-02-01T00:00:00.000Z" },
      { publicName: "ada", updatedAt: "2024-03-01T00:00:00.000Z" },
      { publicName: "  ", updatedAt: "2024-01-01T00:00:00.000Z" },
    ]);

    assert.deepEqual(entries, [
      { publicName: "ada", updatedAt: "2024-02-01T00:00:00.000Z" },
      { publicName: "zeta", updatedAt: "2024-01-01T00:00:00.000Z" },
    ]);
  });

  it("omits untrustworthy lastModified timestamps", () => {
    const mapped = toPublicSitemapParticipantProfileEntry(
      makeProfile({ publicName: "ada", updatedAt: "not-a-date" }),
    );
    assert.deepEqual(mapped, { publicName: "ada" });
  });

  it("public → private removes eligibility; private → public restores it", () => {
    const publicEntry = toPublicSitemapParticipantProfileEntry(
      makeProfile({ publicName: "ada", profileVisibility: "public" }),
    );
    assert.ok(publicEntry);

    const afterPrivate = toPublicSitemapParticipantProfileEntry(
      makeProfile({ publicName: "ada", profileVisibility: "private" }),
    );
    assert.equal(afterPrivate, null);

    const afterPublicAgain = toPublicSitemapParticipantProfileEntry(
      makeProfile({ publicName: "ada", profileVisibility: "public" }),
    );
    assert.equal(afterPublicAgain?.publicName, "ada");
  });

  it("response shape contains only publicName and optional updatedAt", async () => {
    const entries = await listPublicSitemapParticipantProfiles([
      { publicName: "ada", updatedAt: "2024-02-01T00:00:00.000Z" },
    ]);
    assert.deepEqual(Object.keys(entries[0]!).sort(), ["publicName", "updatedAt"]);
  });
});

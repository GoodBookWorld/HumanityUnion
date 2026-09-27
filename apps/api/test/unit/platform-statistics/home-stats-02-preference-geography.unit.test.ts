import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after } from "node:test";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatPreferredCityCommunityId, formatPreferredRegionId } from "@hu/geography";

import {
  countActiveAuthUsers,
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
  updateAuthUserAccountStatus,
} from "../../../src/modules/auth/auth-user.repository.js";
import { isMongoConfigured } from "../../../src/infrastructure/mongodb/mongo-config.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { buildDefaultMemberPreferences } from "../../../src/modules/preferences/preferences.defaults.js";
import { insertPreferences } from "../../../src/modules/preferences/preferences.repository.js";
import {
  countParticipantPreferenceGeography,
  type ParticipantPreferenceGeographySource,
} from "../../../src/modules/platform-statistics/platform-statistics-preference-geography.js";
import {
  clearPlatformStatisticsCache,
  readCachedPlatformStatistics,
  writeCachedPlatformStatistics,
} from "../../../src/modules/platform-statistics/platform-statistics.cache.js";
import { getPlatformStatisticsPayload } from "../../../src/modules/platform-statistics/platform-statistics.service.js";
import { PLATFORM_STATISTICS_CACHE_TTL_MS } from "../../../src/modules/platform-statistics/platform-statistics.types.js";

const VANCOUVER = "17145";
const VICTORIA = "17156";
const LOS_ANGELES = "120784";
const EMAIL_PREFIX = "home-stats-02-";
const serviceSource = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../src/modules/platform-statistics/platform-statistics.service.ts",
  ),
  "utf8",
);

function geography(partial: {
  preferredCountryIds?: string[];
  preferredRegions?: string[];
  preferredCityCommunityIds?: string[];
  preferredGeographicScopes?: string[];
  preferredActivityAreas?: string[];
}, eligible = true): ParticipantPreferenceGeographySource {
  return {
    eligible,
    participationPreferences: partial,
  };
}

function expectCounts(
  participants: readonly ParticipantPreferenceGeographySource[],
  countries: number,
  regions: number,
): void {
  assert.deepEqual(countParticipantPreferenceGeography(participants), { countries, regions });
}

describe("HOME STATS 02 preference geography", () => {
  after(async () => {
    clearPlatformStatisticsCache();

    if (!isMongoConfigured()) {
      return;
    }

    const memberIds = ["home-stats-02-active", "home-stats-02-disabled"];
    await getMongoCollection(MONGO_COLLECTIONS.memberPreferences).deleteMany({
      memberId: { $in: memberIds },
    });
    await deleteAuthUsersByEmailPrefix(EMAIL_PREFIX);
  });

  it("1. no Participants => Countries=0, Regions=0", () => {
    expectCounts([], 0, 0);
  });

  it("2. eligible Participants with no geography Preferences => Countries=0, Regions=0", () => {
    expectCounts(
      [
        geography({
          preferredActivityAreas: ["Environment and Climate"],
          preferredGeographicScopes: [],
        }),
      ],
      0,
      0,
    );
  });

  it("3. one Participant with CA only => Countries=1, Regions=0", () => {
    expectCounts([geography({ preferredCountryIds: ["CA"] })], 1, 0);
  });

  it("4. one Participant with CA + BC => Countries=1, Regions=1", () => {
    expectCounts(
      [
        geography({
          preferredCountryIds: ["CA"],
          preferredRegions: [formatPreferredRegionId("CA", "CA-BC")],
        }),
      ],
      1,
      1,
    );
  });

  it("5. CA + BC + Vancouver counts the city and not BC", () => {
    expectCounts(
      [
        geography({
          preferredCountryIds: ["CA"],
          preferredRegions: [formatPreferredRegionId("CA", "CA-BC")],
          preferredCityCommunityIds: [
            formatPreferredCityCommunityId("CA", "CA-BC", VANCOUVER),
          ],
        }),
      ],
      1,
      1,
    );
  });

  it("6. Vancouver and Victoria are two regions under one country", () => {
    expectCounts(
      [
        geography({
          preferredCountryIds: ["CA"],
          preferredRegions: [formatPreferredRegionId("CA", "CA-BC")],
          preferredCityCommunityIds: [
            formatPreferredCityCommunityId("CA", "CA-BC", VANCOUVER),
            formatPreferredCityCommunityId("CA", "CA-BC", VICTORIA),
          ],
        }),
      ],
      1,
      2,
    );
  });

  it("7. Vancouver plus Alberta with no city => Countries=1, Regions=2", () => {
    expectCounts(
      [
        geography({
          preferredCountryIds: ["CA"],
          preferredRegions: [
            formatPreferredRegionId("CA", "CA-BC"),
            formatPreferredRegionId("CA", "CA-AB"),
          ],
          preferredCityCommunityIds: [
            formatPreferredCityCommunityId("CA", "CA-BC", VANCOUVER),
          ],
        }),
      ],
      1,
      2,
    );
  });

  it("8. multiple Participants selecting the same Vancouver => Countries=1, Regions=1", () => {
    const vancouver = geography({
      preferredCountryIds: ["CA"],
      preferredRegions: [formatPreferredRegionId("CA", "CA-BC")],
      preferredCityCommunityIds: [formatPreferredCityCommunityId("CA", "CA-BC", VANCOUVER)],
    });
    expectCounts([vancouver, vancouver], 1, 1);
  });

  it("9. BC only plus Vancouver under BC => Countries=1, Regions=2", () => {
    expectCounts(
      [
        geography({
          preferredCountryIds: ["CA"],
          preferredRegions: [formatPreferredRegionId("CA", "CA-BC")],
        }),
        geography({
          preferredCountryIds: ["CA"],
          preferredRegions: [formatPreferredRegionId("CA", "CA-BC")],
          preferredCityCommunityIds: [
            formatPreferredCityCommunityId("CA", "CA-BC", VANCOUVER),
          ],
        }),
      ],
      1,
      2,
    );
  });

  it("10. a Canadian city and a California city are two countries and two regions", () => {
    expectCounts(
      [
        geography({
          preferredCountryIds: ["CA"],
          preferredRegions: [formatPreferredRegionId("CA", "CA-BC")],
          preferredCityCommunityIds: [
            formatPreferredCityCommunityId("CA", "CA-BC", VANCOUVER),
          ],
        }),
        geography({
          preferredCountryIds: ["US"],
          preferredRegions: [formatPreferredRegionId("US", "US-CA")],
          preferredCityCommunityIds: [
            formatPreferredCityCommunityId("US", "US-CA", LOS_ANGELES),
          ],
        }),
      ],
      2,
      2,
    );
  });

  it("11. a valid region implies its country when preferredCountryIds is absent", () => {
    expectCounts(
      [geography({ preferredRegions: [formatPreferredRegionId("CA", "CA-BC")] })],
      1,
      1,
    );
  });

  it("12. a valid city implies its country when preferredCountryIds is absent", () => {
    expectCounts(
      [
        geography({
          preferredCityCommunityIds: [
            formatPreferredCityCommunityId("CA", "CA-BC", VANCOUVER),
          ],
        }),
      ],
      1,
      1,
    );
  });

  it("13. world contributes neither Country nor Region", () => {
    expectCounts([geography({ preferredGeographicScopes: ["world"] })], 0, 0);
    expectCounts(
      [
        geography({
          preferredCountryIds: ["CA"],
          preferredGeographicScopes: ["world"],
        }),
      ],
      1,
      0,
    );
  });

  it("14. malformed geography does not create counts", () => {
    expectCounts(
      [
        geography({
          preferredCountryIds: ["not-a-country", ""],
          preferredRegions: ["nope", "ZZ::ZZ-NOPE", "::"],
          preferredCityCommunityIds: ["Vancouver", "CA::CA-BC::not-a-city", "bad"],
        }),
      ],
      0,
      0,
    );
  });

  it("15. a disabled Participant contributes neither Country nor Region", () => {
    expectCounts(
      [
        geography(
          {
            preferredCountryIds: ["US"],
            preferredRegions: [formatPreferredRegionId("US", "US-CA")],
            preferredCityCommunityIds: [
              formatPreferredCityCommunityId("US", "US-CA", LOS_ANGELES),
            ],
          },
          false,
        ),
        geography({}),
      ],
      0,
      0,
    );
  });

  it("16. Participation Area without Preferences contributes nothing", () => {
    assert.doesNotMatch(serviceSource, /listActiveParticipationAreas/);
    assert.doesNotMatch(serviceSource, /participation_areas/);
    expectCounts([geography({})], 0, 0);
  });

  it("17. profile country/region without Preferences contributes nothing", () => {
    assert.doesNotMatch(serviceSource, /profile\.country/);
    assert.doesNotMatch(serviceSource, /countGeographyFromMembers/);
    expectCounts([geography({})], 0, 0);
  });

  it("18. existing Participants statistic still uses non-disabled auth users", async () => {
    assert.match(serviceSource, /countActiveAuthUsers\(/);
    assert.match(serviceSource, /listActiveAuthUserMemberIds\(/);
    clearPlatformStatisticsCache();

    if (!isMongoConfigured()) {
      return;
    }

    const payload = await getPlatformStatisticsPayload();
    assert.equal(payload.data.users, await countActiveAuthUsers());
  });

  it("19. endpoint payload exposes aggregate numeric values only", async () => {
    clearPlatformStatisticsCache();
    const payload = await getPlatformStatisticsPayload();

    for (const value of Object.values(payload.data)) {
      assert.equal(typeof value, "number");
      assert.equal(Number.isInteger(value), true);
    }

    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes("preferredCountryIds"), false);
    assert.equal(serialized.includes("preferredRegions"), false);
    assert.equal(serialized.includes("preferredCityCommunityIds"), false);
    assert.equal(serialized.includes("::"), false);
    assert.equal(serialized.includes("@"), false);
  });

  it("20. 60-second cache behavior remains intact", async () => {
    assert.equal(PLATFORM_STATISTICS_CACHE_TTL_MS, 60_000);
    clearPlatformStatisticsCache();

    const now = 1_700_000_000_000;
    writeCachedPlatformStatistics(
      {
        data: {
          users: 5,
          activeMembers: 0,
          countries: 0,
          regions: 0,
          authors: 0,
          initiatives: 0,
          proposals: 0,
          collectiveDecisions: 0,
          civicActionPackages: 0,
          officialResponses: 0,
          civicArchive: 0,
        },
        meta: { activeMemberWindowDays: 90, generatedAt: "2026-09-27T00:00:00.000Z" },
      },
      now,
    );

    assert.equal(readCachedPlatformStatistics(now + 59_999)?.data.countries, 0);
    assert.equal(readCachedPlatformStatistics(now + 60_000), null);

    clearPlatformStatisticsCache();
    const first = await getPlatformStatisticsPayload();
    const second = await getPlatformStatisticsPayload();
    assert.equal(second.meta.generatedAt, first.meta.generatedAt);
    clearPlatformStatisticsCache();
  });

  it("eligible auth preferences are counted and disabled auth preferences are not", async () => {
    if (!isMongoConfigured()) {
      return;
    }

    await deleteAuthUsersByEmailPrefix(EMAIL_PREFIX);
    await getMongoCollection(MONGO_COLLECTIONS.memberPreferences).deleteMany({
      memberId: { $in: ["home-stats-02-active", "home-stats-02-disabled"] },
    });
    clearPlatformStatisticsCache();
    const before = await getPlatformStatisticsPayload();

    const active = await insertAuthUser(
      {
        email: `${EMAIL_PREFIX}active@example.com`,
        password: "home-stats-02-password",
        displayName: "Home Stats Active",
      },
      "home-stats-02-active",
    );
    const disabled = await insertAuthUser(
      {
        email: `${EMAIL_PREFIX}disabled@example.com`,
        password: "home-stats-02-password",
        displayName: "Home Stats Disabled",
      },
      "home-stats-02-disabled",
    );
    await updateAuthUserAccountStatus(disabled.userId, "disabled");

    const activePreferences = buildDefaultMemberPreferences({
      memberId: active.memberId,
      userId: active.userId,
    });
    activePreferences.participationPreferences.preferredCountryIds = ["CA"];
    activePreferences.participationPreferences.preferredRegions = [
      formatPreferredRegionId("CA", "CA-BC"),
    ];

    const disabledPreferences = buildDefaultMemberPreferences({
      memberId: disabled.memberId,
      userId: disabled.userId,
    });
    disabledPreferences.participationPreferences.preferredCountryIds = ["US"];
    disabledPreferences.participationPreferences.preferredRegions = [
      formatPreferredRegionId("US", "US-CA"),
    ];
    disabledPreferences.participationPreferences.preferredCityCommunityIds = [
      formatPreferredCityCommunityId("US", "US-CA", LOS_ANGELES),
    ];

    await insertPreferences(activePreferences);
    await insertPreferences(disabledPreferences);
    clearPlatformStatisticsCache();
    const payload = await getPlatformStatisticsPayload();

    assert.equal(payload.data.users, before.data.users + 1);
    assert.equal(payload.data.countries, before.data.countries + 1);
    assert.equal(payload.data.regions, before.data.regions + 1);

    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes(active.memberId), false);
    assert.equal(serialized.includes(disabled.memberId), false);
    assert.equal(serialized.includes(EMAIL_PREFIX), false);
    assert.equal(serialized.includes("CA-BC"), false);
    assert.equal(serialized.includes("US-CA"), false);

    clearPlatformStatisticsCache();
  });
});

/**
 * Step 15D.1 — Home statistics + Search date consumer fixes (Web).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { deepMergeMessages } from "../i18n/load-ui-messages.js";
import { formatInitiativeExperienceDate } from "../public-initiative-experience/initiative-experience-i18n.js";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "../..");

describe("Step 15D.1 — Home statistics + Search date consumers", () => {
  it("16 Home statistics does not use English-merged .has() as localization evidence", () => {
    const src = readFileSync(
      join(webSrc, "features/platform-statistics/components/HumanityUnionInNumbers.tsx"),
      "utf8",
    );
    assert.doesNotMatch(src, /tMetrics\.has|\.has\(\s*[`'"]\$\{sharedKey\}/);
    assert.doesNotMatch(src, /useTranslations\("publicStatistics\.metrics"\)/);
    assert.match(src, /cards\.\$\{card\.key/);

    const english = {
      publicHome: {
        statistics: {
          cards: {
            users: { label: "Participants", description: "EN desc" },
          },
        },
      },
      publicStatistics: {
        metrics: {
          participants: { label: "Participants" },
        },
      },
    };
    const remote = {
      publicHome: {
        statistics: {
          cards: {
            users: { label: "მონაწილეები", description: "KA desc" },
          },
        },
      },
    };
    const merged = deepMergeMessages(english as never, remote as never) as {
      publicHome: { statistics: { cards: { users: { label: string } } } };
      publicStatistics: { metrics: { participants: { label: string } } };
    };
    // English-merged tree still has publicStatistics — that must not win.
    assert.equal(merged.publicStatistics.metrics.participants.label, "Participants");
    assert.equal(merged.publicHome.statistics.cards.users.label, "მონაწილეები");
    // Consumer contract: Home uses publicHome card labels only.
    const homeLabel = merged.publicHome.statistics.cards.users.label;
    assert.equal(homeLabel, "მონაწილეები");
    assert.notEqual(homeLabel, merged.publicStatistics.metrics.participants.label);
  });

  it("17 Search dates use the active document locale, not browser default", () => {
    const src = readFileSync(
      join(webSrc, "features/global-search/components/GlobalSearchPageContent.tsx"),
      "utf8",
    );
    assert.doesNotMatch(src, /toLocaleDateString\(\s*undefined/);
    assert.match(src, /formatInitiativeExperienceDate/);
    assert.match(src, /formatSearchResultDate\(locale/);

    const iso = "2024-06-15T12:00:00.000Z";
    const ka = formatInitiativeExperienceDate("ka", iso, { month: "long" });
    const en = formatInitiativeExperienceDate("en", iso, { month: "long" });
    assert.notEqual(ka, en);
    assert.match(ka, /ივნ|წლის|2024/);
    assert.doesNotMatch(ka, /^June /);
  });

  it("18 Search result content ownership remains CT/PLP presentation adapters", () => {
    const src = readFileSync(
      join(webSrc, "features/global-search/components/GlobalSearchPageContent.tsx"),
      "utf8",
    );
    assert.match(src, /buildSearchResultPresentation|readSearchResultTitle|readSearchResultSummary/);
    assert.match(src, /useTranslations\("search"\)/);
  });
});

/**
 * Pack 10E — Final polish & deployment certification contracts for Packs 10A–10D.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");
const repoRoot = path.resolve(webRoot, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 10E — geography deployment readiness", () => {
  it("gitignore/dockerignore exceptions keep public geography communities trackable", () => {
    const gitignore = readRepo(".gitignore");
    const dockerignore = readRepo(".dockerignore");
    assert.match(gitignore, /!apps\/web\/public\/data\/geography\/\*\*/);
    assert.match(dockerignore, /!apps\/web\/public\/data/);
    assert.match(dockerignore, /^data$/m);

    const caBc = path.join(webRoot, "public/data/geography/communities/CA/CA-BC.json");
    assert.ok(existsSync(caBc));

    // Exit 1 => path is NOT ignored (git check-ignore -q).
    let ignored = true;
    try {
      execFileSync("git", ["check-ignore", "-q", caBc], { cwd: repoRoot });
    } catch (error) {
      const status = (error as { status?: number }).status;
      ignored = status === 0;
      assert.equal(status, 1, "CA-BC.json must not be ignored");
    }
    assert.equal(ignored, false);

    const listed = execFileSync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "--", caBc],
      { cwd: repoRoot, encoding: "utf8" },
    ).trim();
    assert.ok(listed.endsWith("CA-BC.json"), listed);
  });

  it("representative community datasets are valid non-empty JSON", () => {
    const samples = [
      ["CA", "CA-BC", 100],
      ["US", "US-CA", 500],
      ["UA", "UA-30", 1],
    ] as const;

    for (const [country, region, minCount] of samples) {
      const filePath = path.join(
        webRoot,
        "public/data/geography/communities",
        country,
        `${region}.json`,
      );
      assert.ok(existsSync(filePath), filePath);
      const records = JSON.parse(readFileSync(filePath, "utf8")) as Array<{
        code: string;
        label: string;
      }>;
      assert.ok(records.length >= minCount, `${region} count ${records.length}`);
      assert.ok(records.every((row) => row.code && row.label));
    }

    const caBc = JSON.parse(
      readFileSync(
        path.join(webRoot, "public/data/geography/communities/CA/CA-BC.json"),
        "utf8",
      ),
    ) as unknown[];
    assert.equal(caBc.length, 139);
  });
});

describe("Pack 10E — series contract anchors", () => {
  it("10A header is burger → brand → avatar; avatar opens drawer", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const controls = readWeb("design-system/components/BrowserWorkspaceHeaderControls.tsx");
    assert.match(header, /HumanityHeaderMenuButton/);
    assert.match(header, /humanity-header__end/);
    assert.match(controls, /tWorkspace\("openMenu"\)/);
    assert.match(controls, /PwaWorkspaceDrawer/);
    assert.doesNotMatch(controls, /href="\/workspace"/);
    assert.doesNotMatch(controls, /workspace-trigger/);
  });

  it("10C Country order ends with News → Team → Partners; 10D media tabs avoid vertical scrollIntoView", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const body = page.slice(page.indexOf("return ("));
    const news = body.indexOf("<CountryPublicNewsWidget");
    const team = body.indexOf("<CountryTeamSection");
    const partners = body.indexOf("<CountryPartnersSection");
    assert.ok(news > 0 && team > news && partners > team);

    const tabs = readWeb(
      "features/civic-media-center/components/TrustedMediaCategoryTabs.tsx",
    );
    assert.doesNotMatch(tabs, /\.scrollIntoView\s*\(/);
    assert.match(tabs, /tabList\.scrollTo\s*\(/);

    const board = readWeb(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    assert.doesNotMatch(board, /pie-election-results__tie/);
  });

  it("legacy PublicChoiceSelectOneVotingBoard remains unmounted", () => {
    const board = readWeb(
      "features/public-choice-candidate/components/PublicChoiceSelectOneVotingBoard.tsx",
    );
    assert.match(board, /\(tie\)/);

    const pack03 = readWeb("features/public-choice-ux-pack03/public-choice-ux-pack03.test.ts");
    const pack04 = readWeb("features/public-choice-ux-pack04/public-choice-ux-pack04.test.ts");
    assert.match(pack03, /doesNotMatch\(cd, \/PublicChoiceSelectOneVotingBoard\/\)/);
    assert.match(pack04, /doesNotMatch\(cd, \/PublicChoiceSelectOneVotingBoard\/\)/);
  });
});

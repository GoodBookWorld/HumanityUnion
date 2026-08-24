/**
 * Pack 17D — Distribution UI wired to Pack 17C platform social accounts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 17D — publication social distribution UI", () => {
  it("Distribution uses HU platform channels, not personal Author accounts", () => {
    const panel = readWeb("features/blog/components/BlogPublicationOptimizationPanel.tsx");
    assert.match(panel, /Humanity Union social distribution/);
    assert.match(
      panel,
      /Choose the Humanity Union social channels where this publication may be distributed/,
    );
    assert.match(panel, /not access to your personal social accounts/i);
    assert.match(panel, /fetchPublicPlatformSocialAccounts/);
    assert.match(panel, /platform-social-accounts-public-api/);
    assert.match(panel, /PLATFORM_SOCIAL_NETWORKS/);
    assert.match(panel, /setChannelPermitted/);
    assert.match(panel, /Official channel not configured/);
    assert.match(panel, /External API not connected/);
    assert.doesNotMatch(panel, /Author connected social accounts/);
    assert.doesNotMatch(panel, /linkedin/i);
    assert.doesNotMatch(panel, /Published to Facebook|posted successfully/i);
  });

  it("write path persists huPlatformChannels as distribution intent", () => {
    const panel = readWeb("features/blog/components/BlogPublicationOptimizationPanel.tsx");
    assert.match(panel, /huPlatformChannels/);
    assert.match(panel, /permitted/);
    assert.match(panel, /huSocialShare: anyPermitted \? "opt_in" : "unset"/);
    assert.match(panel, /authorExternalAccounts: \[\]/);
  });
});

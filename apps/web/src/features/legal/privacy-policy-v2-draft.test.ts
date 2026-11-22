import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { isAccountDeletionUiEnabled } from "../account-deletion/account-deletion-availability";
import {
  PRIVACY_POLICY_V2_EFFECTIVE_DATE,
  PRIVACY_POLICY_V2_MATERIAL_CHANGE_NOTICE,
  PRIVACY_POLICY_V2_SECTION_13_PARAGRAPHS,
  PRIVACY_POLICY_V2_SECTION_ADDITIONS,
  PRIVACY_POLICY_V2_VERSION,
  PUBLISHED_PRIVACY_POLICY_VERSION,
} from "./privacy-policy-v2-draft";

const SRC = new URL("../../", import.meta.url);
const REPO = new URL("../../../../../", import.meta.url);

function read(root: URL, path: string): string {
  return readFileSync(new URL(path, root), "utf8");
}

describe("staged privacy policy v2", () => {
  it("keeps the published English policy and version on v1", () => {
    const page = read(SRC, "app/privacy/page.tsx");
    const localePage = read(SRC, "app/[locale]/privacy/page.tsx");
    const versions = read(REPO, "packages/types/src/domain/legal-localization.ts");
    const platform = read(REPO, "apps/api/src/config/platform.config.ts");
    assert.equal(PUBLISHED_PRIVACY_POLICY_VERSION, "privacy-2026-11-v1");
    assert.match(versions, /privacy: "privacy-2026-11-v1"/);
    assert.doesNotMatch(versions, /privacy-2026-11-v2/);
    assert.match(platform, /ACCOUNT_DELETION_ENABLED\?\.trim\(\)/);
    assert.doesNotMatch(platform, /ACCOUNT_DELETION_ENABLED\s*=\s*"true"/);
    assert.match(page, /Effective Date: November 18, 2026/);
    assert.match(
      page,
      /Participants may request deletion of their account or personal information by contacting/,
    );
    assert.doesNotMatch(page, /privacy-policy-v2-draft/);
    assert.doesNotMatch(page, /privacy-2026-11-v2/);
    assert.doesNotMatch(page, /720 hours/);
    assert.match(localePage, /from "\.\.\/\.\.\/privacy\/page"/);
    assert.equal(PRIVACY_POLICY_V2_EFFECTIVE_DATE, null);
  });

  it("holds the approved v2 text without publishing or translating it", () => {
    const section13 = PRIVACY_POLICY_V2_SECTION_13_PARAGRAPHS.join("\n");
    assert.equal(PRIVACY_POLICY_V2_VERSION, "privacy-2026-11-v2");
    assert.match(section13, /30 days/);
    assert.match(section13, /720 hours/);
    assert.match(section13, /attempts to send one reminder/);
    assert.match(section13, /Delivery of the reminder is not guaranteed/);
    assert.match(section13, /Recovery becomes unavailable at the exact deadline/);
    assert.match(section13, /not instantaneous/);
    assert.match(section13, /does not mean that every item of personal information disappears/);
    assert.match(section13, /does not cancel a confirmed deletion/);
    assert.match(section13, /does not lift the suspension/);
    assert.doesNotMatch(section13, /legal hold/i);
    assert.match(PRIVACY_POLICY_V2_SECTION_ADDITIONS.section6, /public civic records/);
    assert.match(PRIVACY_POLICY_V2_SECTION_ADDITIONS.section7, /private messages/i);
    assert.match(PRIVACY_POLICY_V2_SECTION_ADDITIONS.section8, /essential account communications/);
    assert.match(PRIVACY_POLICY_V2_SECTION_ADDITIONS.section12, /does not keep the closed account open/);
    assert.match(PRIVACY_POLICY_V2_MATERIAL_CHANGE_NOTICE, /30 days \(720 hours\)/);
    assert.match(PRIVACY_POLICY_V2_MATERIAL_CHANGE_NOTICE, /new account/);

    const terms = read(SRC, "app/terms/page.tsx");
    const page = read(SRC, "app/privacy/page.tsx");
    const emailTemplates = read(REPO, "apps/api/src/modules/email/email.templates.ts");
    assert.doesNotMatch(terms, /Account closure and retention are described/);
    assert.doesNotMatch(emailTemplates, /Humanity Union has updated its Privacy Policy/);
    assert.doesNotMatch(page, /Humanity Union has updated its Privacy Policy/);
    assert.equal(isAccountDeletionUiEnabled({ NODE_ENV: "test" }), false);
  });
});

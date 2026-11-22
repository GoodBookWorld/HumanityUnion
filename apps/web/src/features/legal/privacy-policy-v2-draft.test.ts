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
  it("publishes English policy v2 with the approved date and keeps deletion off", () => {
    const page = read(SRC, "app/privacy/page.tsx");
    const localePage = read(SRC, "app/[locale]/privacy/page.tsx");
    const versions = read(REPO, "packages/types/src/domain/legal-localization.ts");
    const platform = read(REPO, "apps/api/src/config/platform.config.ts");
    const webFlag = read(SRC, "features/account-deletion/account-deletion-availability.ts");
    const resolver = read(REPO, "apps/api/src/modules/legal-localization/legal-localization.public.ts");
    assert.equal(PUBLISHED_PRIVACY_POLICY_VERSION, "privacy-2026-11-v2");
    assert.equal(PRIVACY_POLICY_V2_VERSION, "privacy-2026-11-v2");
    assert.equal(PRIVACY_POLICY_V2_EFFECTIVE_DATE, "2026-11-22");
    assert.match(versions, /privacy: "privacy-2026-11-v2"/);
    assert.match(versions, /terms: "terms-2026-03-v1"/);
    assert.match(platform, /ACCOUNT_DELETION_ENABLED\?\.trim\(\)/);
    assert.doesNotMatch(platform, /ACCOUNT_DELETION_ENABLED\s*=\s*"true"/);
    assert.match(webFlag, /NEXT_PUBLIC_ACCOUNT_DELETION_ENABLED\?\.trim\(\)/);
    assert.doesNotMatch(webFlag, /NEXT_PUBLIC_ACCOUNT_DELETION_ENABLED\s*=\s*"true"/);
    assert.match(page, /Effective Date: November 22, 2026/);
    assert.doesNotMatch(page, /Effective Date: November 18, 2026/);
    assert.doesNotMatch(page, /privacy-policy-v2-draft/);
    assert.match(page, /720 hours from confirmation/);
    assert.match(page, /Closing an account does not, by itself, remove public civic records/);
    assert.match(page, /private messages remain available to the other participants/);
    assert.match(page, /essential account communications/);
    assert.match(page, /Account deletion follows section 13/);
    assert.match(page, /Recovery becomes unavailable at the exact deadline/);
    assert.match(page, /Closure is not instantaneous/);
    assert.match(page, /does not lift the suspension/);
    assert.match(page, /The rights in section 14/);
    assert.doesNotMatch(page, /legal hold/i);
    assert.match(page, /Material changes will be communicated through appropriate platform notices/);
    assert.match(resolver, /canonicalSourceVersion === CANONICAL_LEGAL_SOURCE_VERSIONS\[record\.documentType\]/);
    assert.match(resolver, /isStaleRelativeToCanonical/);
    assert.match(localePage, /from "\.\.\/\.\.\/privacy\/page"/);
    assert.equal(isAccountDeletionUiEnabled({ NODE_ENV: "test" }), false);
  });

  it("keeps the approved notice unsent and the section 13 rules intact", () => {
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

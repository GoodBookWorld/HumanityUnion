/**
 * TASK-095 — Country Experience + Email Delivery verification.
 * Run: npm run verify:country-experience-email-delivery
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyCountryExperience(): void {
  console.log("1. Country Experience");

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/countries/[countryCode]/page.tsx")),
    "Canonical /countries/[countryCode] route must exist",
  );

  const legacyPage = readRepoFile("apps/web/src/app/country/[countrySlug]/page.tsx");
  assert(
    legacyPage.includes("redirect("),
    "Legacy /country route must redirect to /countries/{ISO2}",
  );

  const dynamicPage = readRepoFile(
    "apps/web/src/features/country-experience/components/CountryExperienceDynamicPage.tsx",
  );
  assert(
    dynamicPage.includes("Country Statistics"),
    "Country page must include statistics section",
  );
  assert(
    dynamicPage.includes("Search Civic Activity in This Country"),
    "Country page must include scoped search form",
  );
  assert(
    dynamicPage.includes("Country Initiatives"),
    "Country page must include initiatives section",
  );
  assert(
    dynamicPage.includes("Recommended Media"),
    "Country page must include recommended media carousel",
  );
  assert(
    dynamicPage.includes("CountryPublicNewsWidget"),
    "Country page must include latest trusted news widget",
  );
  assert(!dynamicPage.includes("InteractiveWorldMap"), "Country page must not embed world map");

  const apiRoutes = readRepoFile(
    "apps/api/src/modules/country-statistics/country-statistics.routes.ts",
  );
  assert(
    apiRoutes.includes("/countries/:countryCode/statistics"),
    "Country statistics API route must exist",
  );

  const mapDoc = readRepoFile("docs/INTERACTIVE_WORLD_MAP_INTEGRATION.md");
  assert(
    mapDoc.includes("/countries/CA"),
    "Map integration doc must document /countries/CA contract",
  );
  assert(mapDoc.includes("_top"), "Map integration doc must document _top iframe navigation");

  const nav = readRepoFile("apps/web/src/features/public-experience/constants.ts");
  const navLabels = [
    "Home",
    "Institutions",
    "Initiatives",
    "Civic Media",
    "Knowledge",
    "Membership",
    "Search",
  ];
  let lastIndex = -1;
  for (const label of navLabels) {
    const index = nav.indexOf(`label: "${label}"`);
    assert(index >= 0, `Header navigation must include ${label}`);
    assert(index > lastIndex, `Header navigation order must place ${label} after prior items`);
    lastIndex = index;
  }

  const stats = readRepoFile(
    "apps/web/src/features/platform-statistics/components/HumanityUnionInNumbers.tsx",
  );
  assert(
    !stats.includes("Civic Action Packages"),
    "Home statistics must not include Civic Action Packages",
  );
  assert(
    stats.includes('label: "Members"'),
    'Home statistics Members card must be labeled "Members"',
  );
  assert(
    stats.includes('iconSrc: "/icons/workspace/member-check.svg"'),
    "Members card must use member-check.svg",
  );
}

function verifyEmailDelivery(): void {
  console.log("2. Email delivery gating");

  const emailService = readRepoFile("apps/api/src/modules/email/email.service.ts");
  assert(
    emailService.includes("sendTransactionalEmailAndAwait"),
    "Email service must support synchronous awaited delivery",
  );
  assert(
    emailService.includes("emailSent: true"),
    "Email service must return emailSent on success",
  );

  const authConfirmation = readRepoFile(
    "apps/api/src/modules/auth/auth-email-confirmation.service.ts",
  );
  assert(authConfirmation.includes("emailSent"), "Registration confirmation must expose emailSent");
  assert(
    authConfirmation.includes("markEmailConfirmationCodeDelivered"),
    "Registration confirmation must mark delivery only after provider success",
  );

  const twoStep = readRepoFile("apps/api/src/modules/auth/auth-login-two-step.service.ts");
  assert(twoStep.includes("emailSent"), "Two-step login must expose emailSent");

  const confirmForm = readRepoFile("apps/web/src/features/auth/components/ConfirmEmailForm.tsx");
  assert(
    confirmForm.includes("We could not send the confirmation code"),
    "Confirm email UI must show delivery failure message",
  );

  const envExample = readRepoFile("apps/api/.env.example");
  assert(envExample.includes("EMAIL_PROVIDER=mock"), ".env.example must document EMAIL_PROVIDER");
}

function runPass(pass: number): void {
  console.log(`\n=== verify:country-experience-email-delivery pass ${pass} ===`);
  verifyCountryExperience();
  verifyEmailDelivery();
}

for (let pass = 1; pass <= 3; pass += 1) {
  runPass(pass);
}

console.log("\nverify:country-experience-email-delivery PASSED (3 consecutive passes).");

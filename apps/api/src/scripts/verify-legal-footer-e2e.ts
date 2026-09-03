/**
 * TASK-076 — Legal pages, header/footer branding verification.
 * Run: npm run verify:legal-footer
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const FORBIDDEN_PRIVACY_TERMS = [
  "WordPress",
  "Gravatar",
  "comment metadata",
  "article editing cookies",
];
const FORBIDDEN_LAW_TERMS = ["Republic of Poland"];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, relativePath));
}

function verifyHeaderBranding(): void {
  console.log("1. Header branding and navigation");

  const header = readRepoFile("apps/web/src/design-system/components/HumanityHeader.tsx");
  const constants = readRepoFile("apps/web/src/features/public-experience/constants.ts");
  const layoutCss = readRepoFile("apps/web/src/design-system/layout.css");

  assert(
    header.includes("BRAND_TAGLINE") || header.includes("WORLD SOLIDARITY"),
    "Header must include WORLD SOLIDARITY tagline",
  );
  assert(layoutCss.includes(".humanity-header__tagline"), "Header tagline styles must exist");
  assert(
    header.includes("/brand/humanity-union-logo.svg"),
    "Header must use real Humanity Union logo",
  );
  assert(
    header.includes('aria-label="Humanity Union home"'),
    "Header logo link must be accessible",
  );
  assert(!header.includes('href="/support"'), "Header must not include Feedback link");
  assert(!constants.includes('"About"'), "Primary navigation must not include About");
  assert(header.includes("HeaderAuthUtility"), "Header must keep login/workspace access");
}

function verifyFooterStructure(): void {
  console.log("2. Footer structure and links");

  const footer = readRepoFile(
    "apps/web/src/features/public-experience/components/PublicExperienceFooter.tsx",
  );
  const footerLinks = readRepoFile("apps/web/src/features/public-experience/footer-links.ts");
  const footerCss = readRepoFile("apps/web/src/features/public-experience/public-experience.css");

  assert(
    footer.includes("public-experience-footer__grid"),
    "Footer must use four-block grid layout",
  );
  assert(
    footer.includes("WORLD SOLIDARITY") || footer.includes("FOOTER_CONTENT.tagline"),
    "Footer must include WORLD SOLIDARITY",
  );
  assert(
    footer.includes("/brand/humanity-union-logo.svg") ||
      footer.includes("public-experience-footer__logo"),
    "Footer must include real logo",
  );
  assert(footerLinks.includes('href: "/privacy"'), "Footer must link Privacy");
  assert(footerLinks.includes('href: "/terms"'), "Footer must link Terms");
  assert(footerLinks.includes('href: "/contact"'), "Footer must link Contact");
  assert(footerLinks.includes('href: "/support"'), "Footer Feedback must link to /support");
  assert(!footerLinks.includes('label: "About"'), "Footer must not include About placeholder");
  assert(!footerLinks.includes('label: "Media"'), "Footer must not include Media placeholder");
  assert(footerLinks.includes("Facebook"), "Footer must include Facebook social link");
  const footerSocial = readRepoFile(
    "apps/web/src/features/public-experience/components/FooterSocialLinks.tsx",
  );
  assert(footer.includes("FooterSocialLinks"), "Footer must render dedicated social icon links.");
  assert(
    footerLinks.includes("https://www.facebook.com/HumanityUnionWS/"),
    "Footer social links must use real external URLs.",
  );
  assert(footerSocial.includes('target="_blank"'), "Footer social links must open in a new tab.");
  assert(
    footerSocial.includes('rel="noopener noreferrer"'),
    'Footer social links must use rel="noopener noreferrer".',
  );
  assert(
    footerSocial.includes("aria-label={social.label}"),
    "Footer social icon links must include aria-label.",
  );
  assert(
    footer.includes("footerCopyright") &&
      (footer.includes("FOOTER_COPYRIGHT_YEAR") ||
        readRepoFile("apps/web/src/features/public-experience/constants.ts").includes(
          "FOOTER_COPYRIGHT_YEAR = 2024",
        )),
    "Footer must include localized 2024 copyright via footerCopyright ICU",
  );
  assert(
    footerCss.includes("@media (min-width: 64rem)"),
    "Footer must define desktop responsive layout",
  );
}

function verifyLegalPages(): void {
  console.log("3. Privacy, Terms, and Contact pages");

  const privacy = readRepoFile("apps/web/src/app/privacy/page.tsx");
  const terms = readRepoFile("apps/web/src/app/terms/page.tsx");
  const contact = readRepoFile("apps/web/src/app/contact/page.tsx");

  assert(fileExists("apps/web/src/app/privacy/page.tsx"), "Privacy page must exist");
  assert(fileExists("apps/web/src/app/terms/page.tsx"), "Terms page must exist");
  assert(fileExists("apps/web/src/app/contact/page.tsx"), "Contact page must exist");

  const layout = readRepoFile("apps/web/src/design-system/components/HumanityLayout.tsx");

  assert(layout.includes('id="main-content"'), "Layout must expose main-content landmark");
  assert(
    privacy.includes("info@huws.org") ||
      privacy.includes("CONTACT_EMAIL") ||
      readRepoFile("apps/web/src/features/public-experience/footer-links.ts").includes(
        "info@huws.org",
      ),
    "Privacy page must include contact email",
  );
  assert(
    terms.includes("British Columbia") && terms.includes("Canada"),
    "Terms must use BC/Canada governing law placeholder",
  );
  assert(
    contact.includes("mailto:info@huws.org") || contact.includes("mailtoContactLink"),
    "Contact page must use mailto link",
  );

  for (const term of FORBIDDEN_PRIVACY_TERMS) {
    assert(
      !privacy.includes(term),
      `Privacy page must not include WordPress-specific term: ${term}`,
    );
  }

  for (const term of FORBIDDEN_LAW_TERMS) {
    assert(!terms.includes(term), `Terms page must not include forbidden governing law: ${term}`);
  }
}

function verifyFaviconSupport(): void {
  console.log("4. Favicon support");

  const layout = readRepoFile("apps/web/src/app/layout.tsx");

  assert(
    fileExists("apps/web/public/brand/favicon.ico") ||
      fileExists("apps/web/src/app/brand/favicon.ico"),
    "Favicon file must exist in public or app directory",
  );
  assert(layout.includes("icons:"), "Root layout metadata must define icons");
  assert(
    readRepoFile("docs/FAVICON_ASSETS.md").includes("favicon.ico") &&
      readRepoFile("docs/FAVICON_ASSETS.md").includes("32"),
    "Favicon documentation must describe recommended sizes",
  );
}

function verifyAccessibilityBasics(): void {
  console.log("5. Accessibility basics");

  const layout = readRepoFile("apps/web/src/design-system/components/HumanityLayout.tsx");
  const footer = readRepoFile(
    "apps/web/src/features/public-experience/components/PublicExperienceFooter.tsx",
  );

  assert(layout.includes('href="#main-content"'), "Skip link must target main content");
  assert(footer.includes("<h2"), "Footer section headings must be semantic");
  assert(
    readRepoFile(
      "apps/web/src/features/public-experience/components/FooterSocialLinks.tsx",
    ).includes("aria-label"),
    "Footer social links must include aria-label",
  );
}

async function main(): Promise<void> {
  verifyHeaderBranding();
  verifyFooterStructure();
  verifyLegalPages();
  verifyFaviconSupport();
  verifyAccessibilityBasics();
  console.log("\nverify:legal-footer PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

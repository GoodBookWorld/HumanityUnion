/**
 * TASK-073 — Civic Nomination Form & Poster UI verification.
 * Run: npm run verify:civic-nomination-ui
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const FEATURE_DIR = path.join(REPO_ROOT, "apps/web/src/features/civic-nomination");
const INSTITUTIONS_DIR = path.join(REPO_ROOT, "apps/web/src/features/institutions");

const NOMINATABLE_ROLES = [
  "humanity_council",
  "chamber_of_intellectual_analysis",
  "expert_analysis_team",
  "state_collaboration_department",
] as const;

const FORBIDDEN_UI_TERMS = [
  "follower",
  "likeCount",
  "ranking",
  "endorsement",
  "campaign poster",
  "supportVotes",
  "voteWeight",
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function readFeatureSources(): string {
  return fs
    .readdirSync(FEATURE_DIR, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && /\.(tsx|ts|css)$/.test(entry))
    .map((entry) => fs.readFileSync(path.join(FEATURE_DIR, entry), "utf-8"))
    .join("\n");
}

function verifyRoutesAndComponents(): void {
  console.log("1. Routes and component boundaries");

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/institutions/nominations/new/page.tsx")),
    "Nomination form route must exist at /institutions/nominations/new",
  );
  assert(
    fs.existsSync(
      path.join(REPO_ROOT, "apps/web/src/app/institutions/nominations/[nominationId]/page.tsx"),
    ),
    "Full poster route must exist at /institutions/nominations/[nominationId]",
  );

  for (const file of [
    "components/CivicNominationFormPageContent.tsx",
    "components/AllNominationsModal.tsx",
    "components/CompactNominationPoster.tsx",
    "components/FullNominationPosterPageContent.tsx",
    "components/NominationVotingWidgetPlaceholder.tsx",
    "components/NominationResultWidgetPlaceholder.tsx",
    "components/CreateNominationButton.tsx",
    "api.ts",
    "constants.ts",
    "nomination-form-utils.ts",
    "civic-nomination.css",
  ]) {
    assert(
      fs.existsSync(path.join(FEATURE_DIR, file)),
      `Missing civic nomination UI file: ${file}`,
    );
  }
}

function verifyInstitutionIntegration(): void {
  console.log("2. Institution page integration");

  const content = readRepoFile("apps/web/src/features/institutions/content.ts");
  const card = readRepoFile("apps/web/src/features/institutions/components/InstitutionCard.tsx");
  const wpc = readRepoFile("apps/web/src/features/institutions/components/WpcFeaturedCard.tsx");

  assert(
    card.includes("CreateNominationButton"),
    "Institution cards must include Create Nomination button",
  );
  assert(
    card.includes("All Nominations"),
    "Institution cards must include All Nominations modal trigger",
  );
  assert(
    card.includes("AllNominationsModal"),
    "Institution cards must mount All Nominations modal",
  );
  assert(
    content.includes("Representatives are appointed by participating governments."),
    "State representatives card must show appointment note",
  );
  assert(
    !wpc.includes("Create Nomination"),
    "WPC featured card must not expose civic nomination actions",
  );
  assert(
    wpc.includes("nonNominationNote"),
    "WPC featured card must render nomination exclusion note",
  );
  assert(
    content.includes("not open to civic nomination"),
    "WPC institution content must explain nomination exclusion",
  );

  for (const role of NOMINATABLE_ROLES) {
    assert(
      content.includes(`nominationRole: "${role}"`),
      `Content must include nominatable role: ${role}`,
    );
  }

  assert(
    !content.includes('nominationRole: "chamber_of_state_representatives"'),
    "State representatives must not be nominatable",
  );
}

function verifyFormAndValidation(): void {
  console.log("3. Nomination form and validation");

  const form = readRepoFile(
    "apps/web/src/features/civic-nomination/components/CivicNominationFormPageContent.tsx",
  );
  const utils = readRepoFile("apps/web/src/features/civic-nomination/nomination-form-utils.ts");
  const constants = readRepoFile("apps/web/src/features/civic-nomination/constants.ts");

  assert(form.includes("I nominate myself"), "Form must support self nomination");
  assert(form.includes("I nominate another person"), "Form must support other-person nomination");
  assert(form.includes("Save Draft"), "Form must include Save Draft action");
  assert(form.includes("Submit Nomination"), "Form must include Submit Nomination action");
  assert(form.includes("GeographySearchSelect"), "Form must use shared geography selectors");
  assert(form.includes("Civic Scope"), "Form must include Civic Scope section");
  assert(
    form.includes("universal-declaration-of-human-rights"),
    "Form must link UDHR declaration review in a new tab",
  );
  assert(
    form.includes("/knowledge/humanity-union-constitution"),
    "Form must link Humanity Union constitution review in a new tab",
  );
  assert(form.includes('target="same_window"'), "Declaration review links must open in a new tab");
  assert(form.includes("useSearchParams"), "Form must read role query param for preselect");
  assert(form.includes("getStoredAccessToken"), "Form must require authentication");
  assert(utils.includes("validateCivicNominationForm"), "Client-side validation helper must exist");
  assert(utils.includes("countryCode"), "Form state must store countryCode");
  assert(
    constants.includes("civicNominationFormPath"),
    "Form path helper must support role preselect",
  );
  assert(
    !form.includes("phoneNumber") && !form.includes("dateOfBirth") && !form.includes("gender"),
    "Form must not collect forbidden personal trait fields",
  );
}

function verifyPostersAndVotingPlaceholders(): void {
  console.log("4. Posters and deferred voting placeholders");

  const compact = readRepoFile(
    "apps/web/src/features/civic-nomination/components/CompactNominationPoster.tsx",
  );
  const full = readRepoFile(
    "apps/web/src/features/civic-nomination/components/FullNominationPosterPageContent.tsx",
  );
  const voting = readRepoFile(
    "apps/web/src/features/civic-nomination/components/NominationVotingWidgetPlaceholder.tsx",
  );
  const result = readRepoFile(
    "apps/web/src/features/civic-nomination/components/NominationResultWidgetPlaceholder.tsx",
  );
  const projection = readRepoFile(
    "apps/api/src/modules/civic-nomination/civic-nomination.projection.ts",
  );

  assert(
    compact.includes("civic-nomination-compact-poster__name"),
    "Compact poster must show nominee name",
  );
  assert(
    compact.includes("civic-nomination-compact-poster__role"),
    "Compact poster must show role",
  );
  assert(
    compact.includes("civic-nomination-compact-poster__country"),
    "Compact poster must show country",
  );
  assert(
    compact.includes("civic-nomination-compact-poster__tags"),
    "Compact poster must show expertise tags",
  );
  assert(
    compact.includes("civic-nomination-compact-poster__votes"),
    "Compact poster must show votes area",
  );
  assert(compact.includes("View Full Poster"), "Compact poster must link to full poster");

  assert(
    compact.includes("coming soon") || compact.includes("Coming soon"),
    "Compact poster vote area must use coming soon placeholder",
  );
  assert(!compact.includes("voteCount"), "Compact poster must not show fake vote numbers");

  assert(
    voting.includes("Transparent Support Voting"),
    "Full poster must include voting placeholder title",
  );
  assert(full.includes("legalNotice"), "Full poster must render legal notice from projection");
  assert(voting.includes("disabled"), "Voting widget placeholder must remain disabled");
  assert(result.includes("Coming soon"), "Result widget placeholder must not show vote totals");
  assert(
    projection.includes("/institutions/nominations/"),
    "Public URL projection must link to institutions nomination poster route",
  );
}

function verifyModalAccessibility(): void {
  console.log("5. Modal accessibility and search integration");

  const modal = readRepoFile(
    "apps/web/src/features/civic-nomination/components/AllNominationsModal.tsx",
  );
  const sources = readFeatureSources();

  assert(modal.includes('role="dialog"'), "All Nominations modal must use dialog role");
  assert(modal.includes("aria-modal"), "All Nominations modal must set aria-modal");
  assert(modal.includes("Escape"), "All Nominations modal must close on Escape");
  assert(modal.includes("listPublicCivicNominations"), "Modal must load published nominations");

  for (const term of FORBIDDEN_UI_TERMS) {
    assert(!sources.includes(term), `Civic nomination UI must not include ${term}`);
  }

  assert(
    sources.includes("prefers-reduced-motion") ||
      readRepoFile("apps/web/src/features/civic-nomination/civic-nomination.css").includes(
        "prefers-reduced-motion",
      ),
    "Civic nomination CSS must respect reduced motion",
  );
}

function verifyInstitutionsCss(): void {
  console.log("6. Institutions styling updates");

  const institutionsSources = fs
    .readdirSync(INSTITUTIONS_DIR, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && /\.(tsx|css)$/.test(entry))
    .map((entry) => fs.readFileSync(path.join(INSTITUTIONS_DIR, entry), "utf-8"))
    .join("\n");

  assert(
    institutionsSources.includes("institutions-card__nomination-note") ||
      readRepoFile("apps/web/src/features/civic-nomination/civic-nomination.css").includes(
        "institutions-card__nomination-note",
      ),
    "Institution nomination notes must be styled",
  );
}

function main(): void {
  verifyRoutesAndComponents();
  verifyInstitutionIntegration();
  verifyFormAndValidation();
  verifyPostersAndVotingPlaceholders();
  verifyModalAccessibility();
  verifyInstitutionsCss();

  console.log("\nverify:civic-nomination-ui PASS");
}

main();

/**
 * TASK-080 — Responsive header, auth forms, session and avatar delivery verification.
 * Run: npm run verify:responsive-auth-avatar-fixes
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

function verifyFormControls(): void {
  console.log("1. Authentication form controls");

  const components = readRepoFile("apps/web/src/design-system/components.css");
  const tokens = readRepoFile("apps/web/src/design-system/tokens.css");
  const authForm = readRepoFile("apps/web/src/features/auth/components/auth-form.css");

  assert(tokens.includes("--hu-border-default"), "Design tokens must define border default");
  assert(
    components.includes("border: 1px solid var(--hu-border-default)"),
    "Shared form controls must use visible default border",
  );
  assert(components.includes(":hover:not(:disabled)"), "Form controls must define hover state");
  assert(
    components.includes("border-color: var(--hu-color-primary)"),
    "Form controls must define focus border",
  );
  assert(components.includes(":disabled"), "Form controls must define disabled state");
  assert(authForm.includes("auth-form__field"), "Auth forms must use shared field structure");
}

function verifyFooterBrand(): void {
  console.log("2. Footer brand hierarchy");

  const footer = readRepoFile(
    "apps/web/src/features/public-experience/components/PublicExperienceFooter.tsx",
  );
  const css = readRepoFile("apps/web/src/features/public-experience/public-experience.css");

  assert(
    footer.includes("public-experience-footer__brand-text"),
    "Footer must use brand text stack",
  );
  assert(
    footer.includes("public-experience-footer__identity") &&
      footer.includes("public-experience-footer__tagline"),
    "Footer must render site name and slogan separately",
  );
  assert(css.includes("flex-direction: column"), "Footer brand text must stack vertically");
  assert(css.includes("color: #0174b0"), "Footer site name must use #0174B0");
  assert(css.includes("color: #a57979"), "Footer slogan must use #A57979");
  assert(css.includes("text-transform: uppercase"), "Footer slogan must remain uppercase");
}

function verifyStatisticsBreakpoints(): void {
  console.log("3. Platform statistics breakpoints");

  const css = readRepoFile("apps/web/src/features/platform-statistics/platform-statistics.css");

  assert(
    css.includes("grid-template-columns: repeat(9, minmax(0, 1fr))"),
    "Default statistics grid must use nine columns",
  );
  assert(css.includes("@media (max-width: 768px)"), "Statistics must switch at 768px");
  assert(
    !css.includes("@media (min-width: 75rem)") && !css.includes("64rem"),
    "Statistics must not use 1024px/1200px-only breakpoints",
  );
  assert(
    css.includes(".platform-statistics__description") && css.includes("display: none"),
    "Mobile statistics must hide explanatory text",
  );
}

function verifyHeaderBurgerMenu(): void {
  console.log("4. Header burger menu");

  const header = readRepoFile("apps/web/src/design-system/components/HumanityHeader.tsx");
  const mobile = readRepoFile("apps/web/src/design-system/components/HumanityHeaderMobileMenu.tsx");
  const layout = readRepoFile("apps/web/src/design-system/layout.css");

  assert(header.includes("HumanityHeaderMenuButton"), "Header must include burger button");
  assert(
    header.includes("humanity-header__nav--desktop"),
    "Header must separate desktop navigation",
  );
  assert(mobile.includes("aria-expanded"), "Burger button must expose aria-expanded");
  assert(mobile.includes("aria-controls"), "Burger button must expose aria-controls");
  assert(layout.includes("@media (max-width: 768px)"), "Header responsive rules must use 768px");
  assert(
    layout.includes(".humanity-header__nav--desktop") && layout.includes("display: none"),
    "Desktop navigation must hide on mobile",
  );
}

function verifyAuthTtl(): void {
  console.log("5. Access token lifetime");

  const authConfig = readRepoFile("apps/api/src/config/auth.config.ts");
  const envExample = readRepoFile("apps/api/.env.example");

  assert(
    authConfig.includes("JWT_ACCESS_TOKEN_TTL_MINUTES"),
    "Auth config must support TTL minutes env",
  );
  assert(authConfig.includes('"15m"'), "Auth config must default access token to 15 minutes");
  assert(
    envExample.includes("JWT_ACCESS_EXPIRES_IN=15m"),
    "API env example must document 15-minute TTL",
  );
}

function verifyAvatarDelivery(): void {
  console.log("6. Avatar media delivery headers");

  const middleware = readRepoFile("apps/api/src/modules/media-upload/media-static.middleware.ts");
  const app = readRepoFile("apps/api/src/app.ts");
  const avatar = readRepoFile("apps/web/src/design-system/components/HumanityAvatar.tsx");
  const profile = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfileWorkspace.tsx",
  );

  assert(
    middleware.includes("Cross-Origin-Resource-Policy") && middleware.includes("cross-origin"),
    "Media middleware must set cross-origin resource policy",
  );
  assert(
    middleware.includes("Access-Control-Allow-Origin"),
    "Media middleware must set CORS origin",
  );
  assert(middleware.includes("nosniff"), "Media middleware must keep nosniff protection");
  assert(app.includes("mediaStaticHeadersMiddleware"), "App must apply media static headers");
  assert(app.includes("Content-Type"), "Static media route must set image content types");
  assert(avatar.includes("HumanityAvatar"), "Shared avatar component must exist");
  assert(
    profile.includes("updateMyMemberProfile({ avatarUrl:"),
    "Avatar upload must persist avatarUrl",
  );
}

function verifyConsoleCleanup(): void {
  console.log("7. Console cleanup and auth discovery");

  const layout = readRepoFile("apps/web/src/app/layout.tsx");
  const authStatus = readRepoFile("apps/web/src/features/auth/use-client-auth-status.ts");
  const betaBanner = readRepoFile("apps/web/src/features/closed-beta/components/BetaBanner.tsx");

  assert(
    layout.includes('data-scroll-behavior="smooth"'),
    "Root layout must declare Next.js smooth scroll behavior",
  );
  assert(
    !betaBanner.includes("getMe()"),
    "Beta banner must not call /auth/me for signed-out visitors",
  );
  assert(
    authStatus.includes("refresh()"),
    "Auth status must attempt refresh before clearing session",
  );
  assert(
    authStatus.includes("if (!token)") && authStatus.includes("unauthenticated"),
    "Auth status must skip /auth/me when no token is stored",
  );
}

function main(): void {
  verifyFormControls();
  verifyFooterBrand();
  verifyStatisticsBreakpoints();
  verifyHeaderBurgerMenu();
  verifyAuthTtl();
  verifyAvatarDelivery();
  verifyConsoleCleanup();

  console.log("\nTASK-080 verify:responsive-auth-avatar-fixes PASS");
}

void main();

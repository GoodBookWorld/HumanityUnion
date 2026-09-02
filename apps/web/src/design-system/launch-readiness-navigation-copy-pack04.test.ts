import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { INITIATIVE_LIFECYCLE_STAGE_REGISTRY } from "@hu/types";

import { DESKTOP_CAPSULE_NAVIGATION, PRIMARY_NAVIGATION } from "../features/public-experience/constants.js";
import {
  FOOTER_PLATFORM_COLUMN_ONE,
  FOOTER_PLATFORM_COLUMN_TWO,
  REGISTRATION_ROUTE,
} from "../features/public-experience/footer-links.js";
import { REGISTRATION_GATEWAY_CONTENT } from "../features/public-experience/content.js";
import { WORKSPACE_ROUTE } from "../features/community-experience/constants.js";
import { ENTITY_TYPE_OPTIONS } from "../features/global-search/api.js";
import { resolveSaveButtonLabel } from "../features/member-profile/use-save-button-phase.js";
import { resolveCurrentDestination } from "./components/resolve-current-destination.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Launch Readiness Pack 04 — Navigation & Copy Consistency", () => {
  it("1 — public desktop capsule is exactly five canonical links", () => {
    assert.deepEqual(
      DESKTOP_CAPSULE_NAVIGATION.map((item) => item.label),
      ["Home", "Institutions", "Initiatives", "Knowledge", "Search"],
    );
    assert.equal(DESKTOP_CAPSULE_NAVIGATION.length, 5);
    assert.ok(!DESKTOP_CAPSULE_NAVIGATION.some((item) => item.label === "Blog"));
  });

  it("2 — /blog and /workspace do not activate Home", () => {
    assert.equal(resolveCurrentDestination("/blog"), null);
    assert.equal(resolveCurrentDestination("/workspace"), null);
    assert.equal(resolveCurrentDestination("/workspace/messages"), null);
    assert.equal(resolveCurrentDestination("/"), "Home");
  });

  it("3 — nested Initiative routes activate Initiatives where appropriate", () => {
    assert.equal(resolveCurrentDestination("/initiatives"), "Initiatives");
    assert.equal(
      resolveCurrentDestination("/initiatives/public/init_123"),
      "Initiatives",
    );
    assert.equal(
      resolveCurrentDestination("/collaborative-analysis/public/analysis_1"),
      "Initiatives",
    );
    assert.equal(resolveCurrentDestination("/petitions/public/pet_1"), "Initiatives");
    assert.equal(resolveCurrentDestination("/civic-archive/init_1"), "Initiatives");
    assert.equal(resolveCurrentDestination("/civic-archive"), null);
  });

  it("4 — Footer Blog remains; Support label matches /support", () => {
    assert.ok(
      FOOTER_PLATFORM_COLUMN_ONE.some((link) => link.label === "Blog" && link.href === "/blog"),
    );
    assert.ok(
      FOOTER_PLATFORM_COLUMN_TWO.some(
        (link) => link.label === "Support" && link.href === "/support",
      ),
    );
    assert.ok(!FOOTER_PLATFORM_COLUMN_TWO.some((link) => link.label === "Feedback"));
  });

  it("5 — registration surfaces no longer claim coming soon", () => {
    assert.equal(REGISTRATION_ROUTE, "/register");
    assert.equal(WORKSPACE_ROUTE, "/workspace");
    assert.equal(REGISTRATION_GATEWAY_CONTENT.actionLabel, "Create account");
    assert.doesNotMatch(REGISTRATION_GATEWAY_CONTENT.visitorConclusion, /coming soon|future capabilities/i);
    assert.doesNotMatch(REGISTRATION_GATEWAY_CONTENT.placeholderActionLabel, /coming soon|Identity Capability/i);

    const gateway = read("features/public-experience/components/RegistrationGatewayEvidence.tsx");
    assert.match(gateway, /REGISTRATION_ROUTE/);
    assert.doesNotMatch(gateway, /coming soon/i);

    const communityContent = read("features/community-experience/content.ts");
    assert.doesNotMatch(communityContent, /Registration entry coming soon/i);
    assert.doesNotMatch(communityContent, /remain future capabilities/i);

    const registerPage = read("app/register/page.tsx");
    assert.match(registerPage, /t\("registerTitle"\)/);
    assert.match(registerPage, /getTranslations\("auth"\)/);
    assert.doesNotMatch(registerPage, /coming soon/i);
  });

  it("6 — Participant/Member visible terminology follows canonical distinction", () => {
    const memberPage = read("app/member/page.tsx");
    assert.match(memberPage, /title="Profile"/);
    assert.match(memberPage, /Participant profile/);

    const publicProfile = read("app/member/[uniqueName]/page.tsx");
    assert.match(publicProfile, /Public Profile/);
    assert.doesNotMatch(publicProfile, /Public Member Profile/);

    const workspace = read("features/member-profile/components/MemberProfileWorkspace.tsx");
    assert.match(workspace, /title="Profile"/);
    assert.doesNotMatch(workspace, /title="Member Profile"/);

    const landing = read("features/initiatives/components/PublicInitiativesLanding.tsx");
    assert.match(landing, /Workspace tools appear here/);
    assert.doesNotMatch(landing, /Member workspace/);

    const membership = read("features/membership/components/MembershipPageContent.tsx");
    assert.match(membership, /Membership/);
  });

  it("7 — canonical Assistant name used on global Assistant surfaces", () => {
    const widget = read(
      "features/humanity-union-assistant/components/HumanityUnionAssistantWidget.tsx",
    );
    assert.match(widget, /Humanity Union Assistant/);

    const fab = read(
      "features/humanity-union-assistant/components/HumanityUnionAssistantFloatingButton.tsx",
    );
    assert.match(fab, /Open Humanity Union Assistant/);
    assert.match(fab, /title="Humanity Union Assistant"/);

    const implementation = read("features/implementation/components/ImplementationWorkspace.tsx");
    assert.match(implementation, /Humanity Union Assistant/);
    assert.doesNotMatch(implementation, /title="Humanity Assistant"/);
  });

  it("8 — Workspace Authoring/Publishing labels resolve correctly", () => {
    const nav = read("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /Become an Author/);
    assert.match(nav, /state\.navLabel/);
    assert.match(nav, /publishingWorkspaceHref/);
    assert.match(nav, /resolveWorkspaceNavDisplayLabel/);

    const groups = read("features/initiatives/components/build-workspace-nav-groups.ts");
    assert.match(groups, /label: "Profile"/);
    assert.match(groups, /href: "\/member"/);
  });

  it("9 — Editor navigation label remains Editorial Review", () => {
    const nav = read("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /label: "Editorial Review"/);
    assert.match(nav, /editorialReviewHref/);
    assert.match(nav, /resolveWorkspaceNavDisplayLabel/);

    const authoring = read("features/blog/components/AuthoringPageContent.tsx");
    assert.match(authoring, /Editorial Review/);
    assert.doesNotMatch(authoring, /future Administration \/ Editorial surface/);
  });

  it("10 — Lifecycle stage labels match registry", () => {
    const labels = INITIATIVE_LIFECYCLE_STAGE_REGISTRY.map((stage) => stage.label);
    assert.deepEqual(labels, [
      "Initiative",
      "Collaborative Analysis",
      "Improvement Proposals",
      "Revision",
      "Petition",
      "Decision Session",
      "Collective Decision",
      "Implementation Commitments",
      "Implementation Tracking",
      "Official Responses",
      "Public Impact",
      "Civic Archive",
    ]);

    const searchLabels: string[] = ENTITY_TYPE_OPTIONS.map((option) => option.label);
    assert.ok(searchLabels.includes("Improvement Proposals"));
    assert.ok(searchLabels.includes("Official Responses"));
    assert.ok(searchLabels.includes("Civic Archive"));
    assert.ok(searchLabels.includes("Revision"));
    assert.ok(!searchLabels.includes("Public Civic Archive"));
  });

  it("11 — notification / message / reminder labels remain distinct", () => {
    const notifications = read(
      "features/notifications/components/NotificationCenterPageContent.tsx",
    );
    assert.match(notifications, /No active notifications/);
    assert.match(notifications, /No unread messages/);
    assert.match(notifications, /No reminders yet/);

    const groups = read("features/initiatives/components/build-workspace-nav-groups.ts");
    assert.match(groups, /label: "Messages"/);
    assert.match(groups, /href: "\/workspace\/messages"/);
    assert.match(groups, /label: "Notifications"/);
    assert.match(groups, /href: "\/notifications"/);

    const nav = read("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /resolveWorkspaceNavDisplayLabel/);
  });

  it("12 — destructive labels map to distinct conceptual actions in presentation helpers", () => {
    const comments = read("features/blog/components/BlogCommentsSection.tsx");
    assert.match(comments, />\s*Remove\s*</);

    const support = read("features/support/components/SupportPageContent.tsx");
    assert.match(support, /CONTACT_EMAIL/);
    assert.doesNotMatch(support, /Contact placeholder/);
  });

  it("13 — async action labels use canonical wording", () => {
    assert.equal(resolveSaveButtonLabel("saving", "Save"), "Saving…");
    assert.equal(resolveSaveButtonLabel("success", "Save"), "Saved");
    assert.equal(resolveSaveButtonLabel("idle", "Save Draft"), "Save Draft");

    const comments = read("features/blog/components/BlogCommentsSection.tsx");
    assert.match(comments, /Posting…/);
    assert.match(comments, /Post Comment/);
  });

  it("14 — no obvious stale Civic Assistant product copy on active global surfaces", () => {
    const fab = read(
      "features/humanity-union-assistant/components/HumanityUnionAssistantFloatingButton.tsx",
    );
    const modal = read(
      "features/humanity-union-assistant/components/HumanityUnionAssistantModal.tsx",
    );
    assert.doesNotMatch(fab, /Civic Assistant/);
    assert.doesNotMatch(modal, /Civic Assistant/);
    assert.match(modal, /assistant\.modal\.title/);
    assert.doesNotMatch(modal, />\s*Humanity Union Assistant\s*</);
  });

  it("15 — mobile navigation retains required routes", () => {
    const mobileLabels = PRIMARY_NAVIGATION.map((item) => item.label);
    assert.ok(mobileLabels.includes("Home"));
    assert.ok(mobileLabels.includes("Institutions"));
    assert.ok(mobileLabels.includes("Initiatives"));
    assert.ok(mobileLabels.includes("Knowledge"));
    assert.ok(mobileLabels.includes("Search"));
    assert.ok(mobileLabels.includes("Civic Media"));
    assert.ok(mobileLabels.includes("Membership"));

    const mobile = read("design-system/components/HumanityHeaderMobileMenu.tsx");
    assert.match(mobile, /PRIMARY_NAVIGATION\.map/);
    assert.match(mobile, /href="\/register"/);
    assert.match(mobile, /tAuth\("createAccount"\)/);
    assert.match(mobile, /href="\/workspace"/);
    assert.match(mobile, /tNav\("workspace"\)/);
    assert.match(mobile, /tWorkspace\("notifications"\)/);
    assert.match(mobile, /tWorkspace\("profile"\)/);
    assert.match(mobile, /href="\/notifications"/);
    assert.match(mobile, /href="\/member"/);
    assert.doesNotMatch(mobile, /Member profile/);

    // Blog remains intentionally outside the mobile primary list; reachable via Footer + Knowledge.
    assert.ok(
      FOOTER_PLATFORM_COLUMN_ONE.some((link) => link.label === "Blog" && link.href === "/blog"),
    );
  });
});

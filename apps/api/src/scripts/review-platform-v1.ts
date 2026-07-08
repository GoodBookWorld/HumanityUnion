/**
 * TASK-048 — Humanity Platform Architecture Review v1.0 verification.
 * Run: npm run review:platform-v1
 *
 * Static architectural audit checks. Does not modify production code.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const CAPABILITY02_PIPELINE_MODULES = [
  "initiatives",
  "initiative-collaborative-analysis",
  "initiative-improvement-proposal",
  "initiative-version-revision",
  "decision-session",
  "initiative-collective-decision",
  "civic-action-package",
  "civic-delivery",
  "official-response",
  "civic-accountability",
  "initiative-implementation-commitment",
  "initiative-implementation-tracking",
  "initiative-public-impact",
  "public-civic-archive",
];

const INTEGRATION_PIPELINE_STAGE_IDS = [
  "initiative",
  "analysis",
  "proposal",
  "revision",
  "decision_session",
  "collective_decision",
  "civic_action_package",
  "official_response",
  "civic_accountability",
  "commitment",
  "tracking",
  "public_impact",
  "archive",
];

const WORKSPACE_SECTION_FILES = [
  "apps/web/src/features/execution-pipeline/components/CivicDeliveryWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/OfficialResponsesWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/CivicAccountabilityWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/DecisionResultWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/InitiativeImplementationCommitmentWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/InitiativeImplementationTrackingWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/InitiativePublicImpactWorkspace.tsx",
  "apps/web/src/features/execution-pipeline/components/InitiativePublicCivicArchiveWorkspace.tsx",
  "apps/web/src/features/decision-session/components/DecisionSessionWorkspace.tsx",
  "apps/web/src/features/civic-compatibility-review/components/CivicCompatibilityReviewWorkspace.tsx",
  "apps/web/src/features/capability02-integration/components/WorkspaceCivicIntegrationPanel.tsx",
];

const PUBLIC_EXPERIENCE_PAGES = [
  "apps/web/src/features/global-experience/components/GlobalExperiencePage.tsx",
  "apps/web/src/features/country-experience/components/CountryExperiencePage.tsx",
  "apps/web/src/features/region-experience/components/RegionExperiencePage.tsx",
  "apps/web/src/features/community-experience/components/CommunityExperiencePage.tsx",
];

const PRIVACY_ASSERT_MODULES = [
  "apps/api/src/modules/initiative-collective-decision/public-initiative-collective-decision.projection.ts",
  "apps/api/src/modules/civic-action-package/civic-action-package.projection.ts",
  "apps/api/src/modules/civic-delivery/civic-delivery.projection.ts",
  "apps/api/src/modules/official-response/official-response.projection.ts",
  "apps/api/src/modules/civic-accountability/civic-accountability.projection.ts",
];

const RAW_API_MESSAGES = [
  "Initiative API is not available.",
  "Member API is not available.",
  "Preferences API is not available.",
];

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

function verifyPipelineModulesExist(): void {
  console.log("1. Pipeline module completeness");

  for (const moduleName of CAPABILITY02_PIPELINE_MODULES) {
    const moduleDir = path.join(REPO_ROOT, "apps/api/src/modules", moduleName);
    assert(fs.existsSync(moduleDir), `Missing pipeline module directory: ${moduleName}`);
  }

  const integrationSource = readRepoFile(
    "apps/api/src/modules/capability02-integration/capability02-integration.service.ts",
  );

  for (const stageId of INTEGRATION_PIPELINE_STAGE_IDS) {
    assert(
      integrationSource.includes(`"${stageId}"`),
      `Integration pipeline must define stage: ${stageId}`,
    );
  }

  assert(
    integrationSource.includes("PIPELINE_STAGE_ORDER"),
    "Integration service must define PIPELINE_STAGE_ORDER",
  );
}

function verifyNoOrphanCapabilityModules(): void {
  console.log("2. No orphan Capability02 modules");

  const requiredModules = [
    "apps/api/src/modules/capability02-integration/index.ts",
    "apps/api/src/modules/civic-compatibility-review/index.ts",
    "apps/api/src/modules/workspace-assistant/index.ts",
    "apps/api/src/modules/participation-eligibility/participation-eligibility.service.ts",
  ];

  for (const moduleFile of requiredModules) {
    assert(fileExists(moduleFile), `Missing module file: ${moduleFile}`);
  }

  const appSource = readRepoFile("apps/api/src/app.ts");
  assert(
    appSource.includes("/api/v1/public/integration"),
    "Integration layer must be mounted in app.ts",
  );
  assert(
    appSource.includes("workspaceAssistantRouter") || appSource.includes("workspace-assistant"),
    "Workspace assistant must be mounted in app.ts",
  );
}

function verifyPublicPrivateSeparation(): void {
  console.log("3. Public/private API separation");

  const appSource = readRepoFile("apps/api/src/app.ts");
  assert(appSource.includes('"/api/v1/public/'), "Public routes must use /api/v1/public prefix");

  const publicInitiativeRoutes = readRepoFile(
    "apps/api/src/modules/initiatives/public-initiative.routes.ts",
  );
  assert(
    !publicInitiativeRoutes.includes("authenticationMiddleware"),
    "Public initiative routes must not require authentication",
  );

  const initiativeRoutes = readRepoFile("apps/api/src/modules/initiatives/initiative.routes.ts");
  assert(
    initiativeRoutes.includes("authenticationMiddleware"),
    "Private initiative routes must require authentication",
  );
}

function verifyProjectionConsistency(): void {
  console.log("4. Consistent public projections");

  const projectionModules = CAPABILITY02_PIPELINE_MODULES.filter(
    (name) => name !== "initiatives" && name !== "civic-delivery",
  );

  for (const moduleName of projectionModules) {
    const projectionGlob = fs
      .readdirSync(path.join(REPO_ROOT, "apps/api/src/modules", moduleName))
      .filter((file) => file.includes("projection") && file.endsWith(".ts"));

    assert(projectionGlob.length > 0, `Module ${moduleName} must define a projection file`);
  }

  assert(
    fileExists("apps/api/src/modules/initiatives/public-initiative.projection.ts"),
    "Initiatives must define public projection",
  );
  assert(
    fileExists("apps/api/src/modules/civic-delivery/civic-delivery.projection.ts"),
    "Civic delivery must define public projection",
  );
}

function verifyPrivacyGuards(): void {
  console.log("5. Privacy guards on sensitive projections");

  for (const file of PRIVACY_ASSERT_MODULES) {
    const source = readRepoFile(file);
    assert(
      source.includes("assertPublicProjection") || source.includes("assert"),
      `${file} must include runtime privacy assertion`,
    );
    assert(
      !source.includes("participantId: ") && !source.includes("participantId,"),
      `${file} must not expose participantId in projection output`,
    );
  }
}

function verifyIntegrationLayer(): void {
  console.log("6. Capability02 integration layer");

  const integrationTypes = readRepoFile("packages/types/src/domain/capability02-integration.ts");
  assert(integrationTypes.includes("CivicIntegrationView"), "Integration view type must exist");
  assert(integrationTypes.includes("CivicSearchMetadata"), "Search metadata contract must exist");
  assert(
    integrationTypes.includes("CIVIC_NOTIFICATION_EVENT_REGISTRY"),
    "Notification registry must exist",
  );

  const integrationService = readRepoFile(
    "apps/api/src/modules/capability02-integration/capability02-integration.service.ts",
  );
  assert(
    integrationService.includes("buildSearchMetadata"),
    "Integration service must build search metadata",
  );
  assert(
    integrationService.includes("buildIntegrationView"),
    "Integration service must build integration views",
  );
  assert(
    integrationService.includes("publicUrlForEntity"),
    "Integration service must centralize public URLs",
  );
}

function verifyDesignSystemAdoption(): void {
  console.log("7. Design system adoption");

  const layout = readRepoFile("apps/web/src/app/layout.tsx");
  const globals = readRepoFile("apps/web/src/app/globals.css");
  const tokens = readRepoFile("apps/web/src/design-system/tokens.css");

  assert(layout.includes("HumanityLayout"), "Root layout must use HumanityLayout");
  assert(globals.includes("humanity-design-system.css"), "Globals must import design system");
  assert(tokens.includes("--hu-color-primary: #0174b0"), "Primary color token must be official");

  const memberCss = readRepoFile("apps/web/src/components/member/member-workspace.css");
  assert(memberCss.includes("position: sticky"), "Workspace nav must be sticky");

  const assistantCss = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/workspace-civic-assistant.css",
  );
  assert(
    assistantCss.includes("var(--hu-header-height)"),
    "Assistant sticky offset must account for global header",
  );
}

function verifyWorkspaceIntegrity(): void {
  console.log("8. Workspace integrity");

  const sections = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/initiative-workspace-sections.ts",
  );
  assert(sections.includes("Public Civic Archive"), "Workspace must include Public Civic Archive");
  assert(sections.includes("Civic Integration"), "Workspace must include Civic Integration");

  for (const file of WORKSPACE_SECTION_FILES) {
    const source = readRepoFile(file);
    assert(source.includes("WorkspaceSectionShell"), `${file} must use WorkspaceSectionShell`);
  }

  const initiativesPage = readRepoFile("apps/web/src/app/initiatives/page.tsx");
  for (const message of RAW_API_MESSAGES) {
    assert(!initiativesPage.includes(message), "Initiatives page must not show raw API errors");
  }
}

function verifyPublicExperienceIntegrity(): void {
  console.log("9. Public experience integrity");

  for (const file of PUBLIC_EXPERIENCE_PAGES) {
    const source = readRepoFile(file);
    assert(!source.includes("<PublicExperienceHeader"), `${file} must not duplicate global header`);
    assert(!source.includes("<PublicExperienceFooter"), `${file} must not duplicate global footer`);
  }

  const layout = readRepoFile("apps/web/src/design-system/components/HumanityLayout.tsx");
  assert(layout.includes('id="main-content"'), "Global layout must expose main content landmark");

  const projectionEngine = readRepoFile("apps/web/src/features/public-projection-engine/index.ts");
  assert(
    projectionEngine.includes("loadGlobalExperienceProjections") ||
      fileExists(
        "apps/web/src/features/public-projection-engine/load-global-experience-projections.ts",
      ),
    "Public projection engine must exist",
  );
}

function verifyAssistantReadiness(): void {
  console.log("11. Assistant readiness");

  const assistantService = readRepoFile(
    "apps/api/src/modules/workspace-assistant/workspace-assistant.service.ts",
  );
  assert(
    assistantService.includes("safety") || assistantService.includes("Safety"),
    "Assistant service must enforce safety guardrails",
  );

  const safetyGuard = readRepoFile(
    "apps/api/src/modules/workspace-assistant/workspace-assistant-safety-guard.ts",
  );
  assert(safetyGuard.length > 0, "Assistant safety guard must exist");

  const assistantComponent = readRepoFile(
    "apps/web/src/features/workspace-civic-assistant/components/WorkspaceCivicAssistant.tsx",
  );
  assert(
    assistantComponent.includes("initiative-workspace-ux"),
    "Assistant must use shared workspace UX styles",
  );
}

function verifyDocumentationExists(): void {
  console.log("12. Architecture documentation");

  assert(fileExists("docs/DESIGN_SYSTEM.md"), "Design system documentation must exist");
  assert(
    fileExists("docs/HUMANITY_PLATFORM_ARCHITECTURE_REVIEW_V1.md"),
    "Architecture review v1.0 document must exist",
  );
  assert(
    fileExists("project/architecture/governance/CAPABILITY02_INTEGRATION_LAYER_ARCHITECTURE.md"),
    "Capability02 integration architecture must exist",
  );

  const designSystem = readRepoFile("docs/DESIGN_SYSTEM.md");
  assert(
    designSystem.includes("#0174B0"),
    "Design system doc must document official primary color",
  );
  assert(
    !designSystem.includes("#1B4F8A"),
    "Design system doc must not contain outdated primary color",
  );
}

function verifyKnownArchitecturalRisksDocumented(): void {
  console.log("13. Known risks documented in review");

  const review = readRepoFile("docs/HUMANITY_PLATFORM_ARCHITECTURE_REVIEW_V1.md");
  assert(review.includes("Architecture Score"), "Review must include architecture score");
  assert(review.includes("Technical Debt"), "Review must include technical debt section");
  assert(
    review.includes("Civic Delivery") || review.includes("civic delivery"),
    "Review must document civic delivery integration gap",
  );
  assert(
    review.includes("APPROVED WITH RECOMMENDATIONS") ||
      review.includes("CONDITIONALLY APPROVED") ||
      review.includes("APPROVED"),
    "Review must include architecture decision",
  );
}

function verifyPersistencePattern(): void {
  console.log("10. Persistence adapter pattern");

  const persistenceModules = [
    "initiatives",
    "initiative-collective-decision",
    "public-civic-archive",
    "civic-action-package",
  ];

  for (const moduleName of persistenceModules) {
    const persistenceDir = path.join(REPO_ROOT, "apps/api/src/modules", moduleName, "persistence");
    assert(fs.existsSync(persistenceDir), `${moduleName} must define persistence adapters`);

    const files = fs.readdirSync(persistenceDir);
    assert(
      files.some((file) => file.includes("memory")),
      `${moduleName} must include memory persistence adapter`,
    );
    assert(
      files.some((file) => file.includes("file")),
      `${moduleName} must include file persistence adapter`,
    );
  }
}

function main(): void {
  verifyPipelineModulesExist();
  verifyNoOrphanCapabilityModules();
  verifyPublicPrivateSeparation();
  verifyProjectionConsistency();
  verifyPrivacyGuards();
  verifyIntegrationLayer();
  verifyDesignSystemAdoption();
  verifyWorkspaceIntegrity();
  verifyPublicExperienceIntegrity();
  verifyPersistencePattern();
  verifyAssistantReadiness();
  verifyDocumentationExists();
  verifyKnownArchitecturalRisksDocumented();

  console.log("\nTASK-048 review:platform-v1 PASS");
}

main();

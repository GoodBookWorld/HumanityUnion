/**
 * TASK-077 — Public initiatives, media uploads, and auth UX verification.
 * Run: npm run verify:frontend-media-auth-fixes
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

dotenv.config({ path: path.resolve(REPO_ROOT, "apps/api/.env") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

function assert(condition: boolean, message: string): asserts condition {
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

function verifyStaticStructure(): void {
  console.log("1. Static structure and navigation");

  assert(
    fileExists("apps/web/public/brand/humanity-union-logo.svg"),
    "Brand logo asset must exist",
  );
  assert(
    fileExists("apps/web/src/app/workspace/initiatives/page.tsx"),
    "Private workspace initiatives route must exist",
  );

  const initiativesPage = readRepoFile("apps/web/src/app/initiatives/page.tsx");
  assert(
    initiativesPage.includes("WorldInitiativesPageContent"),
    "/initiatives must render public World Initiatives page",
  );
  assert(
    !initiativesPage.includes("InitiativesPageGate"),
    "/initiatives must not render private workspace gate",
  );

  const workspaceNav = readRepoFile(
    "apps/web/src/features/initiatives/components/WorkspaceNavigation.tsx",
  );
  assert(
    workspaceNav.includes('href: "/workspace/initiatives"'),
    "Workspace navigation must link private initiatives to /workspace/initiatives",
  );

  const header = readRepoFile("apps/web/src/design-system/components/HumanityHeader.tsx");
  assert(
    header.includes("/brand/humanity-union-logo.svg"),
    "Header must use real Humanity Union logo",
  );

  const footer = readRepoFile(
    "apps/web/src/features/public-experience/components/PublicExperienceFooter.tsx",
  );
  assert(
    footer.includes("/brand/humanity-union-logo.svg"),
    "Footer must use real Humanity Union logo",
  );
  assert(footer.includes("FooterSocialLinks"), "Footer must render SVG social icons");

  for (const icon of [
    "icons8-facebook.svg",
    "icons8-youtube.svg",
    "icons8-x.svg",
    "icons8-instagram.svg",
    "icons8-linkedin.svg",
  ]) {
    assert(
      fileExists(`apps/web/src/assets/icons/civic/${icon}`),
      `Footer social icon asset must exist: ${icon}`,
    );
  }

  const notificationsPage = readRepoFile(
    "apps/web/src/features/notifications/components/NotificationCenterPageContent.tsx",
  );
  assert(
    !notificationsPage.includes("<HumanityHeader"),
    "/notifications must not render a duplicate global header",
  );

  const headerAuth = readRepoFile("apps/web/src/design-system/components/HeaderAuthUtility.tsx");
  assert(
    headerAuth.includes("useClientAuthStatus") || headerAuth.includes('"pending"'),
    "Header auth utility must defer auth state until after hydration",
  );
  assert(
    !/if\s*\(\s*!getStoredAccessToken\(\)\s*\)\s*return/.test(headerAuth),
    "Header auth utility must not read auth token during render",
  );

  const memberPage = readRepoFile("apps/web/src/app/member/page.tsx");
  assert(
    !memberPage.includes("getCurrentMember"),
    "Member page must not perform server-side auth gate that breaks profile save UX",
  );

  for (const moduleFile of [
    "apps/api/src/modules/media-upload/media-upload.service.ts",
    "apps/api/src/modules/media-upload/local-media.provider.ts",
    "apps/api/src/modules/media-upload/media-upload.validation.ts",
    "apps/api/src/modules/media-upload/media-upload.routes.ts",
    "docs/MEDIA_UPLOAD_FOUNDATION.md",
  ]) {
    assert(fileExists(moduleFile), `Required media upload artifact must exist: ${moduleFile}`);
  }

  const formFields = readRepoFile(
    "apps/web/src/features/initiatives/components/InitiativeFormFields.tsx",
  );
  assert(
    formFields.includes("INITIATIVE_ACTIVITY_AREA_OPTIONS"),
    "Initiative forms must use canonical activity area list",
  );
  assert(
    formFields.includes("communityAssociation"),
    "Initiative forms must expose community association text input",
  );
}

async function verifyRuntimeBehavior(): Promise<void> {
  console.log("2. Runtime world initiatives and media upload behavior");

  const { seedMember } = await import("../modules/member/member.store.js");
  const { createInitiativeDraft, publishInitiative, saveInitiativeDraft } =
    await import("../modules/initiatives/initiative.service.js");
  const { listInitiatives } = await import("../modules/initiatives/initiative.store.js");
  const { listWorldInitiativeCardProjections, isEligibleForWorldInitiativesListing } =
    await import("../modules/initiatives/initiative-world-initiatives.projection.js");
  const { validateUploadedImageFile } =
    await import("../modules/media-upload/media-upload.validation.js");
  const { MediaUploadService } = await import("../modules/media-upload/media-upload.service.js");
  const { LocalMediaStorageProvider } =
    await import("../modules/media-upload/local-media.provider.js");
  const { validateAvatarUrl } =
    await import("../modules/member-profile/member-profile.validators.js");

  const steward = seedMember({
    id: "world-initiatives-steward",
    profile: {
      displayName: "World Initiatives Steward",
      uniqueName: "world-initiatives-steward",
      languages: ["en"],
    },
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const identity = { participantId: steward.id, userId: "verify-user" };

  const worldDraft = createInitiativeDraft(identity, {
    title: "World Climate Solidarity Initiative",
    description: "A projected world-scope civic initiative for verification.",
    activityArea: "Environment and Climate",
    participationScope: "world",
  });
  const projectedWorld = publishInitiative(identity, worldDraft.initiativeId);

  const communityDraft = createInitiativeDraft(identity, {
    title: "Local Community Garden Initiative",
    description: "Community-scoped initiative that must not appear on world listing.",
    activityArea: "Food and Agriculture",
    participationScope: "community",
    communityAssociation: "Nelson Community Garden",
  });
  await saveInitiativeDraft(identity, communityDraft.initiativeId, {
    communityAssociation: "Nelson Community Garden",
  });
  publishInitiative(identity, communityDraft.initiativeId);

  const privateDraft = createInitiativeDraft(identity, {
    title: "Private Draft Initiative",
    description: "Draft initiative excluded from public world listing.",
    activityArea: "Education",
    participationScope: "world",
  });

  assert(
    isEligibleForWorldInitiativesListing(projectedWorld),
    "Projected public world initiative must be eligible for world listing",
  );
  assert(
    !isEligibleForWorldInitiativesListing(privateDraft),
    "Draft initiatives must be excluded from world listing",
  );

  const worldCards = listWorldInitiativeCardProjections(listInitiatives(), 16);
  assert(
    worldCards.some((card) => card.initiativeId === projectedWorld.initiativeId),
    "World listing must include projected world initiative",
  );
  assert(
    !worldCards.some((card) => card.initiativeId === communityDraft.initiativeId),
    "Community-scoped initiatives must be excluded from world listing",
  );
  assert(worldCards.length <= 16, "World listing must cap at 16 initiatives");

  const mediaService = new MediaUploadService(new LocalMediaStorageProvider());
  const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  const avatarRecord = await mediaService.uploadMedia({
    purpose: "avatar",
    file: {
      buffer: pngBuffer,
      mimeType: "image/png",
      extension: ".png",
      size: pngBuffer.length,
      width: 1,
      height: 1,
    },
    ownerUserId: "verify-user",
    ownerParticipantId: steward.id,
    publicBaseUrl: "http://localhost:4000",
  });

  assert(
    avatarRecord.mediaUrl.includes("/api/v1/media/files/avatars/"),
    "Avatar media URL must be stable",
  );
  validateAvatarUrl(avatarRecord.mediaUrl);

  const initiativeImage = await mediaService.uploadMedia({
    purpose: "initiative-image",
    file: {
      buffer: pngBuffer,
      mimeType: "image/png",
      extension: ".png",
      size: pngBuffer.length,
      width: 1,
      height: 1,
    },
    ownerUserId: "verify-user",
    ownerParticipantId: steward.id,
    initiativeId: projectedWorld.initiativeId,
    publicBaseUrl: "http://localhost:4000",
  });

  assert(
    initiativeImage.mediaUrl.includes("/api/v1/media/files/initiatives/"),
    "Initiative image URL must use initiatives storage path",
  );

  let rejected = false;

  try {
    validateUploadedImageFile("avatar", {
      mimetype: "text/html",
      originalname: "evil.html",
      size: 32,
      buffer: Buffer.from("<html></html>"),
    } as Express.Multer.File);
  } catch {
    rejected = true;
  }

  assert(rejected, "Invalid MIME uploads must be rejected");
}

async function main(): Promise<void> {
  verifyStaticStructure();
  await verifyRuntimeBehavior();
  console.log("verify:frontend-media-auth-fixes — all checks passed");
}

void import("./verification-script-lifecycle.js").then(({ runVerificationScript }) =>
  runVerificationScript(main),
);

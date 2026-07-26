/**
 * TASK-105B — Membership countries and avatar crop editor verification.
 * Run: npm run verify:membership-avatar-geography
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const PASS_COUNT = 3;

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

function verifyMembershipParticipationCountries(): void {
  console.log("1. Membership civic participation countries");

  const form = readRepoFile(
    "apps/web/src/features/membership/components/MembershipApplicationForm.tsx",
  );
  const types = readRepoFile("packages/types/src/domain/membership.ts");
  const validators = readRepoFile("apps/api/src/modules/membership/membership.validators.ts");
  const multiSelect = readRepoFile(
    "apps/web/src/design-system/components/GeographyMultiSelect.tsx",
  );

  assert(
    form.includes("Countries of Civic Participation"),
    "Membership form must label civic participation countries.",
  );
  assert(
    form.includes("participationCountryCodes"),
    "Membership form must persist participationCountryCodes.",
  );
  assert(
    form.includes("GeographyMultiSelect"),
    "Membership form must use shared GeographyMultiSelect.",
  );
  assert(
    form.includes("toGeographyCountryOptions"),
    "Membership form must use shared geography dataset.",
  );
  assert(
    form.includes("Select the countries where you live, have community connections"),
    "Membership form must include civic participation helper text.",
  );
  assert(
    !form.includes('autoComplete="country"'),
    "Membership form must not imply citizenship/residence verification.",
  );
  assert(
    types.includes("participationCountryCodes"),
    "Membership types must include participationCountryCodes.",
  );
  assert(
    validators.includes("MEMBERSHIP_PARTICIPATION_COUNTRY_LIMIT"),
    "Membership validators must enforce participation country limit.",
  );
  assert(
    validators.includes("resolveParticipationCountryCodesInput"),
    "Membership validators must migrate legacy countryCode input.",
  );
  assert(
    multiSelect.includes("geography-multi-select__chip"),
    "GeographyMultiSelect must render removable chips.",
  );
  assert(multiSelect.includes("Clear All"), "GeographyMultiSelect must expose Clear All.");
  assert(
    !multiSelect.includes('type="checkbox"'),
    "GeographyMultiSelect must not render checkbox wall.",
  );
  assert(
    multiSelect.includes('role="combobox"'),
    "GeographyMultiSelect must expose combobox semantics.",
  );
}

function verifyAvatarCropEditor(): void {
  console.log("2. Avatar crop editor and upload flow");

  const workspace = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfileWorkspace.tsx",
  );
  const uploadField = readRepoFile(
    "apps/web/src/features/media-upload/components/AvatarImageUploadField.tsx",
  );
  const cropEditor = readRepoFile(
    "apps/web/src/features/media-upload/components/AvatarCropEditor.tsx",
  );
  const cropUtil = readRepoFile("apps/web/src/features/media-upload/avatar-crop.ts");
  const cropCss = readRepoFile(
    "apps/web/src/features/media-upload/components/avatar-crop-editor.css",
  );

  assert(
    workspace.includes("AvatarImageUploadField"),
    "Member profile must use avatar crop upload field.",
  );
  assert(uploadField.includes("AvatarCropEditor"), "Avatar upload must open crop editor.");
  assert(cropEditor.includes("Save Avatar"), "Crop editor must expose Save Avatar.");
  assert(cropEditor.includes("Reset"), "Crop editor must expose Reset.");
  assert(cropEditor.includes("Cancel"), "Crop editor must expose Cancel.");
  assert(cropEditor.includes("Zoom"), "Crop editor must expose zoom control.");
  assert(
    cropCss.includes("avatar-crop-editor__grid"),
    "Crop editor must render rule-of-thirds grid.",
  );
  assert(
    cropCss.includes("border-radius: 999px"),
    "Crop editor must preview circular avatar mask.",
  );
  assert(cropUtil.includes("AVATAR_CROP_OUTPUT_SIZE = 512"), "Avatar crop must output 512×512.");
  assert(cropUtil.includes('"image/webp"'), "Avatar crop must output WebP.");
  assert(
    cropUtil.includes("validateAvatarSourceFile"),
    "Avatar crop must validate source image constraints.",
  );
  assert(
    uploadField.includes("loadAvatarCropSource"),
    "Avatar upload must validate before opening crop editor.",
  );
}

async function verifyMembershipParticipationRuntime(): Promise<void> {
  console.log("3. Membership participation persistence runtime");

  const { isMongoConfigured } = await import("../infrastructure/mongodb/mongo-config.js");
  assert(isMongoConfigured(), "MONGODB_URI must be configured.");

  const { bootstrapAuthPersistence } =
    await import("../infrastructure/mongodb/bootstrap-auth-persistence.js");
  await bootstrapAuthPersistence();

  const { registerAndConfirmAuthUser } = await import("../modules/auth/auth.service.js");
  const { deleteAuthUsersByEmailPrefix } = await import("../modules/auth/auth-user.repository.js");
  const { deleteMembershipsByUserIdPrefix, findMembershipByUserId } =
    await import("../modules/membership/membership.repository.js");
  const { upsertMembershipApplication } =
    await import("../modules/membership/membership.service.js");
  const { MEMBERSHIP_PARTICIPATION_COUNTRY_LIMIT } =
    await import("../modules/membership/membership.validators.js");

  const prefix = `membership-avatar-geography-${Date.now()}`;
  const email = `${prefix}@example.com`;

  await deleteMembershipsByUserIdPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);

  await registerAndConfirmAuthUser({
    email,
    displayName: "Participation Countries",
    password: "verify-password-123",
  });

  const { findRawAuthUserByEmail } = await import("../modules/auth/auth-user.repository.js");
  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "Confirmed user must exist.");

  const legacyDraft = await upsertMembershipApplication({
    userId: stored.userId,
    displayName: "Participation Countries",
    application: {
      countryCode: "ca",
      displayNameConfirmed: "Participation Countries",
      understandMembershipMeaning: false,
      understandNoVoteWeightChange: false,
      understandDataPolicy: false,
      submit: false,
    },
  });

  assert(
    legacyDraft.application.participationCountryCodes?.join(",") === "CA",
    "Legacy countryCode must migrate to participationCountryCodes.",
  );
  assert(
    legacyDraft.application.countryCode === "CA",
    "Primary countryCode must mirror first selection.",
  );

  const multiDraft = await upsertMembershipApplication({
    userId: stored.userId,
    displayName: "Participation Countries",
    application: {
      participationCountryCodes: ["US", "CA", "GB"],
      displayNameConfirmed: "Participation Countries",
      understandMembershipMeaning: false,
      understandNoVoteWeightChange: false,
      understandDataPolicy: false,
      submit: false,
    },
  });

  assert(
    multiDraft.application.participationCountryCodes?.join(",") === "US,CA,GB",
    "Multiple participation countries must persist in order.",
  );

  const reloaded = await findMembershipByUserId(stored.userId);
  assert(
    reloaded?.participationCountryCodes?.join(",") === "US,CA,GB",
    "Participation countries must reload from MongoDB.",
  );

  const tooMany = ["US", "CA", "GB", "FR", "DE", "IT", "ES", "NL", "SE", "NO", "DK"];

  try {
    await upsertMembershipApplication({
      userId: stored.userId,
      displayName: "Participation Countries",
      application: {
        participationCountryCodes: tooMany,
        displayNameConfirmed: "Participation Countries",
        understandMembershipMeaning: false,
        understandNoVoteWeightChange: false,
        understandDataPolicy: false,
        submit: false,
      },
    });
    throw new Error("Expected participation country limit rejection.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.includes(String(MEMBERSHIP_PARTICIPATION_COUNTRY_LIMIT)),
      "Participation country limit must be enforced.",
    );
  }

  await deleteMembershipsByUserIdPrefix(prefix);
  await deleteAuthUsersByEmailPrefix(prefix);
}

function verifyPackageScript(): void {
  console.log("4. Verification script registration");

  const pkg = readRepoFile("package.json");
  assert(
    pkg.includes('"verify:membership-avatar-geography"'),
    "package.json must define verify:membership-avatar-geography.",
  );
  assert(pkg.includes('"verify:media-upload"'), "package.json must define verify:media-upload.");
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:membership-avatar-geography pass ${pass} ===`);
  verifyMembershipParticipationCountries();
  verifyAvatarCropEditor();
  await verifyMembershipParticipationRuntime();
  verifyPackageScript();
}

async function main(): Promise<void> {
  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:membership-avatar-geography PASSED (3 consecutive passes).");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

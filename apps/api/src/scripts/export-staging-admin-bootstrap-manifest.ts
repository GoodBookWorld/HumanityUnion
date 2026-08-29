/**
 * Staging helper — export private Admin (Volody) source manifest for production bootstrap.
 *
 * Read-only against staging Mongo. Writes a local chmod 600 JSON file containing
 * email (never printed). Transfer out-of-band; do not paste emails into chat.
 *
 * Usage:
 *   PRODUCTION_ADMIN_SOURCE_MANIFEST=./.runtime/production-admin-source.json \
 *     pnpm --filter @hu/api export:staging-admin-bootstrap-manifest
 *
 * Refuses humanity_union_production as source.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
  getMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import {
  ADMIN_SOURCE_MANIFEST_VERSION,
  APPROVED_PRODUCTION_ADMIN,
  PRODUCTION_ADMIN_BOOTSTRAP_DATABASE,
  PRODUCTION_ADMIN_SOURCE_MANIFEST_ENV,
  ProductionAdminBootstrapError,
  maskEmail,
  normalizeEmail,
  writeSourceAdminManifestFile,
  type SourceAdminIdentity,
  type SourceAdminManifest,
} from "../modules/production-admin-bootstrap/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const outPath = process.env[PRODUCTION_ADMIN_SOURCE_MANIFEST_ENV]?.trim();
  if (!outPath) {
    throw new ProductionAdminBootstrapError(
      `Set ${PRODUCTION_ADMIN_SOURCE_MANIFEST_ENV} to the output file path.`,
      "MISSING_MANIFEST",
    );
  }

  if (!isMongoConfigured()) {
    throw new ProductionAdminBootstrapError(
      "MongoDB is not configured.",
      "MONGO_UNCONFIGURED",
    );
  }

  const config = resolveMongoConfig();
  if (config.database === PRODUCTION_ADMIN_BOOTSTRAP_DATABASE) {
    throw new ProductionAdminBootstrapError(
      "Refusing to export from production database.",
      "WRONG_DATABASE",
    );
  }

  await connectMongoClient();
  try {
    const db = getMongoClient().db(config.database);
    const approved = APPROVED_PRODUCTION_ADMIN;

    const [auth, member, profile] = await Promise.all([
      db.collection(MONGO_COLLECTIONS.authUsers).findOne({ memberId: approved.memberId }),
      db.collection(MONGO_COLLECTIONS.members).findOne({ memberId: approved.memberId }),
      db.collection(MONGO_COLLECTIONS.memberProfiles).findOne({
        $or: [{ userId: approved.userId }, { profileId: approved.profileId }],
      }),
    ]);

    if (!auth || !member || !profile) {
      throw new ProductionAdminBootstrapError(
        "Incomplete staging graph for Volody Admin identity.",
        "INCOMPLETE_SOURCE_GRAPH",
      );
    }
    if (
      String(auth.userId) !== approved.userId ||
      String(profile.profileId) !== approved.profileId ||
      String(profile.userId) !== approved.userId
    ) {
      throw new ProductionAdminBootstrapError(
        "Staging ID drift for Volody Admin identity.",
        "SOURCE_ID_DRIFT",
      );
    }
    if (String(profile.publicName) !== approved.publicName) {
      throw new ProductionAdminBootstrapError(
        `Staging publicName drift: expected exact "${approved.publicName}".`,
        "SOURCE_PUBLIC_NAME_DRIFT",
      );
    }
    if (String(member.uniqueName ?? "") !== approved.uniqueName) {
      throw new ProductionAdminBootstrapError(
        `Staging uniqueName drift: expected exact "${approved.uniqueName}".`,
        "SOURCE_UNIQUE_NAME_DRIFT",
      );
    }

    const displayName = String(
      profile.displayName ?? auth.displayName ?? member.displayName ?? approved.displayName,
    ).trim();
    if (displayName !== approved.displayName) {
      throw new ProductionAdminBootstrapError(
        `Staging displayName drift: expected exact "${approved.displayName}".`,
        "SOURCE_DISPLAY_NAME_DRIFT",
      );
    }

    const languages = Array.isArray(member.languages)
      ? member.languages.filter((entry): entry is string => typeof entry === "string")
      : undefined;

    const identity: SourceAdminIdentity = {
      label: approved.label,
      memberId: approved.memberId,
      userId: approved.userId,
      profileId: approved.profileId,
      email: normalizeEmail(String(auth.email)),
      displayName: approved.displayName,
      publicName: approved.publicName,
      uniqueName: approved.uniqueName,
      authRole: "admin",
      languages,
      authCreatedAt: typeof auth.createdAt === "string" ? auth.createdAt : undefined,
      memberCreatedAt: typeof member.createdAt === "string" ? member.createdAt : undefined,
      // Never read or export staging passwordHash.
      profile: {
        memberNumber:
          typeof profile.memberNumber === "string" ? profile.memberNumber : undefined,
        biography: typeof profile.biography === "string" ? profile.biography : undefined,
        avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : undefined,
        organization:
          typeof profile.organization === "string" ? profile.organization : undefined,
        website: typeof profile.website === "string" ? profile.website : undefined,
        linkedinUrl:
          typeof profile.linkedinUrl === "string" ? profile.linkedinUrl : undefined,
        facebookUrl:
          typeof profile.facebookUrl === "string" ? profile.facebookUrl : undefined,
        youtubeUrl: typeof profile.youtubeUrl === "string" ? profile.youtubeUrl : undefined,
        instagramUrl:
          typeof profile.instagramUrl === "string" ? profile.instagramUrl : undefined,
        xUrl: typeof profile.xUrl === "string" ? profile.xUrl : undefined,
        skills: Array.isArray(profile.skills)
          ? profile.skills.filter((entry): entry is string => typeof entry === "string")
          : undefined,
        country: typeof profile.country === "string" ? profile.country : undefined,
        region: typeof profile.region === "string" ? profile.region : undefined,
        community: typeof profile.community === "string" ? profile.community : undefined,
        participationAreaId:
          typeof profile.participationAreaId === "string"
            ? profile.participationAreaId
            : undefined,
        participationVisibility:
          profile.participationVisibility === "public" ||
          profile.participationVisibility === "members_only" ||
          profile.participationVisibility === "private"
            ? profile.participationVisibility
            : undefined,
        language: typeof profile.language === "string" ? profile.language : undefined,
        timezone: typeof profile.timezone === "string" ? profile.timezone : undefined,
        profileVisibility:
          profile.profileVisibility === "public" ||
          profile.profileVisibility === "members_only" ||
          profile.profileVisibility === "private"
            ? profile.profileVisibility
            : undefined,
        showOrganization:
          typeof profile.showOrganization === "boolean"
            ? profile.showOrganization
            : undefined,
        showLocation:
          typeof profile.showLocation === "boolean" ? profile.showLocation : undefined,
        showParticipationArea:
          typeof profile.showParticipationArea === "boolean"
            ? profile.showParticipationArea
            : undefined,
        membershipPubliclyVisible:
          typeof profile.membershipPubliclyVisible === "boolean"
            ? profile.membershipPubliclyVisible
            : undefined,
        skillsVisibility:
          profile.skillsVisibility === "public" ||
          profile.skillsVisibility === "members_only" ||
          profile.skillsVisibility === "private"
            ? profile.skillsVisibility
            : undefined,
        professionalLinksVisibility:
          profile.professionalLinksVisibility === "public" ||
          profile.professionalLinksVisibility === "members_only" ||
          profile.professionalLinksVisibility === "private"
            ? profile.professionalLinksVisibility
            : undefined,
        showInitiativesStatistics:
          typeof profile.showInitiativesStatistics === "boolean"
            ? profile.showInitiativesStatistics
            : undefined,
        showCollectiveDecisionsStatistics:
          typeof profile.showCollectiveDecisionsStatistics === "boolean"
            ? profile.showCollectiveDecisionsStatistics
            : undefined,
        showAlliesStatistics:
          typeof profile.showAlliesStatistics === "boolean"
            ? profile.showAlliesStatistics
            : undefined,
        showProposalsStatistics:
          typeof profile.showProposalsStatistics === "boolean"
            ? profile.showProposalsStatistics
            : undefined,
        showPetitionsStatistics:
          typeof profile.showPetitionsStatistics === "boolean"
            ? profile.showPetitionsStatistics
            : undefined,
        showCommitmentsStatistics:
          typeof profile.showCommitmentsStatistics === "boolean"
            ? profile.showCommitmentsStatistics
            : undefined,
        messagingPolicy:
          profile.messagingPolicy === "active_allies" ||
          profile.messagingPolicy === "registered_participants" ||
          profile.messagingPolicy === "nobody"
            ? profile.messagingPolicy
            : undefined,
        createdAt: typeof profile.createdAt === "string" ? profile.createdAt : undefined,
      },
    };

    const manifest: SourceAdminManifest = {
      version: ADMIN_SOURCE_MANIFEST_VERSION,
      identities: [identity],
    };
    const writtenPath = writeSourceAdminManifestFile(outPath, manifest);

    console.log(
      JSON.stringify(
        {
          tool: "export-staging-admin-bootstrap-manifest",
          mode: "read-only-export",
          sourceDatabase: config.database,
          manifestPath: writtenPath,
          permissions: "0600",
          identity: {
            label: identity.label,
            memberId: identity.memberId,
            userId: identity.userId,
            profileId: identity.profileId,
            displayName: identity.displayName,
            publicName: identity.publicName,
            uniqueName: identity.uniqueName,
            authRole: "admin",
            emailMasked: maskEmail(identity.email),
            sourcePasswordHashExported: false,
          },
          note: "Full email written to manifest file only — not printed. Staging passwordHash omitted.",
        },
        null,
        2,
      ),
    );
  } finally {
    await disconnectMongoClient();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      tool: "export-staging-admin-bootstrap-manifest",
      ok: false,
      error: message,
    }),
  );
  process.exitCode = 1;
});

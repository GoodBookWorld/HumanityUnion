/**
 * Staging helper — export private steward source manifest for production bootstrap.
 *
 * Read-only against staging Mongo. Writes a local chmod 600 JSON file containing
 * emails (never printed). Transfer the file out-of-band to the production operator
 * environment; do not paste emails into chat or shell history.
 *
 * Usage (Render STAGING API Shell or local with staging DB):
 *   PRODUCTION_STEWARD_SOURCE_MANIFEST=./.runtime/production-steward-source.json \
 *     pnpm --filter @hu/api exec tsx src/scripts/export-staging-steward-bootstrap-manifest.ts
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
  APPROVED_PRODUCTION_STEWARDS,
  PRODUCTION_STEWARD_BOOTSTRAP_DATABASE,
  PRODUCTION_STEWARD_SOURCE_MANIFEST_ENV,
  SOURCE_MANIFEST_VERSION,
  ProductionStewardBootstrapError,
  maskEmail,
  normalizeEmail,
  writeSourceStewardManifestFile,
  type SourceStewardIdentity,
  type SourceStewardManifest,
} from "../modules/production-steward-bootstrap/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const outPath = process.env[PRODUCTION_STEWARD_SOURCE_MANIFEST_ENV]?.trim();
  if (!outPath) {
    throw new ProductionStewardBootstrapError(
      `Set ${PRODUCTION_STEWARD_SOURCE_MANIFEST_ENV} to the output file path.`,
      "MISSING_MANIFEST",
    );
  }

  if (!isMongoConfigured()) {
    throw new ProductionStewardBootstrapError(
      "MongoDB is not configured.",
      "MONGO_UNCONFIGURED",
    );
  }

  const config = resolveMongoConfig();
  if (config.database === PRODUCTION_STEWARD_BOOTSTRAP_DATABASE) {
    throw new ProductionStewardBootstrapError(
      "Refusing to export from production database.",
      "WRONG_DATABASE",
    );
  }

  await connectMongoClient();
  try {
    const db = getMongoClient().db(config.database);
    const memberIds = APPROVED_PRODUCTION_STEWARDS.map((row) => row.memberId);
    const userIds = APPROVED_PRODUCTION_STEWARDS.map((row) => row.userId);
    const profileIds = APPROVED_PRODUCTION_STEWARDS.map((row) => row.profileId);

    const [auths, members, profiles] = await Promise.all([
      db
        .collection(MONGO_COLLECTIONS.authUsers)
        .find({ memberId: { $in: memberIds } })
        .toArray(),
      db
        .collection(MONGO_COLLECTIONS.members)
        .find({ memberId: { $in: memberIds } })
        .toArray(),
      db
        .collection(MONGO_COLLECTIONS.memberProfiles)
        .find({
          $or: [{ userId: { $in: userIds } }, { profileId: { $in: profileIds } }],
        })
        .toArray(),
    ]);

    const authByMember = new Map(auths.map((doc) => [String(doc.memberId), doc]));
    const memberById = new Map(members.map((doc) => [String(doc.memberId), doc]));
    const profileByUser = new Map(profiles.map((doc) => [String(doc.userId), doc]));
    const profileById = new Map(profiles.map((doc) => [String(doc.profileId), doc]));

    const identities: SourceStewardIdentity[] = APPROVED_PRODUCTION_STEWARDS.map((approved) => {
      const auth = authByMember.get(approved.memberId);
      const member = memberById.get(approved.memberId);
      const profile =
        profileByUser.get(approved.userId) ?? profileById.get(approved.profileId);
      if (!auth || !member || !profile) {
        throw new ProductionStewardBootstrapError(
          `Incomplete staging graph for ${approved.label}.`,
          "INCOMPLETE_SOURCE_GRAPH",
        );
      }
      if (
        String(auth.userId) !== approved.userId ||
        String(profile.profileId) !== approved.profileId ||
        String(profile.userId) !== approved.userId
      ) {
        throw new ProductionStewardBootstrapError(
          `Staging ID drift for ${approved.label}.`,
          "SOURCE_ID_DRIFT",
        );
      }
      if (String(profile.publicName) !== approved.publicName) {
        throw new ProductionStewardBootstrapError(
          `Staging publicName drift for ${approved.label}.`,
          "SOURCE_PUBLIC_NAME_DRIFT",
        );
      }
      const uniqueName = String(member.uniqueName ?? "");
      if (uniqueName !== approved.uniqueName) {
        throw new ProductionStewardBootstrapError(
          `Staging uniqueName drift for ${approved.label}.`,
          "SOURCE_UNIQUE_NAME_DRIFT",
        );
      }

      const displayName = String(
        profile.displayName ?? auth.displayName ?? member.displayName ?? approved.label,
      ).trim();
      const languages = Array.isArray(member.languages)
        ? member.languages.filter((entry): entry is string => typeof entry === "string")
        : undefined;

      return {
        label: approved.label,
        memberId: approved.memberId,
        userId: approved.userId,
        profileId: approved.profileId,
        email: normalizeEmail(String(auth.email)),
        displayName,
        publicName: approved.publicName,
        uniqueName: approved.uniqueName,
        languages,
        authCreatedAt:
          typeof auth.createdAt === "string" ? auth.createdAt : undefined,
        memberCreatedAt:
          typeof member.createdAt === "string" ? member.createdAt : undefined,
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
    });

    const manifest: SourceStewardManifest = {
      version: SOURCE_MANIFEST_VERSION,
      identities,
    };
    const writtenPath = writeSourceStewardManifestFile(outPath, manifest);

    console.log(
      JSON.stringify(
        {
          tool: "export-staging-steward-bootstrap-manifest",
          mode: "read-only-export",
          sourceDatabase: config.database,
          manifestPath: writtenPath,
          permissions: "0600",
          identities: identities.map((identity) => ({
            label: identity.label,
            memberId: identity.memberId,
            userId: identity.userId,
            profileId: identity.profileId,
            displayName: identity.displayName,
            publicName: identity.publicName,
            uniqueName: identity.uniqueName,
            emailMasked: maskEmail(identity.email),
          })),
          note: "Full emails written to manifest file only — not printed.",
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
      tool: "export-staging-steward-bootstrap-manifest",
      ok: false,
      error: message,
    }),
  );
  process.exitCode = 1;
});

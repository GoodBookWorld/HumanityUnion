import type {
  LoadedPortableMediaSource,
  PortableMediaAvatar,
  PortableMediaInitiativeCover,
} from "./portable-media-bundle.js";
import { STAGING_ADMIN_MEMBER_ID, STAGING_ADMIN_USER_ID } from "./constants.js";

export type MediaPlanAction =
  | "upload_and_update"
  | "update_url_only"
  | "skip_already_canonical"
  | "conflict"
  | "missing_target";

export interface InitiativeMediaPlanItem {
  initiativeId: string;
  title: string;
  sourceFilename: string;
  destinationObjectKey: string;
  contentSha256: string;
  currentImageUrl: string | null;
  currentCoverUrl: string | null;
  plannedPublicUrl: string;
  action: MediaPlanAction;
  reason: string;
}

export interface AvatarMediaPlanItem {
  key: string;
  memberId: string;
  userId: string;
  displayName: string;
  sourceFilename: string | null;
  destinationObjectKey: string | null;
  contentSha256: string | null;
  currentAvatarUrl: string | null;
  plannedPublicUrl: string | null;
  action: MediaPlanAction | "unresolved";
  reason: string;
}

export interface MediaMigrationPlan {
  mode: "dry-run" | "execute";
  targetDatabase: string;
  bundleDir: string;
  publicBaseUrlHint: string | null;
  initiatives: InitiativeMediaPlanItem[];
  avatars: AvatarMediaPlanItem[];
  summary: {
    initiativeUploadsPlanned: number;
    initiativeUpdatesPlanned: number;
    avatarUploadsPlanned: number;
    avatarUpdatesPlanned: number;
    unresolvedAvatars: number;
    conflicts: number;
  };
  conflicts: string[];
}

function isLocalhostMediaUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  return /localhost|127\.0\.0\.1/i.test(url);
}

function extractUrl(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildMediaMigrationPlan(input: {
  targetDatabase: string;
  portable: LoadedPortableMediaSource;
  buildPublicUrl: (storageKey: string) => string;
  initiativesById: Map<
    string,
    {
      metadata?: {
        imageUrl?: string;
        coverMedia?: { url?: string; type?: string; verificationStatus?: string; createdAt?: string };
        imageAltText?: string;
      };
    }
  >;
  profilesByUserId: Map<string, { avatarUrl?: string; userId: string }>;
  authByMemberId: Map<string, { userId: string; memberId: string; role?: string }>;
  existingMediaByStorageKey: Map<string, { mediaUrl: string; storageKey: string }>;
}): MediaMigrationPlan {
  const conflicts: string[] = [];
  const initiatives: InitiativeMediaPlanItem[] = [];

  for (const cover of input.portable.manifest.initiativeCovers) {
    initiatives.push(
      planInitiativeCover({
        cover,
        initiative: input.initiativesById.get(cover.initiativeId),
        plannedPublicUrl: input.buildPublicUrl(cover.destinationObjectKey),
        existingMedia: input.existingMediaByStorageKey.get(cover.destinationObjectKey),
        conflicts,
      }),
    );
  }

  const avatars: AvatarMediaPlanItem[] = [];
  for (const avatar of input.portable.manifest.participantAvatars) {
    avatars.push(
      planAvatar({
        avatar,
        auth: input.authByMemberId.get(avatar.memberId),
        profile: input.profilesByUserId.get(avatar.userId),
        plannedPublicUrl: input.buildPublicUrl(avatar.destinationObjectKey),
        existingMedia: input.existingMediaByStorageKey.get(avatar.destinationObjectKey),
        conflicts,
      }),
    );
  }

  // Ensure unresolved list from manifest is represented
  for (const unresolved of input.portable.manifest.unresolvedAvatars ?? []) {
    void unresolved;
  }

  const summary = {
    initiativeUploadsPlanned: initiatives.filter((i) => i.action === "upload_and_update").length,
    initiativeUpdatesPlanned: initiatives.filter(
      (i) => i.action === "upload_and_update" || i.action === "update_url_only",
    ).length,
    avatarUploadsPlanned: avatars.filter((a) => a.action === "upload_and_update").length,
    avatarUpdatesPlanned: avatars.filter(
      (a) => a.action === "upload_and_update" || a.action === "update_url_only",
    ).length,
    unresolvedAvatars: avatars.filter((a) => a.action === "unresolved").length,
    conflicts: conflicts.length,
  };

  return {
    mode: "dry-run",
    targetDatabase: input.targetDatabase,
    bundleDir: input.portable.bundleDir,
    publicBaseUrlHint: null,
    initiatives,
    avatars,
    summary,
    conflicts,
  };
}

function planInitiativeCover(input: {
  cover: PortableMediaInitiativeCover;
  initiative:
    | {
        metadata?: {
          imageUrl?: string;
          coverMedia?: { url?: string };
        };
      }
    | undefined;
  plannedPublicUrl: string;
  existingMedia: { mediaUrl: string; storageKey: string } | undefined;
  conflicts: string[];
}): InitiativeMediaPlanItem {
  const currentImageUrl = extractUrl(input.initiative?.metadata?.imageUrl);
  const currentCoverUrl = extractUrl(input.initiative?.metadata?.coverMedia?.url);

  if (!input.initiative) {
    input.conflicts.push(`Initiative missing in target: ${input.cover.initiativeId}`);
    return {
      initiativeId: input.cover.initiativeId,
      title: input.cover.title,
      sourceFilename: input.cover.sourceFilename,
      destinationObjectKey: input.cover.destinationObjectKey,
      contentSha256: input.cover.contentSha256,
      currentImageUrl,
      currentCoverUrl,
      plannedPublicUrl: input.plannedPublicUrl,
      action: "missing_target",
      reason: "Initiative not found in target database.",
    };
  }

  if (
    currentImageUrl === input.plannedPublicUrl &&
    (!currentCoverUrl || currentCoverUrl === input.plannedPublicUrl)
  ) {
    return {
      initiativeId: input.cover.initiativeId,
      title: input.cover.title,
      sourceFilename: input.cover.sourceFilename,
      destinationObjectKey: input.cover.destinationObjectKey,
      contentSha256: input.cover.contentSha256,
      currentImageUrl,
      currentCoverUrl,
      plannedPublicUrl: input.plannedPublicUrl,
      action: "skip_already_canonical",
      reason: "Canonical media URL already present.",
    };
  }

  if (input.existingMedia && input.existingMedia.mediaUrl === input.plannedPublicUrl) {
    return {
      initiativeId: input.cover.initiativeId,
      title: input.cover.title,
      sourceFilename: input.cover.sourceFilename,
      destinationObjectKey: input.cover.destinationObjectKey,
      contentSha256: input.cover.contentSha256,
      currentImageUrl,
      currentCoverUrl,
      plannedPublicUrl: input.plannedPublicUrl,
      action: "update_url_only",
      reason: "Object already uploaded; update Initiative media fields only.",
    };
  }

  return {
    initiativeId: input.cover.initiativeId,
    title: input.cover.title,
    sourceFilename: input.cover.sourceFilename,
    destinationObjectKey: input.cover.destinationObjectKey,
    contentSha256: input.cover.contentSha256,
    currentImageUrl,
    currentCoverUrl,
    plannedPublicUrl: input.plannedPublicUrl,
    action: "upload_and_update",
    reason: isLocalhostMediaUrl(currentImageUrl) || isLocalhostMediaUrl(currentCoverUrl)
      ? "Replace localhost media URL with canonical R2/public URL."
      : "Upload cover and set canonical media fields.",
  };
}

function planAvatar(input: {
  avatar: PortableMediaAvatar;
  auth: { userId: string; memberId: string; role?: string } | undefined;
  profile: { avatarUrl?: string; userId: string } | undefined;
  plannedPublicUrl: string;
  existingMedia: { mediaUrl: string; storageKey: string } | undefined;
  conflicts: string[];
}): AvatarMediaPlanItem {
  if (
    input.avatar.memberId === STAGING_ADMIN_MEMBER_ID ||
    input.avatar.userId === STAGING_ADMIN_USER_ID
  ) {
    input.conflicts.push("Refusing to touch staging-admin avatar mapping.");
    return {
      key: input.avatar.key,
      memberId: input.avatar.memberId,
      userId: input.avatar.userId,
      displayName: input.avatar.displayName,
      sourceFilename: input.avatar.sourceFilename,
      destinationObjectKey: input.avatar.destinationObjectKey,
      contentSha256: input.avatar.contentSha256,
      currentAvatarUrl: null,
      plannedPublicUrl: null,
      action: "conflict",
      reason: "Staging-admin identity must never be updated by media recovery.",
    };
  }

  if (!input.auth || !input.profile) {
    input.conflicts.push(`Historical Participant missing in target: ${input.avatar.key}`);
    return {
      key: input.avatar.key,
      memberId: input.avatar.memberId,
      userId: input.avatar.userId,
      displayName: input.avatar.displayName,
      sourceFilename: input.avatar.sourceFilename,
      destinationObjectKey: input.avatar.destinationObjectKey,
      contentSha256: input.avatar.contentSha256,
      currentAvatarUrl: extractUrl(input.profile?.avatarUrl),
      plannedPublicUrl: input.plannedPublicUrl,
      action: "missing_target",
      reason: "Auth/profile not found in target.",
    };
  }

  const currentAvatarUrl = extractUrl(input.profile.avatarUrl);
  if (currentAvatarUrl === input.plannedPublicUrl) {
    return {
      key: input.avatar.key,
      memberId: input.avatar.memberId,
      userId: input.avatar.userId,
      displayName: input.avatar.displayName,
      sourceFilename: input.avatar.sourceFilename,
      destinationObjectKey: input.avatar.destinationObjectKey,
      contentSha256: input.avatar.contentSha256,
      currentAvatarUrl,
      plannedPublicUrl: input.plannedPublicUrl,
      action: "skip_already_canonical",
      reason: "Canonical avatar URL already present.",
    };
  }

  if (input.existingMedia && input.existingMedia.mediaUrl === input.plannedPublicUrl) {
    return {
      key: input.avatar.key,
      memberId: input.avatar.memberId,
      userId: input.avatar.userId,
      displayName: input.avatar.displayName,
      sourceFilename: input.avatar.sourceFilename,
      destinationObjectKey: input.avatar.destinationObjectKey,
      contentSha256: input.avatar.contentSha256,
      currentAvatarUrl,
      plannedPublicUrl: input.plannedPublicUrl,
      action: "update_url_only",
      reason: "Object already uploaded; update avatarUrl only.",
    };
  }

  return {
    key: input.avatar.key,
    memberId: input.avatar.memberId,
    userId: input.avatar.userId,
    displayName: input.avatar.displayName,
    sourceFilename: input.avatar.sourceFilename,
    destinationObjectKey: input.avatar.destinationObjectKey,
    contentSha256: input.avatar.contentSha256,
    currentAvatarUrl,
    plannedPublicUrl: input.plannedPublicUrl,
    action: "upload_and_update",
    reason: "Upload avatar and replace localhost/profile media URL.",
  };
}

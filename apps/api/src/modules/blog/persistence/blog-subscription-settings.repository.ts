/**
 * Pack 21B — Blog subscription settings persistence (single platform document).
 */
import type { BlogSubscriptionSettings } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { BlogPersistenceError } from "../blog.errors.js";

export const BLOG_SUBSCRIPTION_SETTINGS_ID = "blog_subscription_settings";

interface BlogSubscriptionSettingsDocument extends BlogSubscriptionSettings {
  _id?: string;
  settingsId: string;
}

let memorySettings: BlogSubscriptionSettings | null = null;

function isMemoryStore(): boolean {
  return process.env.BLOG_SUBSCRIBER_FORCE_MEMORY === "true" || !isMongoConfigured();
}

async function ensureReady(): Promise<void> {
  if (isMemoryStore()) {
    return;
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<BlogSubscriptionSettingsDocument>(
    MONGO_COLLECTIONS.blogSubscriptionSettings,
  );
}

export function resetBlogSubscriptionSettingsForTests(): void {
  memorySettings = null;
}

export async function findBlogSubscriptionSettings(): Promise<BlogSubscriptionSettings | null> {
  await ensureReady();
  if (isMemoryStore()) {
    return memorySettings;
  }
  try {
    const doc = await collection().findOne({ settingsId: BLOG_SUBSCRIPTION_SETTINGS_ID });
    if (!doc) {
      return null;
    }
    return {
      welcomeMessage: doc.welcomeMessage,
      updatedAt: doc.updatedAt,
      ...(doc.updatedByParticipantId
        ? { updatedByParticipantId: doc.updatedByParticipantId }
        : {}),
    };
  } catch (error) {
    throw new BlogPersistenceError("Failed to load Blog subscription settings.", error);
  }
}

export async function upsertBlogSubscriptionSettings(
  settings: BlogSubscriptionSettings,
): Promise<BlogSubscriptionSettings> {
  await ensureReady();
  if (isMemoryStore()) {
    memorySettings = settings;
    return settings;
  }
  try {
    const doc: BlogSubscriptionSettingsDocument = {
      settingsId: BLOG_SUBSCRIPTION_SETTINGS_ID,
      welcomeMessage: settings.welcomeMessage,
      updatedAt: settings.updatedAt,
      ...(settings.updatedByParticipantId
        ? { updatedByParticipantId: settings.updatedByParticipantId }
        : {}),
    };
    await collection().replaceOne({ settingsId: BLOG_SUBSCRIPTION_SETTINGS_ID }, doc, {
      upsert: true,
    });
    return settings;
  } catch (error) {
    throw new BlogPersistenceError("Failed to save Blog subscription settings.", error);
  }
}

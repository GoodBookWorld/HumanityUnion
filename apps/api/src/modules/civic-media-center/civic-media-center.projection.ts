import type { CivicSearchMetadata } from "@hu/types";

export function civicMediaToSearchMetadata(record: {
  entityId: string;
  title: string;
  summary: string;
  activityArea: string;
  publicUrl: string;
  updatedAt: string;
}): CivicSearchMetadata {
  return {
    entityType: "knowledge_media",
    entityId: record.entityId,
    title: record.title,
    summary: record.summary,
    country: "",
    region: "",
    community: "",
    activityArea: record.activityArea,
    status: "published",
    publicUrl: record.publicUrl,
    updatedAt: record.updatedAt,
  };
}

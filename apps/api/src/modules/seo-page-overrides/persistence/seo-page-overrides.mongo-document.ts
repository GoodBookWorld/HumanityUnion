import type { SeoPageOverride } from "@hu/types";

export interface SeoPageOverrideMongoDocument {
  _id: string;
  pageId: string;
  family: SeoPageOverride["family"];
  entityKey: string;
  canonicalPath: string;
  fields: SeoPageOverride["fields"];
  createdAt: string;
  updatedAt: string;
  updatedByParticipantId: string;
}

export function toSeoPageOverrideMongoDocument(
  override: SeoPageOverride,
): SeoPageOverrideMongoDocument {
  return {
    _id: override.pageId,
    pageId: override.pageId,
    family: override.family,
    entityKey: override.entityKey,
    canonicalPath: override.canonicalPath,
    fields: override.fields,
    createdAt: override.createdAt,
    updatedAt: override.updatedAt,
    updatedByParticipantId: override.updatedByParticipantId,
  };
}

export function fromSeoPageOverrideMongoDocument(
  doc: SeoPageOverrideMongoDocument,
): SeoPageOverride {
  return {
    pageId: doc.pageId,
    family: doc.family,
    entityKey: doc.entityKey,
    canonicalPath: doc.canonicalPath,
    fields: doc.fields ?? {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    updatedByParticipantId: doc.updatedByParticipantId,
  };
}

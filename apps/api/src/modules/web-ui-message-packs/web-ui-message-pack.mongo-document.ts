import type { WebUiMessagePackRecord, WebUiMessageTree } from "@hu/types";

export type WebUiMessagePackMongoDocument = {
  packId: string;
  locale: string;
  localeKey: string;
  revision: number;
  status: WebUiMessagePackRecord["status"];
  messages: WebUiMessageTree;
  createdAt: string;
  updatedAt: string;
  updatedByParticipantId?: string | null;
  sourceNote?: string | null;
};

export function toWebUiMessagePackMongoDocument(
  record: WebUiMessagePackRecord,
  localeKey: string,
): WebUiMessagePackMongoDocument {
  return {
    packId: record.packId,
    locale: record.locale,
    localeKey,
    revision: record.revision,
    status: record.status,
    messages: record.messages,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    updatedByParticipantId: record.updatedByParticipantId ?? null,
    sourceNote: record.sourceNote ?? null,
  };
}

export function fromWebUiMessagePackMongoDocument(
  doc: WebUiMessagePackMongoDocument,
): WebUiMessagePackRecord {
  return {
    packId: doc.packId,
    locale: doc.locale,
    revision: doc.revision,
    status: doc.status,
    messages: doc.messages,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    updatedByParticipantId: doc.updatedByParticipantId ?? null,
    sourceNote: doc.sourceNote ?? null,
  };
}

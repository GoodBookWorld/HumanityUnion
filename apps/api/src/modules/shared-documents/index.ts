export { sharedDocumentsDirectMessagesRouter } from "./shared-documents.direct-messages.routes.js";
export { sharedDocumentsInitiativesRouter } from "./shared-documents.initiatives.routes.js";
export {
  defaultSharedDocumentServiceDependencies,
  listSharedDocuments,
  removeSharedDocument,
  replaceSharedDocument,
  resolveSharedDocumentDownload,
  uploadSharedDocument,
  type SharedDocumentServiceDependencies,
  type SharedDocumentUploadFileInput,
} from "./shared-documents.service.js";
export { resolveSharedDocumentContextAccess } from "./shared-documents-access.js";
export {
  drainSharedDocumentNotificationsForTests,
  emitSharedDocumentRemovedNotification,
  emitSharedDocumentReplacedNotification,
  emitSharedDocumentUploadedNotification,
} from "./shared-documents-notifications.js";
export * from "./shared-documents.errors.js";
export {
  deleteSharedDocumentsByContextForTests,
  deleteSharedDocumentsByInitiativeId,
  listAllSharedDocumentsByInitiativeId,
} from "./persistence/shared-documents.repository.js";
export { SECURE_DOCUMENT_STORAGE_ROOT } from "./secure-document-storage.provider.js";

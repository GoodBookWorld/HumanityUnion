export { confirmMemberRegistration } from "./application/confirm-member-registration.service.js";
export type {
  ConfirmMemberRegistrationResult,
  MemberRegistrationOutcome,
} from "./application/confirm-member-registration.service.js";
export type { EditableMemberProfileFields } from "./domain/member-profile.types.js";
export {
  getMemberById,
  getMemberByUniqueName,
  getMemberByIdSync,
  getMemberByUniqueNameSync,
  listMembers,
  updateMemberProfile,
} from "./member-access.js";
export { createMemberRegisteredEvent, buildMemberRegisteredEventId } from "./domain/member-registered.event.js";
export type { MemberRegisteredPayload } from "./domain/member-registered.event.js";
export {
  MemberAlreadyRegisteredError,
  MemberNotFoundError,
  MemberRegistrationConflictError,
  MemberRegistrationTransactionError,
  MemberRegistrationUnavailableError,
} from "./domain/member.errors.js";
export type { PersistedMemberRecord, MemberRegistrationStatus } from "./domain/member.types.js";
export {
  deleteMembersByIdentityIdPrefix,
  deleteMembersByMemberIdPrefix,
  existsMemberByIdentityId,
  findMemberById,
  findMemberByIdentityId,
  findMemberByUniqueName,
  insertMember,
} from "./infrastructure/member.repository.js";
export { toMemberDomain } from "./infrastructure/member.persistence.js";

/** @deprecated Use `./member-access.js` — compatibility shim only. */
export { getMemberById as getLegacyMemberById, seedMember } from "./member.store.js";

export { default as memberRouter } from "./member.routes.js";

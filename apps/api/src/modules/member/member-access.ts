/**
 * Member Access Layer — public API for cross-module Member reads and writes.
 * MongoDB is the single source of truth; verification fixtures are fallback only.
 */
export type { EditableMemberProfileFields } from "./domain/member-profile.types.js";
export {
  getMemberById,
  getMemberByUniqueName,
  getMemberByIdSync,
  getMemberByUniqueNameSync,
  listMembers,
} from "./application/member-read.service.js";
export { updateMemberProfile } from "./application/member-write.service.js";

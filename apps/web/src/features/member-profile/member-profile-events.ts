export const MEMBER_PROFILE_UPDATED_EVENT = "hu:member-profile-updated";

export function dispatchMemberProfileUpdated(): void {
  window.dispatchEvent(new CustomEvent(MEMBER_PROFILE_UPDATED_EVENT));
}

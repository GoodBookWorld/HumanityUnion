export function isMembershipSuccessPreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MEMBERSHIP_SUCCESS_PREVIEW === "true";
}

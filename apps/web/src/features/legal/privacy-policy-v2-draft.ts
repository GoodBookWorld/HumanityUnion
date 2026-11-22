/**
 * HU-ACCOUNT-DELETE-01O — Privacy Policy v2 publication record.
 *
 * The canonical English page carries this wording. This module is not imported
 * by the public Privacy page, the locale route, or the legal resolver.
 * The material-change notice below is not registered with email, notifications,
 * or a scheduler, and it has not been sent.
 *
 * Do not machine-translate this text. Do not send the material-change notice.
 */

export const PUBLISHED_PRIVACY_POLICY_VERSION = "privacy-2026-11-v2" as const;

export const PRIVACY_POLICY_V2_VERSION = "privacy-2026-11-v2" as const;

/** Calendar date shown as November 22, 2026 in the canonical page heading. */
export const PRIVACY_POLICY_V2_EFFECTIVE_DATE = "2026-11-22" as const;

export const PRIVACY_POLICY_V2_SECTION_13_TITLE =
  "13. Account Deletion and Privacy Requests";

export const PRIVACY_POLICY_V2_SECTION_13_PARAGRAPHS = [
  "Participants may request deletion of their account or personal information by contacting info@huws.org or by using the account deletion control in Account Security when that control is available. Self-service deletion is not available for an administrator account, an account with an active regional appointment, or an account with an active editor permission. Those participants may still make the request by email.",
  "A self-service request is confirmed with the current password and a code sent to the account email. This confirms control of the account email. It does not verify legal identity. For any privacy request, Humanity Union may ask for reasonable information to confirm that the requester is authorized. That check is separate from ordinary participation and proportionate to the request.",
  "After confirmation, a recovery period of 30 days begins. The period runs for 720 hours from confirmation. During that period the participant cannot sign in. When three days or less remain and the account is not suspended, Humanity Union attempts to send one reminder. The reminder states the exact deadline and includes a link to the recovery page. Opening the link does not restore the account. A suspended account does not receive that reminder while the suspension lasts. If the suspension ends before the deadline and the reminder has not already been sent, Humanity Union may still attempt to send it. Delivery of the reminder is not guaranteed.",
  "Before the deadline, a participant whose account is not suspended may cancel the deletion on the recovery page by confirming the account email, the current password, and a new code. Cancellation restores sign-in. It does not add roles, appointments, editor permissions, or other privileges. Self-service recovery is unavailable while the account is suspended. Recovery becomes unavailable at the exact deadline.",
  "When the deadline passes, Humanity Union closes the account. Humanity Union attempts to send a closure notice to the account email before that address is released. Delivery of the notice is not guaranteed. A delivery failure does not extend the recovery deadline, and the closure still takes effect. Closing the account in Humanity Union's systems may take a short time after the deadline. Closure is not instantaneous. The closed account cannot be restored. Closure is not delayed by an administrative suspension.",
  "The same email address may be used to register a new account. The new account is a new participant. It does not receive the previous account’s identity, display name, roles, appointments, editor permissions, messages, or other privileges.",
  "Public civic records remain. The display name or pseudonym already associated with those records may remain so the records stay attributable. Account deletion does not rewrite civic documents. A participant may ask info@huws.org to anonymize or further restrict that name, or to request further restriction of other eligible personal information. Humanity Union will assess the request under this section and applicable law. Anonymization is not automatic.",
  "Private messages remain available to the other people in those conversations. The closed account cannot sign in or open them, and they are not transferred to a new account.",
  "At closure, Humanity Union disposes of credentials and profile details that are no longer required for the purposes below, including biography, photograph, organization, website, social links, and location. Disposal is secure and occurs when the information is no longer reasonably required. Closing the account does not mean that every item of personal information disappears at the same moment.",
  "Some information may still be retained, restricted, or anonymized rather than deleted, including information necessary for legal compliance, security, financial records, dispute resolution, or the integrity of public civic records. Retention of those records does not keep the account open and does not postpone release of the email address.",
  "An administrative suspension controls access. It does not cancel a confirmed deletion, extend the recovery deadline, or stop closure at that deadline. Closure does not lift the suspension. While an account is suspended, the participant cannot sign in or cancel the deletion on the recovery page. The participant may still contact info@huws.org about the request.",
  "Humanity Union will assess and respond to deletion and other privacy requests in accordance with applicable law. The rights in section 14, including access, correction, withdrawal of consent, deletion or anonymization of eligible information, objection, restriction, portability, and complaint to a privacy authority, are not reduced by this section.",
] as const;

export const PRIVACY_POLICY_V2_SECTION_ADDITIONS = {
  section6:
    "Closing an account does not, by itself, remove public civic records. A request to anonymize a public author name is handled under section 13.",
  section7:
    "If a participant closes an account, private messages remain available to the other participants in those conversations, as described in section 13.",
  section8:
    "Messages about account deletion, the recovery reminder, and account closure are essential account communications. Humanity Union attempts to send them. Delivery is not guaranteed, and a delivery failure does not extend a recovery deadline.",
  section12:
    "Account deletion follows section 13. It does not, by itself, erase records that this section allows Humanity Union to retain, and retention of those records does not keep the closed account open. Closing an account does not mean that every retained record disappears at the same moment.",
} as const;

/**
 * Prepared English notice for a later authorized publication.
 * This string is not registered with email, notifications, or a scheduler.
 */
export const PRIVACY_POLICY_V2_MATERIAL_CHANGE_NOTICE = [
  "Humanity Union has updated its Privacy Policy.",
  "When the account deletion control is available, a participant may request deletion from Account Security, or by emailing info@huws.org.",
  "After confirmation, a recovery period of 30 days (720 hours) begins. Recovery ends at the exact deadline.",
  "Closing an account does not erase eligible public civic records. The name already shown on those records may remain unless anonymization is requested and approved.",
  "Private messages remain available to the other people in those conversations.",
  "After closure, the same email address may be used to register a new account. The new account does not receive the previous account’s identity or privileges.",
  "Some records may still be retained where the law or the Privacy Policy allows it. Account closure and record retention do not happen as a single simultaneous erasure.",
].join(" ");

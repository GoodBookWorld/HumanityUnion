import { MEMBERSHIP_VOTE_WEIGHT_TRANSPARENCY_NOTE } from "@hu/types";

export const MEMBERSHIP_HERO = {
  title: "Become a Humanity Union Member",
  subtitle:
    "Membership is a voluntary commitment to support Humanity Union and participate in building a stronger global civic community.",
} as const;

export const MEMBERSHIP_MEANING_CARDS = [
  {
    id: "community",
    title: "Community",
    body: "Become part of Humanity Union's long-term civic community.",
  },
  {
    id: "support",
    title: "Support",
    body: "Membership includes a one-time Membership Contribution that helps sustain the platform.",
  },
  {
    id: "participation",
    title: "Participation",
    body: "Members participate equally with all Participants. Membership never increases voting power.",
  },
  {
    id: "transparency",
    title: "Transparency",
    body: "Member status appears on your public profile. You choose whether to display your Member Number.",
  },
] as const;

export const MEMBERSHIP_NOT_MEANS = [
  "identity verification",
  "citizenship",
  "government authorization",
  "moderator privileges",
  "administrator privileges",
  "increased voting influence",
] as const;

export const MEMBERSHIP_BENEFITS = [
  {
    id: "member-badge",
    title: "Member Badge",
    body: "Your Member status appears automatically on your public profile after Membership activation.",
  },
  {
    id: "member-number",
    title: "Member Number",
    body: "Receive a unique Humanity Union Member Number after your contribution is confirmed.",
  },
  {
    id: "participation-recognition",
    title: "Participation Recognition",
    body: "Membership recognizes voluntary support for the civic platform.",
  },
  {
    id: "future-programs",
    title: "Future Member Programs",
    body: "Access to future Member programs will be announced as they become available.",
  },
  {
    id: "transparent-statistics",
    title: "Transparent Statistics",
    body: "Aggregate Membership participation statistics are published across the platform.",
  },
  {
    id: "platform-sustainability",
    title: "Platform Sustainability",
    body: "Membership Contributions help sustain Humanity Union's civic infrastructure.",
  },
] as const;

export const MEMBERSHIP_FAQ = [
  {
    id: "what-is-member",
    question: "What is a Member?",
    answer:
      "A Member is a Participant who has completed the Membership application and confirmed a one-time Membership Contribution. Members remain equal Participants in all civic decisions.",
  },
  {
    id: "voting-power",
    question: "Does Membership change voting power?",
    answer:
      "No. Members and Participants have identical voting weight in all collective decisions.",
  },
  {
    id: "required",
    question: "Is Membership required?",
    answer:
      "No. Membership is entirely voluntary. Participants can engage fully in civic work without becoming Members.",
  },
  {
    id: "participate-without",
    question: "Can I still participate without Membership?",
    answer:
      "Yes. All core civic participation features remain available to confirmed Participants.",
  },
  {
    id: "expire",
    question: "Will Membership expire?",
    answer:
      "Membership is designed as a long-term voluntary commitment. Expiration policies, if any, will be published before they take effect.",
  },
  {
    id: "future-contributions",
    question: "How will future Membership Contributions work?",
    answer:
      "After your application is submitted, a one-time Membership Contribution will confirm your Membership. Payment integration will be available in a future platform update.",
  },
] as const;

export const MEMBERSHIP_CONTRIBUTION_AMOUNT = "1 CAD";

export const MEMBER_BADGE_PRODUCT = {
  title: "Wear Your Commitment",
  body: "Apply for your official Humanity Union Member Badge. The CA$28 contribution includes delivery.",
  subtitle: "A symbol of solidarity, responsibility, and global unity.",
  productName: "Official Humanity Union Member Badge",
  features: ["Secure pin backing", "Delivery included", "Optional Member contribution"] as const,
  price: "CA$28",
  shippingNote: "Delivery included",
  ctaLabel: "Member Badge Application",
  applicationIntro:
    "Confirm where your official Humanity Union Member Badge should be delivered.",
} as const;

export const MEMBER_BADGE_IMAGE_PATH = "/illustrations/membership/member-badge.webp";

export const MEMBERSHIP_SUCCESS_COPY = {
  heading: "Thank You!",
  subheading: "Your trust and support mean a lot.",
  body: "Your symbolic contribution helps Humanity Union continue building a transparent and responsible global civic platform.",
  confirmationTitle: "You are now a Member!",
  confirmationContributionLabel: "Membership Contribution",
  publicMemberNote:
    "Your Member badge appears automatically on your public profile. You can choose whether to show your Member Number publicly from Membership settings.",
  permanentTitle: "Membership is permanent.",
  permanentBody: "Thank you for being part of a better future for all.",
} as const;

export const MEMBERSHIP_SUCCESS_MEANING = [
  "You support Humanity Union and its mission.",
  "You participate equally with all other participants.",
  "Membership does not increase voting power.",
  "Your Member status appears automatically on your public profile.",
  "You help build a global community of responsibility and solidarity.",
] as const;

export const MEMBERSHIP_VOTING_EXPLANATION = MEMBERSHIP_VOTE_WEIGHT_TRANSPARENCY_NOTE;

export const MEMBERSHIP_VOTING_EXAMPLE = {
  totalParticipation: 879,
  members: 645,
  participants: 234,
} as const;

export const MEMBERSHIP_VISIBILITY_LABEL = "Show my Member Number publicly";

export const MEMBERSHIP_VISIBILITY_DESCRIPTION =
  "Member status and badge appear automatically on your public profile. Enable this to also show your Member Number. Payment details are never shown publicly.";

export const MEMBERSHIP_ACTIVATION_UNAVAILABLE = "Membership activation has not been confirmed.";

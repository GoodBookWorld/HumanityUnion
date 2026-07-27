export const MEMBER_BADGE_PAGE_COPY = {
  heroTitle: "Official Humanity Union Member Badge",
  heroSubtitle:
    "The Badge is an optional symbol of solidarity, responsibility, and commitment to the Humanity Union community.",
  meaningTitle: "Meaning of the Badge",
  meaningBody:
    "The physical Member Badge is a symbolic Membership item. It is not proof of identity, a government credential, a voting credential, or a source of greater civic authority.",
  contributionTitle: "Additional Membership Contribution",
  contributionAmount: "20 CAD",
  contributionNote:
    "Shipping is calculated separately according to the available destination and delivery method.",
  shippingTitle: "Shipping information",
  shippingBody:
    "Shipping is additional and destination-dependent. Available destinations are limited to configured regions.",
  eligibilityTitle: "Eligibility",
  eligibilityBody:
    "The official Member Badge is available to active Humanity Union Members. Public visibility of Membership does not affect eligibility.",
  optionalClarification:
    "Requesting the physical Badge is optional and does not affect Membership status, voting, or civic participation.",
  disabledMessage: "Member Badge Contributions are not currently open.",
  cancelMessage:
    "Your Member Badge Contribution was not completed. Your Membership and civic participation were not affected.",
  emptyRequests: "You have not requested a physical Member Badge.",
} as const;

export const MEMBER_BADGE_FAQ = [
  {
    id: "required",
    question: "Is the physical Member Badge required for Membership?",
    answer:
      "No. The physical Badge is an optional additional Membership Contribution for active Members who choose to request it.",
  },
  {
    id: "membership-impact",
    question: "Does requesting the Badge change my Membership?",
    answer:
      "No. Requesting, cancelling, refunding, or not requesting the Badge does not change Membership status, Member Number, voting, or civic participation.",
  },
  {
    id: "amount",
    question: "What is the Member Badge Contribution amount?",
    answer:
      "The additional Membership Contribution is 20 CAD. Shipping is calculated separately based on configured destination and delivery method.",
  },
  {
    id: "shipping",
    question: "Where can badges be shipped?",
    answer:
      "Shipping destinations are limited to operationally configured regions. Additional destinations may become available later.",
  },
] as const;

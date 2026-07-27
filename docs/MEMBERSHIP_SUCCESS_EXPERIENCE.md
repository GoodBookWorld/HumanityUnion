# Membership Success Experience

TASK-091B implements the Membership success experience, Member badge presentation, and public-status visibility controls. Payment integration remains deferred to TASK-092.

## Success page structure

This section documents the success page structure for `/membership/success`.

Route: `/membership/success`

| Section                   | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| Hero                      | Thank-you message with Member Badge artwork            |
| Member Confirmation Card  | Real Member Number, Member Since, 1 CAD contribution   |
| What Membership Means     | Civic meaning points (no authority/KYC language)       |
| Permanent Membership Note | Policy representation in UI                            |
| Physical Badge Offer      | Informational 20 CAD + shipping card with disabled CTA |
| Voting explanation        | Statistical support note (TASK-093 deferred)           |

## Badge asset path

Official artwork (local only):

`/illustrations/membership/member-badge.webp`

Used by `MemberBadgeIcon` at sizes: small (24px), medium (40px), large (64px), feature (responsive).

## Active-member access guard

The success page renders only when:

1. Authenticated participant has `membership.status === "active_member"`, **or**
2. Development preview is explicitly enabled

If the participant is not an active Member and preview is disabled, the page shows **Membership activation has not been confirmed** or redirects to `/membership`.

The route **never** activates Membership. Activation remains a backend responsibility after a verified Stripe webhook in TASK-092.

## Preview policy

Environment variable:

```bash
NEXT_PUBLIC_MEMBERSHIP_SUCCESS_PREVIEW=false
```

Default: `false`

When `true` in development, the page layout may render without active Membership, but confirmation fields remain unavailable — no fake Member Number or Member Since is shown.

Do not enable preview in production.

## Public visibility behavior

Field: `membershipPubliclyVisible` on `member_profiles` (default `false`)

| Actor         | Can enable? |
| ------------- | ----------- |
| Active Member | Yes         |
| Participant   | No          |

Saved via `PATCH /api/v1/member-profile/me/privacy`.

When enabled, public profile may show:

- Member badge icon
- Member label
- Membership domain Member Number

Payment date, Stripe identifiers, contribution amount, and payment records are **never** exposed publicly.

## Public projection rules

When `membership.status === "active_member"` and `membershipPubliclyVisible === true`:

```json
{
  "membershipStatus": "member",
  "memberNumber": "HU-2026-XXXXXX",
  "memberBadgeVisible": true
}
```

Otherwise:

```json
{
  "membershipStatus": "participant",
  "memberBadgeVisible": false
}
```

Hidden public status does not change internal voting category calculations.

## Physical Badge deferred scope

The **Wear Your Commitment** card presents the optional physical Member Badge product:

- 20 CAD + shipping
- Disabled **Order Member Badge** button
- Coming Soon supporting text

Not implemented in this task:

- Cart, order form, shipping address, inventory, taxes, checkout, Stripe product, payment link

## Future Stripe redirect integration point (TASK-092)

After backend-confirmed Membership activation via Stripe webhook:

1. Checkout success redirect → `/membership/success`
2. Success page reads real `memberNumber` and `memberGrantedAt` from Membership domain
3. Physical badge ordering remains a separate future commerce task

See also [MEMBERSHIP_UI_FOUNDATION.md](./MEMBERSHIP_UI_FOUNDATION.md).

## Verification

```bash
npm run verify:membership-success-ui
npm run verify:membership-domain
npm run verify:membership-ui
npm run verify:member-profile
```

## Component map

```
/membership/success
└── MembershipSuccessPageContent
    ├── MembershipSuccessHero
    ├── MembershipSuccessConfirmationCard
    ├── MembershipSuccessMeaningCard
    ├── MembershipSuccessPermanentNote
    ├── MembershipMemberBadgeOffer
    └── MembershipVotingExplanation

MemberBadgeIcon (shared)
MembershipPublicVisibilityControl
MembershipPublicDisplayPreview
```

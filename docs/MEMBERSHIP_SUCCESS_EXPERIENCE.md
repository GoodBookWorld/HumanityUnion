# Membership Success Experience

TASK-091B implements the Membership success experience, Member badge presentation, and Member Number visibility controls. Stripe Membership activation is documented in [STRIPE_MEMBERSHIP_CONTRIBUTION.md](./STRIPE_MEMBERSHIP_CONTRIBUTION.md).

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

Public honorary Member indicator (shared): `MemberStatusIndicator`.

## Active-member access guard

The success page renders only when:

1. Authenticated participant has `membership.status === "active_member"`, **or**
2. Development preview is explicitly enabled

If the participant is not an active Member and preview is disabled, the page shows **Membership activation has not been confirmed** or redirects to `/membership`.

The route **never** activates Membership. Activation remains a backend responsibility after a verified Stripe webhook.

## Preview policy

Environment variable:

```bash
NEXT_PUBLIC_MEMBERSHIP_SUCCESS_PREVIEW=false
```

Default: `false`

When `true` in development, the page layout may render without active Membership, but confirmation fields remain unavailable — no fake Member Number or Member Since is shown.

Do not enable preview in production.

## Public Member status (Pack 25A.1)

Honorary Member status is a **public profile status**.

When:

- `membership.status === "active_member"`
- and a Member Number exists

the public profile **always** projects:

- `membershipStatus: "member"`
- `memberBadgeVisible: true`

No Participant opt-in is required for the Member badge/status indicator.

Existing active Members receive this automatically on the next public-profile fetch — no remigration, resave, or second payment.

## Member Number visibility

Field: `membershipPubliclyVisible` on `member_profiles` (default `false`)

| Actor         | Can enable? |
| ------------- | ----------- |
| Active Member | Yes         |
| Participant   | No          |

Saved via `PATCH /api/v1/member-profile/me/privacy`.

This preference controls **Member Number** exposure only.

| Preference | Public projection |
| ---------- | ----------------- |
| `false`    | Member status + badge; Member Number omitted |
| `true`     | Member status + badge + Member Number |

Payment date, Stripe identifiers, contribution amount, and payment records are **never** exposed publicly.

## Public projection rules

When `membership.status === "active_member"` and Member Number exists:

```json
{
  "membershipStatus": "member",
  "memberBadgeVisible": true
}
```

When `membershipPubliclyVisible === true`, also:

```json
{
  "memberNumber": "HU-2026-XXXXXX"
}
```

When Membership is not `active_member` (or Member Number is missing):

```json
{
  "membershipStatus": "participant",
  "memberBadgeVisible": false
}
```

Internal voting category calculations continue to use canonical Membership status, not the public projection preference.

## Physical Badge application (Pack 25B)

The **Wear Your Commitment** card opens the Member Badge Application modal:

- CA$28 contribution
- Delivery included
- Private shipping address
- Save for Later / Continue to Payment (Stripe Checkout in Pack 25C)

See [MEMBER_BADGE_APPLICATION.md](./MEMBER_BADGE_APPLICATION.md).

## Physical Badge deferred commerce scope

Not implemented in Pack 25B:

- Stripe Badge Checkout
- Admin fulfillment
- A5 shipping labels / QR

## Stripe redirect integration

After backend-confirmed Membership activation via Stripe webhook:

1. Checkout success redirect → `/membership/success`
2. Success page reads real `memberNumber` and `memberGrantedAt` from Membership domain
3. Member badge appears automatically on the public profile
4. Physical badge ordering remains a separate commerce task

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
MemberStatusIndicator (shared public indicator)
MembershipPublicVisibilityControl
MembershipPublicDisplayPreview
```

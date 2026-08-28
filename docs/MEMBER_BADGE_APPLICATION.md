# Member Badge Application

Pack 25B establishes the Member Badge Application foundation:

- private shipping-address application aggregate
- authenticated Participant modal + widget
- CA$28 contribution with delivery included
- Save for Later / Continue to Payment boundary (no Stripe Checkout yet)

Stripe Badge Checkout → Pack 25C
Admin fulfillment + A5 shipping labels → Pack 25D

## Eligibility

Server-enforced:

- `membership.status === "active_member"`
- Member Number present
- authenticated, active, email-verified account

Not derived from public Member badge visibility.

## Price contract

| Constant | Value |
| --- | --- |
| `MEMBER_BADGE_APPLICATION_AMOUNT_CENTS` | `2800` |
| Currency | CAD |
| Display | `CA$28` |
| Delivery | included |

Membership Contribution (CA$1) remains a separate payment.

Do not reuse `STRIPE_MEMBERSHIP_PRICE_ID` for badge applications.

## Private shipping address

Shipping fields are private fulfillment data. They must never appear on:

- `PublicMemberProfile`
- public Participant profile DTOs / projections
- public search

Only the owning Participant (and future authorized Admin surfaces) may retrieve the address.

Audit events may reference `applicationId` / `participantId` / status transitions — never the full postal address.

## API

Base: `/api/v1/member-badge-applications`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/availability` | Eligibility + price labels |
| GET | `/me` | Current unpaid application (or null) |
| PUT | `/me` | Save for Later (upsert unpaid) |
| POST | `/me/continue-to-payment` | Persist + create/reuse Stripe Checkout Session |

Continue to Payment never marks payment paid; only the verified webhook does.

## Pack 25C Stripe boundary

Canonical Checkout attaches to the same `member_badge_applications` record:

- `paymentPurpose = member_badge_contribution`
- metadata: `applicationId`, `internalUserId`
- Price: `STRIPE_MEMBER_BADGE_PRICE_ID` (CA$28 one-time)
- No Stripe shipping collection (HU already stores the private address)
- success → `/membership?badgePayment=success`
- cancel → `/membership?badgePayment=cancelled`

Webhook (`POST /api/v1/webhooks/stripe/membership`) routes Badge Checkout with
`applicationId` to the application payment handler.

Paid transition:

- `paymentStatus: paid`
- `fulfillmentStatus: awaiting_fulfillment`
- `paidAt` set
- Admin Notification: `member_badge_order_paid`
- Audit: `member_badge.payment.completed`

Legacy `member-badge-contribution` (CA$20 + Stripe shipping) remains disabled by
`MEMBER_BADGE_CONTRIBUTIONS_ENABLED=false` and is not used for new orders.

## Pack 25D — Admin fulfillment + Membership UI

Admin Member Badge Order workflow (authorized Admin only):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/admin/member-badge-applications/:applicationId` | Order detail (includes private address) |
| PATCH | `/api/v1/admin/member-badge-applications/:applicationId/fulfillment` | Reversible `shipped` / `delivered` markers |
| POST | `/api/v1/admin/member-badge-applications/:applicationId/email-label` | Email A5 label to fulfillment destination |
| GET | `/api/v1/admin/member-badge-applications/:applicationId/label.pdf` | A5 shipping-label PDF |

Participant Directory Membership primary views:

1. All
2. Application submitted (`application_submitted`)
3. Active Members (`active_member`)
4. Member Badge Orders (`member_badge_orders`)

Deep link from Admin notification `member_badge_order_paid`:

`/admin/participants?view=member_badge_orders&badgeApplicationId={applicationId}`

Participant aggregates include cumulative **Application started**
(`MembershipStatisticsPayload.applicationStarted`).

UI surfaces:

- Admin Order modal — ORDER / PAYMENT / DELIVERY / FULFILLMENT + Print / Email Label
- Fulfillment Progress widget — red animated line until Delivered; green static when complete; `prefers-reduced-motion` disables animation
- My Member Badge Application widget — horizontal field grid on desktop/tablet
- Membership Status facts — equal-width pale tiles (private + public where facts appear)

Shipping address remains Admin/owner-only. Stripe secrets are never shown in UI.

## Pack 25D — A5 shipping-label invariant

Maximum printable shipping-label page size: **A5**.

Never automatically expand the label to A4 or US Letter.

Canonical sender:

```
Humanity Union Society
514 Vernon St.
Nelson, BC V1L 5R4
Canada
```

Recipient comes from the private application shipping address.

Future QR must represent real application / shipping information or a safe application reference — never fabricated sample data.

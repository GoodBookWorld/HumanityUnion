# Official Member Badge Contribution (TASK-094)

Optional **20 CAD** additional Membership Contribution plus configured shipping for **active Members** requesting the physical **Official Humanity Union Member Badge**.

This flow is separate from the initial **1 CAD** Membership Contribution. It does not activate Membership, change Member Number, voting, or public visibility.

## Terminology

| Use                                | Do not use         |
| ---------------------------------- | ------------------ |
| Official Member Badge              | Verification badge |
| Member Badge Contribution          | Product purchase   |
| Additional Membership Contribution | Donation receipt   |
| Badge Request                      | Retail order       |
| Fulfillment                        | Online store       |

## Production enablement

Production remains **disabled by default**:

```env
MEMBER_BADGE_CONTRIBUTIONS_ENABLED=false
```

Enable only after operational, shipping, fulfillment policy, and accounting/legal review.

**No tax engine is implemented in TASK-094.** Stripe Tax, GST/HST/PST calculation, and public tax-exempt or tax-deductible claims are excluded. Future professional review may require a separate task.

## Eligibility

Checkout requires:

- authenticated account
- confirmed email
- `active_member` Membership status
- `MEMBER_BADGE_CONTRIBUTIONS_ENABLED=true`
- configured Stripe Badge Price (`STRIPE_MEMBER_BADGE_PRICE_ID`)
- at least one configured Stripe Shipping Rate

Public Membership visibility does **not** affect eligibility.

## Domain model

Mongo collection: `member_badge_contributions`

Key fields:

- `badgeContributionId`, `badgeRequestNumber` (`HU-BADGE-YYYY-XXXXXX`)
- contribution: `amountCents` (2000), `currency` (`cad`), statuses
- fulfillment: recipient/shipping (private), tracking (optional)
- Stripe references (private)
- audit timestamps and idempotent webhook/email markers

Shipping address is private and never indexed in Search or public profiles.

## API

| Method | Path                                                         | Purpose                               |
| ------ | ------------------------------------------------------------ | ------------------------------------- |
| GET    | `/api/v1/member-badge-contributions/availability`            | Feature + eligibility for UI          |
| POST   | `/api/v1/member-badge-contributions/checkout`                | Create Checkout (active Members only) |
| GET    | `/api/v1/member-badge-contributions/me`                      | Owner request history                 |
| GET    | `/api/v1/member-badge-contributions/me/:badgeContributionId` | Owner request detail                  |
| GET    | `/api/v1/member-badge-contributions/me/session/:sessionId`   | Success page lookup                   |

The browser must not send amount, currency, price id, or identity fields.

## Stripe Checkout

- `mode: payment`
- line item: configured 20 CAD Stripe Price, quantity 1
- shipping address collection for configured countries
- shipping options from configured Stripe Shipping Rates
- metadata `paymentPurpose: member_badge_contribution` (+ internal ids; no PII)

Success URL: `/membership/member-badge/success?session_id={CHECKOUT_SESSION_ID}`  
Cancel URL: `/membership/member-badge?contribution=cancelled`

## Webhook routing

Shared endpoint: `POST /api/v1/webhooks/stripe/membership`

| `paymentPurpose`            | Handler                               |
| --------------------------- | ------------------------------------- |
| `membership`                | Membership activation (TASK-092)      |
| `member_badge_contribution` | Badge confirmation + fulfillment prep |
| missing (legacy)            | Membership handler                    |

Badge webhooks must never activate Membership. Membership webhooks must never create Badge requests.

Handled Badge events include `checkout.session.completed`, async payment events, `payment_intent.*`, `charge.refunded`, and `charge.dispute.created`.

Confirmation occurs only after verified webhook processing. Confirmation email and notification are idempotent.

## Shipping configuration

```env
MEMBER_BADGE_SHIPPING_COUNTRIES=CA
STRIPE_MEMBER_BADGE_SHIPPING_RATE_CA=
STRIPE_MEMBER_BADGE_SHIPPING_RATE_US=
STRIPE_MEMBER_BADGE_SHIPPING_RATE_INTERNATIONAL=
```

Only configured rates are offered. Do not advertise destinations without operational configuration.

## Fulfillment preparation

Service stubs exist for future authorized administration:

- list confirmed requests
- mark preparing / shipped / delivered
- record tracking

No full admin panel in TASK-094.

## Frontend routes

- `/membership/member-badge` — information + CTA
- `/membership/member-badge/success` — processing vs confirmed (backend state)
- `/membership/member-badge/requests` — private history
- `/membership/member-badge/requests/[badgeContributionId]` — owner detail

Artwork: `/illustrations/membership/member-badge.webp`

## Verification

```bash
npm run verify:member-badge-contribution
```

## Production enablement checklist

- [ ] Shipping destinations approved
- [ ] Shipping prices configured in Stripe
- [ ] Lost/damaged delivery policy approved
- [ ] Cancellation/replacement/refund policy approved
- [ ] Data retention policy approved
- [ ] Accounting/legal tax treatment confirmed
- [ ] `MEMBER_BADGE_CONTRIBUTIONS_ENABLED=true` explicitly set
- [ ] Stripe live Price and Shipping Rates configured

## Future tax/accounting extension point

If professional review requires tax handling, add it through a dedicated task without rewriting the Badge Contribution domain. Preserve server-owned amounts and webhook-only confirmation.

# Stripe Membership Contribution (TASK-092)

One-time **1 CAD** Membership Contribution via **Stripe Checkout**. Membership activates **only** after a signed Stripe webhook confirms payment. The success URL and frontend never activate Membership.

## Architecture

```
Participant (application submitted)
        │
        ▼
POST /api/v1/membership/checkout  ──► Stripe Checkout Session (mode: payment)
        │                                      │
        │                                      ▼
        │                              Customer pays 1 CAD
        │                                      │
        ▼                                      ▼
status: pending_payment              Stripe webhook (signed)
        │                                      │
        │                                      ▼
        │                    POST /api/v1/webhooks/stripe/membership
        │                                      │
        │                                      ▼
        │                         activateMembershipMemberNumber()
        │                                      │
        ▼                                      ▼
/membership/success (read-only)      status: active_member + Member Number
```

| Layer        | Responsibility                                                         |
| ------------ | ---------------------------------------------------------------------- |
| Frontend     | Eligibility UI, call checkout API, redirect to Stripe                  |
| Checkout API | Eligibility, create Session, store contribution record                 |
| Webhook      | Signature verification, idempotent activation, refund/dispute audit    |
| MongoDB      | `membership_contributions`, `membership_webhook_events`, `memberships` |

## Checkout flow

1. User is authenticated, email confirmed, application submitted, and not `active_member`.
2. Frontend **Become a Member** calls `POST /api/v1/membership/checkout`.
3. API creates or reuses a `membership_contributions` record and a Stripe Checkout Session (`mode: payment`, 1 CAD).
4. API sets membership `status` to `pending_payment`.
5. Browser redirects to Stripe-hosted Checkout.
6. On cancel, Stripe returns to `/membership?contribution=cancelled` with a neutral message.

### Checkout metadata (no PII)

| Key               | Purpose                     |
| ----------------- | --------------------------- |
| `paymentPurpose`  | Route webhook: `membership` |
| `membershipId`    | Internal membership record  |
| `internalUserId`  | Auth user id                |
| `applicationId`   | Same as membership id       |
| `platformVersion` | Deployment traceability     |

## Payment purpose separation (TASK-094)

The shared Stripe webhook endpoint also receives **Member Badge Contribution** events. Routing uses metadata:

| `paymentPurpose`            | Handler                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| `membership`                | Membership activation (this doc)                                      |
| `member_badge_contribution` | Badge confirmation (see `docs/OFFICIAL_MEMBER_BADGE_CONTRIBUTION.md`) |

Membership webhooks must never create Badge requests. Badge webhooks must never activate Membership.

## Webhook flow

**Endpoint:** `POST /api/v1/webhooks/stripe/membership`

- Mounted **before** `express.json()` with `express.raw({ type: "application/json" })`.
- Verifies `Stripe-Signature` using `STRIPE_WEBHOOK_SECRET`.
- Unsigned or invalid requests are rejected (400).
- Uses Stripe Event ID uniqueness in `membership_webhook_events` for idempotency.

### Handled events

| Event                           | Action                                        |
| ------------------------------- | --------------------------------------------- |
| `checkout.session.completed`    | Activate Membership if paid                   |
| `payment_intent.succeeded`      | Activate Membership (fallback)                |
| `payment_intent.payment_failed` | Record failed payment                         |
| `charge.refunded`               | Record `refunded`; **keep** Membership active |
| `charge.dispute.created`        | Record `disputed`; **keep** Membership active |

Unrelated events are ignored and logged as `ignored`.

## Activation sequence

1. Verify webhook signature.
2. Load Stripe event; skip if `stripeEventId` already `processed`.
3. Read metadata (`membershipId`, `internalUserId`).
4. Load contribution by Checkout Session or Payment Intent id.
5. If membership already `active_member`, mark contribution `already_active` and exit.
6. Call `activateMembershipMemberNumber({ userId })` — assigns Member Number once.
7. Update contribution: `paid`, Stripe ids, `paidAt`, `webhookProcessedAt`, `webhookResult`.
8. Mark webhook event `processed`.

On activation failure: membership `technical_error`, contribution `technical_error`, safe server logging only.

## Refund behavior

- Contribution `status` → `refunded`, `refundedAt` set.
- Membership **remains** `active_member`.
- Admin review may change status later; no automatic revocation.

## Dispute behavior

- Contribution `status` → `disputed`, `disputedAt` set.
- Membership **remains** `active_member`.
- Administrative review only.

## Environment variables

### API (`apps/api/.env`)

| Variable                      | Required   | Description                                             |
| ----------------------------- | ---------- | ------------------------------------------------------- |
| `STRIPE_SECRET_KEY`           | Production | Stripe secret key (`sk_…`)                              |
| `STRIPE_PUBLISHABLE_KEY`      | Optional   | Server-side publishable key reference                   |
| `STRIPE_WEBHOOK_SECRET`       | Production | Webhook signing secret (`whsec_…`)                      |
| `STRIPE_MEMBERSHIP_PRICE_ID`  | Production | Stripe Price id for 1 CAD one-time product              |
| `WEB_ORIGIN`                  | Yes        | Success/cancel URLs (e.g. `http://localhost:3000`)      |
| `MEMBERSHIP_PAYMENT_PROVIDER` | Optional   | `stripe` or `mock` (default: `mock` without secret key) |
| `PLATFORM_VERSION`            | Optional   | Stored in Checkout metadata                             |

### Web (`apps/web/.env.local`)

| Variable                                 | Required | Description                                                                |
| ---------------------------------------- | -------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`     | Optional | For future Stripe.js use; Checkout redirect does not require client SDK    |
| `NEXT_PUBLIC_MEMBERSHIP_SUCCESS_PREVIEW` | Dev only | Preview success UI without active Member (must stay `false` in production) |

## Failure recovery

| Scenario               | Recovery                                           |
| ---------------------- | -------------------------------------------------- |
| User closes Checkout   | Return to `/membership`; create new Session        |
| Webhook delivery retry | Idempotent by Stripe Event ID                      |
| Activation error       | `technical_error` status; support replay after fix |
| Refund / dispute       | Audit on contribution; Member status unchanged     |

## Verification

```bash
npm run verify:membership-payment
```

Uses `MEMBERSHIP_PAYMENT_PROVIDER=mock` and MongoDB to verify checkout, signature rejection, activation, idempotency, refund, dispute, profile projection, and no frontend activation.

## Deferred

- **TASK-093** — Membership Statistics Integration
- **TASK-094** — Physical Member Badge Ordering
- **TASK-095** — Support Platform / Donations (separate from Membership Contribution)

## Related docs

- [MEMBERSHIP_ARCHITECTURE.md](./MEMBERSHIP_ARCHITECTURE.md)
- [MEMBERSHIP_DOMAIN_FOUNDATION.md](./MEMBERSHIP_DOMAIN_FOUNDATION.md)
- [MEMBERSHIP_SUCCESS_EXPERIENCE.md](./MEMBERSHIP_SUCCESS_EXPERIENCE.md)

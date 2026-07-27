# Membership Domain Foundation

TASK-090 implements the core Humanity Union Membership domain: persistence, API foundation, member numbering architecture, profile integration, and workspace UI placeholder. Payment integration is deferred to TASK-092.

## Mission

Membership is a **separate domain** from authentication. Every Email-Confirmed Participant remains a **Participant** until a future confirmed Membership Contribution activates Membership. This task does not implement Stripe, Checkout, webhooks, or statistics changes.

See also [MEMBERSHIP_ARCHITECTURE.md](./MEMBERSHIP_ARCHITECTURE.md) for the full blueprint.

## Domain model

### Membership record (`memberships` collection)

| Field                     | Type                          | Notes                                       |
| ------------------------- | ----------------------------- | ------------------------------------------- |
| `membershipId`            | string (UUID)                 | Primary key                                 |
| `userId`                  | string                        | FK → `auth_users`; unique                   |
| `profileId`               | string                        | FK → `member_profiles`                      |
| `memberNumber`            | string \| null                | Assigned only on `active_member`; immutable |
| `status`                  | `MembershipStatus`            | Lifecycle status                            |
| `applicationStatus`       | `MembershipApplicationStatus` | Application workflow                        |
| `countryCode`             | string \| null                | ISO 3166-1 alpha-2                          |
| `displayNameConfirmed`    | string \| null                | Application confirmation                    |
| `termsVersion`            | string \| null                | e.g. `membership-terms-2026-06-01`          |
| `termsAcceptedAt`         | string \| null                | ISO timestamp                               |
| `applicationSubmittedAt`  | string \| null                | ISO timestamp                               |
| `memberGrantedAt`         | string \| null                | Immutable once set                          |
| `createdAt` / `updatedAt` | string                        | Audit                                       |

Types live in `packages/types/src/domain/membership.ts`.

## Status lifecycle

### Membership status

| Status                  | Meaning                                        |
| ----------------------- | ---------------------------------------------- |
| `not_started`           | Default; no application activity               |
| `application_started`   | Draft application in progress                  |
| `application_completed` | Application submitted; awaiting future payment |
| `pending_payment`       | Reserved for TASK-092                          |
| `manual_review`         | Reserved for payment/review flows              |
| `active_member`         | Membership active; member number assigned      |
| `payment_refunded`      | Reserved for TASK-092                          |
| `payment_disputed`      | Reserved for TASK-092                          |
| `technical_error`       | Reserved for integration failures              |

### Application status (separate from payment)

| Status        | Meaning                                   |
| ------------- | ----------------------------------------- |
| `not_started` | No application                            |
| `draft`       | Saved, not submitted                      |
| `submitted`   | Application submitted                     |
| `approved`    | Set when Membership activates (TASK-092+) |
| `cancelled`   | Reserved for future cancellation flow     |

## API

All routes require JWT authentication (`requireJwtAuthenticationMiddleware`). Application mutations require confirmed email.

| Method | Path                             | Purpose                                           |
| ------ | -------------------------------- | ------------------------------------------------- |
| GET    | `/api/v1/membership/me`          | Full membership state, application view, timeline |
| GET    | `/api/v1/membership/status`      | Lightweight status payload                        |
| POST   | `/api/v1/membership/application` | Create or update application                      |
| PATCH  | `/api/v1/membership/application` | Update application (draft or submit)              |

Application body:

```json
{
  "countryCode": "US",
  "displayNameConfirmed": "Ada Participant",
  "understandMembershipMeaning": true,
  "understandNoVoteWeightChange": true,
  "understandDataPolicy": true,
  "submit": true
}
```

Validation:

- One `memberships` document per `userId` (unique index)
- Duplicate submit rejected when `applicationStatus` is `submitted` or `approved`
- `memberNumber` and `memberGrantedAt` immutable after assignment

## Member number

- Format: `HU-{YEAR}-{6CHAR}` (e.g. `HU-2026-7F3K92`)
- Generator: `membership-member-number.ts`
- Assignment: `activateMembershipMemberNumber()` — **not called in production flows until TASK-092**
- Distinct from profile `memberNumber` on `member_profiles` (legacy internal profile identifier)

## MongoDB indexes

Collection: `memberships`

- `{ userId: 1 }` unique
- `{ memberNumber: 1 }` unique, sparse
- `{ status: 1, updatedAt: -1 }`
- `{ applicationStatus: 1 }`
- `{ profileId: 1 }`

## Profile integration

`/profile` preview includes a **Membership** section (status, application status, Member Number, Member Since) via `MembershipProfileSection`. Data loaded from `GET /api/v1/membership/me`.

## Workspace integration

- Navigation: **Membership** under Profile group → `/membership`
- Page: timeline widget, status card, application form, contribution placeholder (“Coming in TASK-092”)

## Future payment integration points (TASK-092)

1. After `application_completed` + `submitted`, create Stripe Checkout Session → `pending_payment`
2. Webhook handler confirms payment → call `activateMembershipMemberNumber()`
3. New collections from architecture briefing: `membership_contributions`, `membership_webhook_events`
4. Success redirect page remains informational only

## Verification

```bash
npm run verify:membership-domain
```

Also run: `verify:member-profile`, `verify:auth`, `verify:mongodb`, `typecheck`, `build`, `lint`, `format:check`.

## Module layout

```
apps/api/src/modules/membership/
├── membership.constants.ts
├── membership.errors.ts
├── membership-member-number.ts
├── membership.projection.ts
├── membership.repository.ts
├── membership.routes.ts
├── membership.service.ts
├── membership.validators.ts
└── index.ts
```

## Deferred

| Task     | Scope                             |
| -------- | --------------------------------- |
| TASK-091 | Membership UI Foundation (polish) |
| TASK-092 | Stripe Membership Contribution    |
| TASK-093 | Membership Statistics Integration |

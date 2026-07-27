# Membership UI Foundation

TASK-091 implements the complete Humanity Union Membership user experience on top of the Membership Domain (TASK-090). Payment integration, Member activation, and statistics remain deferred.

## Mission

Membership is presented as a complete civic experience explaining what Membership is, why it exists, what it does, what it does not do, and how a Participant becomes a Member — even though payment arrives in TASK-092.

## Route

| Route         | Access                                    |
| ------------- | ----------------------------------------- |
| `/membership` | Public page; authenticated sections gated |

Entry points:

- **Header** — Primary navigation → Membership
- **Workspace** — Sidebar Profile group → Membership; Workspace Home widget
- **Member Profile** — Membership section with Open Membership button

## Page structure

This section documents the page structure for `/membership`.

1. **Hero** — Title, subtitle, Participant/Member cohort badge
2. **Meaning of Membership** — Four information cards (Community, Support, Participation, Transparency)
3. **What Membership Does NOT Mean** — Neutral cards for exclusions
4. **Membership Status Card** — Current status, application status, member number, member since, contribution (authenticated)
5. **Membership Journey** — Vertical timeline on mobile; horizontal on desktop
6. **Membership Application** — Display name, country, declaration checkboxes, Save Draft / Submit Application
7. **Future Contribution Card** — Informational copy + disabled Coming Soon button
8. **Benefits Grid** — Six responsive placeholder cards
9. **FAQ Accordion** — Six `<details>` entries

Unauthenticated visitors see public informational sections plus a sign-in prompt for application and status features.

## User journey

This section documents the user journey from Participant to Member.

```
Registration → Email Confirmed → Membership Application → Membership Contribution → Member
```

| Step state | Visual treatment             |
| ---------- | ---------------------------- |
| Complete   | Humanity primary blue marker |
| Current    | Accent highlight             |
| Upcoming   | Light gray                   |

Application flow:

1. Participant confirms email
2. Completes application form (draft or submit)
3. Submitted application awaits future contribution (TASK-092)
4. Member activation and member number assignment occur only after confirmed contribution (TASK-092+)

## Component hierarchy

```
apps/web/src/app/membership/page.tsx
└── MembershipPageContent
    ├── MemberWorkspace (authenticated)
    │   └── WorkspaceNavigation
    └── membership-page-shell (public)
        ├── MembershipHero
        ├── MembershipStatusCard
        ├── MembershipJourneySection
        │   └── MembershipTimeline
        ├── MembershipApplicationForm
        ├── MembershipContributionCard
        ├── MembershipMeaningCards
        ├── MembershipNotMeans
        ├── MembershipBenefitsGrid
        └── MembershipFaqAccordion

MembershipProfileSection (Member Profile preview)
MembershipWorkspaceWidget (Workspace Home)
```

Shared utilities:

- `membership.constants.ts` — Static copy (FAQ, benefits, meaning cards)
- `membership-labels.ts` — Status/application formatting helpers
- `membership-api.ts` — API client for TASK-090 endpoints

## Responsive behavior

| Breakpoint | Layout                                                          |
| ---------- | --------------------------------------------------------------- |
| Mobile     | Single column; vertical timeline                                |
| Tablet     | Two-column info and benefits grids                              |
| Desktop    | Full-width sections; 4-column meaning grid; horizontal timeline |

## Profile integration

`MembershipProfileSection` on `/profile` shows:

- Current status and application status
- Journey progress summary and compact timeline
- Contribution status
- **Open Membership** button → `/membership`

## Workspace integration

`MembershipWorkspaceWidget` on Workspace Home shows:

- Status, application, journey, contribution
- Compact timeline
- **Continue Membership** button → `/membership`

## Design system reuse

- `Card`, `Button`, `SectionHeader`, `StatusBanner`
- `<details>` accordion pattern (institutions-style)
- Workspace badge styling conventions for cohort labels
- Existing alert/error patterns for validation messages

No new visual language was introduced.

## Future Stripe insertion points (TASK-092)

1. **`MembershipContributionCard`** — Replace disabled Coming Soon with Checkout redirect
2. **`membership.projection.ts` timeline** — Update contribution step detail when payment is available
3. **`MembershipStatusCard` contribution field** — Reflect payment pending/completed states
4. **API** — New Checkout Session and webhook handlers; call `activateMembershipMemberNumber()` on success
5. **Workspace widget** — Surface contribution payment status
6. **Success redirect** — After backend-confirmed activation, Stripe Checkout success redirect targets `/membership/success` (TASK-091B). The page never activates Membership itself.

See [MEMBERSHIP_SUCCESS_EXPERIENCE.md](./MEMBERSHIP_SUCCESS_EXPERIENCE.md) for the success page, badge artwork, and public visibility controls.

## Verification

```bash
npm run verify:membership-ui
npm run verify:membership-domain
npm run verify:member-profile
npm run verify:workspace-ux
npm run verify:design-system
npm run typecheck
npm run build
npm run lint
npm run format:check
```

## Deferred

| Task     | Scope                             |
| -------- | --------------------------------- |
| TASK-092 | Stripe Membership Contribution    |
| TASK-093 | Membership Statistics Integration |

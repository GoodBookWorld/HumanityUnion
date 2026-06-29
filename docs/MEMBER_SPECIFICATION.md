# Humanity Union Member Specification

## Purpose

This document defines the Member entity, which represents a registered participant of Humanity Union. It specifies the Member data model, status and verification levels, participation metrics, activity planning, public profile behavior, privacy rules, and planned extensions. All profile, authentication integration, activity tracking, notification, and participation modules must align with this specification unless revised through a formal architectural decision.

## User vs Member

Humanity Union maintains a strict separation between system identity and civic identity:

**User** — technical system entity used for authentication, permissions, security, and data relations. The User holds credentials, session tokens, role assignments, security settings, and internal identifiers required by the platform to authorize and persist operations.

**Member** — public and civic identity of a registered participant inside Humanity Union. The Member represents how an individual appears and acts within WSAZ, CRZ, democratic instruments, publications, and institutional contexts. Each Member is linked to a User, but public-facing features operate on Member semantics rather than exposing User internals.

## Member Core Fields

| Field | Purpose | Public / Private |
| --- | --- | --- |
| memberId | Unique platform identifier for the Member record. | Private (internal reference; not displayed as primary label) |
| userId | Foreign key linking the Member to the associated User account. | Private |
| displayName | Human-readable name shown on profile, publications, and comments. | Public |
| uniqueName | Unique handle used for mentions, profile URLs, and search. | Public |
| avatar | Profile image or approved placeholder representing the Member visually. | Public |
| country | Member's declared or verified country affiliation for CRZ context. | Public (country may be shown; precise address is not stored here) |
| region | Member's declared or verified region within the country. | Public |
| city | Member's declared or verified city or local community context. | Public |
| languages | Languages the Member speaks or prefers for interface and content. | Public (preference list); interface defaults may also be Private in User settings |
| bio | Short self-description displayed on the public profile. | Public |
| publicLinks | Approved external links the Member chooses to display on their profile. | Public |
| memberStatus | Current civic and operational status level within the platform. | Public |
| verificationLevel | Degree of identity or affiliation verification achieved. | Public (level shown; verification evidence remains Private) |
| socialActivityScore | Computed participation metric reflecting constructive platform activity. | Public |
| activityPlan | Member Social Activity Plan defining scope, priorities, time commitment, and notification preferences. | Private |
| createdAt | Timestamp when the Member record was created. | Public (date may be shown in profile metadata) |
| updatedAt | Timestamp when the Member record was last modified. | Private |

## Member Status Levels

Member status indicates civic role and platform responsibilities. A Member may hold one primary status for display, with additional roles managed through authorization systems where required.

| Status | Description |
| --- | --- |
| Registered Member | Default status after successful registration; may participate within base platform rules. |
| Verified Member | Member who has completed required verification steps beyond basic registration. |
| Volunteer | Member approved for volunteer programs and related responsibilities. |
| Moderator | Member authorized to review content and enforce community rules within assigned scope. |
| Institution Member | Member acting as a representative or participant linked to a registered Institution. |
| Council Member | Member holding a seat or role within Humanity Council or its chambers. |
| Administrator | Member with elevated operational permissions for platform administration. |

Status levels are distinct from verification level. Both may affect eligibility for petitions, voting, and institutional actions.

## Verification Levels

Verification level indicates the depth of identity or affiliation assurance completed for a Member.

| Level | Description |
| --- | --- |
| Unverified | Registration complete; no additional verification performed. |
| Email Verified | Member has confirmed control of a registered email address. |
| Phone Verified | Member has confirmed control of a registered phone number. |
| Identity Verified | Member has completed identity verification according to platform policy. |
| Institution Verified | Member's affiliation with a registered Institution has been confirmed. |

Higher verification levels unlock additional rights and responsibilities as defined in governance and security specifications. Verification evidence and review metadata remain private.

## Social Activity Score

**Social Activity Score** is the main platform metric for Member participation. It quantifies constructive engagement over time and supports eligibility, visibility, and trust signals within platform rules. It is not a substitute for verification and does not alone grant governance authority.

Examples of score sources include:

- creating proposals
- creating petitions
- creating polls
- participating in voting
- commenting
- receiving constructive reactions
- verification
- volunteering
- institutional participation

Score calculation rules, weights, decay, and caps are defined in a dedicated activity and statistics specification. The score displayed on the public profile reflects the current computed value only.

## Member Social Activity Plan

The **Member Social Activity Plan** allows each Member to declare how they intend to participate so the platform can surface relevant activity and send responsibility-based notifications.

### Activity Scope

- Community
- City
- Region
- Country
- World

### Participation Priorities

- topics
- categories
- platform tools
- institutions
- geographic areas

### Time Commitment

- 10 minutes per day
- 30 minutes per day
- 1 hour per week
- custom

### Notification Logic

Members should receive responsibility-based notifications according to their selected activity scope, priorities, tools, and time availability. Notifications outside the declared plan are suppressed or deprioritized unless they relate to mandatory security, moderation, verification, or governance actions affecting the Member directly.

The activity plan is private configuration data. Its effects appear publicly only through participation behavior, not through exposure of the plan itself.

## Member Public Profile

The public profile page presents civic identity and participation summary. The following information may be shown according to Member settings, status, and platform policy:

- display name
- unique name
- avatar
- country / region / city
- verification level
- social activity score
- member status
- activity badges
- created publications
- public comments
- public statistics
- selected public links

The profile must not expose private fields such as `userId`, verification evidence, activity plan details, or non-public contact information.

## Member Privacy Rules

Private data must never be publicly exposed without explicit permission. Fields marked Private in the Member Core Fields table, verification evidence, security-related User data, and activity plan configuration remain accessible only to the Member and authorized system roles under audit controls.

Members control optional public elements such as bio, public links, and geographic context within policy limits. The platform defaults to minimal exposure until the Member opts in to additional public visibility. Aggregated statistics shown on profiles must comply with privacy and anonymization rules defined in the statistics specification.

## Future Extensions

The following capabilities are planned for subsequent specification and implementation volumes:

- badges
- achievements
- rank system
- activity calendar
- personalized civic recommendations
- volunteer commitments
- ACTUC participation status

These extensions build on the Member entity defined here and must remain consistent with Social Activity Score, verification level, and member status semantics.

This Member Specification defines the foundation for profile, authentication, activity tracking, notifications, and future participation modules.

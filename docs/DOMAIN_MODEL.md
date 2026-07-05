# Humanity Union Domain Model

## Purpose

This document defines the core domain entities of the Humanity Union platform. It establishes the conceptual model that governs how data, relationships, permissions, and business rules are represented across the database, API, backend services, and frontend applications. All implementation work must treat these entities and their distinctions as authoritative unless revised through a formal architectural decision.

## Core Terminology Decision

Humanity Union distinguishes between two closely related but separate concepts:

**User** — a technical system entity used for authentication, permissions, and data relations. A User record represents credentials, roles, session state, and internal references required by the platform to authorize actions and persist data. Not every technical User attribute is intended for public display.

**Member** — a registered participant of Humanity Union with public social activity, responsibilities, preferences, and participation history. A Member is the social and governance identity through which an individual engages in WSAZ and CRZ activity, democratic instruments, publications, and institutional interaction. In practice, a Member is linked to a User, but the domain treats Member as the primary actor in public and participatory contexts.

This separation keeps authentication and authorization concerns distinct from social presence, reputation, and participation semantics.

## Primary Member Metric

**Social Activity Score** — the official platform metric that measures a Member's level of participation and contribution through proposals, petitions, polls, voting, comments, reactions, verification, and other platform activities.

The Social Activity Score reflects constructive engagement over time. It informs eligibility, visibility, and trust signals within platform rules. It is not a substitute for identity verification and does not alone confer governance authority.

## Member Social Activity Plan

The **Member Social Activity Plan** is a future platform feature that allows each Member to define how they participate in Humanity Union according to personal capacity and interest.

Each plan may include:

- **Activity Scope** — Community, City, Region, Country, World.
- **Participation Priorities** — categories, topics, tools, and platform areas the Member wishes to emphasize.
- **Time Commitment** — for example, 10 minutes per day, 1 hour per week, or a custom schedule.
- **Responsibility-Based Notifications** — the Member receives notifications only according to their chosen scope, priorities, tools, and available activity time.

The Member Social Activity Plan aligns platform communication and surfacing of opportunities with the Member's declared intent, reducing noise and supporting sustainable participation.

## Initial Core Entities

| Entity                      | Purpose                                                                                                  | Notes                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| User                        | Represents authentication credentials, roles, permissions, and internal system identity.                 | Linked one-to-one or one-to-many with Member depending on account policy; not the public social identity. |
| Member                      | Represents a registered participant with public activity, preferences, responsibilities, and history.    | Primary actor in WSAZ, CRZ, and democratic participation contexts.                                        |
| Profile                     | Stores public and semi-public Member presentation data such as display name, bio, avatar, and badges.    | Distinct from User security fields; governed by privacy and verification rules.                           |
| Verification                | Records identity and affiliation checks, verification level, status, and supporting evidence references. | Required for certain petitions, votes, and institutional actions.                                         |
| Social Activity Score       | Stores the computed participation metric for a Member.                                                   | Derived from governed activity types; updated according to platform rules.                                |
| Member Social Activity Plan | Stores a Member's chosen scope, priorities, time commitment, and notification preferences.               | Future feature; drives responsibility-based notification logic.                                           |
| Notification                | Represents alerts, reminders, and system messages delivered to a Member or User.                         | Delivery filtered by plan, role, verification, and zone context where applicable.                         |
| Country                     | Represents a sovereign or recognized national unit within the CRZ hierarchy.                             | Parent context for regions and country-scoped democratic instruments.                                     |
| Region                      | Represents a sub-national geographic unit within a Country.                                              | Supports local CRZ activity and regional institutions.                                                    |
| Institution                 | Represents a registered organizational entity such as a government body, NGO, or academic unit.          | May hold representatives, verification, and scoped permissions.                                           |
| Proposal                    | Represents a structured initiative submitted for review, discussion, and possible adoption.              | Subject to lifecycle states and governance rules.                                                         |
| Petition                    | Represents a collective request supported by verified signatures.                                        | Linked to thresholds, eligibility, and zone scope.                                                        |
| Poll                        | Represents a non-binding opinion-gathering instrument with defined options and duration.                 | Distinct from formal Voting.                                                                              |
| Voting                      | Represents a formal binding decision process with eligibility, ballots, and outcomes.                    | Governed by verification level, role, and institutional scope.                                            |
| Candidate                   | Represents a person, option, or choice presented within a Poll or Voting process.                        | May reference a Member or external entity depending on process type.                                      |
| Publication                 | Represents primary content posted to WSAZ or a CRZ feed.                                                 | Supports comments, reactions, and links to democratic instruments.                                        |
| Comment                     | Represents a user-generated response attached to a Publication or eligible content item.                 | Subject to moderation and trust policies.                                                                 |
| Reaction                    | Represents a lightweight expressive response to a Publication or Comment.                                | Limited types; contributes to engagement signals where permitted.                                         |
| Statistics                  | Represents aggregated, policy-compliant metrics derived from platform activity and governance processes. | Must respect privacy, verification context, and publication rules.                                        |

This Domain Model is the foundation for the Humanity Union database, API, backend, and frontend architecture.

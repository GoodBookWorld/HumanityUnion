# Humanity Union Database Blueprint

## Version 1.0

### Logical Data Model for the Humanity Union Living Ecosystem

---

# Purpose

This document defines the logical database model of Humanity Union.

It does not yet define final MongoDB schemas or code.

Its purpose is to describe the core data entities, relationships, and responsibilities that will later guide:

* MongoDB collection design;
* REST API design;
* backend services;
* frontend state structure;
* analytics;
* security rules;
* future scalability.

The database must reflect Humanity Union as a living civic technology ecosystem, not as a simple website.

---

# Core Database Principle

The database must never be designed only around screens.

It must be designed around the living relationships between:

* Members;
* Initiatives;
* Knowledge;
* Communities;
* Institutions;
* Trust;
* Fair;
* Impact;
* Growth;
* Regions;
* Platform Services.

Every stored record should support understanding, participation, cooperation, trust, or meaningful impact.

---

# Primary Entity Groups

The Humanity Union database is organized into the following logical groups:

1. Identity & Members
2. Civic Participation
3. Initiatives
4. Knowledge
5. Communities & Regions
6. Institutions
7. Fair & Impact
8. Trust & Moderation
9. Notifications & Recommendations
10. Analytics & Observatory
11. Administration & System

---

# 1. Identity & Members

## User

Technical system entity used for authentication and access control.

Stores:

* email;
* password hash;
* authentication provider;
* account status;
* roles;
* security flags;
* createdAt;
* updatedAt.

Important rule:

User is technical.

Member is civic identity.

---

## Member

Public and civic identity of a registered participant.

Stores:

* userId;
* displayName;
* uniqueName;
* avatar;
* country;
* region;
* city;
* languages;
* bio;
* public links;
* member status;
* verification level;
* public statistics;
* createdAt;
* updatedAt.

---

## Impact Profile

User-facing name for the internal Civic Responsibility Profile.

Stores:

* responsibility scope;
* priority categories;
* priority tools;
* priority locations;
* time commitment;
* notification preferences;
* learning interests;
* volunteering interests;
* ACTUC interest;
* privacy settings.

Purpose:

To help the platform recommend meaningful actions without overwhelming the Member.

---

## Public Profile

Stores public-facing Member information.

Must never expose private data without explicit permission.

---

## Civic Dashboard Data

Private personalized space for the Member.

Stores or derives:

* active initiatives;
* recommended actions;
* Fair summary;
* impact summary;
* growth insights;
* notifications;
* next horizon suggestions.

---

# 2. Civic Participation

## Activity Record

Stores every meaningful platform action.

Examples:

* comment;
* vote;
* petition signature;
* proposal support;
* poll participation;
* volunteer action;
* knowledge completion;
* source contribution;
* moderation action.

Used by:

* Fair Service;
* Impact Service;
* Reflection Service;
* Analytics Service.

---

## Comment

Stores Member discussion contributions.

Fields:

* memberId;
* targetType;
* targetId;
* text;
* status;
* parentCommentId;
* reactions;
* moderation status;
* createdAt;
* updatedAt.

---

## Reaction

Stores lightweight Member responses.

Examples:

* support;
* insightful;
* constructive;
* needs evidence;
* agree;
* disagree respectfully.

Rule:

Reactions must support meaningful participation, not popularity addiction.

---

# 3. Initiatives

## Initiative

Central action entity of Humanity Union.

All Proposals, Petitions, Polls, Voting processes, Volunteer Campaigns, ACTUC projects, Educational Projects, and Community Projects are initiative types.

Stores:

* title;
* summary;
* problem;
* why it matters;
* evidence;
* proposed solution;
* initiative type;
* creatorId;
* team;
* status;
* scope;
* region;
* country;
* categories;
* tags;
* timeline;
* discussion settings;
* implementation status;
* impact status;
* createdAt;
* updatedAt.

---

## Initiative Type

Defines initiative formats.

Examples:

* Proposal;
* Petition;
* Poll;
* Voting;
* Volunteer Campaign;
* ACTUC Research;
* Educational Project;
* Community Project;
* Emergency Response.

---

## Initiative Team

Stores collaboration structure.

Includes:

* initiator;
* co-authors;
* experts;
* editors;
* volunteers;
* moderators;
* institutional contacts.

---

## Initiative Timeline Event

Stores the history of an initiative.

Examples:

* created;
* published;
* revised;
* reviewed;
* supported;
* voted;
* implemented;
* completed;
* archived;
* impact confirmed.

Purpose:

Transparency and trust.

---

## Initiative Version

Stores major revisions of proposals or initiative content.

Purpose:

To preserve history and prevent hidden manipulation.

---

# 4. Knowledge

## Knowledge Item

Stores educational and informational content.

Types:

* article;
* analysis;
* research note;
* learning material;
* ACTUC material;
* verified source explanation;
* media purity note.

Fields:

* title;
* summary;
* body;
* authorId;
* source references;
* reliability status;
* categories;
* tags;
* language;
* status;
* createdAt;
* updatedAt.

---

## Source

Stores external or internal information sources.

Fields:

* source name;
* URL;
* type;
* reliability status;
* verification notes;
* related knowledge items;
* createdAt;
* updatedAt.

---

## Learning Path

Stores structured learning sequences.

Purpose:

To guide Members from knowledge to understanding.

---

# 5. Communities & Regions

## Region Entity

Represents geographic structure.

Types:

* world;
* country;
* region;
* city;
* community.

Stores:

* name;
* type;
* parentRegionId;
* geographic metadata;
* language settings;
* local statistics;
* activity summary.

---

## Community

Represents civic communities within geographic or thematic areas.

Stores:

* name;
* description;
* scope;
* members;
* initiatives;
* local statistics;
* moderators;
* createdAt;
* updatedAt.

---

# 6. Institutions

## Institution

Stores Humanity Union institutional structures.

Examples:

* Humanity Council;
* Chamber of State Representatives;
* Chamber of Intellectual Analysis & General Staff;
* Humanity Protection;
* World Protection Corps;
* Secretariat;
* Department of Intellectual Analysis;
* Department of State Collaboration.

Fields:

* name;
* type;
* purpose;
* functions;
* members;
* decisions;
* reports;
* status;
* createdAt;
* updatedAt.

---

## Institutional Decision

Stores decisions, resolutions, recommendations, and reports.

Purpose:

Transparency and governance history.

---

# 7. Fair & Impact

## Fair Ledger

Stores all Fair-generating events.

Fields:

* memberId;
* sourceType;
* sourceId;
* actionType;
* fairAmount;
* calculationReason;
* timestamp;
* visibility;
* audit metadata.

Rule:

Fair is a measure of civic activity, not human worth.

---

## Fair Summary

Aggregated Fair data.

Types:

* Member Fair;
* Initiative Fair;
* Community Fair;
* Regional Fair;
* Country Fair;
* World Fair.

---

## Impact Record

Stores meaningful outcomes.

Examples:

* initiative implemented;
* community improved;
* knowledge shared;
* policy influenced;
* volunteers mobilized;
* environmental result;
* educational result.

Impact should be evidence-based whenever possible.

---

## Reflection Summary

Stores personal growth insights.

Examples:

* weekly reflection;
* monthly reflection;
* participation pattern;
* learning progress;
* next horizon suggestion.

---

# 8. Trust & Moderation

## Verification Record

Stores Member and source verification data.

Types:

* email verification;
* identity verification;
* institution verification;
* source verification.

---

## Moderation Case

Stores reports, review decisions, appeals, and outcomes.

Purpose:

Safety, fairness, and transparency.

---

## Audit Log

Stores sensitive administrative and system actions.

Purpose:

Accountability and security.

---

# 9. Notifications & Recommendations

## Notification

Stores calm, useful communication.

Types:

* information;
* recommendation;
* guidance;
* reminder;
* system alert.

Rule:

Notifications should respect Member attention.

---

## Recommendation Record

Stores why something was recommended.

Fields:

* memberId;
* recommendationType;
* targetType;
* targetId;
* reason;
* related Impact Profile data;
* estimated time;
* createdAt;
* status.

Purpose:

Explainable recommendations.

---

## Opportunity

Stores meaningful contribution opportunities.

Examples:

* local initiative;
* discussion needing expertise;
* volunteering;
* learning path;
* poll;
* voting;
* ACTUC contribution.

---

# 10. Analytics & Observatory

## Humanity Health Indicator

Stores high-level platform health metrics.

Categories:

* Initiative Health;
* Participation Health;
* Community Health;
* Knowledge Health;
* Trust Health;
* Impact Health.

---

## Humanity Observatory Snapshot

Stores periodic platform summaries.

Examples:

* daily;
* weekly;
* monthly;
* yearly.

Purpose:

To track long-term development of Humanity Union.

---

# 11. Administration & System

## Admin User

Technical administrative access.

Must be separated from public Member identity.

---

## System Setting

Stores platform configuration.

---

## Localization Entry

Stores translation and regional interface content.

---

## Security Event

Stores security-related system activity.

---

# Core Relationships

User → Member

Member → Impact Profile

Member → Public Profile

Member → Activity Records

Member → Initiatives

Initiative → Initiative Type

Initiative → Initiative Team

Initiative → Timeline Events

Initiative → Comments

Initiative → Fair Ledger

Initiative → Impact Records

Knowledge → Sources

Knowledge → Initiatives

Community → Members

Community → Initiatives

Region → Communities

Institution → Decisions

Fair Ledger → Member / Initiative / Community / Region

Impact Record → Initiative / Community / Institution / Region

Recommendation → Member / Opportunity

Notification → Member

---

# Database Design Rules

1. Separate technical identity from civic identity.
2. Store public and private data separately where appropriate.
3. Preserve initiative history.
4. Make recommendations explainable.
5. Store Fair as a ledger, not only as a number.
6. Store Impact as evidence-based records whenever possible.
7. Make moderation auditable.
8. Support regional scaling from the beginning.
9. Avoid popularity-driven data structures.
10. Design for long-term growth.

---

# MongoDB Direction

The final MongoDB implementation should use collections based on logical domain boundaries.

Likely initial collections:

* users
* members
* impact_profiles
* initiatives
* initiative_types
* initiative_timeline_events
* initiative_versions
* comments
* reactions
* activity_records
* knowledge_items
* sources
* learning_paths
* regions
* communities
* institutions
* institutional_decisions
* fair_ledger
* fair_summaries
* impact_records
* reflection_summaries
* verification_records
* moderation_cases
* audit_logs
* notifications
* recommendation_records
* opportunities
* humanity_health_indicators
* observatory_snapshots
* system_settings
* localization_entries
* security_events

This list may be refined during technical schema design.

---

# Final Principle

The Humanity Union database is not merely a storage system.

It is the memory of the living civic ecosystem.

It must preserve participation, trust, knowledge, cooperation, impact, and growth in a way that allows Humanity Union to evolve without losing its human-centered purpose.

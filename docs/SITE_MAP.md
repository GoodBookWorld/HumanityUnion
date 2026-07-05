# Humanity Union Site Map

This document defines the complete navigation structure of the Humanity Union platform. It maps public, authenticated, administrative, and regional routes, along with modal overlays and global components that appear across the application. All interface work must align with this structure unless explicitly revised in a future specification volume.

## Public Pages

Pages accessible without authentication. Some actions on these pages may redirect unauthenticated users to login or registration modals.

| Page         | URL             | Purpose                                                                                                                                            |
| ------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home         | `/`             | Landing page introducing Humanity Union, featured activity from WSAZ, and primary entry points into proposals, petitions, polls, and institutions. |
| Institutions | `/institutions` | Directory and discovery of registered institutions with filtering by type, region, and verification status.                                        |
| Proposals    | `/proposals`    | Public listing of active and archived proposals in the World Social Activity Zone with search and sort options.                                    |
| Petitions    | `/petitions`    | Public listing of open and closed petitions, including signature progress and eligibility requirements.                                            |
| Polls        | `/polls`        | Public listing of active and completed polls for non-binding opinion gathering across the platform.                                                |
| Voting       | `/voting`       | Public listing of formal voting processes, schedules, eligibility rules, and outcomes where published.                                             |
| About        | `/about`        | Platform mission, governance overview, Humanity Council structure, and foundational principles.                                                    |
| Media        | `/media`        | Official announcements, press resources, downloadable assets, and public communications from Humanity Union.                                       |
| Volunteering | `/volunteering` | Information and entry points for volunteer participation, roles, and contribution pathways.                                                        |
| Blog         | `/blog`         | Editorial publications, updates, and long-form articles from the platform and partner institutions.                                                |
| Contact      | `/contact`      | Contact channels, support requests, and institutional inquiry forms.                                                                               |
| Login        | `/login`        | Dedicated authentication page; mirrors login modal functionality for direct access and deep linking.                                               |
| Registration | `/register`     | Dedicated account registration page; mirrors registration modal functionality for direct access and deep linking.                                  |

## Authenticated Pages

Pages available to signed-in users. Access may further depend on verification level, role, and zone membership.

| Page               | URL                   | Purpose                                                                                                          |
| ------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Profile            | `/profile`            | View and manage the user's public identity, avatar, bio, verification badges, and Social Activity Score summary. |
| Settings           | `/settings`           | Account preferences, privacy controls, notification defaults, language, and theme options.                       |
| Notifications      | `/notifications`      | Inbox of system, moderation, governance, and social activity alerts with read and action states.                 |
| My Publications    | `/publications/mine`  | List of publications authored by the user across WSAZ and CRZ contexts with edit and status controls.            |
| Saved Publications | `/publications/saved` | Bookmarked or saved publications for later reading and reference.                                                |
| Activity History   | `/activity`           | Chronological record of the user's proposals, petitions, votes, comments, reactions, and other platform actions. |
| Verification       | `/verification`       | Identity and affiliation verification workflow, status tracking, and submission of required evidence.            |

## Administrative Pages

Pages restricted to moderators and administrators. Permissions vary by role scope (WSAZ, CRZ, institution, or system-wide).

| Page                   | URL                   | Purpose                                                                                                          |
| ---------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Dashboard              | `/admin`              | Overview of platform health, pending moderation queues, recent governance activity, and key operational metrics. |
| User Management        | `/admin/users`        | Search, review, suspend, restore, and assign roles to user accounts with audit visibility.                       |
| Publication Moderation | `/admin/publications` | Review flagged and pending publications, apply moderation actions, and manage ACTUC-assisted review queues.      |
| Institution Management | `/admin/institutions` | Register, verify, update, and deactivate institutional accounts and their representative assignments.            |
| Statistics             | `/admin/statistics`   | Operational and participation analytics for administrators, subject to privacy and policy constraints.           |
| System Settings        | `/admin/settings`     | Platform configuration, feature flags, maintenance controls, and global policy parameters.                       |

## Country & Region Zone

Regionally scoped pages within a Country & Region Zone (CRZ). URLs use `{country}` and optional `{region}` path segments representing the active zone context.

| Page                 | URL                           | Purpose                                                                                                            |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Country Home         | `/crz/{country}`              | CRZ landing page for a country, showing regional activity, featured institutions, and local governance highlights. |
| Region Home          | `/crz/{country}/{region}`     | CRZ landing page for a sub-region within a country, focused on local publications and democratic instruments.      |
| Country Proposals    | `/crz/{country}/proposals`    | Proposals scoped to the selected country or its regions.                                                           |
| Country Petitions    | `/crz/{country}/petitions`    | Petitions scoped to the selected country or its regions.                                                           |
| Country Polls        | `/crz/{country}/polls`        | Polls scoped to the selected country or its regions.                                                               |
| Country Voting       | `/crz/{country}/voting`       | Formal voting processes scoped to the selected country or its regions.                                             |
| Country Institutions | `/crz/{country}/institutions` | Institutions registered or active within the selected country or its regions.                                      |

## Modal Windows

Overlays triggered from global navigation, page actions, or deep links. Modals preserve underlying route context where possible.

| Modal           | Trigger context                              | Purpose                                                                                           |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Login           | Header, protected actions, `/login` fallback | Authenticate an existing user without leaving the current page when invoked inline.               |
| Registration    | Header, login modal, `/register` fallback    | Create a new user account with progressive validation and terms acceptance.                       |
| Create Proposal | Proposals pages, user action menus           | Compose and submit a new proposal with required metadata, zone selection, and attachments.        |
| Create Petition | Petitions pages, user action menus           | Compose and launch a new petition with threshold and eligibility configuration.                   |
| Create Poll     | Polls pages, user action menus               | Define a new poll question, options, duration, and visibility scope.                              |
| Create Voting   | Voting pages, authorized roles               | Initiate a formal voting process according to governance permissions and validation rules.        |
| Edit Profile    | Profile page, profile widget actions         | Update display name, bio, avatar, and other editable profile fields.                              |
| Search          | Header search bar, keyboard shortcut         | Global search across publications, institutions, proposals, petitions, polls, and users.          |
| Filters         | List and directory pages                     | Apply structured filters to current listings without full page navigation.                        |
| Image Viewer    | Publications, media, profile avatars         | Full-screen or focused viewing of images with accessible navigation and download where permitted. |

## Global Components

Persistent or frequently reused interface elements present across multiple routes. Behavior and appearance must follow the Design System.

| Component          | Scope                         | Purpose                                                                                                          |
| ------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Header             | Global                        | Primary branding, main navigation, search entry, authentication controls, language selector, and theme switcher. |
| Footer             | Global                        | Legal links, contact shortcuts, documentation references, and secondary institutional navigation.                |
| Navigation         | Global                        | Primary and contextual menus linking to public, authenticated, CRZ, and admin destinations per user permissions. |
| Breadcrumbs        | Page-level                    | Hierarchical location indicator for nested routes, especially CRZ and admin sections.                            |
| Search Bar         | Header, search modal          | Quick access to platform-wide search with scope hints and recent queries where enabled.                          |
| Statistics Widgets | Home, dashboards, CRZ landing | Compact metric displays for participation, trends, and institutional activity summaries.                         |
| Publication Cards  | Feeds, listings, saved items  | Standardized presentation of publication content in WSAZ and CRZ contexts.                                       |
| Pagination         | Listings and directories      | Navigate large result sets for proposals, petitions, polls, institutions, and publications.                      |
| Language Selector  | Header, settings              | Switch interface language while preserving route and user preferences.                                           |
| Theme Switcher     | Header, settings              | Toggle light and dark presentation modes consistent with accessibility requirements.                             |

This document defines the navigation architecture of the Humanity Union platform.

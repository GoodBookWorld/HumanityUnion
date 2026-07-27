# Member Profile Foundation (TASK-053)

The Member Profile is Humanity Union's civic participant identity layer. Authentication identifies the person; the Member Profile represents that participant inside the platform.

## Architecture

```
Authentication User (Mongo auth_users)
        │ 1:1 userId
        ▼
Member Profile (Mongo member_profiles)
        │
        └── Civic actions continue to use RequestIdentity.participantId
```

- Auth stores credentials, sessions, and email.
- Member Profile stores civic identity, location, participation references, preferences, and privacy controls.
- Capability 02 modules are unchanged and still resolve `RequestIdentity` separately.

## Public / private model

| Surface             | Data                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| Authenticated owner | Full `MemberProfile` via `/api/v1/member-profile/me`                  |
| Privacy settings    | `/api/v1/member-profile/me/privacy`                                   |
| Public viewer       | `PublicMemberProfile` via `/api/v1/public/member-profiles/:profileId` |

Public projections never expose:

- email
- passwordHash
- JWT / sessions / refresh tokens
- internal auth userId
- auth provider metadata

## Privacy

Visibility levels:

- `public` — visible to everyone when field-level privacy allows
- `members_only` — visible only to authenticated members
- `private` — visible only to the profile owner

Field-level controls:

- `showOrganization`
- `showLocation`
- `showParticipationArea`
- `participationVisibility`

## Mongo collection

Collection: `member_profiles`

Indexes:

- `userId` (unique)
- `publicName` (unique)
- `country`
- `region`
- `community`
- `participationAreaId`
- `profileVisibility`
- `updatedAt`

Profiles auto-create on registration.

## API routes

Authenticated:

- `GET /api/v1/member-profile/me`
- `PATCH /api/v1/member-profile/me`
- `GET /api/v1/member-profile/me/privacy`
- `PATCH /api/v1/member-profile/me/privacy`
- `GET /api/v1/member-profile/me/workspace-identity`

Public:

- `GET /api/v1/public/member-profiles/:profileId`

No public list endpoint.

## Workspace integration

The workspace sidebar resolves Member Profile identity instead of temporary bootstrap display:

- Avatar (default: `/brand/humanity-default-avatar.svg`)
- Display name
- Participation area reference
- Country / region / community

Dedicated workspace page: `/member`

Sections:

- Profile
- Privacy
- Participation Area
- Preferences

## Avatar

Current foundation stores avatar URLs only.

Supported URL extensions:

- `.png`
- `.jpg` / `.jpeg`
- `.webp`

Binary upload/storage is deferred. URL length is validated as an interim guard.

## Verification

```bash
npm run verify:member-profile
```

Requires `MONGODB_URI`. Runs three consecutive passes covering registration auto-create, updates, privacy, public projection safety, visibility rules, workspace identity, avatar validation, and Capability 02 compatibility.

## Deferred work

- Avatar binary upload/storage
- Profile statistics or civic activity summaries
- Followers, messaging, reputation, ranking, or social feed features
- Fair points or gamification
- Public profile discovery/list endpoints

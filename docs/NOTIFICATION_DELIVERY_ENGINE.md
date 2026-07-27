# Notification Delivery Engine

TASK-058 introduces Humanity Union's first private notification delivery engine. Notifications help authenticated members notice relevant civic activity and responsibilities. They are not a social feed, engagement system, or email/push channel.

## Principles

1. Notifications serve responsibility, not addiction.
2. No likes, reactions, follows, or popularity alerts.
3. Notifications are private to the participant.
4. Notifications must be explainable from civic records.
5. Public records remain public; notification routing is private.
6. No email, push, SMS, websocket, or AI ranking in Version 1.

## Domain Model

`MemberNotification` fields:

- `notificationId`
- `recipientProfileId` (private persistence only)
- `recipientUserId` (private persistence only)
- `eventType`
- `title`
- `message`
- `relatedEntityType`
- `relatedEntityId`
- `relatedUrl`
- `priority` — `critical`, `important`, `normal`, `informational`
- `status` — `unread`, `read`, `archived`
- `createdAt`
- `readAt` optional
- `archivedAt` optional

API responses expose `MemberNotificationView`, which omits recipient identifiers.

## Notification Lifecycle

1. A civic workflow emits a registry event through `emitCivicNotificationEvent()`.
2. The engine resolves deterministic recipients for that event.
3. A template supplies title, message, and priority.
4. Notifications are stored in `member_notifications`.
5. Members list, read, archive, and count unread notifications through authenticated API routes.
6. The web notification center at `/notifications` displays private civic notifications only.

## Event Registry Mapping

Events come from `CIVIC_NOTIFICATION_EVENT_REGISTRY` in Capability02 integration types.

| Event                              | Typical recipient           | Message intent                       |
| ---------------------------------- | --------------------------- | ------------------------------------ |
| `initiative_published`             | initiative steward          | Your initiative was published        |
| `analysis_published`               | initiative steward          | Collaborative analysis published     |
| `proposal_submitted`               | initiative steward          | New improvement proposal submitted   |
| `proposal_decided`                 | proposal author             | Proposal reviewed                    |
| `revision_published`               | initiative steward          | Initiative revision published        |
| `decision_opened`                  | decision steward            | Collective decision is open          |
| `decision_closed`                  | steward / decision steward  | Collective decision result available |
| `civic_action_package_issued`      | initiative steward          | Civic Action Package ready           |
| `official_response_received`       | steward / CAP sender        | Official response recorded           |
| `official_response_verified`       | steward / CAP sender        | Official response verified           |
| `civic_accountability_event_added` | related participants        | Accountability timeline updated      |
| `civic_accountability_closed`      | related participants        | Accountability timeline closed       |
| `commitment_published`             | commitment author / steward | Implementation commitment published  |
| `tracking_updated`                 | tracking author / steward   | Implementation tracking updated      |
| `impact_verified`                  | impact author               | Public impact verified               |
| `archive_published`                | archive author / steward    | Archive record published             |

## Recipient Rules (Version 1)

Recipient resolution is deterministic and narrow:

- initiative steward
- analysis author (via steward notification for published analysis)
- proposal author
- decision steward
- CAP sender / official response recorder
- commitment author
- tracking author
- public impact author
- archive author

The engine does not fan out to all platform users.

For `decision_opened`, Version 1 notifies the decision steward only. Broad eligible-participant fanout is deferred until eligibility resolution is cheap and safe at notification time.

## API Routes

Authenticated only:

- `GET /api/v1/notifications/mine`
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/read-all`
- `POST /api/v1/notifications/:notificationId/read`
- `POST /api/v1/notifications/:notificationId/archive`

No public notification routes exist.

## Persistence

Primary store: MongoDB collection `member_notifications`.

Indexes:

- `recipientUserId`
- `recipientProfileId`
- `status`
- `priority`
- `createdAt`
- `relatedEntityType + relatedEntityId`

Tests and local verification use memory persistence via `NOTIFICATION_PERSISTENCE=memory`.

## Privacy

Never expose in notification API responses:

- `recipientUserId`
- `recipientProfileId`
- email, password hashes, refresh tokens
- other participants' private auth data

Sanitization checks reject forbidden private keys and gamification language in responses.

## Web Integration

- `/notifications` — private notification center
- Header notification link with unread badge for authenticated members
- Workspace Home notifications card with unread count
- Workspace intelligence context includes unread notification count for assistant context only (no AI suggestions from notifications yet)

## Future Work

Deferred intentionally:

- email delivery
- push notifications
- SMS
- websocket / real-time streaming
- eligible-participant fanout for open decisions
- AI prioritization or recommendation
- social follows, likes, reactions, popularity alerts

## Verification

Run:

```bash
npm run verify:notifications
```

The script runs three consecutive passes covering module structure, hooks, privacy, runtime behavior, and web integration.

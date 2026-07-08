# MongoDB Foundation (TASK-050)

Humanity Union supports three persistence modes per Capability 02 module:

- `memory` — in-process only (verification and ephemeral runs)
- `file` — local JSON under `apps/api/.runtime/` (**development only**)
- `mongodb` — production-ready persistence via the official MongoDB Node.js driver

MongoDB adapts to the existing snapshot-based persistence architecture. Domain models, services, and civic workflows are unchanged.

## Environment variables

| Variable                              | Required                       | Default          | Description               |
| ------------------------------------- | ------------------------------ | ---------------- | ------------------------- |
| `MONGODB_URI`                         | When any module uses `mongodb` | _(unset)_        | MongoDB connection string |
| `MONGODB_DATABASE`                    | No                             | `humanity_union` | Database name             |
| `MONGODB_CONNECT_TIMEOUT_MS`          | No                             | `10000`          | Client connect timeout    |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | No                             | `10000`          | Server selection timeout  |
| `MONGODB_MAX_POOL_SIZE`               | No                             | `10`             | Connection pool size      |

If `MONGODB_URI` is not set, the API starts normally unless a module explicitly selects `mongodb` persistence.

## Module persistence selection

Each module resolves its adapter from an environment variable (default `file`):

| Module                      | Environment variable                               |
| --------------------------- | -------------------------------------------------- |
| Initiatives                 | `INITIATIVE_PERSISTENCE`                           |
| Collaborative analyses      | `INITIATIVE_ANALYSIS_PERSISTENCE`                  |
| Improvement proposals       | `INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE`      |
| Version revisions           | `INITIATIVE_VERSION_REVISION_PERSISTENCE`          |
| Decision sessions           | `DECISION_SESSION_PERSISTENCE`                     |
| Collective decisions        | `INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE`       |
| Decision votes              | `INITIATIVE_DECISION_VOTE_PERSISTENCE`             |
| Participation areas         | `PARTICIPATION_AREA_PERSISTENCE`                   |
| Civic action packages       | `CIVIC_ACTION_PACKAGE_PERSISTENCE`                 |
| Civic delivery              | `CIVIC_DELIVERY_PERSISTENCE`                       |
| Official responses          | `OFFICIAL_RESPONSE_PERSISTENCE`                    |
| Civic accountability        | `CIVIC_ACCOUNTABILITY_PERSISTENCE`                 |
| Implementation commitments  | `INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE` |
| Implementation tracking     | `INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE`   |
| Public impact               | `INITIATIVE_PUBLIC_IMPACT_PERSISTENCE`             |
| Public civic archive        | `PUBLIC_CIVIC_ARCHIVE_PERSISTENCE`                 |
| Civic compatibility reviews | `CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE`           |

Example (full Capability 02 pipeline on MongoDB):

```bash
export MONGODB_URI="mongodb://127.0.0.1:27017"
export MONGODB_DATABASE="humanity_union_dev"
export INITIATIVE_PERSISTENCE=mongodb
export INITIATIVE_ANALYSIS_PERSISTENCE=mongodb
export INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE=mongodb
export INITIATIVE_VERSION_REVISION_PERSISTENCE=mongodb
export DECISION_SESSION_PERSISTENCE=mongodb
export INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE=mongodb
export INITIATIVE_DECISION_VOTE_PERSISTENCE=mongodb
export PARTICIPATION_AREA_PERSISTENCE=mongodb
export CIVIC_ACTION_PACKAGE_PERSISTENCE=mongodb
export CIVIC_DELIVERY_PERSISTENCE=mongodb
export OFFICIAL_RESPONSE_PERSISTENCE=mongodb
export CIVIC_ACCOUNTABILITY_PERSISTENCE=mongodb
export INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE=mongodb
export INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE=mongodb
export INITIATIVE_PUBLIC_IMPACT_PERSISTENCE=mongodb
export PUBLIC_CIVIC_ARCHIVE_PERSISTENCE=mongodb
export CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE=mongodb
```

Example (priority modules only):

```bash
export MONGODB_URI="mongodb://127.0.0.1:27017"
export MONGODB_DATABASE="humanity_union_dev"
export INITIATIVE_PERSISTENCE=mongodb
export INITIATIVE_ANALYSIS_PERSISTENCE=mongodb
export INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE=mongodb
export INITIATIVE_VERSION_REVISION_PERSISTENCE=mongodb
export DECISION_SESSION_PERSISTENCE=mongodb
export INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE=mongodb
export INITIATIVE_DECISION_VOTE_PERSISTENCE=mongodb
export PARTICIPATION_AREA_PERSISTENCE=mongodb
```

## Local development

1. Run MongoDB locally (Docker example):

   ```bash
   docker run --name hu-mongo -p 27017:27017 -d mongo:7
   ```

2. Set `MONGODB_URI=mongodb://127.0.0.1:27017` and module persistence vars as above.

3. Start the API — `bootstrapMongoPersistence()` connects, ensures indexes, and hydrates Mongo-backed module caches before stores load.

4. Run verification:

   ```bash
   npm run verify:mongodb
   ```

   Skips gracefully when `MONGODB_URI` is unset.

## MongoDB Atlas

1. Create a cluster and database user with read/write access to the target database.
2. Allow your deployment IP (or `0.0.0.0/0` for early staging only).
3. Copy the SRV connection string into `MONGODB_URI`.
4. Set `MONGODB_DATABASE` to your application database name.

## Health check

`GET /api/v1/health` includes a `mongodb` object from `checkMongoConnection()`:

- `connected`
- `database`
- `latencyMs`
- `error` (when unavailable)

## Safety

- **File persistence is for local development only.** Do not use `.runtime` JSON files in production.
- **No automatic migration** from `.runtime` files is included in TASK-050. Migration is deferred to a follow-up task.

## Deferred work

- MongoDB data migration from existing `.runtime` JSON files
- Production deployment wiring (Hetzner/Docker)
- Workspace assistant response persistence (no durable store in current architecture)

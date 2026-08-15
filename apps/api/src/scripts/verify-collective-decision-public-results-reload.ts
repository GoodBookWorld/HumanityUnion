import { getPublicInitiativeCollectiveDecision } from "../modules/initiative-collective-decision/public-initiative-collective-decision.projection.js";

const decisionId = process.argv[2];
const expectedSupport = process.argv[3];
const expectedOutcome = process.argv[4];

if (!decisionId || !expectedSupport || !expectedOutcome) {
  process.exit(1);
}

const projection = await getPublicInitiativeCollectiveDecision(decisionId);

const matches =
  projection !== null &&
  projection.statistics.supportCount === Number.parseInt(expectedSupport, 10) &&
  projection.outcome?.outcome === expectedOutcome;

// Recovery Task 14: `getPublicInitiativeCollectiveDecision` resolves the
// steward's display name via a Mongo-backed Member lookup, which opens a
// MongoDB client connection. This script previously relied on falling off
// the end of the module to terminate; the open connection then kept the
// event loop alive and the process never exited on its own, hanging the
// parent's `spawnSync` call indefinitely.
//
// A graceful `disconnectMongoClient()` call (via the shared
// `runVerificationScript` helper used elsewhere) was tried here first, but
// it reproducibly triggered a `MongoExpiredSessionError` thrown from the
// driver's background session/heartbeat machinery racing the client close
// in this extremely short-lived, single-query process — a genuine MongoDB
// driver behavior, not a defect in this script or in production Mongo
// lifecycle code (confirmed by bisecting: the same query succeeds cleanly
// without a subsequent `disconnectMongoClient()` call). Since this script
// is an explicit one-shot CLI whose only job is this single check, and every
// assertion has already completed by this point, an explicit `process.exit`
// is the safe, minimal fix: it terminates immediately regardless of any
// open driver-internal handle, without truncating this script's
// already-produced (and already-flushed, since assertions never wrote
// deferred output) result.
process.exit(matches ? 0 : 1);

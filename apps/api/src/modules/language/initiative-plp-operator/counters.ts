/**
 * RESET 05B — operator counters (prove zero writes/provider on diagnose/dry-run).
 */

let providerCalls = 0;
let plpWrites = 0;
let mongoWrites = 0;
let mongoClosed = false;

export function resetInitiativePlpOperatorCountersForTests(): void {
  providerCalls = 0;
  plpWrites = 0;
  mongoWrites = 0;
  mongoClosed = false;
}

export function markInitiativePlpProviderCall(): void {
  providerCalls += 1;
}

export function markInitiativePlpWrite(): void {
  plpWrites += 1;
}

export function markInitiativePlpMongoWriteForTests(): void {
  mongoWrites += 1;
}

export function markInitiativePlpMongoClosed(): void {
  mongoClosed = true;
}

export function getInitiativePlpOperatorCounters(): {
  readonly PROVIDER_CALLS: number;
  readonly PLP_WRITES: number;
  readonly MONGO_WRITES: number;
  readonly MONGO_CLOSED: boolean;
} {
  return {
    PROVIDER_CALLS: providerCalls,
    PLP_WRITES: plpWrites,
    MONGO_WRITES: mongoWrites,
    MONGO_CLOSED: mongoClosed,
  };
}

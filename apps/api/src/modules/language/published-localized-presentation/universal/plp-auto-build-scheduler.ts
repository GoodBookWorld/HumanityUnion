/**
 * LOAD.03 — one PLP due timer plus one 60s due-only safety sweep.
 * No fixed 3s drain interval and no timer per work row.
 */

export const PLP_SAFETY_SWEEP_MS = 60_000;

type SchedulerHandlers = {
  readonly onDue: () => void;
  readonly onSafety: () => void;
};

let handlers: SchedulerHandlers = {
  onDue: () => {},
  onSafety: () => {},
};

let dueTimer: NodeJS.Timeout | null = null;
let dueTimerAtMs: number | null = null;
let dueFire: (() => void) | null = null;
let safetyTimer: NodeJS.Timeout | null = null;
let safetyArmed = false;
let manualTimers = false;
let nowOverrideMs: number | null = null;

export function setPlpSchedulerHandlers(next: SchedulerHandlers): void {
  handlers = next;
}

export function plpSchedulerNowMs(): number {
  return nowOverrideMs ?? Date.now();
}

export function setPlpSchedulerNowMsForTests(ms: number | null): void {
  nowOverrideMs = ms;
}

export function usePlpSchedulerManualTimersForTests(enabled: boolean): void {
  manualTimers = enabled;
}

function clearDueTimerOnly(): void {
  if (dueTimer) {
    clearTimeout(dueTimer);
    dueTimer = null;
  }
  dueTimerAtMs = null;
  dueFire = null;
}

/** Replace the single due timer. Later recomputes may move it; there is still one. */
export function armPlpDueTimer(dueAtMs: number): void {
  if (!Number.isFinite(dueAtMs)) {
    return;
  }
  clearDueTimerOnly();
  dueTimerAtMs = dueAtMs;
  const fire = () => {
    if (dueTimerAtMs !== dueAtMs) {
      return;
    }
    clearDueTimerOnly();
    handlers.onDue();
  };
  dueFire = fire;
  if (manualTimers) {
    return;
  }
  const delay = Math.max(0, dueAtMs - plpSchedulerNowMs());
  dueTimer = setTimeout(fire, delay);
  dueTimer.unref?.();
}

export function clearPlpDueTimer(): void {
  clearDueTimerOnly();
}

export function plpDueTimerAtMsForTests(): number | null {
  return dueTimerAtMs;
}

export function plpDueTimerCountForTests(): number {
  return dueTimerAtMs == null ? 0 : 1;
}

export function firePlpDueTimerForTests(): void {
  const fire = dueFire;
  if (!fire) {
    return;
  }
  fire();
}

export function startPlpSafetySweep(): void {
  if (safetyArmed) {
    return;
  }
  safetyArmed = true;
  if (manualTimers) {
    return;
  }
  safetyTimer = setInterval(() => {
    handlers.onSafety();
  }, PLP_SAFETY_SWEEP_MS);
  safetyTimer.unref?.();
}

export function plpSafetySweepArmedForTests(): boolean {
  return safetyArmed;
}

export function firePlpSafetySweepForTests(): void {
  handlers.onSafety();
}

export function stopPlpAutoBuildScheduler(): void {
  clearDueTimerOnly();
  if (safetyTimer) {
    clearInterval(safetyTimer);
    safetyTimer = null;
  }
  safetyArmed = false;
}

export function resetPlpAutoBuildSchedulerForTests(): void {
  stopPlpAutoBuildScheduler();
  manualTimers = false;
  nowOverrideMs = null;
  handlers = { onDue: () => {}, onSafety: () => {} };
}

let tail: Promise<void> = Promise.resolve();

/**
 * Serializes in-process reply acceptance with link disable.
 * A reply cannot read a linked snapshot and insert after a disconnect that
 * already passed this section. Cross-process callers still need the Mongo
 * transaction in the reply service, which writes the link document.
 */
export function runIntegrityMediaLinkCriticalSection<T>(work: () => Promise<T>): Promise<T> {
  const run = tail.then(() => work());
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

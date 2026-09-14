/**
 * Reset 03E.13 — Media PLP batch attach by canonical identity (not array position).
 * Shared by SSR load path and adversarial join regressions.
 */

export function mediaPlpBatchIdentityKey(
  entityType: string,
  entityId: string,
): string {
  return `${entityType}\0${entityId}`;
}

/**
 * Index HTTP/batch resolver rows by entityType+entityId.
 * Duplicate keys keep the first row (deterministic; never shift by response order).
 */
export function indexMediaPlpBatchResultsByIdentity<
  T extends { readonly entityType: string; readonly entityId: string },
>(results: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of results) {
    const key = mediaPlpBatchIdentityKey(row.entityType, row.entityId);
    if (!map.has(key)) {
      map.set(key, row);
    }
  }
  return map;
}

/**
 * Attach batch results to request items by identity. Missing rows call `fallback`.
 * Response order and sparse/extra rows cannot shift localization onto another key.
 */
export function attachMediaPlpBatchByIdentity<
  TItem extends {
    readonly entityType: string;
    readonly entityId: string;
    readonly key: string;
  },
  TResult extends { readonly entityType: string; readonly entityId: string },
  TOut,
>(input: {
  readonly items: readonly TItem[];
  readonly byEntityKey: ReadonlyMap<string, TResult>;
  readonly mapHit: (hit: TResult, item: TItem) => TOut;
  readonly fallback: (item: TItem) => TOut;
}): Record<string, TOut> {
  const out: Record<string, TOut> = {};
  for (const item of input.items) {
    const hit = input.byEntityKey.get(
      mediaPlpBatchIdentityKey(item.entityType, item.entityId),
    );
    out[item.key] = hit
      ? input.mapHit(hit, item)
      : input.fallback(item);
  }
  return out;
}

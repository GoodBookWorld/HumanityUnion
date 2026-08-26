/**
 * Home Hero quote honeycomb + signal field.
 * Honeycomb geometry mirrors Pack 22I / prior hero hex work without Earth/orbit coupling.
 * Mask phases alone reveal/hide the stable quote (12s cycle).
 */

import { HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS } from "./hero-unity-visual.constants";

export const HERO_HEX_BACKDROP = "#f4f7fa";

export const HERO_HEX_MATRIX = {
  minColumns: 14,
  maxColumns: 24,
  maxCells: 520,
  tabletMaxColumns: 18,
} as const;

/** Quote / mask cycle length in ms — must match HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS. */
export const HERO_QUOTE_CYCLE_MS = HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS * 1_000;

/**
 * Mask phase fractions on the 12s cycle (quote text stays opacity 1):
 * 0–15% mostly closed → 15–40% open → 40–70% readable → 70–90% close → 90–100% swap window.
 */
export const HERO_QUOTE_MASK_PHASES = {
  /** End of initial mostly-closed hold (≈75–90% coverage). */
  closedHoldEnd: 0.15,
  /** Clusters finish opening; readable phase begins. */
  openEnd: 0.4,
  /** Readable hold ends; clusters begin returning. */
  readableEnd: 0.7,
  /** Closing mostly done; swap/protection window begins. */
  closeEnd: 0.9,
  /** @deprecated alias — prefer closedHoldEnd */
  openStart: 0.15,
  /** @deprecated alias — prefer openEnd */
  readableStart: 0.4,
  /** @deprecated alias — prefer closeEnd */
  closedEnd: 0.9,
} as const;

/** Target clear fraction during the readable hold. */
export const HERO_QUOTE_READABLE_CLEAR_FRACTION = {
  min: 0.9,
  max: 0.95,
} as const;

/** Target mask coverage (1 - clear) at cycle start / swap window. */
export const HERO_QUOTE_MASK_COVERAGE = {
  /** Initial closed hold ≈75–90% obscured. */
  initialMin: 0.75,
  initialMax: 0.9,
  /** Pre-swap closing ≈60–85% obscured. */
  swapMin: 0.6,
  swapMax: 0.85,
} as const;

export const HERO_SIGNAL_FIELD = {
  desktopCount: 6,
  tabletCount: 4,
  radiusCss: 3.2,
} as const;

/** Mulberry32 — deterministic, no external deps. */
export function createHeroHexSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface HeroHexCell {
  readonly index: number;
  readonly col: number;
  readonly row: number;
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly clusterId: number;
  /** 0..1 offset within cluster open/close stagger. */
  readonly clusterOffset: number;
  readonly phase: number;
  /** Soft living flicker during readable hold (sparse). */
  readonly living: boolean;
  readonly clusterWeight: number;
}

export interface HeroHexCluster {
  readonly id: number;
  readonly cx: number;
  readonly cy: number;
  /** 0..1 — when this cluster prefers to open within the open window. */
  readonly openBias: number;
  /** 0..1 — when this cluster prefers to close within the close window. */
  readonly closeBias: number;
}

export interface HeroHexField {
  readonly width: number;
  readonly height: number;
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly HeroHexCell[];
  readonly clusters: readonly HeroHexCluster[];
}

export interface HeroSignalPoint {
  readonly id: number;
  readonly anchors: readonly { readonly x: number; readonly y: number }[];
  readonly durationMs: number;
  readonly phaseMs: number;
  readonly clusterAffinity: number;
  readonly radius: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function resolveColumns(width: number): number {
  const approx = Math.round(width / 28);
  const maxCols =
    width < 520 ? HERO_HEX_MATRIX.tabletMaxColumns : HERO_HEX_MATRIX.maxColumns;
  return Math.min(
    maxCols,
    Math.max(HERO_HEX_MATRIX.minColumns, approx),
  );
}

const CLUSTER_FOCI_NORM = [
  { x: 0.5, y: 0.42 },
  { x: 0.28, y: 0.55 },
  { x: 0.72, y: 0.55 },
  { x: 0.42, y: 0.68 },
  { x: 0.58, y: 0.32 },
] as const;

export function buildHeroHexField(input: {
  width: number;
  height: number;
  seed?: number;
}): HeroHexField {
  const width = Math.max(1, Math.floor(input.width));
  const height = Math.max(1, Math.floor(input.height));
  const columns = resolveColumns(width);
  const cellW = width / columns;
  const cellH = cellW * 0.866;
  let rows = Math.ceil(height / cellH) + 1;

  while (columns * rows > HERO_HEX_MATRIX.maxCells && rows > 8) {
    rows -= 1;
  }

  const radius = cellW * 0.5;
  const random = createHeroHexSeededRandom(input.seed ?? 0x5155_4f54); // "QUOT"
  const foci = CLUSTER_FOCI_NORM.map((f, id) => ({
    id,
    cx: f.x * width,
    cy: f.y * height,
    openBias: random(),
    closeBias: random(),
  }));

  const draft: Array<{
    index: number;
    col: number;
    row: number;
    cx: number;
    cy: number;
    radius: number;
    clusterId: number;
    clusterOffset: number;
    phase: number;
    livingRoll: number;
    clusterWeight: number;
  }> = [];

  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    const offsetX = row % 2 === 1 ? cellW * 0.5 : 0;
    for (let col = 0; col < columns; col += 1) {
      const cx = col * cellW + cellW * 0.5 + offsetX;
      const cy = row * cellH + cellH * 0.5;
      if (cx < -cellW || cx > width + cellW || cy < -cellH || cy > height + cellH) {
        continue;
      }

      let bestId = 0;
      let minDist = Number.POSITIVE_INFINITY;
      for (const focus of foci) {
        const dist = Math.hypot(cx - focus.cx, cy - focus.cy);
        if (dist < minDist) {
          minDist = dist;
          bestId = focus.id;
        }
      }
      const normDist = minDist / Math.hypot(width, height);
      draft.push({
        index,
        col,
        row,
        cx,
        cy,
        radius,
        clusterId: bestId,
        clusterOffset: random(),
        phase: random() * Math.PI * 2,
        livingRoll: random(),
        clusterWeight: 1 - Math.min(1, normDist * 3.2),
      });
      index += 1;
      if (draft.length >= HERO_HEX_MATRIX.maxCells) {
        break;
      }
    }
    if (draft.length >= HERO_HEX_MATRIX.maxCells) {
      break;
    }
  }

  const cells: HeroHexCell[] = draft.map((cell) => ({
    index: cell.index,
    col: cell.col,
    row: cell.row,
    cx: cell.cx,
    cy: cell.cy,
    radius: cell.radius,
    clusterId: cell.clusterId,
    clusterOffset: cell.clusterOffset,
    phase: cell.phase,
    living: cell.livingRoll < 0.12,
    clusterWeight: cell.clusterWeight,
  }));

  const clusters: HeroHexCluster[] = foci.map((f) => ({
    id: f.id,
    cx: f.cx,
    cy: f.cy,
    openBias: f.openBias,
    closeBias: f.closeBias,
  }));

  return { width, height, columns, rows, cells, clusters };
}

export function drawHeroHexCell(
  ctx: CanvasRenderingContext2D,
  cell: Pick<HeroHexCell, "cx" | "cy" | "radius">,
  fillStyle: string,
  radiusScale = 1.05,
): void {
  const radius = cell.radius * radiusScale;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cell.cx + radius * Math.cos(angle);
    const y = cell.cy + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

/**
 * Cluster openness 0..1 at cycle progress (0 opaque cover, 1 fully clear).
 * Local clusters open/close with neighbor stagger — not a uniform global flicker.
 */
export function heroClusterOpenAmount(
  cluster: Pick<HeroHexCluster, "openBias" | "closeBias">,
  progress: number,
  /** Optional boost 0..1 when a signal approaches this cluster. */
  signalBoost = 0,
): number {
  const { closedHoldEnd, openEnd, readableEnd, closeEnd } = HERO_QUOTE_MASK_PHASES;

  // 0–15%: mostly closed (~80% cover → open ≈ 0.2).
  if (progress < closedHoldEnd) {
    return clamp01(0.18 + signalBoost * 0.05);
  }

  // 15–40%: clusters stagger open toward readable.
  if (progress < openEnd) {
    const span = openEnd - closedHoldEnd;
    const localStart = closedHoldEnd + cluster.openBias * span * 0.55;
    const localEnd = closedHoldEnd + span * (0.5 + cluster.openBias * 0.45);
    const base = smoothstep(localStart, localEnd, progress);
    // Blend from initial openness to near-full clear.
    return clamp01(0.18 + base * 0.75 + signalBoost * 0.18);
  }

  // 40–70%: readable hold — ~90–95% clear.
  if (progress < readableEnd) {
    return clamp01(0.93 + signalBoost * 0.03);
  }

  // 70–90%: clusters return irregularly toward ~70–80% cover (open ≈ 0.2–0.3).
  if (progress < closeEnd) {
    const span = closeEnd - readableEnd;
    const localStart = readableEnd + cluster.closeBias * span * 0.2;
    const localEnd = readableEnd + span * (0.35 + cluster.closeBias * 0.35);
    const closing = smoothstep(localStart, localEnd, progress);
    return clamp01(0.93 - closing * 0.72 - signalBoost * 0.04);
  }

  // 90–100%: swap / protection window — stay mostly closed (~75–80% cover).
  return clamp01(0.2 + signalBoost * 0.04);
}

/**
 * Per-cell mask opacity (1 = opaque #f4f7fa cover, 0 = clear / quote visible).
 */
export function heroQuoteHexCellOpacity(
  cell: Pick<
    HeroHexCell,
    "clusterId" | "clusterOffset" | "phase" | "living" | "clusterWeight"
  >,
  cluster: Pick<HeroHexCluster, "openBias" | "closeBias">,
  cycleElapsedMs: number,
  signalBoost = 0,
  cycleMs: number = HERO_QUOTE_CYCLE_MS,
): number {
  const progress = (((cycleElapsedMs % cycleMs) + cycleMs) % cycleMs) / cycleMs;
  const open = heroClusterOpenAmount(cluster, progress, signalBoost);

  // Neighbor stagger within cluster — small timing offsets, not global noise.
  const stagger = (cell.clusterOffset - 0.5) * 0.12;
  let clear = clamp01(open + stagger * Math.min(1, open * 1.2));

  // Very sparse soft fragments during readable hold only (keep ~90–95% clear).
  const { openEnd, readableEnd, closeEnd } = HERO_QUOTE_MASK_PHASES;
  if (cell.living && progress >= openEnd && progress < readableEnd) {
    const wave = 0.5 + 0.5 * Math.sin(cycleElapsedMs * 0.0024 + cell.phase);
    clear = clamp01(clear - wave * 0.035 * (0.35 + 0.65 * cell.clusterWeight));
  }

  // During close, some cells return slightly ahead of the cluster mean (not exact reverse).
  if (progress >= readableEnd && progress < closeEnd) {
    const earlyReturn =
      Math.max(0, 0.55 - cell.clusterOffset) *
      smoothstep(readableEnd, readableEnd + 0.1, progress) *
      0.28;
    clear = clamp01(clear - earlyReturn);
  }

  return clamp01(1 - clear);
}

/** Mean clear fraction for a field at a cycle time — used by readability tests. */
export function heroQuoteHexClearFraction(
  field: HeroHexField,
  cycleElapsedMs: number,
  boostByCluster: ReadonlyMap<number, number> = new Map(),
): number {
  if (field.cells.length === 0) {
    return 1;
  }
  let clearSum = 0;
  for (const cell of field.cells) {
    const cluster = field.clusters[cell.clusterId]!;
    const boost = boostByCluster.get(cell.clusterId) ?? 0;
    const opacity = heroQuoteHexCellOpacity(
      cell,
      cluster,
      cycleElapsedMs,
      boost,
    );
    clearSum += 1 - opacity;
  }
  return clearSum / field.cells.length;
}

/** Mask coverage = 1 − clear fraction. */
export function heroQuoteHexCoverageFraction(
  field: HeroHexField,
  cycleElapsedMs: number,
  boostByCluster: ReadonlyMap<number, number> = new Map(),
): number {
  return 1 - heroQuoteHexClearFraction(field, cycleElapsedMs, boostByCluster);
}

/** True during the late-cycle window where a quote content swap would be masked. */
export function heroQuoteIsSwapWindow(
  cycleElapsedMs: number,
  cycleMs: number = HERO_QUOTE_CYCLE_MS,
): boolean {
  const progress = (((cycleElapsedMs % cycleMs) + cycleMs) % cycleMs) / cycleMs;
  return progress >= HERO_QUOTE_MASK_PHASES.closeEnd;
}

export function buildHeroSignalPoints(input: {
  width: number;
  height: number;
  count?: number;
  seed?: number;
  clusters: readonly HeroHexCluster[];
}): readonly HeroSignalPoint[] {
  const random = createHeroHexSeededRandom(input.seed ?? 0x5347_4e4c); // "SGNL"
  const count =
    input.count ??
    (input.width < 520
      ? HERO_SIGNAL_FIELD.tabletCount
      : HERO_SIGNAL_FIELD.desktopCount);
  const clusters =
    input.clusters.length > 0
      ? input.clusters
      : [{ id: 0, cx: input.width * 0.5, cy: input.height * 0.5, openBias: 0.5, closeBias: 0.5 }];

  const points: HeroSignalPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const affinity = i % clusters.length;
    const home = clusters[affinity]!;
    const anchors = [
      {
        x: clamp01((home.cx + (random() - 0.5) * input.width * 0.18) / input.width),
        y: clamp01((home.cy + (random() - 0.5) * input.height * 0.18) / input.height),
      },
      {
        x: 0.18 + random() * 0.64,
        y: 0.22 + random() * 0.56,
      },
      {
        x: clamp01(
          (clusters[(affinity + 2) % clusters.length]!.cx +
            (random() - 0.5) * input.width * 0.12) /
            input.width,
        ),
        y: clamp01(
          (clusters[(affinity + 2) % clusters.length]!.cy +
            (random() - 0.5) * input.height * 0.12) /
            input.height,
        ),
      },
      {
        x: 0.22 + random() * 0.56,
        y: 0.28 + random() * 0.48,
      },
    ];
    points.push({
      id: i,
      anchors,
      durationMs: 4_200 + random() * 5_800,
      phaseMs: random() * 8_000,
      clusterAffinity: affinity,
      radius: HERO_SIGNAL_FIELD.radiusCss * (0.85 + random() * 0.3),
    });
  }
  return points;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Deterministic point position in CSS pixels.
 * Moves between invisible anchors; optionally eases toward an active cluster.
 */
export function heroSignalPointPosition(
  point: HeroSignalPoint,
  elapsedMs: number,
  width: number,
  height: number,
  attractor: { x: number; y: number; strength: number } | null = null,
): { x: number; y: number } {
  const local = ((elapsedMs + point.phaseMs) % point.durationMs) / point.durationMs;
  const segmentCount = point.anchors.length;
  const scaled = local * segmentCount;
  const i0 = Math.floor(scaled) % segmentCount;
  const i1 = (i0 + 1) % segmentCount;
  const t = smoothstep(0, 1, scaled - Math.floor(scaled));
  const a0 = point.anchors[i0]!;
  const a1 = point.anchors[i1]!;
  let x = lerp(a0.x, a1.x, t) * width;
  let y = lerp(a0.y, a1.y, t) * height;

  if (attractor && attractor.strength > 0) {
    x = lerp(x, attractor.x, attractor.strength);
    y = lerp(y, attractor.y, attractor.strength);
  }
  return { x, y };
}

/**
 * Suggestive point→mask coordination: boost for clusters near signal points
 * during the opening / early readable window.
 */
export function heroSignalClusterBoosts(
  points: readonly HeroSignalPoint[],
  clusters: readonly HeroHexCluster[],
  elapsedMs: number,
  width: number,
  height: number,
  cycleMs: number = HERO_QUOTE_CYCLE_MS,
): Map<number, number> {
  const progress = (((elapsedMs % cycleMs) + cycleMs) % cycleMs) / cycleMs;
  const boosts = new Map<number, number>();
  if (
    progress < HERO_QUOTE_MASK_PHASES.closedHoldEnd ||
    progress > HERO_QUOTE_MASK_PHASES.readableEnd
  ) {
    return boosts;
  }

  for (const point of points) {
    const pos = heroSignalPointPosition(point, elapsedMs, width, height);
    for (const cluster of clusters) {
      const dist = Math.hypot(pos.x - cluster.cx, pos.y - cluster.cy);
      const radius = Math.min(width, height) * 0.16;
      if (dist > radius) {
        continue;
      }
      const proximity = 1 - dist / radius;
      const prev = boosts.get(cluster.id) ?? 0;
      boosts.set(cluster.id, Math.min(1, prev + proximity * 0.55));
    }
  }
  return boosts;
}

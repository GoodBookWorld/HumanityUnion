/**
 * Home Hero quote honeycomb + signal field.
 * Geometric cell-scale dissolve: hexes shrink/grow around their centers.
 * Quote stays opacity 1; mask presence alone reveals/hides the text (12s cycle).
 */

import { HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS } from "./hero-unity-visual.constants";

export const HERO_HEX_BACKDROP = "#f4f7fa";

export const HERO_HEX_MATRIX = {
  minColumns: 14,
  maxColumns: 24,
  maxCells: 520,
  tabletMaxColumns: 18,
} as const;

/** Skip drawing below this geometric scale (cell is absent). */
export const HERO_HEX_SCALE_EPSILON = 0.02;

/** Quote / mask cycle length in ms — must match HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS. */
export const HERO_QUOTE_CYCLE_MS = HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS * 1_000;

/**
 * Mask phase fractions on the 12s cycle (quote text stays opacity 1):
 * 0–15% fully closed → 15–35% reveal → 35–65% fully open → 65–85% close → 85–100% fully closed + swap.
 */
export const HERO_QUOTE_MASK_PHASES = {
  /** End of initial fully-closed hold (all cells scale = 1). */
  closedHoldEnd: 0.15,
  /** All cells finished shrinking; fully-open readable hold begins. */
  openEnd: 0.35,
  /** Readable hold ends; cells begin growing back. */
  readableEnd: 0.65,
  /** All cells finished growing; fully-closed swap hold begins. */
  closeEnd: 0.85,
  /** @deprecated alias — prefer closedHoldEnd */
  openStart: 0.15,
  /** @deprecated alias — prefer openEnd */
  readableStart: 0.35,
  /** @deprecated alias — prefer closeEnd */
  closedEnd: 0.85,
} as const;

/** Readable hold must be fully clear (no covering cells). */
export const HERO_QUOTE_READABLE_CLEAR_FRACTION = {
  min: 1,
  max: 1,
} as const;

/** Closed / swap phases must be fully covered. */
export const HERO_QUOTE_MASK_COVERAGE = {
  initialMin: 1,
  initialMax: 1,
  swapMin: 1,
  swapMax: 1,
} as const;

/** Slight geometric overlap so adjacent hexes seal seams when fully closed. */
export const HERO_HEX_DRAW_OVERLAP = 1.12;

/**
 * Full-close solid cover — seals anti-aliased hex seams during closed/swap holds.
 * Active only when honeycomb is fully rebuilt (not during reveal/open/readability).
 */
export const HERO_QUOTE_SOLID_COVER = {
  color: HERO_HEX_BACKDROP,
  /** Post-close hold length (closeEnd → 1.0) ≈ 1.8s of the 12s cycle. */
  holdMs: Math.round((1 - 0.85) * HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS * 1_000),
} as const;

/**
 * True while the solid seam-safety cover should fully obscure the quote.
 * Matches fully-closed honeycomb holds at cycle start and after closeEnd.
 */
export function heroQuoteSolidCoverActive(
  cycleElapsedMs: number,
  cycleMs: number = HERO_QUOTE_CYCLE_MS,
): boolean {
  const progress = (((cycleElapsedMs % cycleMs) + cycleMs) % cycleMs) / cycleMs;
  return (
    progress < HERO_QUOTE_MASK_PHASES.closedHoldEnd ||
    progress >= HERO_QUOTE_MASK_PHASES.closeEnd
  );
}

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
  /** 0..1 — shrink order (0 disappears first). Independent of growAt. */
  readonly revealAt: number;
  /** 0..1 — grow-back order (0 returns first). Not the exact reverse of revealAt. */
  readonly growAt: number;
  /** 0..1 local stagger within cluster. */
  readonly clusterOffset: number;
  readonly phase: number;
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
    revealNoise: number;
    growNoise: number;
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
        revealNoise: random(),
        growNoise: random(),
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

  // Pseudo-random reveal order (cluster-biased). Grow order uses a different noise axis.
  const revealRanked = [...draft].sort((a, b) => {
    const scoreA = a.revealNoise * 0.72 + (1 - a.clusterWeight) * 0.28;
    const scoreB = b.revealNoise * 0.72 + (1 - b.clusterWeight) * 0.28;
    return scoreA - scoreB;
  });
  const growRanked = [...draft].sort((a, b) => {
    const scoreA = a.growNoise * 0.68 + a.clusterWeight * 0.32;
    const scoreB = b.growNoise * 0.68 + b.clusterWeight * 0.32;
    return scoreA - scoreB;
  });
  const revealAtByIndex = new Map<number, number>();
  const growAtByIndex = new Map<number, number>();
  const total = Math.max(1, draft.length);
  revealRanked.forEach((cell, rank) => {
    revealAtByIndex.set(cell.index, (rank + 0.5) / total);
  });
  growRanked.forEach((cell, rank) => {
    growAtByIndex.set(cell.index, (rank + 0.5) / total);
  });

  const cells: HeroHexCell[] = draft.map((cell) => ({
    index: cell.index,
    col: cell.col,
    row: cell.row,
    cx: cell.cx,
    cy: cell.cy,
    radius: cell.radius,
    clusterId: cell.clusterId,
    revealAt: revealAtByIndex.get(cell.index) ?? 0.5,
    growAt: growAtByIndex.get(cell.index) ?? 0.5,
    clusterOffset: cell.clusterOffset,
    phase: cell.phase,
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


function easeInCubic(t: number): number {
  return t * t * t;
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/**
 * Draw a solid hex scaled about its center.
 * Skips drawing when scale is below epsilon (cell is absent).
 */
export function drawHeroHexCell(
  ctx: CanvasRenderingContext2D,
  cell: Pick<HeroHexCell, "cx" | "cy" | "radius">,
  fillStyle: string,
  scale = 1,
): void {
  if (scale < HERO_HEX_SCALE_EPSILON) {
    return;
  }
  const radius = cell.radius * HERO_HEX_DRAW_OVERLAP * scale;
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
 * Cluster openness 0..1 (0 = fully present, 1 = fully absent).
 * Diagnostic helper; cell visibility is driven by geometric scale.
 */
export function heroClusterOpenAmount(
  cluster: Pick<HeroHexCluster, "openBias" | "closeBias">,
  progress: number,
  signalBoost = 0,
): number {
  const { closedHoldEnd, openEnd, readableEnd, closeEnd } = HERO_QUOTE_MASK_PHASES;

  if (progress < closedHoldEnd) {
    return 0;
  }
  if (progress < openEnd) {
    const span = openEnd - closedHoldEnd;
    const localStart = closedHoldEnd + cluster.openBias * span * 0.45;
    const localEnd = closedHoldEnd + span * (0.55 + cluster.openBias * 0.35);
    const base = smoothstep(localStart, localEnd, progress);
    return clamp01(base + signalBoost * 0.12);
  }
  if (progress < readableEnd) {
    return 1;
  }
  if (progress < closeEnd) {
    const span = closeEnd - readableEnd;
    const localStart = readableEnd + cluster.closeBias * span * 0.2;
    const localEnd = readableEnd + span * (0.45 + cluster.closeBias * 0.4);
    const closing = smoothstep(localStart, localEnd, progress);
    return clamp01(1 - closing);
  }
  return 0;
}

/**
 * Geometric cell scale 0..1 (1 = full hex covering, 0 = absent / not drawn).
 * Full cycle: closed → open → closed. Signal boost may accelerate mid-phase
 * motion but never prevents completing scale 0 / scale 1 holds.
 */
export function heroQuoteHexCellScale(
  cell: Pick<HeroHexCell, "revealAt" | "growAt" | "clusterOffset">,
  cluster: Pick<HeroHexCluster, "openBias" | "closeBias">,
  cycleElapsedMs: number,
  signalBoost = 0,
  cycleMs: number = HERO_QUOTE_CYCLE_MS,
): number {
  const progress = (((cycleElapsedMs % cycleMs) + cycleMs) % cycleMs) / cycleMs;
  const { closedHoldEnd, openEnd, readableEnd, closeEnd } = HERO_QUOTE_MASK_PHASES;

  // 0–15% / 85–100%: fully closed — every cell present.
  if (progress < closedHoldEnd || progress >= closeEnd) {
    return 1;
  }

  // 35–65%: fully open — every cell absent.
  if (progress >= openEnd && progress < readableEnd) {
    return 0;
  }

  // 15–35%: shrink 1 → 0 (guarantee completion before openEnd).
  if (progress < openEnd) {
    const span = openEnd - closedHoldEnd;
    const duration = span * 0.28;
    const finishEarly = span * 0.02;
    const rawStart =
      closedHoldEnd +
      cell.revealAt * (span - duration - finishEarly) * 0.92 +
      cluster.openBias * span * 0.06 +
      (cell.clusterOffset - 0.5) * span * 0.05 -
      signalBoost * span * 0.08;
    const start = Math.min(
      Math.max(closedHoldEnd, rawStart),
      openEnd - duration - finishEarly,
    );
    const t = clamp01((progress - start) / Math.max(1e-6, duration));
    return clamp01(1 - easeInCubic(t));
  }

  // 65–85%: grow 0 → 1 (guarantee completion before closeEnd).
  const span = closeEnd - readableEnd;
  const duration = span * 0.28;
  const finishEarly = span * 0.02;
  const rawStart =
    readableEnd +
    cell.growAt * (span - duration - finishEarly) * 0.92 +
    cluster.closeBias * span * 0.06 +
    (cell.clusterOffset - 0.5) * span * 0.05 -
    signalBoost * span * 0.05;
  const start = Math.min(
    Math.max(readableEnd, rawStart),
    closeEnd - duration - finishEarly,
  );
  const t = clamp01((progress - start) / Math.max(1e-6, duration));
  return clamp01(easeOutCubic(t));
}

/** Mean clear fraction ≈ fraction of geometric absence (1 − mean scale). */
export function heroQuoteHexClearFraction(
  field: HeroHexField,
  cycleElapsedMs: number,
  boostByCluster: ReadonlyMap<number, number> = new Map(),
): number {
  return 1 - heroQuoteHexCoverageFraction(field, cycleElapsedMs, boostByCluster);
}

/** Mean geometric scale across cells (proxy for covered quote area). */
export function heroQuoteHexCoverageFraction(
  field: HeroHexField,
  cycleElapsedMs: number,
  boostByCluster: ReadonlyMap<number, number> = new Map(),
): number {
  if (field.cells.length === 0) {
    return 0;
  }
  let scaleSum = 0;
  for (const cell of field.cells) {
    const cluster = field.clusters[cell.clusterId]!;
    const boost = boostByCluster.get(cell.clusterId) ?? 0;
    scaleSum += heroQuoteHexCellScale(cell, cluster, cycleElapsedMs, boost);
  }
  return scaleSum / field.cells.length;
}

/** True when every cell is at full geometric scale (fully closed mask). */
export function heroQuoteHexIsFullyClosed(
  field: HeroHexField,
  cycleElapsedMs: number,
  boostByCluster: ReadonlyMap<number, number> = new Map(),
): boolean {
  if (field.cells.length === 0) {
    return true;
  }
  for (const cell of field.cells) {
    const cluster = field.clusters[cell.clusterId]!;
    const boost = boostByCluster.get(cell.clusterId) ?? 0;
    if (heroQuoteHexCellScale(cell, cluster, cycleElapsedMs, boost) < 1 - 1e-6) {
      return false;
    }
  }
  return true;
}

/** True when every cell is absent (fully open / quote unobstructed). */
export function heroQuoteHexIsFullyOpen(
  field: HeroHexField,
  cycleElapsedMs: number,
  boostByCluster: ReadonlyMap<number, number> = new Map(),
): boolean {
  if (field.cells.length === 0) {
    return true;
  }
  for (const cell of field.cells) {
    const cluster = field.clusters[cell.clusterId]!;
    const boost = boostByCluster.get(cell.clusterId) ?? 0;
    if (heroQuoteHexCellScale(cell, cluster, cycleElapsedMs, boost) > HERO_HEX_SCALE_EPSILON) {
      return false;
    }
  }
  return true;
}

/** True during the late-cycle window where a quote content swap is fully masked. */
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
    (progress >= HERO_QUOTE_MASK_PHASES.openEnd &&
      progress < HERO_QUOTE_MASK_PHASES.readableEnd) ||
    progress >= HERO_QUOTE_MASK_PHASES.closeEnd
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

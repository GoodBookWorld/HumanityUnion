/**
 * Pack 22I.1 — seeded PRNG + honeycomb cell geometry for HU Matrix Reveal.
 */

import { PWA_LAUNCH_MATRIX } from "./pwa-launch-constants";

/** Mulberry32 — deterministic, no external deps. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MatrixCell {
  readonly index: number;
  readonly col: number;
  readonly row: number;
  /** Center x in CSS pixels. */
  readonly cx: number;
  /** Center y in CSS pixels. */
  readonly cy: number;
  readonly radius: number;
  /** Reveal rank 0..n-1 (lower disappears first). */
  readonly revealRank: number;
  /** Normalized 0..1 — cell clears once progress >= revealAt. */
  readonly revealAt: number;
  /** 0..1 cluster proximity for late-network visual rhythm. */
  readonly clusterWeight: number;
}

export interface MatrixField {
  readonly width: number;
  readonly height: number;
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly MatrixCell[];
}

/** Alias used by canvas + tests. */
export type HuMatrixField = MatrixField;

function resolveColumns(width: number): number {
  const approx = Math.round(width / 28);
  return Math.min(
    PWA_LAUNCH_MATRIX.maxColumns,
    Math.max(PWA_LAUNCH_MATRIX.minColumns, approx),
  );
}

/**
 * Build a hex-ish honeycomb field with a seeded reveal order.
 * Cluster bias near foci creates brief network/honeycomb islands late in the dissolve.
 */
export function buildHuMatrixField(input: {
  width: number;
  height: number;
  seed?: number;
}): MatrixField {
  const width = Math.max(1, Math.floor(input.width));
  const height = Math.max(1, Math.floor(input.height));
  const columns = resolveColumns(width);
  const cellW = width / columns;
  const cellH = cellW * 0.866; // √3/2
  let rows = Math.ceil(height / cellH) + 1;

  while (columns * rows > PWA_LAUNCH_MATRIX.maxCells && rows > 8) {
    rows -= 1;
  }

  const radius = cellW * 0.48;
  const foci = [
    { x: width * 0.5, y: height * 0.42 },
    { x: width * 0.34, y: height * 0.58 },
    { x: width * 0.66, y: height * 0.58 },
  ];

  const random = createSeededRandom(input.seed ?? 0x4855_4d31); // "HUM1"
  const draft: Array<{
    index: number;
    col: number;
    row: number;
    cx: number;
    cy: number;
    radius: number;
    noise: number;
    cluster: number;
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
      let minDist = Number.POSITIVE_INFINITY;
      for (const focus of foci) {
        const dx = (cx - focus.x) / width;
        const dy = (cy - focus.y) / height;
        minDist = Math.min(minDist, Math.hypot(dx, dy));
      }
      // Lower cluster score near foci → later reveal (islands linger).
      const cluster = 1 - Math.min(1, minDist * 2.2);
      draft.push({
        index,
        col,
        row,
        cx,
        cy,
        radius,
        noise: random(),
        cluster,
      });
      index += 1;
      if (draft.length >= PWA_LAUNCH_MATRIX.maxCells) {
        break;
      }
    }
    if (draft.length >= PWA_LAUNCH_MATRIX.maxCells) {
      break;
    }
  }

  // Sort key: early cells = high noise + low cluster; late = low noise + high cluster.
  const ranked = [...draft].sort((a, b) => {
    const scoreA = a.noise * 0.72 + (1 - a.cluster) * 0.28;
    const scoreB = b.noise * 0.72 + (1 - b.cluster) * 0.28;
    return scoreB - scoreA;
  });

  const rankByIndex = new Map<number, number>();
  ranked.forEach((cell, rank) => {
    rankByIndex.set(cell.index, rank);
  });

  const total = Math.max(1, draft.length);
  const cells: MatrixCell[] = draft.map((cell) => {
    const revealRank = rankByIndex.get(cell.index) ?? 0;
    return {
      index: cell.index,
      col: cell.col,
      row: cell.row,
      cx: cell.cx,
      cy: cell.cy,
      radius: cell.radius,
      revealRank,
      revealAt: (revealRank + 0.5) / total,
      clusterWeight: cell.cluster,
    };
  });

  return { width, height, columns, rows, cells };
}

export function drawHexCell(
  ctx: CanvasRenderingContext2D,
  cell: Pick<MatrixCell, "cx" | "cy" | "radius">,
  fillStyle: string,
  radiusScale = 1,
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

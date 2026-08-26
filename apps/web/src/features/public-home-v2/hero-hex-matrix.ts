/**
 * Home Hero hex/honeycomb matrix geometry.
 * Shape language mirrors Pack 22I HU Matrix Reveal without PWA session/audio coupling.
 */

export const HERO_HEX_BACKDROP = "#f4f7fa";

export const HERO_HEX_MATRIX = {
  minColumns: 18,
  maxColumns: 28,
  maxCells: 700,
} as const;

/** Timeline (ms) for the Home Hero hex reveal. */
export const HERO_HEX_TIMING = {
  /** Fully opaque cover before any reveal. */
  holdMs: 2_300,
  /** Active dissolve window end (near-complete). */
  revealEndMs: 5_000,
  /** Soft fade window per cell once its reveal time arrives. */
  cellFadeMs: 700,
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
  readonly revealRank: number;
  /** 0..1 — earlier cells open first after the hold. */
  readonly revealAt: number;
  readonly clusterWeight: number;
  /** Phase for living flicker. */
  readonly phase: number;
  /** Participates in subtle post-reveal living activity. */
  readonly living: boolean;
}

export interface HeroHexField {
  readonly width: number;
  readonly height: number;
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly HeroHexCell[];
}

function resolveColumns(width: number): number {
  const approx = Math.round(width / 26);
  return Math.min(
    HERO_HEX_MATRIX.maxColumns,
    Math.max(HERO_HEX_MATRIX.minColumns, approx),
  );
}

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
  const foci = [
    { x: width * 0.5, y: height * 0.45 },
    { x: width * 0.32, y: height * 0.58 },
    { x: width * 0.68, y: height * 0.58 },
  ];

  const random = createHeroHexSeededRandom(input.seed ?? 0x4845_5831); // "HEX1"
  const draft: Array<{
    index: number;
    col: number;
    row: number;
    cx: number;
    cy: number;
    radius: number;
    noise: number;
    cluster: number;
    phase: number;
    livingRoll: number;
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
        phase: random() * Math.PI * 2,
        livingRoll: random(),
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

  const ranked = [...draft].sort((a, b) => {
    const scoreA = a.noise * 0.74 + (1 - a.cluster) * 0.26;
    const scoreB = b.noise * 0.74 + (1 - b.cluster) * 0.26;
    return scoreB - scoreA;
  });

  const rankByIndex = new Map<number, number>();
  ranked.forEach((cell, rank) => {
    rankByIndex.set(cell.index, rank);
  });

  const total = Math.max(1, draft.length);
  const cells: HeroHexCell[] = draft.map((cell) => {
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
      phase: cell.phase,
      // ~14% keep a soft living flicker after the main reveal.
      living: cell.livingRoll < 0.14,
    };
  });

  return { width, height, columns, rows, cells };
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Per-cell opacity at elapsed time (0 = fully clear / shows underlay, 1 = opaque cover).
 * Supports hold → distributed reveal → brief re-opaque flicker → subtle living state.
 */
export function heroHexCellOpacity(
  cell: Pick<HeroHexCell, "revealAt" | "phase" | "living" | "clusterWeight">,
  elapsedMs: number,
  timing: typeof HERO_HEX_TIMING = HERO_HEX_TIMING,
): number {
  if (elapsedMs < timing.holdMs) {
    return 1;
  }

  const revealSpan = Math.max(1, timing.revealEndMs - timing.holdMs);
  const openAt = timing.holdMs + cell.revealAt * revealSpan;
  const sinceOpen = elapsedMs - openAt;
  const fade = clamp01(sinceOpen / timing.cellFadeMs);
  let opacity = 1 - fade;

  // Active reveal (≈3–5s): some cells briefly re-opaque — living matrix, not one-way dissolve.
  if (elapsedMs >= timing.holdMs + 700 && elapsedMs < timing.revealEndMs) {
    const pulse =
      0.5 + 0.5 * Math.sin(elapsedMs * 0.0042 + cell.phase + cell.revealAt * 9);
    const reopen = Math.max(0, pulse - 0.62) * 1.4 * (1 - fade * 0.55);
    opacity = clamp01(opacity + reopen * (0.45 + 0.4 * cell.clusterWeight));
  }

  // Stable living state after ~5s — sparse soft fragments only.
  if (elapsedMs >= timing.revealEndMs) {
    if (!cell.living) {
      return 0;
    }
    const livingWave =
      0.5 + 0.5 * Math.sin(elapsedMs * 0.0018 + cell.phase);
    return clamp01(0.06 + livingWave * 0.22 * (0.5 + 0.5 * cell.clusterWeight));
  }

  return clamp01(opacity);
}

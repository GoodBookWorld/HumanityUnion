/**
 * Home Hero quote honeycomb mask + foreground signal points (Canvas 2D / SVG).
 * Sits above hero-unity-quote; syncs mask phases to the existing quote cycle.
 */
"use client";

import { useEffect, useRef } from "react";

import { HUMANITY_UNITY_AMBER } from "../hero-unity-visual.constants";
import {
  HERO_HEX_BACKDROP,
  HERO_QUOTE_CYCLE_MS,
  HERO_QUOTE_MASK_PHASES,
  buildHeroHexField,
  buildHeroSignalPoints,
  drawHeroHexCell,
  heroQuoteHexCellOpacity,
  heroSignalClusterBoosts,
  heroSignalPointPosition,
  type HeroHexField,
  type HeroSignalPoint,
} from "../hero-hex-matrix";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function paintMask(
  ctx: CanvasRenderingContext2D,
  field: HeroHexField,
  elapsedMs: number,
  boosts: ReadonlyMap<number, number>,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  for (const cell of field.cells) {
    const cluster = field.clusters[cell.clusterId];
    if (!cluster) {
      continue;
    }
    const opacity = heroQuoteHexCellOpacity(
      cell,
      cluster,
      elapsedMs,
      boosts.get(cell.clusterId) ?? 0,
    );
    if (opacity < 0.02) {
      continue;
    }
    drawHeroHexCell(
      ctx,
      cell,
      `rgba(244, 247, 250, ${opacity.toFixed(3)})`,
      1.06,
    );
  }
}

function paintStaticReducedMask(
  ctx: CanvasRenderingContext2D,
  field: HeroHexField,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  for (const cell of field.cells) {
    // Mostly transparent static honeycomb — content stays readable.
    const opacity = 0.06 + cell.clusterWeight * 0.08;
    drawHeroHexCell(
      ctx,
      cell,
      `rgba(244, 247, 250, ${opacity.toFixed(3)})`,
      1.04,
    );
  }
}

function renderSignals(
  svg: SVGSVGElement,
  points: readonly HeroSignalPoint[],
  elapsedMs: number,
  width: number,
  height: number,
  reduced: boolean,
): void {
  const ns = "http://www.w3.org/2000/svg";
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  for (const point of points) {
    const pos = reduced
      ? {
          x: point.anchors[0]!.x * width,
          y: point.anchors[0]!.y * height,
        }
      : heroSignalPointPosition(point, elapsedMs, width, height);
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", pos.x.toFixed(2));
    circle.setAttribute("cy", pos.y.toFixed(2));
    circle.setAttribute("r", point.radius.toFixed(2));
    circle.setAttribute("class", "hero-quote-honeycomb__signal");
    circle.setAttribute("fill", HUMANITY_UNITY_AMBER);
    svg.appendChild(circle);
  }
}

export function HeroQuoteHoneycombVisual() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fieldRef = useRef<HeroHexField | null>(null);
  const pointsRef = useRef<readonly HeroSignalPoint[]>([]);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const svg = svgRef.current;
    if (!root || !canvas || !svg) {
      return;
    }

    const reduced = prefersReducedMotion();

    const resize = () => {
      const cssW = Math.max(1, root.clientWidth || 1);
      const cssH = Math.max(1, root.clientHeight || 1);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w: cssW, h: cssH, dpr };
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      fieldRef.current = buildHeroHexField({ width: cssW, height: cssH });
      pointsRef.current = buildHeroSignalPoints({
        width: cssW,
        height: cssH,
        clusters: fieldRef.current.clusters,
      });

      const ctx = canvas.getContext("2d");
      if (!ctx || !fieldRef.current) {
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduced) {
        paintStaticReducedMask(ctx, fieldRef.current, cssW, cssH);
        renderSignals(svg, pointsRef.current, 0, cssW, cssH, true);
        return;
      }
      const elapsed =
        startRef.current === null ? 0 : performance.now() - startRef.current;
      const boosts = heroSignalClusterBoosts(
        pointsRef.current,
        fieldRef.current.clusters,
        elapsed,
        cssW,
        cssH,
      );
      paintMask(ctx, fieldRef.current, elapsed, boosts, cssW, cssH);
      renderSignals(svg, pointsRef.current, elapsed, cssW, cssH, false);
    };

    resize();
    if (reduced) {
      window.addEventListener("resize", resize);
      window.addEventListener("orientationchange", resize);
      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("orientationchange", resize);
        fieldRef.current = null;
        pointsRef.current = [];
      };
    }

    startRef.current = performance.now();

    const tick = (now: number) => {
      const field = fieldRef.current;
      const ctx = canvas.getContext("2d");
      if (!field || !ctx) {
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }
      const { w, h, dpr } = sizeRef.current;
      const elapsed = now - (startRef.current ?? now);
      const boosts = heroSignalClusterBoosts(
        pointsRef.current,
        field.clusters,
        elapsed,
        w,
        h,
      );
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintMask(ctx, field, elapsed, boosts, w, h);
      renderSignals(svg, pointsRef.current, elapsed, w, h, false);
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      fieldRef.current = null;
      pointsRef.current = [];
      startRef.current = null;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="hero-quote-honeycomb"
      aria-hidden="true"
      data-hero-quote-honeycomb="true"
      data-hero-hex-backdrop={HERO_HEX_BACKDROP}
      data-hero-quote-cycle-ms={HERO_QUOTE_CYCLE_MS}
      data-hero-mask-closed-hold-end={HERO_QUOTE_MASK_PHASES.closedHoldEnd}
      data-hero-mask-open-end={HERO_QUOTE_MASK_PHASES.openEnd}
      data-hero-mask-readable-end={HERO_QUOTE_MASK_PHASES.readableEnd}
      data-hero-mask-close-end={HERO_QUOTE_MASK_PHASES.closeEnd}
    >
      <div className="hero-quote-honeycomb__layer hero-quote-honeycomb__layer--mask">
        <canvas
          ref={canvasRef}
          className="hero-quote-honeycomb__mask-canvas"
          aria-hidden="true"
        />
      </div>
      <div className="hero-quote-honeycomb__layer hero-quote-honeycomb__layer--signals">
        <svg
          ref={svgRef}
          className="hero-quote-honeycomb__signals"
          aria-hidden="true"
          focusable="false"
        />
      </div>
    </div>
  );
}

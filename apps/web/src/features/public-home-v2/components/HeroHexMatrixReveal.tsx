/**
 * Home Hero foreground hex/honeycomb reveal mask (Canvas 2D).
 * Covers Earth + orbital layers; underlay stays continuously active.
 */
"use client";

import { useEffect, useRef } from "react";

import {
  HERO_HEX_BACKDROP,
  HERO_HEX_TIMING,
  buildHeroHexField,
  drawHeroHexCell,
  heroHexCellOpacity,
  type HeroHexField,
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

function paintField(
  ctx: CanvasRenderingContext2D,
  field: HeroHexField,
  elapsedMs: number,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  for (const cell of field.cells) {
    const opacity = heroHexCellOpacity(cell, elapsedMs);
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

export function HeroHexMatrixReveal() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<HeroHexField | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (prefersReducedMotion()) {
      // Mostly revealed static composition — no matrix flicker / no rAF loop.
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const parent = canvas.parentElement;
        const cssW = parent?.clientWidth || 1;
        const cssH = parent?.clientHeight || 1;
        canvas.width = cssW;
        canvas.height = cssH;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        ctx.clearRect(0, 0, cssW, cssH);
      }
      return;
    }

    const resize = () => {
      const parent = canvas.parentElement;
      const cssW = Math.max(1, parent?.clientWidth || window.innerWidth);
      const cssH = Math.max(1, parent?.clientHeight || window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w: cssW, h: cssH, dpr };
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      fieldRef.current = buildHeroHexField({ width: cssW, height: cssH });
      const ctx = canvas.getContext("2d");
      if (ctx && fieldRef.current) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const elapsed =
          startRef.current === null ? 0 : performance.now() - startRef.current;
        paintField(ctx, fieldRef.current, elapsed, cssW, cssH);
      }
    };

    startRef.current = performance.now();
    resize();

    const tick = (now: number) => {
      const field = fieldRef.current;
      const ctx = canvas.getContext("2d");
      if (!field || !ctx) {
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }
      const { w, h, dpr } = sizeRef.current;
      const elapsed = now - (startRef.current ?? now);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintField(ctx, field, elapsed, w, h);
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
      startRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="hero-unity-globe__hex-matrix"
      aria-hidden="true"
      data-hero-hex-backdrop={HERO_HEX_BACKDROP}
      data-hero-hex-hold-ms={HERO_HEX_TIMING.holdMs}
      data-hero-hex-reveal-end-ms={HERO_HEX_TIMING.revealEndMs}
    />
  );
}

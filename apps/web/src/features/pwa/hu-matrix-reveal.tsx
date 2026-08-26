/**
 * Pack 22I.1 — Canvas 2D HU matrix / honeycomb reveal.
 *
 * Solid splash-colored overlay; cells punch transparent holes in seeded order
 * so the real application underlay becomes visible.
 */
"use client";

import { useEffect, useRef } from "react";

import {
  buildHuMatrixField,
  drawHexCell,
  type HuMatrixField,
} from "./hu-matrix-geometry";
import { PWA_LAUNCH_BACKDROP } from "./pwa-launch-constants";

export interface HuMatrixRevealProps {
  readonly progress: number;
  readonly seed: number;
  readonly active: boolean;
  readonly className?: string;
}

function paintFrame(
  ctx: CanvasRenderingContext2D,
  field: HuMatrixField,
  progress: number,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = PWA_LAUNCH_BACKDROP;
  ctx.fillRect(0, 0, width, height);

  // Mid/late network islands: subtle cool tint on cells that still remain.
  if (progress > 0.4) {
    for (const cell of field.cells) {
      if (progress >= cell.revealAt) {
        continue;
      }
      const boost = cell.clusterWeight * (1 - progress);
      if (boost < 0.12) {
        continue;
      }
      drawHexCell(
        ctx,
        cell,
        `rgba(1, 116, 176, ${0.08 + 0.28 * boost})`,
        1.02,
      );
    }
  }

  // Punch cleared cells so the live app shows through.
  ctx.globalCompositeOperation = "destination-out";
  for (const cell of field.cells) {
    if (progress < cell.revealAt) {
      continue;
    }
    drawHexCell(ctx, cell, "rgba(0,0,0,1)", 1.08);
  }
  ctx.globalCompositeOperation = "source-over";
}

export function HuMatrixReveal({
  progress,
  seed,
  active,
  className,
}: HuMatrixRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<HuMatrixField | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!active) {
      fieldRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const resize = () => {
      const parent = canvas.parentElement;
      const cssW = parent?.clientWidth || window.innerWidth;
      const cssH = parent?.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      sizeRef.current = { w: cssW, h: cssH, dpr };
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      fieldRef.current = buildHuMatrixField({
        width: cssW,
        height: cssH,
        seed,
      });
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintFrame(ctx, fieldRef.current, progressRef.current, cssW, cssH);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      fieldRef.current = null;
    };
  }, [active, seed]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const canvas = canvasRef.current;
    const field = fieldRef.current;
    if (!canvas || !field) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const { w, h, dpr } = sizeRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFrame(ctx, field, progress, w, h);
  }, [active, progress]);

  if (!active) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "hu-pwa-launch__matrix"}
      aria-hidden="true"
    />
  );
}

export { buildHuMatrixField };

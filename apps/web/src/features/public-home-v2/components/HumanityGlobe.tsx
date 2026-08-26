/**
 * Home hero Earth + orbital communication composition.
 * Pack: earth.gif core with lightweight SVG/CSS orbits (no WebGL).
 */
"use client";

import { HUMANITY_UNITY_EARTH_SRC } from "../hero-unity-visual.constants";

type OrbitLayer = "rear" | "front";

interface OrbitDef {
  readonly id: string;
  readonly rx: number;
  readonly ry: number;
  readonly rotate: number;
  readonly durationSec: number;
  readonly delaySec: number;
  readonly layer: OrbitLayer;
  /** Signal nodes on this orbit (fractional start offsets 0–1). */
  readonly nodes: readonly number[];
}

/**
 * ViewBox 0..100 centered at 50,50.
 * Earth GIF occupies ~60% of the composition (see CSS width).
 */
const ORBITS: readonly OrbitDef[] = [
  {
    id: "a",
    rx: 42,
    ry: 18,
    rotate: -28,
    durationSec: 38,
    delaySec: 0,
    layer: "rear",
    nodes: [0.05, 0.55],
  },
  {
    id: "b",
    rx: 38,
    ry: 22,
    rotate: 18,
    durationSec: 52,
    delaySec: -8,
    layer: "rear",
    nodes: [0.22],
  },
  {
    id: "c",
    rx: 44,
    ry: 16,
    rotate: 52,
    durationSec: 44,
    delaySec: -14,
    layer: "front",
    nodes: [0.12, 0.68],
  },
  {
    id: "d",
    rx: 36,
    ry: 26,
    rotate: -62,
    durationSec: 60,
    delaySec: -22,
    layer: "front",
    nodes: [0.4],
  },
] as const;

/** Short-lived communication chords (decorative, not data-driven). */
const COMM_LINES: readonly {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly delaySec: number;
  readonly layer: OrbitLayer;
}[] = [
  { x1: 22, y1: 38, x2: 48, y2: 28, delaySec: 0, layer: "rear" },
  { x1: 58, y1: 30, x2: 78, y2: 42, delaySec: 2.4, layer: "rear" },
  { x1: 28, y1: 62, x2: 55, y2: 70, delaySec: 1.1, layer: "front" },
  { x1: 62, y1: 66, x2: 80, y2: 52, delaySec: 3.6, layer: "front" },
];

function OrbitSvg({ layer }: { layer: OrbitLayer }) {
  const orbits = ORBITS.filter((orbit) => orbit.layer === layer);
  const lines = COMM_LINES.filter((line) => line.layer === layer);

  return (
    <svg
      className={`hero-unity-globe__svg hero-unity-globe__svg--${layer}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {orbits.map((orbit) => (
        <g
          key={orbit.id}
          className="hero-unity-globe__orbit-group"
          style={{
            // CSS custom properties drive per-orbit spin timing.
            ["--hero-orbit-duration" as string]: `${orbit.durationSec}s`,
            ["--hero-orbit-delay" as string]: `${orbit.delaySec}s`,
            transform: `rotate(${orbit.rotate}deg)`,
            transformOrigin: "50px 50px",
          }}
        >
          <ellipse
            className="hero-unity-globe__path"
            cx="50"
            cy="50"
            rx={orbit.rx}
            ry={orbit.ry}
            fill="none"
          />
          <g className="hero-unity-globe__spin">
            {orbit.nodes.map((offset, index) => {
              // Place node on the ellipse: approximate via angle on major circle then scale Y.
              const angle = offset * Math.PI * 2;
              const x = 50 + orbit.rx * Math.cos(angle);
              const y = 50 + orbit.ry * Math.sin(angle);
              return (
                <circle
                  key={`${orbit.id}-n${index}`}
                  className="hero-unity-globe__node"
                  cx={x}
                  cy={y}
                  r="1.35"
                />
              );
            })}
          </g>
        </g>
      ))}
      {lines.map((line, index) => (
        <line
          key={`${layer}-line-${index}`}
          className="hero-unity-globe__comm"
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          style={{
            ["--hero-comm-delay" as string]: `${line.delaySec}s`,
          }}
        />
      ))}
    </svg>
  );
}

export function HumanityGlobe() {
  return (
    <div className="hero-unity-globe" aria-hidden="true" data-hero-earth="gif">
      <div className="hero-unity-globe__layer hero-unity-globe__layer--rear">
        <OrbitSvg layer="rear" />
      </div>
      <div className="hero-unity-globe__earth">
        {/* Native GIF — no re-encode / duplicate asset */}
        <img
          className="hero-unity-globe__earth-img"
          src={HUMANITY_UNITY_EARTH_SRC}
          alt=""
          width={320}
          height={320}
          draggable={false}
          decoding="async"
        />
      </div>
      <div className="hero-unity-globe__layer hero-unity-globe__layer--front">
        <OrbitSvg layer="front" />
      </div>
    </div>
  );
}

/** Test seam — orbit definitions for density contracts. */
export const HERO_UNITY_ORBIT_DEFS = ORBITS;

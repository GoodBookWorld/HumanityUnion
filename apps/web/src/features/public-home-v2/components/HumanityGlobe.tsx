"use client";

import { useEffect, useRef, useState } from "react";
import {
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  QuadraticBezierCurve3,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

import {
  HUMANITY_GLOBE_INTERACTION,
  HUMANITY_UNITY_AMBER_HEX,
  HUMANITY_UNITY_ARC_COUNT,
  HUMANITY_UNITY_BLUE_HEX,
  HUMANITY_UNITY_GLOBE_RADIUS,
} from "../hero-unity-visual.constants";

/**
 * Pack 01.1 — geometry radius reduced ~15% from Pack 01 (28 → 23.8).
 * Continents removed: abstract ellipses were not recognizable; prefer clean
 * wireframe + communication arcs over inaccurate land spots.
 */
const GLOBE_RADIUS = HUMANITY_UNITY_GLOBE_RADIUS;

type ArcRuntime = {
  curve: QuadraticBezierCurve3;
  pulse: Mesh;
  progress: number;
  speed: number;
};

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

function randomPointOnSphere(radius: number, random: () => number): Vector3 {
  const phi = Math.acos(-1 + 2 * random());
  const theta = random() * Math.PI * 2;
  return new Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
  );
}

export function HumanityGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webGlAvailable, setWebGlAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setWebGlAvailable(supportsWebGl());
  }, []);

  useEffect(() => {
    if (webGlAvailable !== true) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const scene = new Scene();
    const camera = new PerspectiveCamera(40, 1, 0.1, 1000);
    camera.position.set(0, 0, 95);

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.style.pointerEvents = "none";
    container.appendChild(renderer.domElement);

    void HUMANITY_GLOBE_INTERACTION;

    const globeGroup = new Group();
    scene.add(globeGroup);

    // Subtle transparent shell (structure only — no continent map).
    const shellGeo = new SphereGeometry(GLOBE_RADIUS, 48, 48);
    const shellMat = new MeshBasicMaterial({
      color: HUMANITY_UNITY_BLUE_HEX,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    });
    const shellMesh = new Mesh(shellGeo, shellMat);
    globeGroup.add(shellMesh);

    const gridGeo = new SphereGeometry(GLOBE_RADIUS - 0.2, 28, 28);
    const gridMat = new MeshBasicMaterial({
      color: HUMANITY_UNITY_BLUE_HEX,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
    });
    const gridMesh = new Mesh(gridGeo, gridMat);
    globeGroup.add(gridMesh);

    const random = createSeededRandom(0x68756e31);
    const arcs: ArcRuntime[] = [];
    const disposables: Array<{ dispose: () => void }> = [
      shellGeo,
      shellMat,
      gridGeo,
      gridMat,
    ];

    for (let index = 0; index < HUMANITY_UNITY_ARC_COUNT; index += 1) {
      const start = randomPointOnSphere(GLOBE_RADIUS, random);
      const end = randomPointOnSphere(GLOBE_RADIUS, random);
      const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
      const distance = start.distanceTo(end);
      mid.normalize().multiplyScalar(GLOBE_RADIUS + distance * 0.25);

      const curve = new QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(40);
      const geometry = new BufferGeometry().setFromPoints(points);
      const material = new LineBasicMaterial({
        color: HUMANITY_UNITY_AMBER_HEX,
        transparent: true,
        opacity: 0.7,
      });
      const line = new Line(geometry, material);
      globeGroup.add(line);

      const pulseGeo = new SphereGeometry(0.85, 8, 8);
      const pulseMat = new MeshBasicMaterial({
        color: HUMANITY_UNITY_AMBER_HEX,
        transparent: true,
        opacity: 0.95,
      });
      const pulse = new Mesh(pulseGeo, pulseMat);
      globeGroup.add(pulse);

      arcs.push({
        curve,
        pulse,
        progress: random(),
        speed: prefersReducedMotion ? 0 : 0.0025 + random() * 0.0035,
      });

      disposables.push(geometry, material, pulseGeo, pulseMat);
    }

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(container);
    resize();

    let frameId = 0;
    let running = true;

    const tick = () => {
      if (!running) {
        return;
      }

      // Launch Readiness Pack 06 — stop scheduling RAF while the tab is hidden.
      if (document.visibilityState === "hidden") {
        frameId = 0;
        return;
      }

      frameId = window.requestAnimationFrame(tick);

      if (!prefersReducedMotion && HUMANITY_GLOBE_INTERACTION.autoRotate) {
        globeGroup.rotation.y += 0.0045;
      }

      if (!prefersReducedMotion) {
        for (const arc of arcs) {
          arc.progress += arc.speed;
          if (arc.progress > 1) {
            arc.progress = 0;
          }
          arc.pulse.position.copy(arc.curve.getPoint(arc.progress));
        }
      }

      renderer.render(scene, camera);
    };

    const resumeIfVisible = () => {
      if (!running || document.visibilityState !== "visible" || frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    document.addEventListener("visibilitychange", resumeIfVisible);
    tick();

    return () => {
      running = false;
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", resumeIfVisible);
      observer.disconnect();

      for (const item of disposables) {
        item.dispose();
      }

      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [webGlAvailable]);

  if (webGlAvailable === false) {
    return null;
  }

  return <div ref={containerRef} className="hero-unity-globe" aria-hidden="true" />;
}

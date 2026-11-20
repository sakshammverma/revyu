"use client";

import { useEffect, useRef } from "react";

/**
 * The WebGL layer behind the hero scene: a fine dot-matrix surface, tilted away
 * like a counter top, that breathes slowly. Each time the phone moves to its next
 * step a ripple spreads out from the standee and briefly lights the dots in the
 * brand blue: every scan sends a wave. Ink and blue only, nothing literal.
 *
 * Purely decorative, and an upgrade only: the CSS scene underneath is complete
 * without it. It never loads on a phone, a low-memory or low-core device, a
 * data-saver connection or under reduced motion, and it stops drawing whenever
 * the hero is off screen or the tab is hidden.
 */

type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

function capable(): boolean {
  const nav = navigator as Nav;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (!window.matchMedia("(min-width: 1024px)").matches) return false;
  if ((nav.hardwareConcurrency ?? 4) < 4) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  if (nav.connection?.saveData) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// Ripples alive at once; a new one replaces the oldest.
const RIPPLES = 4;

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2 uOrigin;
  uniform float uStarts[${RIPPLES}];
  uniform float uAmps[${RIPPLES}];
  varying float vGlow;
  varying float vFade;

  void main() {
    vec3 p = position;
    // A slow, low swell so the surface is never quite still.
    float swell = sin(p.x * 0.42 + uTime * 0.45) * cos(p.z * 0.36 - uTime * 0.32) * 0.14;

    // Rings travelling out from the standee.
    float d = distance(p.xz, uOrigin);
    float glow = 0.0;
    for (int i = 0; i < ${RIPPLES}; i++) {
      float age = uTime - uStarts[i];
      if (age < 0.0 || age > 4.2) continue;
      float radius = age * 3.6;
      float band = exp(-pow((d - radius) / 0.85, 2.0));
      glow += band * uAmps[i] * (1.0 - age / 4.2);
    }
    glow = clamp(glow, 0.0, 1.0);
    p.y += swell + glow * 0.32;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (2.6 + glow * 2.2) * uPixelRatio * (9.0 / -mv.z);

    vGlow = glow;
    // Fade into the distance and toward the sides, so the field has no edges.
    vFade = smoothstep(22.0, 9.0, -mv.z) * smoothstep(11.0, 5.5, abs(p.x));
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uAccent;
  varying float vGlow;
  varying float vFade;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.32, r);
    vec3 color = mix(uInk, uAccent, smoothstep(0.05, 0.6, vGlow));
    float alpha = disc * vFade * (0.3 + vGlow * 0.7);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

type Api = { pulse: (strength: number) => void; cleanup: () => void };

function mount(THREE: typeof import("three"), host: HTMLDivElement): Api {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  const eye = new THREE.Vector3(0, 4.6, 8.5);
  const look = new THREE.Vector3(0, -1.2, -4);
  camera.position.copy(eye);
  camera.lookAt(look);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  host.appendChild(renderer.domElement);

  // The surface: one grid of points, one draw call.
  const COLS = 88;
  const ROWS = 64;
  const STEP = 0.3;
  const positions = new Float32Array(COLS * ROWS * 3);
  let k = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      positions[k++] = (c - (COLS - 1) / 2) * STEP;
      positions[k++] = -1.6;
      positions[k++] = 3 - r * STEP;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    // Under the standee, bottom left of the stage.
    uOrigin: { value: new THREE.Vector2(-2.4, 0.6) },
    uStarts: { value: Array.from({ length: RIPPLES }, () => -100) },
    uAmps: { value: Array.from({ length: RIPPLES }, () => 0) },
    uInk: { value: new THREE.Color(0x1a1e23) },
    uAccent: { value: new THREE.Color(0x2f6df0) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  scene.add(new THREE.Points(geometry, material));

  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // Pointer parallax: the camera drifts a little, eased.
  const target = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => {
    target.x = e.clientX / window.innerWidth - 0.5;
    target.y = e.clientY / window.innerHeight - 0.5;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  let raf = 0;
  let running = false;
  let visible = true;
  const start = performance.now();
  const now = () => (performance.now() - start) / 1000;
  let next = 0;

  const pulse = (strength: number) => {
    uniforms.uStarts.value[next] = now();
    uniforms.uAmps.value[next] = strength;
    next = (next + 1) % RIPPLES;
  };

  const frame = () => {
    uniforms.uTime.value = now();
    camera.position.x += (eye.x + target.x * 0.9 - camera.position.x) * 0.04;
    camera.position.y += (eye.y - target.y * 0.5 - camera.position.y) * 0.04;
    camera.lookAt(look);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const sync = () => {
    const should = visible && !document.hidden;
    if (should && !running) {
      running = true;
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  });
  io.observe(host);
  document.addEventListener("visibilitychange", sync);
  sync();
  pulse(1);
  host.dataset.ready = "true";

  return {
    pulse,
    cleanup: () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointermove", onMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete host.dataset.ready;
    },
  };
}

/** `beat` changes whenever the phone moves on a step; `strong` marks the scan step. */
export function HeroCanvas({ beat, strong = false }: { beat: number; strong?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || !capable()) return;
    let cancelled = false;
    // After first paint and when the main thread is idle: never in the way of the headline.
    const load = () => {
      import("three").then((THREE) => {
        if (cancelled) return;
        try {
          api.current = mount(THREE, el);
        } catch {
          // No WebGL context after all: the CSS scene stands on its own.
        }
      });
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(load, { timeout: 2500 }) : window.setTimeout(load, 1200);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      api.current?.cleanup();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    api.current?.pulse(strong ? 1 : 0.55);
  }, [beat, strong]);

  return <div ref={host} aria-hidden className="hs-canvas" />;
}

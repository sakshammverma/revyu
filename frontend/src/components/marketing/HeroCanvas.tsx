"use client";

import { useEffect, useRef } from "react";

/**
 * The WebGL layer behind the hero scene: QR "pixels" and review stars drifting
 * in depth, lit in the brand blue. Purely decorative, and an upgrade only:
 * the CSS scene underneath is complete without it.
 *
 * It never loads on a phone, a low-memory or low-core device, a data-saver
 * connection or under reduced motion, and it stops drawing whenever the hero
 * is off screen or the tab is hidden.
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

function mount(THREE: typeof import("three"), host: HTMLDivElement): () => void {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.z = 9;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  host.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0x2f6df0, 60, 30);
  rim.position.set(-5, -2, 4);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  // Deterministic pseudo-random so the layout is the same on every visit.
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  // QR pixels: one instanced mesh, one draw call.
  const CUBES = 40;
  const cubeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const cubeMat = new THREE.MeshStandardMaterial({ color: 0x4f86ff, roughness: 0.35, metalness: 0.2 });
  const cubes = new THREE.InstancedMesh(cubeGeo, cubeMat, CUBES);
  const cubeData = Array.from({ length: CUBES }, () => ({
    x: (rnd() - 0.5) * 15,
    y: (rnd() - 0.5) * 9,
    z: -6 + rnd() * 5,
    s: 0.5 + rnd() * 0.9,
    speed: 0.15 + rnd() * 0.35,
    phase: rnd() * Math.PI * 2,
  }));
  group.add(cubes);

  // Review stars: a five-point shape with a soft bevel.
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.21;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
  starGeo.center();
  const starMat = new THREE.MeshStandardMaterial({ color: 0xffb53a, roughness: 0.45, metalness: 0.05, emissive: 0xf5a524, emissiveIntensity: 0.35 });
  // Stars sit in a ring around the phone and standee, never in front of them.
  const stars = Array.from({ length: 9 }, (_, i) => {
    const mesh = new THREE.Mesh(starGeo, starMat);
    const angle = (i / 9) * Math.PI * 2 + rnd() * 0.5;
    const base = { x: Math.cos(angle) * (4.6 + rnd() * 1.6), y: Math.sin(angle) * (2.9 + rnd() * 0.9), z: -3.5 + rnd() * 2.5 };
    mesh.position.set(base.x, base.y, base.z);
    mesh.scale.setScalar(0.4 + rnd() * 0.45);
    mesh.rotation.set(rnd() * 0.6, rnd() * Math.PI, rnd() * 0.6);
    group.add(mesh);
    return { mesh, base, speed: 0.2 + rnd() * 0.4, phase: rnd() * Math.PI * 2 };
  });

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

  // Pointer parallax, eased.
  const target = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => {
    target.x = e.clientX / window.innerWidth - 0.5;
    target.y = e.clientY / window.innerHeight - 0.5;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  const dummy = new THREE.Object3D();
  let raf = 0;
  let running = false;
  let visible = true;
  const start = performance.now();

  const frame = () => {
    const t = (performance.now() - start) / 1000;
    for (let i = 0; i < CUBES; i++) {
      const c = cubeData[i];
      dummy.position.set(c.x, c.y + Math.sin(t * c.speed + c.phase) * 0.35, c.z);
      dummy.rotation.set(t * c.speed * 0.6 + c.phase, t * c.speed * 0.4, 0);
      dummy.scale.setScalar(c.s);
      dummy.updateMatrix();
      cubes.setMatrixAt(i, dummy.matrix);
    }
    cubes.instanceMatrix.needsUpdate = true;
    for (const s of stars) {
      s.mesh.position.y = s.base.y + Math.sin(t * s.speed + s.phase) * 0.4;
      s.mesh.rotation.y += 0.004 + s.speed * 0.004;
    }
    group.rotation.y += (target.x * 0.35 - group.rotation.y) * 0.04;
    group.rotation.x += (target.y * 0.2 - group.rotation.x) * 0.04;
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
  host.dataset.ready = "true";

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("pointermove", onMove);
    cubeGeo.dispose();
    cubeMat.dispose();
    starGeo.dispose();
    starMat.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    delete host.dataset.ready;
  };
}

export function HeroCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || !capable()) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    // After first paint and when the main thread is idle: never in the way of the headline.
    const load = () => {
      import("three").then((THREE) => {
        if (cancelled) return;
        try {
          cleanup = mount(THREE, el);
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
      cleanup?.();
    };
  }, []);

  return <div ref={host} aria-hidden className="hs-canvas" />;
}

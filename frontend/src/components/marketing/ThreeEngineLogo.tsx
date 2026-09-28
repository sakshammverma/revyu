"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export function ThreeEngineLogo() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Compact, refined 220x220 canvas with reduced radius for a snug, jewel-like aesthetic
    const width = 220;
    const height = 220;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.z = 5.6;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // 1. Reduced-radius Delicate 3D Spirograph Curve
    const spiroPoints: THREE.Vector3[] = [];
    const R = 0.72;
    const r = 0.24;
    const p = 0.35;
    const totalPoints = 360 * 3;
    for (let i = 0; i <= totalPoints; i++) {
      const theta = (i * Math.PI) / 180;
      const x = (R - r) * Math.cos(theta) + p * Math.cos(((R - r) * theta) / r);
      const y = (R - r) * Math.sin(theta) - p * Math.sin(((R - r) * theta) / r);
      const z = Math.sin(theta * 6) * 0.08;
      spiroPoints.push(new THREE.Vector3(x, y, z));
    }
    const spiroGeo = new THREE.BufferGeometry().setFromPoints(spiroPoints);
    const spiroMat = new THREE.LineBasicMaterial({
      color: 0x397dff,
      transparent: true,
      opacity: 0.5,
      linewidth: 1,
    });
    const spiroLine = new THREE.Line(spiroGeo, spiroMat);
    mainGroup.add(spiroLine);

    // 2. Reduced-radius Gyroscopic Rings (Fine Swiss Horology)
    // Ring A (celestial blue)
    const ringAGeo = new THREE.TorusGeometry(0.92, 0.006, 16, 110);
    const ringAMat = new THREE.MeshBasicMaterial({
      color: 0x397dff,
      transparent: true,
      opacity: 0.4,
    });
    const ringA = new THREE.Mesh(ringAGeo, ringAMat);
    ringA.rotation.x = Math.PI / 3.8;
    mainGroup.add(ringA);

    // Ring B (emerald green)
    const ringBGeo = new THREE.TorusGeometry(0.78, 0.005, 16, 90);
    const ringBMat = new THREE.MeshBasicMaterial({
      color: 0x449127,
      transparent: true,
      opacity: 0.35,
    });
    const ringB = new THREE.Mesh(ringBGeo, ringBMat);
    ringB.rotation.y = Math.PI / 3.2;
    mainGroup.add(ringB);

    // Ring C (inner slate blue ring)
    const ringCGeo = new THREE.TorusGeometry(0.64, 0.005, 16, 80);
    const ringCMat = new THREE.MeshBasicMaterial({
      color: 0x2563eb,
      transparent: true,
      opacity: 0.45,
    });
    const ringC = new THREE.Mesh(ringCGeo, ringCMat);
    ringC.rotation.x = -Math.PI / 4.5;
    mainGroup.add(ringC);

    // 3. Subtle Orbiting Stardust Particles (Gold & Blue)
    const particleCount = 42;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const goldColor = new THREE.Color(0xf59e0b);
    const blueColor = new THREE.Color(0x397dff);

    for (let i = 0; i < particleCount; i++) {
      const radius = 0.48 + Math.random() * 0.42;
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.acos(2 * Math.random() - 1);

      particlePositions[i * 3] = radius * Math.sin(theta) * Math.cos(phi);
      particlePositions[i * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
      particlePositions[i * 3 + 2] = radius * Math.cos(theta);

      const color = Math.random() > 0.45 ? goldColor : blueColor;
      particleColors[i * 3] = color.r;
      particleColors[i * 3 + 1] = color.g;
      particleColors[i * 3 + 2] = color.b;
    }

    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );
    particlesGeo.setAttribute(
      "color",
      new THREE.BufferAttribute(particleColors, 3)
    );

    const particlesMat = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
    });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    mainGroup.add(particles);

    // Interactive mouse damping
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    function handleMouseMove(e: MouseEvent) {
      const rect = container?.getBoundingClientRect();
      if (!rect) return;
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotationY = mouseX * 0.25;
      targetRotationX = -mouseY * 0.25;
    }

    window.addEventListener("mousemove", handleMouseMove);

    let animId: number;
    let clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      spiroLine.rotation.z += delta * 0.22;
      ringA.rotation.z += delta * 0.25;
      ringA.rotation.x += delta * 0.12;
      ringB.rotation.y += delta * 0.2;
      ringB.rotation.z -= delta * 0.14;
      ringC.rotation.x -= delta * 0.16;
      ringC.rotation.y += delta * 0.12;
      particles.rotation.y += delta * 0.1;

      mainGroup.rotation.x += (targetRotationX - mainGroup.rotation.x) * 0.05;
      mainGroup.rotation.y += (targetRotationY - mainGroup.rotation.y) * 0.05;

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handleMouseMove);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      spiroGeo.dispose();
      spiroMat.dispose();
      ringAGeo.dispose();
      ringAMat.dispose();
      ringBGeo.dispose();
      ringBMat.dispose();
      ringCGeo.dispose();
      ringCMat.dispose();
      particlesGeo.dispose();
      particlesMat.dispose();
    };
  }, []);

  return (
    <div
      className="relative w-44 h-44 sm:w-48 sm:h-48 mx-auto -mb-1 flex items-center justify-center cursor-pointer select-none group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 3D WebGL Canvas Layer (Reduced radius, 220px) */}
      <div
        ref={mountRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible"
      />

      {/* Subtle Soft Ambient Glow */}
      <div
        className={`absolute w-20 h-20 rounded-full bg-[#397dff]/12 blur-lg transition-all duration-700 pointer-events-none ${
          isHovered ? "scale-115 opacity-60" : "scale-100 opacity-30"
        }`}
      />

      {/* Center Brand Emblem: EXACT NAVBAR LOGO IN BLACK COLOR (#1a1e23) */}
      <div className="relative z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white border border-[#e8ecec] shadow-[0_0_0_4px_rgba(255,255,255,0.96),0_4px_14px_rgba(15,30,97,0.08)] flex items-center justify-center group-hover:scale-105 group-hover:shadow-[0_0_0_5px_rgba(255,255,255,1),0_8px_20px_rgba(57,125,255,0.16)] transition-all duration-300">
        {/* Exact Revyu Spirograph Flower Logo from Navbar (BLACK COLOR #1a1e23) */}
        <svg
          className="w-5.5 h-5.5 sm:w-6 sm:h-6 text-[#1a1e23] transition-transform duration-500 group-hover:rotate-90"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2a4 4 0 0 0-4 4v12a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
          <path d="M22 12a4 4 0 0 0-4-4H6a4 4 0 0 0 0 8h12a4 4 0 0 0 4-4z" />
        </svg>
      </div>
    </div>
  );
}

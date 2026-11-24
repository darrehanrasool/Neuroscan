"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MRICase, PRELOADED_MRI_CASES } from "@/lib/mriData";
import {
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  Layers,
  Sparkles,
  Scissors,
  Crosshair,
  Monitor
} from "lucide-react";

interface Brain3DViewerProps {
  currentCase: MRICase;
  isProjectorStandalone?: boolean;
}

export const Brain3DViewer: React.FC<Brain3DViewerProps> = ({
  currentCase,
  isProjectorStandalone = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [clipY, setClipY] = useState(3.0); // clipping plane height (3.0 = no clip)
  const [brainOpacity, setBrainOpacity] = useState(0.35);
  const [showEdema, setShowEdema] = useState(true);
  const [activeCase, setActiveCase] = useState<MRICase>(currentCase);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const tumorGroupRef = useRef<THREE.Group | null>(null);
  const brainGroupRef = useRef<THREE.Group | null>(null);
  const clipPlaneRef = useRef<THREE.Plane | null>(null);

  // Sync with prop changes
  useEffect(() => {
    setActiveCase(currentCase);
  }, [currentCase]);

  // Sync across windows via BroadcastChannel (Laptop <-> Projector Screen)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const channel = new BroadcastChannel("neuroscan_projector_sync");

    channel.onmessage = (event) => {
      if (event.data?.type === "CASE_CHANGE") {
        const found = PRELOADED_MRI_CASES.find((c) => c.id === event.data.caseId);
        if (found) {
          setActiveCase(found);
        }
      } else if (event.data?.type === "AUTO_ROTATE") {
        setAutoRotate(event.data.value);
      } else if (event.data?.type === "CLIP_SLICE") {
        setClipY(event.data.value);
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  // Broadcast changes if in controller mode
  const broadcastCase = (c: MRICase) => {
    setActiveCase(c);
    if (typeof window !== "undefined") {
      const channel = new BroadcastChannel("neuroscan_projector_sync");
      channel.postMessage({ type: "CASE_CHANGE", caseId: c.id });
      channel.close();
    }
  };

  // Keyboard hotkeys for live presentation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === " ") {
        e.preventDefault();
        setAutoRotate((prev) => !prev);
      } else if (e.key === "1") {
        broadcastCase(PRELOADED_MRI_CASES[0]); // Glioma
      } else if (e.key === "2") {
        broadcastCase(PRELOADED_MRI_CASES[1]); // Meningioma
      } else if (e.key === "3") {
        broadcastCase(PRELOADED_MRI_CASES[2]); // Pituitary
      } else if (e.key === "4") {
        broadcastCase(PRELOADED_MRI_CASES[3]); // Healthy
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02040a); // Deep black space for high-contrast projector beam
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.5, 6.5);
    cameraRef.current = camera;

    // 2. Renderer with Clipping Planes & Antialiasing
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 3. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 14;
    controls.minDistance = 2.5;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.8;
    controlsRef.current = controls;

    // 4. Lights (Cyan & Blue surgical theater spotlights)
    const ambientLight = new THREE.AmbientLight(0x1a2b4c, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 2.0);
    dirLight1.position.set(5, 8, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x7928ca, 1.5);
    dirLight2.position.set(-5, -3, -5);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x38bdf8, 2.5, 10);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // 5. 3D Anatomical Brain Cortex Construction (Left & Right Hemispheres)
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY);
    clipPlaneRef.current = clipPlane;

    const brainGroup = new THREE.Group();
    brainGroupRef.current = brainGroup;
    scene.add(brainGroup);

    // Procedural Gyri-Sulci Cortex Geometry
    const buildHemisphere = (isLeft: boolean) => {
      const geo = new THREE.SphereGeometry(1.6, 64, 64);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();

      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);

        // Flatten medial side (interhemispheric fissure)
        if (isLeft && v.x < 0.05) v.x = Math.max(v.x, 0.02);
        if (!isLeft && v.x > -0.05) v.x = Math.min(v.x, -0.02);

        // Elongate anterior-posterior (frontal/occipital length)
        v.z *= 1.35;
        v.y *= 1.1;

        // Taper frontal and temporal poles
        if (v.z > 0.8) v.x *= 0.88;
        if (v.y < -0.4 && v.z > 0.1) v.x *= 1.05; // temporal lobe flare

        // Cerebellar recess
        if (v.z < -1.1 && v.y < -0.3) {
          v.y += 0.3;
        }

        // Procedural gyri & sulci sinusoidal folds
        const fold =
          Math.sin(v.x * 7.5) * Math.cos(v.y * 6.5) * Math.sin(v.z * 5.5) * 0.08 +
          Math.sin(v.x * 14.0 + v.y * 12.0) * 0.035;
        v.addScaledVector(v.clone().normalize(), fold);

        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();

      // Translucent Glassy Cortex Material with clipping
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x03254c,
        emissiveIntensity: 0.4,
        roughness: 0.15,
        metalness: 0.1,
        transmission: 0.82,
        thickness: 1.2,
        transparent: true,
        opacity: brainOpacity,
        clippingPlanes: [clipPlane],
        clipShadows: true,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = isLeft ? 0.08 : -0.08;

      // Subtle wireframe rim outline for projector holographic pop
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
        clippingPlanes: [clipPlane]
      });
      const wireMesh = new THREE.Mesh(geo, wireMat);
      wireMesh.position.copy(mesh.position);

      const hemiGroup = new THREE.Group();
      hemiGroup.add(mesh);
      hemiGroup.add(wireMesh);
      return hemiGroup;
    };

    brainGroup.add(buildHemisphere(true));
    brainGroup.add(buildHemisphere(false));

    // Brainstem & Cerebellum Anchor
    const stemGeo = new THREE.CylinderGeometry(0.3, 0.45, 1.2, 32);
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.4,
      transparent: true,
      opacity: 0.5,
      clippingPlanes: [clipPlane]
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.position.set(0, -1.5, -0.4);
    brainGroup.add(stemMesh);

    // 6. Tumor Group Container
    const tumorGroup = new THREE.Group();
    tumorGroupRef.current = tumorGroup;
    scene.add(tumorGroup);

    // 7. Grid Base Hologram Platform
    const grid = new THREE.GridHelper(12, 24, 0x00f0ff, 0x1e293b);
    grid.position.y = -2.2;
    scene.add(grid);

    // Concentric holographic rings
    const ringGeo = new THREE.RingGeometry(2.5, 2.55, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = -2.18;
    scene.add(ringMesh);

    // 8. Animation Render Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Orbit controls update
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Pulse Tumor and Edema
      if (tumorGroupRef.current) {
        tumorGroupRef.current.children.forEach((child, idx) => {
          if (child instanceof THREE.Mesh) {
            const pulse = 1.0 + Math.sin(elapsed * 3.0 + idx) * 0.05;
            child.scale.set(pulse, pulse, pulse);
            if (child.material && "emissiveIntensity" in child.material) {
              (child.material as any).emissiveIntensity = 0.8 + Math.sin(elapsed * 4.0) * 0.4;
            }
          }
        });
      }

      // Floating holographic grid animation
      ringMesh.rotation.z = elapsed * 0.15;

      renderer.render(scene, camera);
    };

    animate();

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, []);

  // Update Auto-Rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Update Brain Opacity & Clipping Plane
  useEffect(() => {
    if (clipPlaneRef.current) {
      clipPlaneRef.current.constant = clipY;
    }
    if (brainGroupRef.current) {
      brainGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material && "opacity" in child.material) {
          if (!(child.material as any).wireframe) {
            (child.material as any).opacity = brainOpacity;
          }
        }
      });
    }
  }, [clipY, brainOpacity]);

  // Rebuild / Position Pathological 3D Tumor based on activeCase
  useEffect(() => {
    if (!tumorGroupRef.current || !sceneRef.current) return;
    const group = tumorGroupRef.current;

    // Clear old tumor meshes
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }

    const cls = activeCase.classification.toLowerCase();

    if (cls === "glioma") {
      // High-Grade Glioblastoma: Irregular multi-nodular infiltrative mass in Right Frontotemporal Cortex
      const tumorPos = new THREE.Vector3(0.75, 0.45, 0.55);

      // Central Necrotic Core (dark red, irregular)
      const coreGeo = new THREE.DodecahedronGeometry(0.38, 3);
      // deform vertices to look biological
      const pos = coreGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        v.multiplyScalar(1.0 + Math.sin(v.x * 12 + v.y * 9) * 0.18);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      coreGeo.computeVertexNormals();

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xff1744,
        emissive: 0xd50000,
        emissiveIntensity: 0.9,
        roughness: 0.25,
        metalness: 0.3
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.copy(tumorPos);
      group.add(coreMesh);

      // Active Peripheral Enhancing Ring (hyperintense orange)
      const ringGeo = new THREE.IcosahedronGeometry(0.55, 3);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xff9100,
        emissive: 0xff6d00,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.65,
        roughness: 0.3
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(tumorPos);
      group.add(ringMesh);

      // Vasogenic Edema Cloud (T2/FLAIR hyperintensity - glowing green/cyan halo)
      if (showEdema) {
        const edemaGeo = new THREE.SphereGeometry(0.95, 32, 32);
        const edemaMat = new THREE.MeshPhysicalMaterial({
          color: 0x10b981,
          emissive: 0x059669,
          emissiveIntensity: 0.35,
          transmission: 0.85,
          transparent: true,
          opacity: 0.32,
          roughness: 0.4
        });
        const edemaMesh = new THREE.Mesh(edemaGeo, edemaMat);
        edemaMesh.position.copy(tumorPos);
        group.add(edemaMesh);
      }

      // Beacon coordinate callout line
      const lineMat = new THREE.LineBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.8 });
      const points = [tumorPos.clone(), new THREE.Vector3(tumorPos.x + 0.8, tumorPos.y + 1.2, tumorPos.z + 0.4)];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, lineMat);
      group.add(line);

    } else if (cls === "meningioma") {
      // Extra-axial dural-based mass attached to Left Parasagittal Convexity
      const tumorPos = new THREE.Vector3(-0.95, 0.95, -0.2);

      const menGeo = new THREE.SphereGeometry(0.48, 32, 32);
      // Flatten towards dura
      menGeo.scale(0.85, 1.15, 1.0);
      const menMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.2
      });
      const menMesh = new THREE.Mesh(menGeo, menMat);
      menMesh.position.copy(tumorPos);
      group.add(menMesh);

      // Pathognomonic Dural Tail (linear enhancing tail along convex dura)
      const tailCurve = new THREE.QuadraticBezierCurve3(
        tumorPos.clone(),
        new THREE.Vector3(tumorPos.x - 0.3, tumorPos.y + 0.35, tumorPos.z - 0.2),
        new THREE.Vector3(tumorPos.x - 0.5, tumorPos.y + 0.6, tumorPos.z - 0.35)
      );
      const tailGeo = new THREE.TubeGeometry(tailCurve, 20, 0.05, 8, false);
      const tailMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      const tailMesh = new THREE.Mesh(tailGeo, tailMat);
      group.add(tailMesh);

    } else if (cls === "pituitary") {
      // Sellar & Suprasellar Adenoma at Skull Base (Center Midline Base)
      const tumorPos = new THREE.Vector3(0.0, -0.85, 0.35);

      // Sellar Base Mass
      const sellaGeo = new THREE.SphereGeometry(0.32, 32, 32);
      sellaGeo.scale(1.2, 0.9, 1.0);
      const sellaMat = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 0.9,
        roughness: 0.3
      });
      const sellaMesh = new THREE.Mesh(sellaGeo, sellaMat);
      sellaMesh.position.copy(tumorPos);
      group.add(sellaMesh);

      // Suprasellar Waist (Snowman configuration extending towards optic chiasm)
      const upperGeo = new THREE.SphereGeometry(0.24, 32, 32);
      const upperMesh = new THREE.Mesh(upperGeo, sellaMat);
      upperMesh.position.set(tumorPos.x, tumorPos.y + 0.26, tumorPos.z + 0.05);
      group.add(upperMesh);

    } else {
      // Normal Healthy Brain: No neoplasm, add gentle anatomical ventricular glow
      const ventMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.25 });
      const ventGeo = new THREE.TorusGeometry(0.5, 0.06, 16, 32);
      const leftVent = new THREE.Mesh(ventGeo, ventMat);
      leftVent.position.set(0.3, 0.1, 0.0);
      leftVent.rotation.y = Math.PI / 4;
      group.add(leftVent);

      const rightVent = new THREE.Mesh(ventGeo, ventMat);
      rightVent.position.set(-0.3, 0.1, 0.0);
      rightVent.rotation.y = -Math.PI / 4;
      group.add(rightVent);
    }
  }, [activeCase, showEdema]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col ${
        isFullscreen || isProjectorStandalone ? "h-screen rounded-none border-none" : "h-[540px]"
      }`}
    >
      {/* Top HUD: Presentation & Projector Telemetry Overlay */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Active Neoplasm Diagnostic Pill */}
        <div className="pointer-events-auto flex items-center space-x-2.5 px-4 py-2 rounded-xl bg-slate-900/90 border border-cyan-500/40 backdrop-blur-md shadow-lg shadow-cyan-950/40">
          <span
            className={`w-3 h-3 rounded-full animate-ping ${
              activeCase.severity === "danger"
                ? "bg-red-400"
                : activeCase.severity === "warning"
                ? "bg-amber-400"
                : "bg-emerald-400"
            }`}
          />
          <div>
            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold flex items-center space-x-1.5">
              <Sparkles className="w-3 h-3" />
              <span>3D Holographic Projector Mode</span>
            </div>
            <h2 className="text-sm font-bold text-white font-serif">{activeCase.diagnosis}</h2>
          </div>
          <span className="ml-2 px-2 py-0.5 rounded bg-black/60 text-xs font-mono font-bold text-cyan-300 border border-slate-800">
            {activeCase.confidence}% Confidence
          </span>
        </div>

        {/* Presentation Controls Deck */}
        <div className="pointer-events-auto flex items-center space-x-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md">
          {/* Auto-Rotate Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle 360° Auto-Orbit (Spacebar)"
            className={`p-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center space-x-1.5 ${
              autoRotate ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">360° Orbit</span>
          </button>

          {/* Reset Camera */}
          <button
            onClick={() => {
              if (cameraRef.current && controlsRef.current) {
                cameraRef.current.position.set(0, 2.5, 6.5);
                controlsRef.current.target.set(0, 0, 0);
              }
            }}
            title="Reset Camera Orientation"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Edema Halo Toggle */}
          {activeCase.classification.toLowerCase() === "glioma" && (
            <button
              onClick={() => setShowEdema(!showEdema)}
              title="Toggle Vasogenic Edema Cloud"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                showEdema ? "bg-emerald-600/80 text-white font-bold" : "bg-slate-800 text-slate-400"
              }`}
            >
              Edema Halo
            </button>
          )}

          {/* Projector Window Launcher (Dual Display Mode) */}
          {!isProjectorStandalone && (
            <button
              onClick={() => {
                window.open("/projector", "NeuroscanProjector", "width=1280,height=720,menubar=no,toolbar=no");
              }}
              title="Launch Dual-Display Projector Window"
              className="p-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs flex items-center space-x-1 font-bold"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Projector Window</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title="Toggle True Fullscreen (Key 'F')"
            className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Bottom Floating Interactive Sliders (Cortex Opacity & 3D Axial Cross-Section Clipping Plane) */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Anatomical Coordinate HUD */}
        <div className="pointer-events-auto px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 backdrop-blur-md">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold mb-0.5">
            <Crosshair className="w-3 h-3" />
            <span>Target Centroid: {activeCase.brainRegion}</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {activeCase.tumorCentroid.radius > 0
              ? `Voxel Coordinates: [X: ${activeCase.tumorCentroid.x}, Y: ${activeCase.tumorCentroid.y}] • Area: ${activeCase.tumorAreaMm2} mm²`
              : "Normal Intracranial Symmetry • No Neoplastic Centroid"}
          </span>
        </div>

        {/* 3D Slicing Plane & Transparency Sliders */}
        <div className="pointer-events-auto flex items-center space-x-4 bg-slate-900/90 px-4 py-2 rounded-xl border border-slate-800 backdrop-blur-md text-xs font-mono">
          {/* Axial Cross-Section Cut */}
          <div className="flex items-center space-x-2">
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-300 hidden sm:inline">Axial Slice:</span>
            <input
              type="range"
              min="-1.5"
              max="2.5"
              step="0.05"
              value={clipY}
              onChange={(e) => setClipY(parseFloat(e.target.value))}
              className="w-24 accent-amber-400 cursor-pointer"
              title="Slice through brain cortex to reveal deep-seated tumors"
            />
            {clipY < 2.4 && (
              <button
                onClick={() => setClipY(3.0)}
                className="text-[10px] text-amber-400 underline ml-1 hover:text-amber-300"
              >
                Reset
              </button>
            )}
          </div>

          {/* Cortex Transparency */}
          <div className="flex items-center space-x-2">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300 hidden sm:inline">Brain Glass:</span>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.05"
              value={brainOpacity}
              onChange={(e) => setBrainOpacity(parseFloat(e.target.value))}
              className="w-20 accent-cyan-400 cursor-pointer"
              title="Adjust outer brain cortex translucency"
            />
          </div>
        </div>
      </div>

      {/* Projection Stage Watermark & Hotkey Guidance */}
      <div className="absolute top-20 right-4 z-10 text-right pointer-events-none opacity-40 font-mono text-[10px] text-slate-400 hidden md:block">
        <p>AUDITORIUM 3D PROJECTOR VIEW</p>
        <p>[F] Fullscreen • [Space] Orbit</p>
        <p>[1-4] Switch Pathology</p>
      </div>
    </div>
  );
};

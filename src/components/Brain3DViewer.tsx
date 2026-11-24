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
  const [activeCase, setActiveCase] = useState<MRICase>(currentCase);

  // Anatomical Layer Toggles
  const [showSkull, setShowSkull] = useState(false);
  const [showArteries, setShowArteries] = useState(true);
  const [showVentricles, setShowVentricles] = useState(true);
  const [showCortex, setShowCortex] = useState(true);
  const [showEdema, setShowEdema] = useState(true);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const tumorGroupRef = useRef<THREE.Group | null>(null);
  const brainGroupRef = useRef<THREE.Group | null>(null);
  const skullGroupRef = useRef<THREE.Group | null>(null);
  const arteryGroupRef = useRef<THREE.Group | null>(null);
  const ventricleGroupRef = useRef<THREE.Group | null>(null);
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

    // 4. Lights (Cyan & Surgical Blue spotlights)
    const ambientLight = new THREE.AmbientLight(0x1a2b4c, 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 2.2);
    dirLight1.position.set(5, 8, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x7928ca, 1.6);
    dirLight2.position.set(-5, -3, -5);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x38bdf8, 2.5, 10);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // 5. Clipping Plane for Axial Cross-Sectioning
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY);
    clipPlaneRef.current = clipPlane;

    // ==========================================
    // LAYER A: CRANIAL SKULL VAULT (CALVARIUM)
    // ==========================================
    const skullGroup = new THREE.Group();
    skullGroupRef.current = skullGroup;
    scene.add(skullGroup);

    const skullGeo = new THREE.SphereGeometry(1.92, 48, 48);
    skullGeo.scale(1.04, 1.12, 1.36);
    const skullMat = new THREE.MeshStandardMaterial({
      color: 0xede8d5, // Ivory bone color
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      clippingPlanes: [clipPlane],
      clipShadows: true,
    });
    const skullMesh = new THREE.Mesh(skullGeo, skullMat);
    skullMesh.position.set(0, 0.1, 0);
    skullGroup.add(skullMesh);

    // Cranial Suture Lines (Coronal & Sagittal Sutures)
    const suturePoints: THREE.Vector3[] = [];
    for (let theta = -Math.PI / 2; theta <= Math.PI / 2; theta += 0.06) {
      const y = Math.cos(theta) * 1.93 * 1.12 + 0.1;
      const z = Math.sin(theta) * 1.93 * 1.36;
      if (y > -0.15) suturePoints.push(new THREE.Vector3(0, y, z));
    }
    const sutureGeo = new THREE.BufferGeometry().setFromPoints(suturePoints);
    const sutureMat = new THREE.LineBasicMaterial({ color: 0xc4b89b, transparent: true, opacity: 0.45 });
    const sutureMesh = new THREE.Line(sutureGeo, sutureMat);
    skullGroup.add(sutureMesh);
    skullGroup.visible = showSkull;

    // ==========================================
    // LAYER B: CEREBRAL CORTEX (GYRI & SULCI)
    // ==========================================
    const brainGroup = new THREE.Group();
    brainGroupRef.current = brainGroup;
    scene.add(brainGroup);

    const buildHemisphere = (isLeft: boolean) => {
      const geo = new THREE.SphereGeometry(1.6, 64, 64);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();

      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);

        // Flatten medial interhemispheric fissure
        if (isLeft && v.x < 0.05) v.x = Math.max(v.x, 0.02);
        if (!isLeft && v.x > -0.05) v.x = Math.min(v.x, -0.02);

        // Elongate anterior-posterior (frontal to occipital pole)
        v.z *= 1.35;
        v.y *= 1.1;

        // Frontal & temporal tapering
        if (v.z > 0.8) v.x *= 0.88;
        if (v.y < -0.4 && v.z > 0.1) v.x *= 1.05; // temporal flare

        // Cerebellar recess
        if (v.z < -1.1 && v.y < -0.3) {
          v.y += 0.3;
        }

        // Procedural gyral convolutions & sulcal fissures
        const fold =
          Math.sin(v.x * 7.5) * Math.cos(v.y * 6.5) * Math.sin(v.z * 5.5) * 0.08 +
          Math.sin(v.x * 14.0 + v.y * 12.0) * 0.035;
        v.addScaledVector(v.clone().normalize(), fold);

        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();

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

    // Brainstem & Pons Anchor
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

    // Cerebellar folia (posterior fossa)
    const cerebGeo = new THREE.SphereGeometry(0.7, 32, 32);
    cerebGeo.scale(1.2, 0.8, 0.9);
    const cerebMat = new THREE.MeshStandardMaterial({
      color: 0x1e40af,
      roughness: 0.35,
      transparent: true,
      opacity: 0.55,
      clippingPlanes: [clipPlane]
    });
    const cerebMesh = new THREE.Mesh(cerebGeo, cerebMat);
    cerebMesh.position.set(0, -1.05, -1.0);
    brainGroup.add(cerebMesh);
    brainGroup.visible = showCortex;

    // ==========================================
    // LAYER C: CEREBRAL ARTERIAL TREE (CIRCLE OF WILLIS & MCAs)
    // ==========================================
    const arteryGroup = new THREE.Group();
    arteryGroupRef.current = arteryGroup;
    scene.add(arteryGroup);

    const arteryMat = new THREE.MeshStandardMaterial({
      color: 0xff1744, // Vivid crimson arterial blood
      emissive: 0xd50000,
      emissiveIntensity: 0.7,
      roughness: 0.25,
      metalness: 0.3,
      clippingPlanes: [clipPlane],
    });

    const createArteryBranch = (pts: THREE.Vector3[], radius = 0.035) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, radius, 8, false);
      const mesh = new THREE.Mesh(tubeGeo, arteryMat);
      arteryGroup.add(mesh);
    };

    // Basilar Artery (ascending ventral pons)
    createArteryBranch([
      new THREE.Vector3(0, -1.5, -0.35),
      new THREE.Vector3(0, -1.0, -0.25),
      new THREE.Vector3(0, -0.5, -0.15),
    ], 0.045);

    // Left & Right Internal Carotid Arteries (ICA) ascending from skull base
    createArteryBranch([
      new THREE.Vector3(-0.35, -1.4, 0.0),
      new THREE.Vector3(-0.32, -0.8, 0.05),
      new THREE.Vector3(-0.25, -0.4, 0.1),
    ], 0.045);

    createArteryBranch([
      new THREE.Vector3(0.35, -1.4, 0.0),
      new THREE.Vector3(0.32, -0.8, 0.05),
      new THREE.Vector3(0.25, -0.4, 0.1),
    ], 0.045);

    // Circle of Willis anastomotic ring
    createArteryBranch([
      new THREE.Vector3(-0.25, -0.4, 0.1),
      new THREE.Vector3(-0.15, -0.38, 0.22),
      new THREE.Vector3(0.15, -0.38, 0.22),
      new THREE.Vector3(0.25, -0.4, 0.1),
      new THREE.Vector3(0.15, -0.42, -0.05),
      new THREE.Vector3(0, -0.45, -0.12),
      new THREE.Vector3(-0.15, -0.42, -0.05),
      new THREE.Vector3(-0.25, -0.4, 0.1),
    ], 0.038);

    // Middle Cerebral Arteries (MCA - M1/M2 branches arching into Sylvian Fissures)
    createArteryBranch([
      new THREE.Vector3(-0.25, -0.4, 0.1),
      new THREE.Vector3(-0.65, -0.2, 0.25),
      new THREE.Vector3(-1.1, 0.05, 0.3),
      new THREE.Vector3(-1.3, 0.4, 0.15),
    ], 0.035);
    createArteryBranch([
      new THREE.Vector3(-1.1, 0.05, 0.3),
      new THREE.Vector3(-1.25, -0.2, 0.4),
    ], 0.025);

    // Right MCA (Notice: courses along right temporal lobe near Glioma centroid)
    createArteryBranch([
      new THREE.Vector3(0.25, -0.4, 0.1),
      new THREE.Vector3(0.65, -0.2, 0.25),
      new THREE.Vector3(1.1, 0.05, 0.3),
      new THREE.Vector3(1.3, 0.4, 0.15),
    ], 0.035);
    createArteryBranch([
      new THREE.Vector3(1.1, 0.05, 0.3),
      new THREE.Vector3(1.25, -0.2, 0.4),
    ], 0.025);

    // Anterior Cerebral Arteries (ACA - Pericallosal arching up midline)
    createArteryBranch([
      new THREE.Vector3(-0.15, -0.38, 0.22),
      new THREE.Vector3(-0.12, 0.2, 0.55),
      new THREE.Vector3(-0.1, 0.7, 0.4),
      new THREE.Vector3(-0.08, 0.9, -0.1),
    ], 0.032);

    createArteryBranch([
      new THREE.Vector3(0.15, -0.38, 0.22),
      new THREE.Vector3(0.12, 0.2, 0.55),
      new THREE.Vector3(0.1, 0.7, 0.4),
      new THREE.Vector3(0.08, 0.9, -0.1),
    ], 0.032);

    // Posterior Cerebral Arteries (PCA - wrapping around midbrain to occipital lobes)
    createArteryBranch([
      new THREE.Vector3(0, -0.45, -0.12),
      new THREE.Vector3(-0.35, -0.35, -0.45),
      new THREE.Vector3(-0.75, -0.2, -0.85),
    ], 0.032);

    createArteryBranch([
      new THREE.Vector3(0, -0.45, -0.12),
      new THREE.Vector3(0.35, -0.35, -0.45),
      new THREE.Vector3(0.75, -0.2, -0.85),
    ], 0.032);
    arteryGroup.visible = showArteries;

    // ==========================================
    // LAYER D: VENTRICULAR SYSTEM (LATERAL & 3RD VENTRICLES)
    // ==========================================
    const ventricleGroup = new THREE.Group();
    ventricleGroupRef.current = ventricleGroup;
    scene.add(ventricleGroup);

    const ventricleMat = new THREE.MeshPhysicalMaterial({
      color: 0x00e5ff,
      emissive: 0x0091ea,
      emissiveIntensity: 0.55,
      roughness: 0.15,
      transmission: 0.7,
      transparent: true,
      opacity: 0.75,
      clippingPlanes: [clipPlane],
    });

    const buildLateralVentricle = (isLeft: boolean) => {
      const sign = isLeft ? 1 : -1;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sign * 0.22, 0.25, 0.55), // Frontal horn
        new THREE.Vector3(sign * 0.28, 0.48, 0.15), // Body
        new THREE.Vector3(sign * 0.38, 0.32, -0.45), // Atrium / Trigone
        new THREE.Vector3(sign * 0.42, 0.15, -0.75), // Occipital horn
        new THREE.Vector3(sign * 0.52, -0.15, -0.1), // Temporal horn
      ]);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.085, 12, false);
      const mesh = new THREE.Mesh(tubeGeo, ventricleMat);
      ventricleGroup.add(mesh);
    };

    buildLateralVentricle(true);
    buildLateralVentricle(false);

    // 3rd Ventricle at midline
    const thirdVentGeo = new THREE.BoxGeometry(0.08, 0.35, 0.5);
    const thirdVentMesh = new THREE.Mesh(thirdVentGeo, ventricleMat);
    thirdVentMesh.position.set(0, 0.15, -0.05);
    ventricleGroup.add(thirdVentMesh);
    ventricleGroup.visible = showVentricles;

    // ==========================================
    // LAYER E: PATHOLOGICAL TUMOR MASS & EDEMA
    // ==========================================
    const tumorGroup = new THREE.Group();
    tumorGroupRef.current = tumorGroup;
    scene.add(tumorGroup);

    // Grid Base Hologram Platform
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

    // Animation Render Loop
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

  // Update Layer Visibility Toggles Live
  useEffect(() => {
    if (skullGroupRef.current) skullGroupRef.current.visible = showSkull;
  }, [showSkull]);

  useEffect(() => {
    if (arteryGroupRef.current) arteryGroupRef.current.visible = showArteries;
  }, [showArteries]);

  useEffect(() => {
    if (ventricleGroupRef.current) ventricleGroupRef.current.visible = showVentricles;
  }, [showVentricles]);

  useEffect(() => {
    if (brainGroupRef.current) brainGroupRef.current.visible = showCortex;
  }, [showCortex]);

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

      // Vasogenic Edema Cloud (T2/FLAIR hyperintensity - glowing green halo)
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

      // Coordinate callout line
      const lineMat = new THREE.LineBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.8 });
      const points = [tumorPos.clone(), new THREE.Vector3(tumorPos.x + 0.8, tumorPos.y + 1.2, tumorPos.z + 0.4)];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, lineMat);
      group.add(line);

    } else if (cls === "meningioma") {
      // Extra-axial dural-based mass attached to Left Parasagittal Convexity
      const tumorPos = new THREE.Vector3(-0.95, 0.95, -0.2);

      const menGeo = new THREE.SphereGeometry(0.48, 32, 32);
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

      // Pathognomonic Dural Tail
      const tailCurve = new THREE.QuadraticBezierCurve3(
        tumorPos.clone(),
        new THREE.Vector3(-1.15, 1.2, -0.3),
        new THREE.Vector3(-1.45, 1.35, -0.5)
      );
      const tailGeo = new THREE.TubeGeometry(tailCurve, 20, 0.04, 8, false);
      const tailMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.9
      });
      const tailMesh = new THREE.Mesh(tailGeo, tailMat);
      group.add(tailMesh);

    } else if (cls === "pituitary") {
      // Sellar / Suprasellar Dumbbell Mass at skull base
      const tumorPos = new THREE.Vector3(0.0, -0.35, 0.25);

      const pitGeo = new THREE.SphereGeometry(0.42, 32, 32);
      pitGeo.scale(1.0, 1.4, 0.9); // Vertical waist dumbbell
      const pitMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x7e22ce,
        emissiveIntensity: 0.85,
        roughness: 0.3
      });
      const pitMesh = new THREE.Mesh(pitGeo, pitMat);
      pitMesh.position.copy(tumorPos);
      group.add(pitMesh);

      // Optic Chiasm compression plane indicator
      const chiasmGeo = new THREE.BoxGeometry(0.8, 0.05, 0.2);
      const chiasmMat = new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xbe185d,
        emissiveIntensity: 0.6
      });
      const chiasmMesh = new THREE.Mesh(chiasmGeo, chiasmMat);
      chiasmMesh.position.set(0.0, -0.05, 0.32);
      group.add(chiasmMesh);

    } else {
      // Normal Brain: Clean baseline with Ventricular highlight
      const normGeo = new THREE.RingGeometry(0.3, 0.34, 32);
      const normMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
      const normMesh = new THREE.Mesh(normGeo, normMat);
      normMesh.position.set(0, 0, 0);
      group.add(normMesh);
    }
  }, [activeCase, showEdema]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${
        isProjectorStandalone ? "h-screen bg-black" : "h-[540px] bg-slate-950 rounded-2xl"
      } overflow-hidden select-none`}
    >
      {/* Top Floating Telemetry & Mode Indicator */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Diagnostic Badge */}
        <div className="pointer-events-auto flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-2xl">
          <div
            className={`w-3 h-3 rounded-full ${
              activeCase.severity === "danger"
                ? "bg-red-500 animate-ping"
                : activeCase.severity === "warning"
                ? "bg-amber-500 animate-pulse"
                : "bg-emerald-500"
            }`}
          />
          <div>
            <div className="text-[10px] font-mono text-cyan-400 flex items-center space-x-1">
              <Sparkles className="w-3 h-3" />
              <span>3D Holographic Projector Mode</span>
            </div>
            <h2 className="text-sm font-bold text-white font-serif">{activeCase.diagnosis}</h2>
          </div>
          <span className="ml-2 px-2 py-0.5 rounded bg-black/60 text-xs font-mono font-bold text-cyan-300 border border-slate-800">
            {activeCase.confidence}% Confidence
          </span>
        </div>

        {/* Anatomical Layer Selector Deck */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md">
          <span className="text-[10px] font-mono text-slate-400 px-1 hidden md:inline">LAYERS:</span>
          
          <button
            onClick={() => setShowSkull(!showSkull)}
            title="Toggle Cranial Vault / Skull Bone Calvarium"
            className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center space-x-1 ${
              showSkull ? "bg-amber-600 text-white font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <span>💀</span>
            <span>Skull</span>
          </button>

          <button
            onClick={() => setShowArteries(!showArteries)}
            title="Toggle Cerebral Arterial Tree (Circle of Willis & MCAs)"
            className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center space-x-1 ${
              showArteries ? "bg-red-600 text-white font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <span>🩸</span>
            <span>Arteries</span>
          </button>

          <button
            onClick={() => setShowCortex(!showCortex)}
            title="Toggle Cerebral Cortex & Parenchyma"
            className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center space-x-1 ${
              showCortex ? "bg-cyan-600 text-white font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <span>🧠</span>
            <span>Cortex</span>
          </button>

          <button
            onClick={() => setShowVentricles(!showVentricles)}
            title="Toggle Ventricular System (CSF)"
            className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center space-x-1 ${
              showVentricles ? "bg-blue-600 text-white font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <span>💧</span>
            <span>Ventricles</span>
          </button>

          {activeCase.classification.toLowerCase() === "glioma" && (
            <button
              onClick={() => setShowEdema(!showEdema)}
              title="Toggle Vasogenic Edema Cloud"
              className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center space-x-1 ${
                showEdema ? "bg-emerald-600 text-white font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span>🟢</span>
              <span>Edema</span>
            </button>
          )}
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
              <span className="hidden sm:inline">Projector</span>
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
              title="Slice through brain cortex & skull to reveal deep-seated tumors"
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

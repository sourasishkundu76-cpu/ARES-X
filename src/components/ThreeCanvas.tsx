import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Obstacle } from '../types';

interface ThreeCanvasProps {
  currentAngle: number;
  obstacles: Obstacle[];
  targetLocked: boolean;
  lockedTarget: Obstacle | null;
  cameraPreset: string;
  onResetPreset?: () => void;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  currentAngle,
  obstacles,
  targetLocked,
  lockedTarget,
  cameraPreset,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const scannerPivotRef = useRef<THREE.Group | null>(null);
  const responsePivotRef = useRef<THREE.Group | null>(null);
  const pointerRayMatRef = useRef<THREE.LineBasicMaterial | null>(null);
  const strobeLightRef = useRef<THREE.PointLight | null>(null);
  const strobeLensMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const waveRingsRef = useRef<{ mesh: THREE.Mesh; progress: number }[]>([]);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const lookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 4, 0));
  const targetCamPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 36, 48));
  const obstacleMeshesRef = useRef<Map<string, { mesh: THREE.Mesh; marker: THREE.Mesh }>>(new Map());

  // Handle Camera Presets
  useEffect(() => {
    if (!cameraRef.current) return;
    if (cameraPreset === 'OVERVIEW') {
      targetCamPos.current.set(0, 36, 48);
      lookAtRef.current.set(0, 3, 0);
    } else if (cameraPreset === 'TOP') {
      targetCamPos.current.set(0, 55, 0.1);
      lookAtRef.current.set(0, 0, 0);
    } else if (cameraPreset === 'FRONT') {
      targetCamPos.current.set(0, 10, 42);
      lookAtRef.current.set(0, 5, 0);
    } else if (cameraPreset === 'SIDE') {
      targetCamPos.current.set(45, 14, 0);
      lookAtRef.current.set(0, 5, 0);
    } else if (cameraPreset === 'RESET') {
      targetCamPos.current.set(0, 36, 48);
      lookAtRef.current.set(0, 4, 0);
    }
  }, [cameraPreset]);

  // Main Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 600;
    let height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    scene.fog = new THREE.FogExp2(0x0a0d14, 0.015);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 36, 48);
    camera.lookAt(lookAtRef.current);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Global Lighting
    const ambientLight = new THREE.AmbientLight(0xdde8ff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(25, 45, 30);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillCyan = new THREE.PointLight(0x00f0ff, 1.5, 60);
    fillCyan.position.set(-15, 12, 10);
    scene.add(fillCyan);

    const accentGreen = new THREE.PointLight(0x00ff9d, 1.2, 50);
    accentGreen.position.set(15, 8, -10);
    scene.add(accentGreen);

    // Ground Plane & Polar Floor Arcs
    const floorGroup = new THREE.Group();
    scene.add(floorGroup);

    const floorGeo = new THREE.PlaneGeometry(160, 160);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c1019,
      roughness: 0.85,
      metalness: 0.2,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.05;
    floorMesh.receiveShadow = true;
    floorGroup.add(floorMesh);

    const grid = new THREE.GridHelper(100, 50, 0x1f293d, 0x121722);
    grid.position.y = 0.01;
    floorGroup.add(grid);

    // Polar radar rings on floor (0 to 180 degrees)
    const cmScale = 0.8;
    const polarRings = [10, 20, 30, 40];
    const radarArcGroup = new THREE.Group();
    radarArcGroup.position.set(0, 0.05, 0);
    floorGroup.add(radarArcGroup);

    polarRings.forEach((rCm) => {
      const rUnits = rCm * cmScale;
      const curve = new THREE.EllipseCurve(0, 0, rUnits, rUnits, 0, Math.PI, false, 0);
      const pts = curve.getPoints(64);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0, -p.y)));
      const isPerimeter = rCm === 30;
      const lineMat = new THREE.LineBasicMaterial({
        color: isPerimeter ? 0xff3b69 : 0x00f0ff,
        transparent: true,
        opacity: isPerimeter ? 0.85 : 0.45,
      });
      radarArcGroup.add(new THREE.Line(lineGeo, lineMat));
    });

    // Radial spokes
    [0, 30, 60, 90, 120, 150, 180].forEach((deg) => {
      const rad = deg * (Math.PI / 180);
      const maxR = 40 * cmScale;
      const x = Math.cos(rad) * maxR;
      const z = -Math.sin(rad) * maxR;
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 0, z)];
      const radGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const radMat = new THREE.LineBasicMaterial({
        color: deg === 90 ? 0x00ff9d : 0x22354e,
        transparent: true,
        opacity: 0.6,
      });
      radarArcGroup.add(new THREE.Line(radGeo, radMat));
    });

    // Hardware Base Pedestal
    const rigGroup = new THREE.Group();
    scene.add(rigGroup);

    // Anodized aluminum base slab
    const baseSlabGeo = new THREE.BoxGeometry(14, 1.2, 14);
    const baseSlabMat = new THREE.MeshStandardMaterial({
      color: 0x1b2230,
      metalness: 0.8,
      roughness: 0.35,
    });
    const baseSlab = new THREE.Mesh(baseSlabGeo, baseSlabMat);
    baseSlab.position.y = 0.6;
    baseSlab.castShadow = true;
    baseSlab.receiveShadow = true;
    rigGroup.add(baseSlab);

    // Arduino MCU Board
    const mcuGeo = new THREE.BoxGeometry(6.8, 0.4, 5.3);
    const mcuMat = new THREE.MeshStandardMaterial({
      color: 0x00646e,
      roughness: 0.4,
      metalness: 0.3,
    });
    const mcuMesh = new THREE.Mesh(mcuGeo, mcuMat);
    mcuMesh.position.set(-2.8, 1.4, 3.2);
    mcuMesh.castShadow = true;
    rigGroup.add(mcuMesh);

    // ATmega328P DIP chip
    const chipGeo = new THREE.BoxGeometry(3.2, 0.25, 0.9);
    const chipMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.2, metalness: 0.8 });
    const chip = new THREE.Mesh(chipGeo, chipMat);
    chip.position.set(-2.8, 1.65, 3.2);
    rigGroup.add(chip);

    // USB Port
    const usbGeo = new THREE.BoxGeometry(1.2, 0.8, 1.0);
    const usbMat = new THREE.MeshStandardMaterial({ color: 0xc4cdd5, metalness: 0.9, roughness: 0.2 });
    const usbPort = new THREE.Mesh(usbGeo, usbMat);
    usbPort.position.set(-5.6, 1.7, 4.4);
    rigGroup.add(usbPort);

    // Breadboard
    const bbGeo = new THREE.BoxGeometry(4.5, 0.4, 8);
    const bbMat = new THREE.MeshStandardMaterial({ color: 0xe6eef8, roughness: 0.6 });
    const bbMesh = new THREE.Mesh(bbGeo, bbMat);
    bbMesh.position.set(3.8, 1.4, 1.8);
    bbMesh.castShadow = true;
    rigGroup.add(bbMesh);

    // Jumper wires
    const createWire = (p1: THREE.Vector3, p2: THREE.Vector3, col: number) => {
      const mid = new THREE.Vector3((p1.x + p2.x) * 0.5, Math.max(p1.y, p2.y) + 1.2, (p1.z + p2.z) * 0.5);
      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.08, 6, false);
      const tubeMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 });
      return new THREE.Mesh(tubeGeo, tubeMat);
    };
    rigGroup.add(createWire(new THREE.Vector3(-0.8, 1.5, 3.5), new THREE.Vector3(2.5, 1.5, 2.0), 0xff3b30));
    rigGroup.add(createWire(new THREE.Vector3(-0.8, 1.5, 3.8), new THREE.Vector3(2.5, 1.5, 2.3), 0x1f242d));
    rigGroup.add(createWire(new THREE.Vector3(-1.2, 1.5, 1.5), new THREE.Vector3(0, 3.5, 0.5), 0x00f0ff));
    rigGroup.add(createWire(new THREE.Vector3(-1.4, 1.5, 1.5), new THREE.Vector3(0, 3.5, -0.5), 0xffcc00));

    // Turret Tower
    const towerGeo = new THREE.CylinderGeometry(2.4, 2.8, 2.6, 24);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x222a38, metalness: 0.7, roughness: 0.3 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(0, 2.5, 0);
    tower.castShadow = true;
    rigGroup.add(tower);

    // MG996R Servo Body
    const servoGeo = new THREE.BoxGeometry(2.2, 2.6, 1.4);
    const servoMat = new THREE.MeshStandardMaterial({ color: 0x151922, roughness: 0.4, metalness: 0.6 });
    const servoMesh = new THREE.Mesh(servoGeo, servoMat);
    servoMesh.position.set(0, 4.2, 0);
    servoMesh.castShadow = true;
    rigGroup.add(servoMesh);

    // Brass shaft
    const shaftGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.6, 16);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(0, 5.7, 0);
    rigGroup.add(shaft);

    // ROTATING ASSEMBLY
    const scannerPivot = new THREE.Group();
    scannerPivot.position.set(0, 5.8, 0);
    scene.add(scannerPivot);
    scannerPivotRef.current = scannerPivot;

    // Servo Horn
    const hornGeo = new THREE.BoxGeometry(0.8, 0.3, 3.2);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xedf2f7, roughness: 0.3 });
    const horn = new THREE.Mesh(hornGeo, hornMat);
    horn.position.set(0, 0.15, 0);
    horn.castShadow = true;
    scannerPivot.add(horn);

    // Sensor Bracket
    const bracketGeo = new THREE.BoxGeometry(5.2, 0.25, 2.0);
    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x121721, metalness: 0.5, roughness: 0.3 });
    const bracket = new THREE.Mesh(bracketGeo, bracketMat);
    bracket.position.set(0, 0.4, 0);
    scannerPivot.add(bracket);

    // HC-SR04 Sensor PCB
    const hcPcbGeo = new THREE.BoxGeometry(4.8, 2.2, 0.2);
    const hcPcbMat = new THREE.MeshStandardMaterial({
      color: 0x0a4da6,
      roughness: 0.35,
      metalness: 0.25,
    });
    const hcPcb = new THREE.Mesh(hcPcbGeo, hcPcbMat);
    hcPcb.position.set(0, 1.6, -0.6);
    hcPcb.castShadow = true;
    scannerPivot.add(hcPcb);

    // Transducer Barrels
    const barrelGeo = new THREE.CylinderGeometry(0.82, 0.82, 1.2, 32);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xdfe5ec, metalness: 0.85, roughness: 0.2 });
    const meshMat = new THREE.MeshStandardMaterial({ color: 0x111620, roughness: 0.9 });

    const barrelT = new THREE.Mesh(barrelGeo, barrelMat);
    barrelT.rotation.x = Math.PI / 2;
    barrelT.position.set(-1.4, 1.6, -1.2);
    barrelT.castShadow = true;
    scannerPivot.add(barrelT);

    const innerMeshT = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), meshMat);
    innerMeshT.position.set(-1.4, 1.6, -1.81);
    innerMeshT.rotation.y = Math.PI;
    scannerPivot.add(innerMeshT);

    const barrelR = new THREE.Mesh(barrelGeo, barrelMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(1.4, 1.6, -1.2);
    barrelR.castShadow = true;
    scannerPivot.add(barrelR);

    const innerMeshR = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), meshMat);
    innerMeshR.position.set(1.4, 1.6, -1.81);
    innerMeshR.rotation.y = Math.PI;
    scannerPivot.add(innerMeshR);

    // Beam Cone Volume
    const beamLength = 40 * cmScale;
    const coneGeo = new THREE.ConeGeometry(8, beamLength, 32, 1, true);
    coneGeo.translate(0, -beamLength / 2, 0);
    coneGeo.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beamCone = new THREE.Mesh(coneGeo, beamMat);
    beamCone.position.set(0, 1.6, -1.8);
    scannerPivot.add(beamCone);

    // Wavefront Pulses
    const waveRings: { mesh: THREE.Mesh; progress: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const ringGeo = new THREE.RingGeometry(0.5, 0.7, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ff9d,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      scannerPivot.add(ringMesh);
      waveRings.push({ mesh: ringMesh, progress: i / 4 });
    }
    waveRingsRef.current = waveRings;

    // SAFE NON-PROJECTILE RESPONSE SYSTEM
    const responsePivot = new THREE.Group();
    responsePivot.position.set(0, 6.2, 0);
    scene.add(responsePivot);
    responsePivotRef.current = responsePivot;

    const strobeHeadGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.7, 16);
    const strobeHeadMat = new THREE.MeshStandardMaterial({ color: 0x222630, metalness: 0.8 });
    const strobeHead = new THREE.Mesh(strobeHeadGeo, strobeHeadMat);
    strobeHead.position.set(0, 2.2, 0);
    responsePivot.add(strobeHead);

    const strobeLensGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const strobeLensMat = new THREE.MeshStandardMaterial({
      color: 0x334455,
      emissive: 0x000000,
      roughness: 0.1,
    });
    const strobeLens = new THREE.Mesh(strobeLensGeo, strobeLensMat);
    strobeLens.position.set(0, 2.6, 0);
    responsePivot.add(strobeLens);
    strobeLensMatRef.current = strobeLensMat;

    const strobeLight = new THREE.PointLight(0xff3355, 0, 30);
    strobeLight.position.set(0, 2.8, 0);
    responsePivot.add(strobeLight);
    strobeLightRef.current = strobeLight;

    const pointerRayMat = new THREE.LineBasicMaterial({
      color: 0xff2a55,
      transparent: true,
      opacity: 0.0,
      linewidth: 2,
    });
    const pointerRayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 2.5, 0),
      new THREE.Vector3(0, 2.5, -30),
    ]);
    const pointerRay = new THREE.Line(pointerRayGeo, pointerRayMat);
    responsePivot.add(pointerRay);
    pointerRayMatRef.current = pointerRayMat;

    // Piezo Buzzer
    const piezoGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.8, 24);
    const piezoMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.6 });
    const piezo = new THREE.Mesh(piezoGeo, piezoMat);
    piezo.position.set(-4.2, 1.6, -2.4);
    piezo.castShadow = true;
    rigGroup.add(piezo);

    // Obstacle Mesh Management
    const obstacleGroup = new THREE.Group();
    scene.add(obstacleGroup);

    const renderObstacles = () => {
      // Clear old meshes
      obstacleMeshesRef.current.forEach(({ mesh }) => {
        obstacleGroup.remove(mesh);
      });
      obstacleMeshesRef.current.clear();

      obstacles.forEach((ob) => {
        const rad = ob.angleDeg * (Math.PI / 180);
        const distUnits = ob.distanceCm * cmScale;
        const posX = Math.cos(rad) * distUnits;
        const posZ = -Math.sin(rad) * distUnits;

        let geo: THREE.BufferGeometry;
        if (ob.id === 'B') {
          geo = new THREE.BoxGeometry(3.2, 5.0, 3.2);
        } else if (ob.id === 'C') {
          geo = new THREE.ConeGeometry(2.0, 5.5, 20);
        } else {
          geo = new THREE.CylinderGeometry(1.8, 1.8, 6.0, 24);
        }

        const mat = new THREE.MeshStandardMaterial({
          color: 0x243247,
          roughness: 0.3,
          metalness: 0.6,
        });

        const obMesh = new THREE.Mesh(geo, mat);
        obMesh.position.set(posX, 3.0, posZ);
        obMesh.castShadow = true;
        obMesh.receiveShadow = true;
        obstacleGroup.add(obMesh);

        // Halo ring
        const haloGeo = new THREE.RingGeometry(2.2, 2.5, 32);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = -2.8;
        obMesh.add(halo);

        obstacleMeshesRef.current.set(ob.id, { mesh: obMesh, marker: halo });
      });
    };

    renderObstacles();

    // Mouse Interaction (Orbit / Drag)
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    const spherical = { radius: 60, theta: Math.PI / 4, phi: Math.PI / 3 };

    const updateCameraSpherical = () => {
      camera.position.x = lookAtRef.current.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = lookAtRef.current.y + spherical.radius * Math.cos(spherical.phi);
      camera.position.z = lookAtRef.current.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(lookAtRef.current);
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      spherical.theta -= dx * 0.008;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi - dy * 0.008, 0.1, Math.PI / 2 - 0.05);
      updateCameraSpherical();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = THREE.MathUtils.clamp(spherical.radius + e.deltaY * 0.05, 12, 110);
      updateCameraSpherical();
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });

    // Animation Loop
    let animationFrameId: number;
    let strobeCounter = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);

      // Smooth camera interpolation towards target
      if (!isDragging) {
        camera.position.lerp(targetCamPos.current, 0.08);
        camera.lookAt(lookAtRef.current);
      }

      // Propagate acoustic wavefront pulses
      waveRingsRef.current.forEach((wr) => {
        wr.progress += delta * 1.8;
        if (wr.progress > 1.0) wr.progress -= 1.0;
        const d = wr.progress * beamLength;
        wr.mesh.position.z = -1.8 - d;
        const s = 0.5 + wr.progress * 4.5;
        wr.mesh.scale.set(s, s, s);
        (wr.mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(wr.progress * Math.PI) * 0.75;
      });

      // Strobe Pulse if engaged
      if (strobeLightRef.current && strobeLensMatRef.current) {
        strobeCounter += delta * 12;
        const pulse = Math.sin(strobeCounter) > 0 ? 1.0 : 0.0;
        if (pointerRayMatRef.current && pointerRayMatRef.current.opacity > 0) {
          strobeLightRef.current.intensity = pulse * 4.0;
          strobeLensMatRef.current.emissive.setHex(pulse ? 0xff2a55 : 0x000000);
        } else {
          strobeLightRef.current.intensity = 0;
          strobeLensMatRef.current.emissive.setHex(0x000000);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || 600;
      height = container.clientHeight || 480;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domEl.removeEventListener('wheel', onWheel);
      if (container && renderer.domElement) {
        container.innerHTML = '';
      }
      renderer.dispose();
    };
  }, [obstacles]);

  // Synchronize Scanner Rotation & Pointer Ray with props
  useEffect(() => {
    if (scannerPivotRef.current) {
      const sensorRad = (currentAngle - 90) * (Math.PI / 180);
      scannerPivotRef.current.rotation.y = -sensorRad;
    }

    if (responsePivotRef.current) {
      if (targetLocked && lockedTarget) {
        const targetRad = (lockedTarget.angleDeg - 90) * (Math.PI / 180);
        responsePivotRef.current.rotation.y = -targetRad;
        if (pointerRayMatRef.current) pointerRayMatRef.current.opacity = 0.95;
      } else {
        if (pointerRayMatRef.current) pointerRayMatRef.current.opacity = 0.0;
      }
    }

    // Highlight target obstacle
    obstacleMeshesRef.current.forEach(({ mesh, marker }, id) => {
      if (targetLocked && lockedTarget && lockedTarget.id === id) {
        (marker.material as THREE.MeshBasicMaterial).opacity = 0.9;
        (marker.material as THREE.MeshBasicMaterial).color.setHex(0xff3b69);
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(0x354b6e);
      } else {
        (marker.material as THREE.MeshBasicMaterial).opacity = 0.0;
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(0x243247);
      }
    });
  }, [currentAngle, targetLocked, lockedTarget]);

  return <div ref={mountRef} className="w-full h-full relative cursor-grab active:cursor-grabbing" />;
};

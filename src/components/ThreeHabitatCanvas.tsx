/**
 * 3D Multi-Habitat Digital Twin (Exterior, Cutaway & Walkable Internal View)
 * Supports all 7 habitats with distinct composite PBR assemblies & unique animations:
 * - iss (Destiny Lab), lunar (Artemis Base), mars (Chryse Outpost), spacecraft (Orion/ESM),
 *   rover (PRV-1 6x6), module (Columbus Lab), custom (Spin-Gravity Torus Ring)
 * - Software-WebGL detection & afterDraw() loop pacing
 * - Zero per-frame GC allocations, collapsible bottom dock, zero backdrop-filter over WebGL
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CategoryRiskScores,
  DetectedHazard,
  EnvironmentalTelemetry,
  FlameAnalysisResult,
  FlameImagingMode,
  FlameTestConfig,
  HabitatProfile,
  RiskClassification,
} from '../types/habitat';
import {
  buildHabitatSceneHandle,
  CameraPresetOption,
  HabitatAssemblyHandle,
  HabitatCameraTargets,
  TwinViewMode,
} from '../lib/habitatScenesBuilder';
import { analyzeFlameConditions, DEFAULT_FLAME_TEST_CONFIG } from '../lib/flamePhysics';
import { getAudioProfileForRisk, HazardAlarmController } from '../lib/hazardAudio';
import { getTelemetryMetricAccent } from '../lib/telemetryAccent';
import {
  Layers,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Compass,
  Box,
  Volume2,
  VolumeX,
  Megaphone,
  Sparkles,
  Flame,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';

interface Props {
  telemetry: EnvironmentalTelemetry;
  habitat: HabitatProfile;
  classification: RiskClassification;
  riskScore?: number;
  hazards?: DetectedHazard[];
  categoryScores?: CategoryRiskScores;
  onSelectSubsystem?: (subsystem: string) => void;
  globalAudioEnabled?: boolean;
  onToggleGlobalAudio?: () => void;
  onTriggerGlobalTestAlarm?: () => void;
  initialViewMode?: TwinViewMode;
  flameConfig?: FlameTestConfig;
  flameAnalysis?: FlameAnalysisResult;
  onUpdateFlameConfig?: (patch: Partial<FlameTestConfig>) => void;
  selfHealingActive?: boolean;
  selfHealingStatusLabel?: string;
  onOpenFlameLab?: () => void;
}

// Pre-allocated math scratchpads (zero GC in render loop)
const _lookTarget = new THREE.Vector3();
const _forwardDir = new THREE.Vector3();
const _rightDir = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _orbitCenter = new THREE.Vector3();
const _orbitFocusTarget = new THREE.Vector3();

let cachedIsSoftwareGl: boolean | null = null;
function detectIsSoftwareGl(): boolean {
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  let probeCanvas: HTMLCanvasElement | null = null;
  try {
    probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    cachedIsSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return cachedIsSoftwareGl;
  } catch {
    cachedIsSoftwareGl = true;
    return true;
  } finally {
    if (probeCanvas) {
      probeCanvas.width = 0;
      probeCanvas.height = 0;
    }
  }
}

export const ThreeHabitatCanvas: React.FC<Props> = ({
  telemetry,
  habitat,
  classification,
  riskScore = 12,
  hazards = [],
  categoryScores,
  onSelectSubsystem,
  globalAudioEnabled,
  onToggleGlobalAudio,
  onTriggerGlobalTestAlarm,
  initialViewMode = 'exterior',
  flameConfig,
  flameAnalysis,
  onUpdateFlameConfig,
  selfHealingActive = false,
  selfHealingStatusLabel,
  onOpenFlameLab,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<TwinViewMode>(initialViewMode);
  const [localFlameConfig, setLocalFlameConfig] = useState<FlameTestConfig>(DEFAULT_FLAME_TEST_CONFIG);
  const activeFlameConfig = flameConfig || localFlameConfig;
  const activeFlameAnalysis = useMemo(
    () => flameAnalysis || analyzeFlameConditions(activeFlameConfig),
    [flameAnalysis, activeFlameConfig]
  );
  const handleFlamePatch = (patch: Partial<FlameTestConfig>) => {
    if (onUpdateFlameConfig) {
      onUpdateFlameConfig(patch);
    } else {
      setLocalFlameConfig((prev) => ({ ...prev, ...patch }));
    }
  };
  const [explodedRatio, setExplodedRatio] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [activePreset, setActivePreset] = useState<string>('orbital');
  const [selectedPart, setSelectedPart] = useState<{ name: string; detail: string } | null>(null);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const audioEnabled = globalAudioEnabled !== undefined ? globalAudioEnabled : localAudioEnabled;
  const [presetOptions, setPresetOptions] = useState<{
    exterior: CameraPresetOption[];
    internal: CameraPresetOption[];
  }>({
    exterior: [
      { id: 'orbital', label: 'Orbital' },
      { id: 'docking', label: 'Docking' },
      { id: 'radiators', label: 'Radiators' },
      { id: 'cupola', label: 'Cupola' },
    ],
    internal: [
      { id: 'corridor', label: 'Corridor' },
      { id: 'eclss', label: 'ECLSS / OGS' },
      { id: 'console', label: 'Console' },
      { id: 'pdu', label: 'Avionics PDU' },
    ],
  });
  const [animationLabel, setAnimationLabel] = useState('Sun-Tracking Solar Arrays & IMV Airflow');
  const [badgeText, setBadgeText] = useState('ISS DIGITAL TWIN');
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const audioProfile = useMemo(
    () => getAudioProfileForRisk(classification, riskScore),
    [classification, riskScore]
  );

  // Refs shared with WebGL loop (prevents canvas remount on state updates)
  const handleRef = useRef<HabitatAssemblyHandle | null>(null);
  const sceneStageRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    sunLight: THREE.DirectionalLight;
    earthshine: THREE.HemisphereLight;
    earthLimb: THREE.Mesh;
    isSoftwareGl: boolean;
  } | null>(null);
  const alarmControllerRef = useRef<HazardAlarmController | null>(null);
  const introProgressRef = useRef<number>(0);

  const viewModeRef = useRef<TwinViewMode>(viewMode);
  viewModeRef.current = viewMode;
  const explodedRef = useRef(explodedRatio);
  explodedRef.current = explodedRatio;
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;
  const habitatRef = useRef(habitat);
  habitatRef.current = habitat;
  const classificationRef = useRef(classification);
  classificationRef.current = classification;
  const riskScoreRef = useRef(riskScore);
  riskScoreRef.current = riskScore;
  const hazardsRef = useRef(hazards);
  hazardsRef.current = hazards;
  const categoryScoresRef = useRef(categoryScores);
  categoryScoresRef.current = categoryScores;
  const audioEnabledRef = useRef(audioEnabled);
  audioEnabledRef.current = audioEnabled;
  const audioProfileRef = useRef(audioProfile);
  audioProfileRef.current = audioProfile;
  const onSelectSubsystemRef = useRef(onSelectSubsystem);
  onSelectSubsystemRef.current = onSelectSubsystem;
  const flameConfigRef = useRef(activeFlameConfig);
  flameConfigRef.current = activeFlameConfig;
  const flameAnalysisRef = useRef(activeFlameAnalysis);
  flameAnalysisRef.current = activeFlameAnalysis;
  const selfHealingRef = useRef(selfHealingActive);
  selfHealingRef.current = selfHealingActive;

  // Camera state refs for smooth damped presets & internal walkthrough
  const cameraTargetsRef = useRef<HabitatCameraTargets>({
    sphericalTarget: { radius: 22, theta: 0.72, phi: 1.08 },
    sphericalCurrent: { radius: 22, theta: 0.72, phi: 1.08 },
    lookTargetY: 0.3,
    orbitFocus: { x: 0, y: 0.3, z: 0 },
    internalPosTarget: { x: -2.6, y: 0.05, z: 0.0 },
    internalPosCurrent: { x: -2.6, y: 0.05, z: 0.0 },
    internalYawTarget: 0.0,
    internalYawCurrent: 0.0,
    internalPitchTarget: -0.04,
    internalPitchCurrent: -0.04,
    cutawayProgress: 0.0,
  });

  // Initialize & sync local Hazard Audio Controller only when not externally controlled by App.tsx
  const isExternallyControlled = Boolean(onToggleGlobalAudio);
  useEffect(() => {
    if (isExternallyControlled) return;
    const ctrl = new HazardAlarmController();
    alarmControllerRef.current = ctrl;

    const unlockAudio = () => {
      ctrl.unlock();
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      ctrl.dispose();
      alarmControllerRef.current = null;
    };
  }, [isExternallyControlled]);

  useEffect(() => {
    const ctrl = alarmControllerRef.current;
    if (!ctrl || isExternallyControlled) return;
    ctrl.setMuted(!audioEnabled);
    ctrl.update(classification, riskScore, hazards, telemetry);
  }, [audioEnabled, classification, riskScore, hazards, telemetry, isExternallyControlled]);

  // Update dynamic 3D console screen texture when telemetry/risk/audio changes
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.consoleScreen.update(
      telemetry,
      riskScore,
      classification,
      hazards,
      categoryScores,
      false,
      audioEnabled
    );
  }, [telemetry, riskScore, classification, hazards, categoryScores, audioEnabled]);

  // Mount WebGLRenderer & Render Loop ONCE (deferred 1 animation frame so initial UI paints immediately)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let bootCancelled = false;
    let cleanupScene: (() => void) | null = null;

    const bootRafId = window.requestAnimationFrame(() => {
      if (bootCancelled) return;
      const isSoftwareGl = detectIsSoftwareGl();

      const width = container.clientWidth || 800;
      const height = container.clientHeight || 480;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          alpha: false,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.shadowMap.enabled = !isSoftwareGl;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);
      } catch {
        setWebglUnavailable(true);
        return;
      }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.011);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 400);
    camera.position.set(14, 9, 14);

    let pmremEnvTex: THREE.Texture | null = null;
    if (!isSoftwareGl) {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremEnvTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = pmremEnvTex;
      pmremGenerator.dispose();
    } else {
      const softFill = new THREE.AmbientLight(0xcbd5e1, 0.55);
      scene.add(softFill);
    }

    const sunLight = new THREE.DirectionalLight(0xfff5e4, 3.1);
    sunLight.position.set(22, 28, 18);
    sunLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.left = -18;
      sunLight.shadow.camera.right = 18;
      sunLight.shadow.camera.top = 18;
      sunLight.shadow.camera.bottom = -18;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    const earthshine = new THREE.HemisphereLight(0x38bdf8, 0x0b1120, 0.95);
    scene.add(earthshine);

    // Starfield & Orbital Earth Limb
    const starCount = 550;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 55 + Math.random() * 55;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 0.28,
      transparent: true,
      opacity: 0.65,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    const earthGeo = new THREE.SphereGeometry(28, 36, 24);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x0c4a6e,
      emissive: 0x0369a1,
      emissiveIntensity: 0.42,
      roughness: 0.85,
      metalness: 0.05,
    });
    const earthLimb = new THREE.Mesh(earthGeo, earthMat);
    earthLimb.position.set(0, -37, -8);
    scene.add(earthLimb);

    sceneStageRef.current = {
      renderer,
      scene,
      sunLight,
      earthshine,
      earthLimb,
      isSoftwareGl,
    };

    // Build initial habitat handle
    const initialHandle = buildHabitatSceneHandle(habitatRef.current.type, renderer, isSoftwareGl);
    initialHandle.consoleScreen.update(
      telemetryRef.current,
      riskScoreRef.current,
      classificationRef.current,
      hazardsRef.current,
      categoryScoresRef.current,
      false,
      audioEnabledRef.current
    );
    scene.add(initialHandle.rootGroup);
    handleRef.current = initialHandle;
    const initMode = viewModeRef.current;
    const initPreset =
      initMode === 'flame_lab'
        ? 'flame_lab'
        : initMode === 'internal'
        ? initialHandle.defaultPresetId.internal
        : initialHandle.defaultPresetId.exterior;
    initialHandle.applyPreset(initPreset, cameraTargetsRef.current, initMode);
    if (initMode === 'flame_lab') {
      cameraTargetsRef.current.sphericalCurrent = { ...cameraTargetsRef.current.sphericalTarget };
    }
    setPresetOptions(initialHandle.presets);
    setActivePreset(initPreset);
    setAnimationLabel(initialHandle.animationLabel);
    setBadgeText(initialHandle.badgeText);

    const env = initialHandle.environment;
    (scene.background as THREE.Color).setHex(env.backgroundHex);
    (scene.fog as THREE.FogExp2).color.setHex(env.fogHex);
    (scene.fog as THREE.FogExp2).density = env.fogDensity;
    sunLight.color.setHex(env.sunColorHex);
    sunLight.intensity = env.sunIntensity;
    earthshine.color.setHex(env.hemiSkyHex);
    earthshine.groundColor.setHex(env.hemiGroundHex);
    earthshine.intensity = env.hemiIntensity;
    earthLimb.visible = env.showEarthLimb;

    if (initMode === 'flame_lab') {
      _orbitCenter.set(
        cameraTargetsRef.current.orbitFocus.x,
        cameraTargetsRef.current.orbitFocus.y,
        cameraTargetsRef.current.orbitFocus.z
      );
    } else {
      _orbitCenter.set(0, cameraTargetsRef.current.lookTargetY, 0);
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Input Handlers: Drag Orbit / Interior Look, Wheel Zoom, WASD/Arrows, Raycast Click
    const raycaster = new THREE.Raycaster();
    let isDragging = false;
    let dragDistance = 0;
    let prevX = 0;
    let prevY = 0;
    const pressedKeys = new Set<string>();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragDistance = 0;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      prevX = e.clientX;
      prevY = e.clientY;

      const camState = cameraTargetsRef.current;
      if (viewModeRef.current === 'internal') {
        camState.internalYawTarget -= dx * 0.0045;
        camState.internalPitchTarget = Math.max(
          -0.65,
          Math.min(0.65, camState.internalPitchTarget - dy * 0.0045)
        );
      } else {
        camState.sphericalTarget.theta -= dx * 0.008;
        camState.sphericalTarget.phi = Math.max(
          0.18,
          Math.min(Math.PI - 0.18, camState.sphericalTarget.phi - dy * 0.008)
        );
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      const activeHandle = handleRef.current;
      if (isDragging && dragDistance < 5 && activeHandle) {
        const rect = renderer.domElement.getBoundingClientRect();
        _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(_pointerNdc, camera);
        const hits = raycaster.intersectObjects(activeHandle.interactables, true);
        if (hits.length > 0) {
          let curr: THREE.Object3D | null = hits[0].object;
          while (curr && !curr.userData?.subsystemName) {
            curr = curr.parent;
          }
          if (curr?.userData?.subsystemName) {
            setSelectedPart({
              name: curr.userData.subsystemName,
              detail: curr.userData.subsystemDetail,
            });
            onSelectSubsystemRef.current?.(curr.userData.subsystemName);
          }
        }
      }
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const camState = cameraTargetsRef.current;
      const activeHandle = handleRef.current;
      if (viewModeRef.current === 'internal' && activeHandle) {
        const step = -Math.sign(e.deltaY) * 0.45;
        const b = activeHandle.internalBounds;
        camState.internalPosTarget.x = Math.max(
          b.minX,
          Math.min(b.maxX, camState.internalPosTarget.x + Math.cos(camState.internalYawTarget) * step)
        );
        return;
      }
      const minZoom = viewModeRef.current === 'flame_lab' ? 0.9 : 6;
      const maxZoom = viewModeRef.current === 'flame_lab' ? 6.5 : 44;
      const zoomStep = viewModeRef.current === 'flame_lab' ? e.deltaY * 0.0035 : e.deltaY * 0.025;
      camState.sphericalTarget.radius = Math.max(
        minZoom,
        Math.min(maxZoom, camState.sphericalTarget.radius + zoomStep)
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      pressedKeys.add(e.key.toLowerCase());
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key.toLowerCase());
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Paced Render Loop (performance.now delta + clean unmount guard)
    let isDisposed = false;
    let rafId = 0;
    let timeoutId = 0;
    let activeSync: WebGLSync | null = null;
    let elapsed = 0;
    let prevFlashState = false;
    let lastTickMs = performance.now();

    function afterDraw(cb: () => void) {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync !== 'function') {
        timeoutId = window.setTimeout(() => {
          if (!isDisposed) cb();
        }, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      activeSync = sync;
      gl.flush();
      const poll = () => {
        if (isDisposed) {
          if (sync) {
            gl.deleteSync(sync);
            if (activeSync === sync) activeSync = null;
          }
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          timeoutId = window.setTimeout(poll, 5);
        } else {
          if (sync) {
            gl.deleteSync(sync);
            if (activeSync === sync) activeSync = null;
          }
          timeoutId = window.setTimeout(() => {
            if (!isDisposed) cb();
          }, 80);
        }
      };
      timeoutId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const nowMs = performance.now();
      const dt = Math.min(0.1, Math.max(0.001, (nowMs - lastTickMs) / 1000));
      lastTickMs = nowMs;
      elapsed += dt;
      introProgressRef.current = Math.min(1, introProgressRef.current + dt * 1.15);

      const camState = cameraTargetsRef.current;
      const mode = viewModeRef.current;
      const activeHandle = handleRef.current;

      // Smooth cutaway damping
      const targetCutaway = mode === 'cutaway' ? 1 : 0;
      camState.cutawayProgress = THREE.MathUtils.damp(
        camState.cutawayProgress,
        targetCutaway,
        5.0,
        dt
      );

      // Strobe sync
      const curClass = classificationRef.current;
      const curAudioProf = audioProfileRef.current;
      const flashOn =
        curAudioProf.flashRateHz > 0 &&
        Math.sin(elapsed * curAudioProf.flashRateHz * Math.PI * 2) > 0;

      if (activeHandle) {
        if (flashOn !== prevFlashState) {
          prevFlashState = flashOn;
          activeHandle.consoleScreen.update(
            telemetryRef.current,
            riskScoreRef.current,
            curClass,
            hazardsRef.current,
            categoryScoresRef.current,
            flashOn,
            audioEnabledRef.current
          );
        }

        activeHandle.update(dt, elapsed, {
          telemetry: telemetryRef.current,
          habitat: habitatRef.current,
          classification: curClass,
          riskScore: riskScoreRef.current,
          hazards: hazardsRef.current,
          categoryScores: categoryScoresRef.current,
          viewMode: mode,
          explodedRatio: explodedRef.current,
          cutawayProgress: camState.cutawayProgress,
          flashOn,
          audioEnabled: audioEnabledRef.current,
          introProgress: introProgressRef.current,
          flameConfig: flameConfigRef.current,
          flameAnalysis: flameAnalysisRef.current,
          selfHealingActive: selfHealingRef.current,
        });
      }

      // Camera Kinematics (Internal Walkthrough vs External/Cutaway/Flame-Lab Orbit)
      if (mode === 'internal' && activeHandle) {
        const moveSpeed = dt * 2.2;
        const b = activeHandle.internalBounds;
        _forwardDir.set(Math.cos(camState.internalYawTarget), 0, Math.sin(camState.internalYawTarget));
        _rightDir.set(-Math.sin(camState.internalYawTarget), 0, Math.cos(camState.internalYawTarget));

        if (pressedKeys.has('w') || pressedKeys.has('arrowup')) {
          camState.internalPosTarget.x += _forwardDir.x * moveSpeed;
          camState.internalPosTarget.z += _forwardDir.z * moveSpeed;
        }
        if (pressedKeys.has('s') || pressedKeys.has('arrowdown')) {
          camState.internalPosTarget.x -= _forwardDir.x * moveSpeed;
          camState.internalPosTarget.z -= _forwardDir.z * moveSpeed;
        }
        if (pressedKeys.has('d') || pressedKeys.has('arrowright')) {
          camState.internalPosTarget.x += _rightDir.x * moveSpeed;
          camState.internalPosTarget.z += _rightDir.z * moveSpeed;
        }
        if (pressedKeys.has('a') || pressedKeys.has('arrowleft')) {
          camState.internalPosTarget.x -= _rightDir.x * moveSpeed;
          camState.internalPosTarget.z -= _rightDir.z * moveSpeed;
        }

        camState.internalPosTarget.x = Math.max(b.minX, Math.min(b.maxX, camState.internalPosTarget.x));
        camState.internalPosTarget.z = Math.max(b.minZ, Math.min(b.maxZ, camState.internalPosTarget.z));

        camState.internalPosCurrent.x = THREE.MathUtils.damp(camState.internalPosCurrent.x, camState.internalPosTarget.x, 7.0, dt);
        camState.internalPosCurrent.y = THREE.MathUtils.damp(camState.internalPosCurrent.y, camState.internalPosTarget.y, 7.0, dt);
        camState.internalPosCurrent.z = THREE.MathUtils.damp(camState.internalPosCurrent.z, camState.internalPosTarget.z, 7.0, dt);
        camState.internalYawCurrent = THREE.MathUtils.damp(camState.internalYawCurrent, camState.internalYawTarget, 8.0, dt);
        camState.internalPitchCurrent = THREE.MathUtils.damp(camState.internalPitchCurrent, camState.internalPitchTarget, 8.0, dt);

        camera.position.set(
          camState.internalPosCurrent.x,
          camState.internalPosCurrent.y,
          camState.internalPosCurrent.z
        );
        _lookTarget.set(
          camera.position.x + Math.cos(camState.internalYawCurrent) * Math.cos(camState.internalPitchCurrent) * 3.0,
          camera.position.y + Math.sin(camState.internalPitchCurrent) * 3.0,
          camera.position.z + Math.sin(camState.internalYawCurrent) * Math.cos(camState.internalPitchCurrent) * 3.0
        );
        camera.lookAt(_lookTarget);
      } else {
        if (autoRotateRef.current && !isDragging && !isSoftwareGl && mode !== 'flame_lab') {
          camState.sphericalTarget.theta += dt * 0.16;
        }

        camState.sphericalCurrent.radius = THREE.MathUtils.damp(camState.sphericalCurrent.radius, camState.sphericalTarget.radius, 5.5, dt);
        camState.sphericalCurrent.theta = THREE.MathUtils.damp(camState.sphericalCurrent.theta, camState.sphericalTarget.theta, 5.5, dt);
        camState.sphericalCurrent.phi = THREE.MathUtils.damp(camState.sphericalCurrent.phi, camState.sphericalTarget.phi, 5.5, dt);

        const r = camState.sphericalCurrent.radius;
        const phi = camState.sphericalCurrent.phi;
        const theta = camState.sphericalCurrent.theta;

        if (mode === 'flame_lab') {
          _orbitFocusTarget.set(camState.orbitFocus.x, camState.orbitFocus.y, camState.orbitFocus.z);
        } else {
          _orbitFocusTarget.set(0, camState.lookTargetY, 0);
        }
        _orbitCenter.set(
          THREE.MathUtils.damp(_orbitCenter.x, _orbitFocusTarget.x, 6.0, dt),
          THREE.MathUtils.damp(_orbitCenter.y, _orbitFocusTarget.y, 6.0, dt),
          THREE.MathUtils.damp(_orbitCenter.z, _orbitFocusTarget.z, 6.0, dt)
        );

        camera.position.set(
          _orbitCenter.x + r * Math.sin(phi) * Math.cos(theta),
          _orbitCenter.y + r * Math.cos(phi),
          _orbitCenter.z + r * Math.sin(phi) * Math.sin(theta)
        );
        camera.lookAt(_orbitCenter);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container || isDisposed) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);

    cleanupScene = () => {
      isDisposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      if (activeSync) {
        try {
          const gl = renderer.getContext() as WebGL2RenderingContext;
          gl.deleteSync(activeSync);
        } catch {
          // Ignore already-lost WebGL context
        }
        activeSync = null;
      }
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);

      if (handleRef.current) {
        scene.remove(handleRef.current.rootGroup);
        handleRef.current.dispose();
        handleRef.current = null;
      }
      if (pmremEnvTex) {
        scene.environment = null;
        pmremEnvTex.dispose();
        pmremEnvTex = null;
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      starGeo.dispose();
      starMat.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      sceneStageRef.current = null;
    };
    });

    return () => {
      bootCancelled = true;
      window.cancelAnimationFrame(bootRafId);
      cleanupScene?.();
    };
  }, []);

  // Hot-Swap Habitat Assembly & Environment whenever `habitat.type` changes
  useEffect(() => {
    const stage = sceneStageRef.current;
    if (!stage) return;

    const currentHandle = handleRef.current;
    if (currentHandle && currentHandle.habitatType === habitat.type) {
      return;
    }

    if (currentHandle) {
      stage.scene.remove(currentHandle.rootGroup);
      currentHandle.dispose();
    }

    const nextHandle = buildHabitatSceneHandle(habitat.type, stage.renderer, stage.isSoftwareGl);
    nextHandle.consoleScreen.update(
      telemetryRef.current,
      riskScoreRef.current,
      classificationRef.current,
      hazardsRef.current,
      categoryScoresRef.current,
      false,
      audioEnabledRef.current
    );
    stage.scene.add(nextHandle.rootGroup);
    handleRef.current = nextHandle;

    // Reset entry animation progress & update environment lighting/backdrop
    introProgressRef.current = 0;
    const env = nextHandle.environment;
    (stage.scene.background as THREE.Color).setHex(env.backgroundHex);
    (stage.scene.fog as THREE.FogExp2).color.setHex(env.fogHex);
    (stage.scene.fog as THREE.FogExp2).density = env.fogDensity;
    stage.sunLight.color.setHex(env.sunColorHex);
    stage.sunLight.intensity = env.sunIntensity;
    stage.earthshine.color.setHex(env.hemiSkyHex);
    stage.earthshine.groundColor.setHex(env.hemiGroundHex);
    stage.earthshine.intensity = env.hemiIntensity;
    stage.earthLimb.visible = env.showEarthLimb;

    // Frame the newly selected habitat smoothly (keeping flame_lab if already in flame_lab)
    setSelectedPart(null);
    const preserveFlame = viewModeRef.current === 'flame_lab';
    const nextViewMode: TwinViewMode = preserveFlame ? 'flame_lab' : 'exterior';
    setViewMode(nextViewMode);
    setExplodedRatio(0);
    setPresetOptions(nextHandle.presets);
    const nextPresetId = preserveFlame ? 'flame_lab' : nextHandle.defaultPresetId.exterior;
    setActivePreset(nextPresetId);
    setAnimationLabel(nextHandle.animationLabel);
    setBadgeText(nextHandle.badgeText);

    if (!preserveFlame) {
      cameraTargetsRef.current.sphericalCurrent.radius += 5.5;
      cameraTargetsRef.current.sphericalCurrent.theta -= 0.45;
    }
    nextHandle.applyPreset(nextPresetId, cameraTargetsRef.current, nextViewMode);
  }, [habitat.type]);

  // View Mode Switcher (Exterior | Cutaway | Internal | Flame Lab)
  const switchViewMode = (nextMode: TwinViewMode) => {
    setViewMode(nextMode);
    const activeHandle = handleRef.current;
    if (!activeHandle) return;
    const camState = cameraTargetsRef.current;

    if (nextMode === 'flame_lab') {
      setAutoRotate(false);
      setActivePreset('flame_lab');
      activeHandle.applyPreset('flame_lab', camState, 'flame_lab');
    } else if (nextMode === 'internal') {
      setAutoRotate(false);
      const defInt = activeHandle.defaultPresetId.internal;
      setActivePreset(defInt);
      activeHandle.applyPreset(defInt, camState, 'internal');
      camState.internalPosCurrent = { ...camState.internalPosTarget };
      camState.internalYawCurrent = camState.internalYawTarget;
      camState.internalPitchCurrent = camState.internalPitchTarget;
    } else if (nextMode === 'cutaway') {
      setAutoRotate(false);
      const defExt = activeHandle.defaultPresetId.exterior;
      setActivePreset(defExt);
      activeHandle.applyPreset(defExt, camState, 'cutaway');
      camState.sphericalTarget.radius = Math.max(9.5, camState.sphericalTarget.radius * 0.78);
    } else {
      const defExt = activeHandle.defaultPresetId.exterior;
      setActivePreset(defExt);
      activeHandle.applyPreset(defExt, camState, 'exterior');
    }
  };

  // Context-Aware Camera Presets
  const applyPreset = (presetId: string) => {
    setActivePreset(presetId);
    const activeHandle = handleRef.current;
    if (!activeHandle) return;
    const isInternalPreset = activeHandle.presets.internal.some((p) => p.id === presetId);
    const targetMode: TwinViewMode = isInternalPreset ? 'internal' : viewMode === 'cutaway' ? 'cutaway' : 'exterior';
    if (isInternalPreset) {
      setViewMode('internal');
      setAutoRotate(false);
    } else {
      if (viewMode === 'internal') setViewMode('exterior');
      if (presetId !== activeHandle.defaultPresetId.exterior) {
        setAutoRotate(false);
      }
    }
    activeHandle.applyPreset(presetId, cameraTargetsRef.current, targetMode);
  };

  const alarmStrobeClass =
    classification === 'extreme_emergency'
      ? 'alarm-strobe-extreme'
      : classification === 'critical'
      ? 'alarm-strobe-critical'
      : classification === 'high_risk'
      ? 'alarm-strobe-high'
      : classification === 'caution'
      ? 'alarm-strobe-caution'
      : '';

  const isDangerActive = classification !== 'normal';

  const handleToggleAudio = () => {
    if (onToggleGlobalAudio) {
      onToggleGlobalAudio();
      return;
    }
    const next = !localAudioEnabled;
    setLocalAudioEnabled(next);
    if (next) {
      alarmControllerRef.current?.unlock();
    }
  };

  const handleTestVoiceAndBeep = () => {
    if (onTriggerGlobalTestAlarm) {
      onTriggerGlobalTestAlarm();
      return;
    }
    setLocalAudioEnabled(true);
    alarmControllerRef.current?.setMuted(false);
    alarmControllerRef.current?.triggerTestSequence(
      classification,
      riskScore,
      hazards,
      telemetry
    );
  };

  return (
    <div
      className="relative w-full h-full min-h-[460px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex flex-col"
      data-testid="habitat-3d-canvas"
      data-habitat-type={habitat.type}
      data-view-mode={viewMode}
      data-camera-preset={activePreset}
      data-alarm-tier={classification}
    >
      {/* Isolated WebGL Viewport Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {webglUnavailable && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/95 p-6 text-center">
          <div className="max-w-md space-y-2 border border-slate-800 bg-slate-900/90 rounded-xl p-5">
            <AlertTriangle className="w-7 h-7 text-amber-400 mx-auto" />
            <div className="text-sm font-mono font-semibold text-white">
              3D WebGL Viewport Unavailable
            </div>
            <p className="text-xs text-slate-400">
              Hardware or WebGL rendering is restricted in this browser session. All telemetry readouts, risk assessments, and AI safety advisors remain fully active.
            </p>
          </div>
        </div>
      )}

      {/* Rapid Red Emergency Screen Strobe & Edge Glow */}
      {isDangerActive && (
        <div
          data-testid="internal-alarm-overlay"
          data-alarm-tier={classification}
          data-alarm-volume={audioProfile.volumePercent}
          className={`pointer-events-none absolute inset-0 z-[5] ${alarmStrobeClass} ${
            viewMode === 'internal'
              ? classification === 'extreme_emergency' || classification === 'critical'
                ? 'border-[6px] border-red-500 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.18)_20%,rgba(220,38,38,0.72)_100%)]'
                : classification === 'high_risk'
                ? 'border-[4px] border-orange-500 bg-[radial-gradient(circle_at_center,rgba(234,88,12,0.12)_30%,rgba(234,88,12,0.5)_100%)]'
                : 'border-[3px] border-amber-400 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.06)_40%,rgba(234,179,8,0.34)_100%)]'
              : classification === 'extreme_emergency' || classification === 'critical'
              ? 'border-[4px] border-red-500/90 bg-[radial-gradient(circle_at_center,transparent_58%,rgba(220,38,38,0.42)_100%)]'
              : 'border-2 border-amber-500/70'
          }`}
        />
      )}

      {/* Minimal Top HUD Ribbon (Solid rgba, zero backdrop-filter over WebGL) */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 p-3.5 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="bg-slate-900/95 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-200">
            <span className="text-cyan-400 font-semibold">{habitat.name}</span>
            <span className="mx-2 text-slate-600">|</span>
            <span>Mode: <strong className="text-white uppercase">{viewMode}</strong></span>
            <span className="mx-2 text-slate-600">|</span>
            <span>
              Hull:{' '}
              <strong className={getTelemetryMetricAccent(telemetry, habitat, 'pressureKPa').valueText}>
                {telemetry.pressureKPa.toFixed(1)} kPa
              </strong>
            </span>
          </div>

          <div
            data-testid="habitat-animation-badge"
            className="bg-slate-900/95 border border-cyan-500/40 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-cyan-300 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{animationLabel}</span>
          </div>

          {selectedPart && (
            <div className="bg-slate-900/95 border border-cyan-500/60 px-3 py-1.5 rounded-lg text-xs font-mono text-cyan-200 flex items-center gap-2">
              <Box className="w-3.5 h-3.5 text-cyan-400" />
              <span>{selectedPart.name}: {selectedPart.detail}</span>
              <button
                type="button"
                onClick={() => setSelectedPart(null)}
                aria-label="Close subsystem readout"
                className="text-slate-400 hover:text-white ml-1"
              >
                ×
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleToggleAudio}
            aria-label={audioEnabled ? 'Mute Alarm Audio' : 'Unmute Alarm Audio'}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition-colors ${
              audioEnabled
                ? isDangerActive
                  ? 'bg-rose-950/95 border-rose-500 text-rose-200'
                  : 'bg-slate-900/95 border-slate-700 text-cyan-300 hover:border-cyan-500/60'
                : 'bg-slate-900/95 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>
              {audioEnabled
                ? isDangerActive
                  ? `BEEP ${audioProfile.volumePercent}%`
                  : 'ALARM: ON'
                : 'ALARM: MUTED'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleTestVoiceAndBeep}
            aria-label="Test Warning Voice & Beep"
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono border bg-slate-900/95 border-slate-700 hover:border-amber-400/70 text-slate-200 hover:text-amber-200 flex items-center gap-1.5 transition-colors"
          >
            <Megaphone className="w-3.5 h-3.5 text-amber-400" />
            <span>Voice Alert</span>
          </button>

          {selfHealingActive ? (
            <div
              data-testid="canvas-self-healing-badge"
              className="bg-teal-950/95 border border-teal-400 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-teal-200 flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-teal-300" />
              <span>{selfHealingStatusLabel || 'SELF-HEALING ACTIVE'}</span>
            </div>
          ) : telemetry.fireDetected ? (
            <div className="bg-rose-950/95 border border-rose-500 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-300" />
              <span>COMBUSTION HAZARD ACTIVE</span>
            </div>
          ) : telemetry.pressureKPa < habitat.limits.pressureMinKPa ? (
            <div className="bg-amber-950/95 border border-amber-500 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              <span>DEPRESSURIZATION VENTING</span>
            </div>
          ) : isDangerActive ? (
            <div className="bg-red-950/95 border border-red-500 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-300" />
              <span>
                {classification.replace('_', ' ').toUpperCase()} ({riskScore}/100)
              </span>
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-400">
              {badgeText}: NOMINAL
            </div>
          )}
        </div>
      </div>

      {/* Compact Flame Lab Readout Chip when inside Flame Lab Mode */}
      {viewMode === 'flame_lab' && (
        <div
          data-testid="flame-lab-canvas-hud"
          className="relative z-10 ml-3.5 mt-1 mr-auto pointer-events-auto bg-slate-950/92 border border-orange-500/40 rounded-xl p-2.5 text-[11px] font-mono text-slate-200 max-w-sm space-y-1.5"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-orange-300 font-bold">
              <Flame className="w-3.5 h-3.5" />
              <span>{activeFlameAnalysis.isSustained ? 'FLAME SUSTAINED' : 'EXTINGUISHED'}</span>
            </span>
            <span className="text-cyan-300 tabular-nums">
              {activeFlameConfig.gravityG.toFixed(2)}g · {activeFlameConfig.oxygenPercent.toFixed(1)}% O₂ · {activeFlameConfig.pressureKPa.toFixed(0)} kPa
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 tabular-nums">
            <span>T_peak: <strong className="text-white">{activeFlameAnalysis.peakTempC.toFixed(0)}°C</strong></span>
            <span>H×W: <strong className="text-white">{activeFlameAnalysis.flameHeightMm}×{activeFlameAnalysis.flameWidthMm} mm</strong></span>
            <span>Tilt: <strong className="text-white">{activeFlameAnalysis.tiltAngleDeg}°</strong></span>
            <span>Spread: <strong className="text-amber-300">{activeFlameAnalysis.spreadRateMmS} mm/s</strong></span>
          </div>
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {([0.0, 0.16, 0.38, 1.0, 1.8] as const).map((gVal) => (
              <button
                key={gVal}
                type="button"
                onClick={() => handleFlamePatch({ gravityG: gVal, ignited: true })}
                className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${
                  Math.abs(activeFlameConfig.gravityG - gVal) < 0.04
                    ? 'bg-orange-500 text-slate-950 border-orange-400 font-bold'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {gVal}g
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleFlamePatch({ ignited: !activeFlameConfig.ignited })}
              className={`ml-auto px-2 py-0.5 rounded border text-[10px] font-bold ${
                activeFlameConfig.ignited
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-emerald-600 border-emerald-500 text-white'
              }`}
            >
              {activeFlameConfig.ignited ? 'Quench' : 'Ignite'}
            </button>
            {onOpenFlameLab && (
              <button
                type="button"
                onClick={onOpenFlameLab}
                className="px-2 py-0.5 rounded border border-cyan-500/50 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 text-[10px] inline-flex items-center gap-1"
              >
                <span>Analyze</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Compact Internal View Warning Symbol Callout */}
      {viewMode === 'internal' && isDangerActive && (
        <div
          data-testid="internal-warning-symbol-banner"
          className="relative z-10 mx-auto mt-auto mb-1 pointer-events-none"
        >
          <div
            className={`px-3.5 py-1.5 rounded-xl border-2 flex items-center gap-2.5 shadow-2xl ${
              classification === 'extreme_emergency' || classification === 'critical'
                ? 'bg-red-950/95 border-red-400 text-white'
                : classification === 'high_risk'
                ? 'bg-orange-950/95 border-orange-400 text-orange-100'
                : 'bg-amber-950/95 border-amber-400 text-amber-100'
            }`}
          >
            <AlertTriangle className="w-5 h-5 text-yellow-300 shrink-0" />
            <div className="font-mono text-[11px] leading-tight flex flex-wrap items-center gap-2">
              <span className="font-bold tracking-wide uppercase">
                {classification.replace('_', ' ')} WARNING · RISK {riskScore}/100
              </span>
              <span className="px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-yellow-300 font-bold">
                VOL {audioProfile.volumePercent}%
              </span>
              <span className="opacity-90 truncate max-w-xs">
                {hazards[0]?.name || 'Threshold Breach'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      <div
        className={`relative ${
          viewMode === 'internal' && isDangerActive ? '' : 'mt-auto'
        } z-10 mx-auto transition-transform duration-300 px-3 pb-2.5 w-full max-w-5xl pointer-events-auto ${
          isDockCollapsed ? 'translate-y-[calc(100%-30px)]' : 'translate-y-0'
        }`}
      >
        <div className="flex justify-center mb-1">
          <button
            type="button"
            onClick={() => setIsDockCollapsed(!isDockCollapsed)}
            className="flex items-center gap-1.5 bg-slate-900/95 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white px-3 py-0.5 rounded-t-md text-[10px] font-mono transition-colors"
          >
            {isDockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>Hide Controls</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-900/95 border border-slate-800 rounded-xl px-2.5 py-2 shadow-2xl flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 text-[11px]">
          {/* Primary View Mode: Exterior | Cutaway | Internal | Flame Lab */}
          <div className="flex items-center gap-0.5 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
            <Eye className="w-3.5 h-3.5 text-cyan-400 ml-1 mr-1 shrink-0" />
            {(
              [
                { id: 'exterior', label: 'Exterior' },
                { id: 'cutaway', label: 'Cutaway' },
                { id: 'internal', label: 'Internal View' },
                { id: 'flame_lab', label: 'Flame Lab' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                data-testid={`view-mode-${m.id}`}
                onClick={() => switchViewMode(m.id)}
                className={`px-2 py-1 rounded-md font-mono whitespace-nowrap transition-colors ${
                  viewMode === m.id
                    ? m.id === 'flame_lab'
                      ? 'bg-orange-500 text-slate-950 font-bold'
                      : 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Context-Aware Camera Presets OR Imaging Mode Filter in Flame Lab */}
          {viewMode === 'flame_lab' ? (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
              <Flame className="w-3.5 h-3.5 text-orange-400 ml-1 mr-1 shrink-0" />
              {(
                [
                  { id: 'optical', label: 'Optical' },
                  { id: 'chemilum', label: 'UV-CH*' },
                  { id: 'infrared', label: 'Thermal IR' },
                ] as { id: FlameImagingMode; label: string }[]
              ).map((flt) => (
                <button
                  key={flt.id}
                  type="button"
                  onClick={() => handleFlamePatch({ imagingMode: flt.id })}
                  className={`px-2 py-1 rounded-md font-mono text-[11px] whitespace-nowrap transition-colors ${
                    activeFlameConfig.imagingMode === flt.id
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {flt.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-0.5 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
              <Compass className="w-3.5 h-3.5 text-slate-400 ml-1 mr-1 shrink-0" />
              {(viewMode === 'internal' ? presetOptions.internal : presetOptions.exterior).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`px-2 py-1 rounded-md font-mono text-[11px] whitespace-nowrap transition-colors ${
                    activePreset === p.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Exploded View Slider (Exterior/Cutaway), Walkthrough Hint (Internal), or Orbit Hint (Flame Lab) */}
          {viewMode === 'internal' ? (
            <div className="text-[11px] font-mono text-slate-400 px-1.5 whitespace-nowrap">
              Drag to look · WASD / Arrows to move
            </div>
          ) : viewMode === 'flame_lab' ? (
            <div className="text-[11px] font-mono text-slate-400 px-1.5 whitespace-nowrap">
              Drag to orbit 3D Flame Rig · Scroll to zoom
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label htmlFor="habitat-exploded-slider" className="font-mono text-slate-400 whitespace-nowrap">
                Explode:
              </label>
              <input
                id="habitat-exploded-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={explodedRatio}
                onChange={(e) => setExplodedRatio(parseFloat(e.target.value))}
                className="w-16 accent-cyan-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setAutoRotate(!autoRotate)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border font-mono text-[11px] whitespace-nowrap transition-colors ${
                  autoRotate
                    ? 'bg-slate-800 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>{autoRotate ? 'Orbit: ON' : 'Orbit: OFF'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

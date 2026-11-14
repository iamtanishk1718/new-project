import * as THREE from 'three';
import {
  CategoryRiskScores,
  DetectedHazard,
  EnvironmentalTelemetry,
  FlameAnalysisResult,
  FlameTestConfig,
  HabitatProfile,
  HabitatType,
  RiskClassification,
} from '../types/habitat';
import {
  buildIssSceneAssembly,
  ConsoleScreenUpdater,
  createConsoleScreenUpdater,
  createHullPanelTexture,
  createParticleTexture,
  createSolarCellTexture,
} from './issSceneBuilder';
import { createFlameChamberAssembly } from './flameChamber3d';
import { analyzeFlameConditions, DEFAULT_FLAME_TEST_CONFIG } from './flamePhysics';

export type TwinViewMode = 'exterior' | 'cutaway' | 'internal' | 'flame_lab';

export interface CameraPresetOption {
  id: string;
  label: string;
}

export interface HabitatCameraTargets {
  sphericalTarget: { radius: number; theta: number; phi: number };
  sphericalCurrent: { radius: number; theta: number; phi: number };
  lookTargetY: number;
  orbitFocus: { x: number; y: number; z: number };
  internalPosTarget: { x: number; y: number; z: number };
  internalPosCurrent: { x: number; y: number; z: number };
  internalYawTarget: number;
  internalYawCurrent: number;
  internalPitchTarget: number;
  internalPitchCurrent: number;
  cutawayProgress: number;
}

export interface HabitatUpdateContext {
  telemetry: EnvironmentalTelemetry;
  habitat: HabitatProfile;
  classification: RiskClassification;
  riskScore: number;
  hazards: DetectedHazard[];
  categoryScores?: CategoryRiskScores;
  viewMode: TwinViewMode;
  explodedRatio: number;
  cutawayProgress: number;
  flashOn: boolean;
  audioEnabled: boolean;
  introProgress: number;
  flameConfig?: FlameTestConfig;
  flameAnalysis?: FlameAnalysisResult;
  selfHealingActive?: boolean;
}

export interface HabitatAssemblyHandle {
  habitatType: HabitatType;
  animationLabel: string;
  badgeText: string;
  rootGroup: THREE.Group;
  consoleScreen: ConsoleScreenUpdater;
  alarmBeaconMat: THREE.MeshStandardMaterial;
  interiorLights: THREE.PointLight[];
  interactables: THREE.Object3D[];
  presets: {
    exterior: CameraPresetOption[];
    internal: CameraPresetOption[];
  };
  defaultPresetId: {
    exterior: string;
    internal: string;
  };
  internalBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  environment: {
    backgroundHex: number;
    fogHex: number;
    fogDensity: number;
    sunColorHex: number;
    sunIntensity: number;
    hemiSkyHex: number;
    hemiGroundHex: number;
    hemiIntensity: number;
    showEarthLimb: boolean;
  };
  applyPreset: (presetId: string, camTargets: HabitatCameraTargets, targetMode: TwinViewMode) => void;
  update: (dt: number, elapsed: number, ctx: HabitatUpdateContext) => void;
  dispose: () => void;
}

function createTerrainTexture(
  baseColor: string,
  grainColor: string,
  craterColor: string,
  anisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle layered surface texture
  for (let i = 0; i < 420; i++) {
    const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 512;
    const y = (Math.cos(i * 78.233) * 0.5 + 0.5) * 512;
    const r = 2 + (i % 7) * 2.2;
    ctx.fillStyle = i % 3 === 0 ? craterColor : grainColor;
    ctx.globalAlpha = i % 3 === 0 ? 0.28 : 0.16;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = anisotropy;
  return tex;
}

function createTireTreadTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#27272a';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#52525b';
  for (let y = 0; y < 256; y += 24) {
    ctx.fillRect(10, y, 108, 12);
    ctx.fillRect(138, y + 12, 108, 12);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

function createContactShadowMesh(
  radius: number,
  opacity: number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  trackTex: <T extends THREE.Texture>(t: T) => T
): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, `rgba(2, 6, 23, ${opacity})`);
  grad.addColorStop(0.65, `rgba(2, 6, 23, ${opacity * 0.4})`);
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = trackTex(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(radius * 2, radius * 2)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      })
    )
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

function tagInteractable(obj: THREE.Object3D, name: string, detail: string, list: THREE.Object3D[]) {
  obj.userData = { subsystemName: name, subsystemDetail: detail };
  list.push(obj);
}

// ===========================================================================
// 1. ISS HABITAT ADAPTER (Preserves full walkable Destiny Lab + C&W Console)
// ===========================================================================
function createIssHabitatHandle(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean
): HabitatAssemblyHandle {
  const assembly = buildIssSceneAssembly(renderer, isSoftwareGl);
  const rootGroup = assembly.habitatGroup;

  // Dual Particle Systems specific to ISS
  const hazardCount = 140;
  const hazardGeo = new THREE.BufferGeometry();
  const hazardPos = new Float32Array(hazardCount * 3);
  const hazardVel = new Float32Array(hazardCount * 3);
  for (let i = 0; i < hazardCount; i++) {
    hazardPos[i * 3] = 2.0 + (Math.random() - 0.5) * 0.6;
    hazardPos[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
    hazardPos[i * 3 + 2] = 0.7 + (Math.random() - 0.5) * 0.4;
    hazardVel[i * 3] = (Math.random() - 0.5) * 0.018;
    hazardVel[i * 3 + 1] = 0.02 + Math.random() * 0.035;
    hazardVel[i * 3 + 2] = (Math.random() - 0.5) * 0.018;
  }
  hazardGeo.setAttribute('position', new THREE.BufferAttribute(hazardPos, 3));
  const hazardMat = new THREE.PointsMaterial({
    color: 0xf97316,
    map: assembly.particleTex,
    size: 0.34,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  rootGroup.add(new THREE.Points(hazardGeo, hazardMat));

  const flowCount = 90;
  const flowGeo = new THREE.BufferGeometry();
  const flowPos = new Float32Array(flowCount * 3);
  for (let i = 0; i < flowCount; i++) {
    flowPos[i * 3] = (Math.random() - 0.5) * 6.8;
    flowPos[i * 3 + 1] = -0.7 + Math.random() * 1.8;
    flowPos[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
  }
  flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
  const flowMat = new THREE.PointsMaterial({
    color: 0x38bdf8,
    map: assembly.particleTex,
    size: 0.1,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  rootGroup.add(new THREE.Points(flowGeo, flowMat));

  const wingBaseX = [-12.6, -8.8, 8.8, 12.6];

  return {
    habitatType: 'iss',
    animationLabel: 'Sun-Tracking Solar Arrays & IMV Airflow',
    badgeText: 'ISS DIGITAL TWIN',
    rootGroup,
    consoleScreen: assembly.consoleScreen,
    alarmBeaconMat: assembly.alarmBeaconMat,
    interiorLights: assembly.interiorLights,
    interactables: assembly.interactables,
    presets: {
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
    },
    defaultPresetId: { exterior: 'orbital', internal: 'corridor' },
    internalBounds: { minX: -2.95, maxX: 2.95, minZ: -0.45, maxZ: 0.45 },
    environment: {
      backgroundHex: 0x060913,
      fogHex: 0x060913,
      fogDensity: 0.011,
      sunColorHex: 0xfff5e4,
      sunIntensity: 3.1,
      hemiSkyHex: 0x38bdf8,
      hemiGroundHex: 0x0b1120,
      hemiIntensity: 0.95,
      showEarthLimb: true,
    },
    applyPreset: (presetId, camTargets) => {
      if (presetId === 'flame_lab') {
        camTargets.orbitFocus = { x: 1.05, y: -0.44, z: 0.56 };
        camTargets.sphericalTarget = { radius: 1.55, theta: -1.65, phi: 1.24 };
        camTargets.lookTargetY = -0.44;
        return;
      }
      if (presetId === 'corridor') {
        camTargets.internalPosTarget = { x: -2.6, y: 0.05, z: 0.0 };
        camTargets.internalYawTarget = 0.0;
        camTargets.internalPitchTarget = -0.04;
      } else if (presetId === 'eclss') {
        camTargets.internalPosTarget = { x: -1.1, y: 0.0, z: -0.18 };
        camTargets.internalYawTarget = Math.PI * 0.5;
        camTargets.internalPitchTarget = -0.05;
      } else if (presetId === 'console') {
        camTargets.internalPosTarget = { x: 0.0, y: 0.1, z: 0.45 };
        camTargets.internalYawTarget = -Math.PI * 0.5;
        camTargets.internalPitchTarget = -0.04;
      } else if (presetId === 'pdu') {
        camTargets.internalPosTarget = { x: 1.45, y: 0.0, z: -0.18 };
        camTargets.internalYawTarget = Math.PI * 0.38;
        camTargets.internalPitchTarget = -0.05;
      } else if (presetId === 'docking') {
        camTargets.sphericalTarget = { radius: 13.5, theta: 0.15, phi: 1.45 };
        camTargets.lookTargetY = 0.3;
        camTargets.orbitFocus = { x: 0, y: 0.3, z: 0 };
      } else if (presetId === 'radiators') {
        camTargets.sphericalTarget = { radius: 16.5, theta: -1.57, phi: 0.85 };
        camTargets.lookTargetY = 0.3;
        camTargets.orbitFocus = { x: 0, y: 0.3, z: 0 };
      } else if (presetId === 'cupola') {
        camTargets.sphericalTarget = { radius: 10.5, theta: 2.25, phi: 2.15 };
        camTargets.lookTargetY = 0.2;
        camTargets.orbitFocus = { x: 0, y: 0.2, z: 0 };
      } else {
        camTargets.sphericalTarget = { radius: 22, theta: 0.72, phi: 1.08 };
        camTargets.lookTargetY = 0.3;
        camTargets.orbitFocus = { x: 0, y: 0.3, z: 0 };
      }
    },
    update: (dt, elapsed, ctx) => {
      const { telemetry: t, habitat: hab, classification: curClass, viewMode: mode, explodedRatio: curExp, cutawayProgress, flashOn, introProgress, flameConfig, flameAnalysis, selfHealingActive } = ctx;

      const activeFlameCfg = flameConfig || DEFAULT_FLAME_TEST_CONFIG;
      const activeFlameRes = flameAnalysis || analyzeFlameConditions(activeFlameCfg);
      assembly.flameChamber.update(dt, elapsed, activeFlameCfg, activeFlameRes, Boolean(selfHealingActive));

      // Cutaway shell
      const effectiveCutaway = mode === 'flame_lab' ? 1 : cutawayProgress;
      assembly.cutawayShellGroup.position.y = effectiveCutaway * 2.8;
      assembly.cutawayShellGroup.visible = effectiveCutaway < 0.96;
      for (const m of assembly.cutawayMaterials) {
        m.opacity = 1 - effectiveCutaway;
      }

      // Exploded Solar & Radiator Separation + Sun-Tracking Solar Wing Articulation
      const deployFactor = THREE.MathUtils.smoothstep(introProgress, 0.0, 1.0);
      for (let i = 0; i < assembly.solarWings.length; i++) {
        const dir = i < 2 ? -1 : 1;
        assembly.solarWings[i].position.x = THREE.MathUtils.damp(
          assembly.solarWings[i].position.x,
          wingBaseX[i] + dir * curExp * 4.5,
          4.5,
          dt
        );
        // Continuous sun-tracking pitch rotation + entry unfold
        assembly.solarWings[i].rotation.x =
          (1 - deployFactor) * 1.1 + Math.sin(elapsed * 0.32 + i * 0.15) * 0.24;
      }
      assembly.radiators[0].position.z = THREE.MathUtils.damp(
        assembly.radiators[0].position.z,
        -2.7 - curExp * 3.2,
        4.5,
        dt
      );
      assembly.radiators[1].position.z = THREE.MathUtils.damp(
        assembly.radiators[1].position.z,
        -2.7 - curExp * 3.2,
        4.5,
        dt
      );

      // IMV rotor spin
      assembly.imvFanRotor.rotation.z -= dt * Math.max(0.4, t.airflowVelocity * 28);

      // Subsystem Status Emissive
      assembly.statusMaterials.cdra.color.setHex(
        t.co2ScrubberStatus === 'failed' ? 0xf43f5e : t.co2ScrubberStatus === 'degraded' ? 0xf59e0b : 0x10b981
      );
      assembly.statusMaterials.cdra.emissive.copy(assembly.statusMaterials.cdra.color);

      assembly.statusMaterials.ogs.color.setHex(
        t.oxygenGenStatus === 'fault' ? 0xf43f5e : t.oxygenGenStatus === 'standby' ? 0xf59e0b : 0x06b6d4
      );
      assembly.statusMaterials.ogs.emissive.copy(assembly.statusMaterials.ogs.color);

      assembly.statusMaterials.pdu.color.setHex(
        t.fireDetected || t.powerSupplyPercent < 40 ? 0xf43f5e : t.smokeDetected || t.powerSupplyPercent < 65 ? 0xf59e0b : 0x10b981
      );
      assembly.statusMaterials.pdu.emissive.copy(assembly.statusMaterials.pdu.color);

      assembly.statusMaterials.imv.color.setHex(
        t.airflowVelocity < hab.limits.airflowMinMs ? 0xf59e0b : 0x14b8a6
      );
      assembly.statusMaterials.imv.emissive.copy(assembly.statusMaterials.imv.color);

      // Thermal Radiator glow
      const overheat = t.coolingSystemStatus !== 'nominal' || t.internalTemperatureC > hab.limits.tempMaxC;
      for (const rm of assembly.radiatorMaterials) {
        rm.emissive.setHex(overheat ? 0xea580c : 0x000000);
        rm.emissiveIntensity = overheat ? 0.55 : 0.0;
      }

      // Beacon & Interior Lights
      const fireActive = t.fireDetected || t.smokeDetected;
      const isDanger = curClass !== 'normal';
      const isCriticalDanger = curClass === 'critical' || curClass === 'extreme_emergency';
      const beaconHex = selfHealingActive ? 0x14b8a6 : isCriticalDanger ? 0xff1e38 : curClass === 'high_risk' ? 0xf97316 : curClass === 'caution' ? 0xeab308 : 0x06b6d4;
      assembly.alarmBeaconMat.color.setHex(beaconHex);
      assembly.alarmBeaconMat.emissive.setHex(beaconHex);
      assembly.alarmBeaconMat.emissiveIntensity = selfHealingActive ? 2.2 + Math.sin(elapsed * 8) * 0.9 : isDanger ? (flashOn ? 2.8 : 0.45) : 0.7;

      const targetIntensity = mode === 'exterior' ? 1.0 : isCriticalDanger && flashOn ? 4.4 : 3.2;
      for (const pt of assembly.interiorLights) {
        pt.intensity = THREE.MathUtils.damp(pt.intensity, targetIntensity, 8.0, dt);
        if (isCriticalDanger && flashOn) pt.color.setHex(0xff2d3d);
        else if (fireActive || isCriticalDanger) pt.color.setHex(0xfca5a5);
        else if (curClass === 'high_risk' && flashOn) pt.color.setHex(0xfdba74);
        else pt.color.setHex(0xe0f2fe);
      }
      assembly.fireLight.intensity = t.fireDetected ? 4.2 + Math.sin(elapsed * 14) * 1.4 : t.smokeDetected ? 1.6 : 0;

      // Particles
      const hPos = hazardGeo.attributes.position.array as Float32Array;
      const depressActive = t.pressureKPa < hab.limits.pressureMinKPa;
      if (fireActive) {
        hazardMat.color.setHex(t.fireDetected ? 0xf97316 : 0x94a3b8);
        hazardMat.opacity = THREE.MathUtils.damp(hazardMat.opacity, 0.85, 3.5, dt);
        for (let i = 0; i < hazardCount; i++) {
          hPos[i * 3] += hazardVel[i * 3];
          hPos[i * 3 + 1] += hazardVel[i * 3 + 1];
          hPos[i * 3 + 2] += hazardVel[i * 3 + 2];
          if (hPos[i * 3 + 1] > (mode === 'internal' ? 1.4 : 3.8)) {
            hPos[i * 3] = 2.0 + (Math.random() - 0.5) * 0.55;
            hPos[i * 3 + 1] = -0.35;
            hPos[i * 3 + 2] = 0.78 + (Math.random() - 0.5) * 0.35;
          }
        }
        hazardGeo.attributes.position.needsUpdate = true;
      } else if (depressActive) {
        hazardMat.color.setHex(0x38bdf8);
        hazardMat.opacity = THREE.MathUtils.damp(hazardMat.opacity, 0.75, 3.5, dt);
        for (let i = 0; i < hazardCount; i++) {
          hPos[i * 3] += 0.045 + Math.abs(hazardVel[i * 3]);
          hPos[i * 3 + 1] += hazardVel[i * 3 + 1] * 0.4;
          hPos[i * 3 + 2] += hazardVel[i * 3 + 2] * 1.4;
          if (hPos[i * 3] > 6.5) {
            hPos[i * 3] = 3.6 + (Math.random() - 0.5) * 0.3;
            hPos[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
            hPos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
          }
        }
        hazardGeo.attributes.position.needsUpdate = true;
      } else {
        hazardMat.opacity = THREE.MathUtils.damp(hazardMat.opacity, 0.0, 4.0, dt);
      }

      const fPos = flowGeo.attributes.position.array as Float32Array;
      const flowSpeed = Math.max(0.002, t.airflowVelocity * 0.14);
      flowMat.color.setHex(t.airflowVelocity < hab.limits.airflowMinMs ? 0xf59e0b : 0x38bdf8);
      flowMat.opacity = mode === 'exterior' ? 0.0 : 0.55;
      if (mode !== 'exterior') {
        for (let i = 0; i < flowCount; i++) {
          fPos[i * 3] += flowSpeed;
          if (fPos[i * 3] > 3.5) {
            fPos[i * 3] = -3.5;
            fPos[i * 3 + 1] = -0.8 + Math.random() * 1.9;
            fPos[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
          }
        }
        flowGeo.attributes.position.needsUpdate = true;
      }
    },
    dispose: () => {
      hazardGeo.dispose();
      hazardMat.dispose();
      flowGeo.dispose();
      flowMat.dispose();
      assembly.disposables.geometries.forEach((g) => g.dispose());
      assembly.disposables.materials.forEach((m) => m.dispose());
      assembly.disposables.textures.forEach((t) => t.dispose());
    },
  };
}

// Shared local disposable registry helper for custom habitat builders
function createRegistry() {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };
  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };
  return { trackGeo, trackMat, trackTex, dispose };
}

// Helper to mount a standard C&W interior workstation console inside any habitat
function buildInteriorConsoleScreen(
  anisotropy: number,
  stationTitle: string,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  trackTex: <T extends THREE.Texture>(t: T) => T,
  alarmBeaconMat: THREE.MeshStandardMaterial,
  width = 1.6,
  height = 1.0
): { group: THREE.Group; consoleScreen: ConsoleScreenUpdater } {
  const consoleScreen = createConsoleScreenUpdater(anisotropy, stationTitle);
  trackTex(consoleScreen.texture);

  const group = new THREE.Group();
  const bezelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.7 }));
  const screenMat = trackMat(new THREE.MeshBasicMaterial({ map: consoleScreen.texture, toneMapped: false }));

  const bezel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width + 0.12, height + 0.12, 0.08)), bezelMat);
  group.add(bezel);

  const screen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(width, height)), screenMat);
  screen.position.z = 0.045;
  group.add(screen);

  const strobeBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width * 0.88, 0.055, 0.08)), alarmBeaconMat);
  strobeBar.position.set(0, height * 0.5 + 0.08, 0.02);
  group.add(strobeBar);

  return { group, consoleScreen };
}

// ===========================================================================
// 2. ARTEMIS BASE CAMP — LUNAR SURFACE HABITAT
// ===========================================================================
function createLunarHabitatHandle(renderer: THREE.WebGLRenderer): HabitatAssemblyHandle {
  const { trackGeo, trackMat, trackTex, dispose } = createRegistry();
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const rootGroup = new THREE.Group();
  const interactables: THREE.Object3D[] = [];

  const regolithTex = trackTex(createTerrainTexture('#64748b', '#94a3b8', '#334155', anisotropy));
  const solarTex = trackTex(createSolarCellTexture(anisotropy));
  const hullMaps = createHullPanelTexture(anisotropy);
  trackTex(hullMaps.map);
  trackTex(hullMaps.bumpMap);
  const particleTex = trackTex(createParticleTexture());

  // Lunar Regolith Cratered Terrain Disc (grounded at y = 0)
  const groundGeo = trackGeo(new THREE.CylinderGeometry(28, 30, 0.8, 48, 8));
  const posAttr = groundGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    if (vy > 0) {
      const dist = Math.hypot(vx, vz);
      const ridge = dist > 5.5 ? Math.sin(vx * 0.35) * Math.cos(vz * 0.35) * 0.45 + Math.max(0, (dist - 16) * 0.14) : 0;
      posAttr.setY(i, 0.4 + ridge);
    }
  }
  groundGeo.computeVertexNormals();
  const regolithMat = trackMat(new THREE.MeshStandardMaterial({ map: regolithTex, roughness: 0.94, metalness: 0.04 }));
  const ground = new THREE.Mesh(groundGeo, regolithMat);
  ground.position.y = -0.4;
  ground.receiveShadow = true;
  rootGroup.add(ground);

  // Instanced Lunar Basalt Rocks
  const rockGeo = trackGeo(new THREE.DodecahedronGeometry(0.45, 0));
  const rockMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.92, metalness: 0.08 }));
  const rockCount = 42;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2 + (i % 5) * 0.3;
    const rad = 7.2 + (i % 9) * 1.9;
    dummy.position.set(Math.cos(angle) * rad, 0.12, Math.sin(angle) * rad);
    dummy.rotation.set(i * 0.5, i * 0.8, 0);
    dummy.scale.set(0.5 + (i % 4) * 0.35, 0.35 + (i % 3) * 0.2, 0.5 + (i % 5) * 0.3);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    rocks.setColorAt(i, new THREE.Color(0x64748b).lerp(new THREE.Color(0x94a3b8), (i % 5) * 0.15));
  }
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  rocks.computeBoundingSphere();
  rootGroup.add(rocks);

  // Distant Earth floating in Lunar Sky
  const earthSphere = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(2.6, 28, 20)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.65, roughness: 0.7 }))
  );
  earthSphere.position.set(-16, 15, -24);
  rootGroup.add(earthSphere);

  // Contact shadow
  rootGroup.add(createContactShadowMesh(5.6, 0.55, trackGeo, trackMat, trackTex));

  // Materials
  const hullMat = trackMat(new THREE.MeshStandardMaterial({ map: hullMaps.map, bumpMap: hullMaps.bumpMap, bumpScale: 0.015, color: 0xf1f5f9, roughness: 0.38, metalness: 0.55 }));
  const goldMliMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.24, metalness: 0.88 }));
  const darkStrutMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.78 }));
  const solarMat = trackMat(new THREE.MeshStandardMaterial({ map: solarTex, emissive: 0x0c4a6e, emissiveIntensity: 0.2, roughness: 0.2, metalness: 0.5 }));
  const alarmBeaconMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.8, roughness: 0.25 }));
  const airlockRingMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.9, roughness: 0.25 }));
  const domeShellMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.55, metalness: 0.35, transparent: true, opacity: 1 }));

  // Habitat Assembly (grounded at y = 0)
  const baseGroup = new THREE.Group();
  rootGroup.add(baseGroup);

  // Blast Pad & 6 Leveling Legs
  const pad = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.2, 3.6, 0.22, 16)), darkStrutMat);
  pad.position.y = 0.11;
  baseGroup.add(pad);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 1.35, 10)), goldMliMat);
    leg.position.set(Math.cos(a) * 2.75, 0.65, Math.sin(a) * 2.75);
    leg.rotation.z = Math.cos(a) * 0.28;
    leg.rotation.x = -Math.sin(a) * 0.28;
    baseGroup.add(leg);
  }

  // Main Vertical Pressure Core (open interior inside cutaway)
  const coreFloor = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.3, 2.3, 0.2, 24)), darkStrutMat);
  coreFloor.position.y = 0.6;
  baseGroup.add(coreFloor);

  const lowerWall = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.35, 2.4, 1.8, 24, 1, true)), hullMat);
  lowerWall.position.y = 1.5;
  tagInteractable(lowerWall, 'Lunar Habitat Core', 'Regolith-shielded 2-deck Artemis pressure hull (55–60 kPa O2-rich)', interactables);
  baseGroup.add(lowerWall);

  // Interior Equipment + Console inside Upper Deck
  const interiorGroup = new THREE.Group();
  interiorGroup.position.set(0, 1.65, 0);
  baseGroup.add(interiorGroup);

  const { group: consoleMesh, consoleScreen } = buildInteriorConsoleScreen(
    anisotropy,
    'ARTEMIS LUNAR // C&W WORKSTATION',
    trackGeo,
    trackMat,
    trackTex,
    alarmBeaconMat,
    1.5,
    0.92
  );
  consoleMesh.position.set(0, 0.45, -1.55);
  interiorGroup.add(consoleMesh);

  // Hydroponic Plant Shelf inside deck
  const plantShelfMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.45, roughness: 0.6 }));
  const hydroShelf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 0.55, 0.45)), plantShelfMat);
  hydroShelf.position.set(-1.35, 0.25, 0.3);
  hydroShelf.rotation.y = Math.PI * 0.42;
  interiorGroup.add(hydroShelf);

  const interiorLight = new THREE.PointLight(0xe0f2fe, 2.4, 9, 1.5);
  interiorLight.position.set(0, 2.9, 0);
  baseGroup.add(interiorLight);

  const flameChamber = createFlameChamberAssembly(trackGeo, trackMat, particleTex, false);
  flameChamber.group.position.set(1.15, -0.45, 0.35);
  flameChamber.group.scale.setScalar(0.72);
  tagInteractable(flameChamber.group, 'Lunar Combustion Flame Rig', '0.16g Artemis atmosphere flame propagation & suppression test rig', interactables);
  interiorGroup.add(flameChamber.group);

  // Removable Upper Geodesic Regolith Dome (Cutaway + Explode)
  const upperDomeGroup = new THREE.Group();
  upperDomeGroup.position.y = 2.4;
  const domeMesh = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(2.36, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52)),
    domeShellMat
  );
  upperDomeGroup.add(domeMesh);
  const ribRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.38, 0.08, 10, 32)), goldMliMat);
  ribRing.rotation.x = Math.PI / 2;
  upperDomeGroup.add(ribRing);
  const domeBeacon = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.22, 0.3, 12)), alarmBeaconMat);
  domeBeacon.position.y = 2.42;
  upperDomeGroup.add(domeBeacon);
  baseGroup.add(upperDomeGroup);

  // Pressurized EVA Airlock & Suit-Port Tunnel (+Z)
  const airlockGroup = new THREE.Group();
  airlockGroup.position.set(0, 1.15, 2.8);
  const tunnel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.85, 0.85, 1.8, 16)), hullMat);
  tunnel.rotation.x = Math.PI / 2;
  airlockGroup.add(tunnel);
  const hatchRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.74, 0.07, 10, 24)), airlockRingMat);
  hatchRing.position.z = 0.92;
  airlockGroup.add(hatchRing);
  const hatchDoor = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.68, 0.68, 0.1, 18)), darkStrutMat);
  hatchDoor.rotation.x = Math.PI / 2;
  hatchDoor.position.z = 0.9;
  airlockGroup.add(hatchDoor);
  tagInteractable(airlockGroup, 'EVA Suit-Port Airlock', 'Dust-mitigated lunar suit-port pressurization chamber', interactables);
  baseGroup.add(airlockGroup);

  // Twin Deployable Vertical Solar Array Towers (VSATs) — Sun Tracking Animation!
  const vsatTowers: THREE.Group[] = [];
  const vsatWings: THREE.Group[] = [];
  const vsatX = [-4.6, 4.6];
  vsatX.forEach((vx, idx) => {
    const tower = new THREE.Group();
    tower.position.set(vx, 0, -0.6);
    const mast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.2, 5.2, 12)), darkStrutMat);
    mast.position.y = 2.6;
    tower.add(mast);

    const wingRotator = new THREE.Group();
    wingRotator.position.y = 3.8;
    const boom = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 3.8, 0.16)), goldMliMat);
    wingRotator.add(boom);
    const fanPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 3.6, 0.05)), solarMat);
    wingRotator.add(fanPanel);
    tower.add(wingRotator);
    tagInteractable(tower, `VSAT Solar Tower ${idx + 1}`, 'Vertical sun-tracking photovoltaic tower for Lunar South Pole', interactables);
    baseGroup.add(tower);
    vsatTowers.push(tower);
    vsatWings.push(wingRotator);
  });

  // High-Gain Earth-Link Dish (Animates sweeping/locking onto Earth)
  const dishBase = new THREE.Group();
  dishBase.position.set(-2.3, 2.7, -1.8);
  const dishPedestal = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.14, 1.1, 10)), darkStrutMat);
  dishPedestal.position.y = 0.55;
  dishBase.add(dishPedestal);
  const dishHead = new THREE.Group();
  dishHead.position.y = 1.1;
  const dishBowl = new THREE.Mesh(
    trackGeo(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.45, 0.09), new THREE.Vector2(0.85, 0.34)], 20)),
    hullMat
  );
  dishBowl.rotation.x = Math.PI * 0.32;
  dishHead.add(dishBowl);
  const feedHorn = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.06, 0.45, 8)), goldMliMat);
  feedHorn.position.set(0, 0.32, 0.32);
  feedHorn.rotation.x = Math.PI * 0.32;
  dishHead.add(feedHorn);
  dishBase.add(dishHead);
  tagInteractable(dishBase, 'Ka-Band Earth-Link Dish', 'Continuous Earth telemetry tracking terminal', interactables);
  baseGroup.add(dishBase);

  // Cryo LOX / LH2 Tanks & Radiator
  const cryoGroup = new THREE.Group();
  cryoGroup.position.set(2.9, 0.9, 1.8);
  for (const offset of [-0.6, 0.6]) {
    const tank = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.52, 16, 12)), hullMat);
    tank.position.set(offset, 0, 0);
    cryoGroup.add(tank);
  }
  tagInteractable(cryoGroup, 'Cryo O2 / Sabatier Storage', 'In-situ LOX/H2O reserve spheres for closed-loop regeneration', interactables);
  baseGroup.add(cryoGroup);

  // Electrostatic Lunar Dust Motes Particle Stream
  const dustCount = 90;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 16;
    dustPos[i * 3 + 1] = 0.25 + Math.random() * 4.5;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xe2e8f0, map: particleTex, size: 0.16, transparent: true, opacity: 0.45, depthWrite: false });
  rootGroup.add(new THREE.Points(dustGeo, dustMat));

  return {
    habitatType: 'lunar',
    animationLabel: 'VSAT Sun-Tracking, Earth Dish Lock & Airlock Cycle',
    badgeText: 'LUNAR BASE TWIN',
    rootGroup,
    consoleScreen,
    alarmBeaconMat,
    interiorLights: [interiorLight],
    interactables,
    presets: {
      exterior: [
        { id: 'overview', label: 'Overview' },
        { id: 'vsat', label: 'VSAT Arrays' },
        { id: 'airlock', label: 'Airlock' },
        { id: 'earthrise', label: 'Earthrise' },
      ],
      internal: [
        { id: 'deck', label: 'Habitat Deck' },
        { id: 'console', label: 'C&W Console' },
        { id: 'hydro', label: 'Hydroponics' },
        { id: 'suitport', label: 'Suit-Port' },
      ],
    },
    defaultPresetId: { exterior: 'overview', internal: 'console' },
    internalBounds: { minX: -1.6, maxX: 1.6, minZ: -1.3, maxZ: 1.3 },
    environment: {
      backgroundHex: 0x05070e,
      fogHex: 0x05070e,
      fogDensity: 0.008,
      sunColorHex: 0xfff8eb,
      sunIntensity: 3.3,
      hemiSkyHex: 0x94a3b8,
      hemiGroundHex: 0x1e293b,
      hemiIntensity: 0.75,
      showEarthLimb: false,
    },
    applyPreset: (presetId, camTargets) => {
      if (presetId === 'flame_lab') {
        camTargets.orbitFocus = { x: 1.15, y: 1.55, z: 0.35 };
        camTargets.sphericalTarget = { radius: 2.0, theta: 0.9, phi: 1.24 };
        camTargets.lookTargetY = 1.55;
        return;
      }
      if (presetId === 'console') {
        camTargets.internalPosTarget = { x: 0.0, y: 2.1, z: -0.05 };
        camTargets.internalYawTarget = -Math.PI * 0.5;
        camTargets.internalPitchTarget = -0.03;
      } else if (presetId === 'hydro') {
        camTargets.internalPosTarget = { x: 0.1, y: 2.0, z: 0.3 };
        camTargets.internalYawTarget = Math.PI;
        camTargets.internalPitchTarget = -0.06;
      } else if (presetId === 'suitport') {
        camTargets.internalPosTarget = { x: 0.0, y: 1.5, z: 1.35 };
        camTargets.internalYawTarget = Math.PI * 0.5;
        camTargets.internalPitchTarget = -0.08;
      } else if (presetId === 'deck') {
        camTargets.internalPosTarget = { x: 1.1, y: 2.25, z: 1.1 };
        camTargets.internalYawTarget = -Math.PI * 0.72;
        camTargets.internalPitchTarget = -0.14;
      } else if (presetId === 'vsat') {
        camTargets.sphericalTarget = { radius: 13.5, theta: -0.55, phi: 1.12 };
        camTargets.lookTargetY = 2.4;
        camTargets.orbitFocus = { x: 0, y: 2.4, z: 0 };
      } else if (presetId === 'airlock') {
        camTargets.sphericalTarget = { radius: 9.5, theta: 1.25, phi: 1.24 };
        camTargets.lookTargetY = 1.5;
        camTargets.orbitFocus = { x: 0, y: 1.5, z: 0 };
      } else if (presetId === 'earthrise') {
        camTargets.sphericalTarget = { radius: 16.5, theta: 0.45, phi: 1.32 };
        camTargets.lookTargetY = 2.8;
        camTargets.orbitFocus = { x: 0, y: 2.8, z: 0 };
      } else {
        camTargets.sphericalTarget = { radius: 15.5, theta: 0.78, phi: 1.12 };
        camTargets.lookTargetY = 2.0;
        camTargets.orbitFocus = { x: 0, y: 2.0, z: 0 };
      }
    },
    update: (dt, elapsed, ctx) => {
      const { viewMode, explodedRatio, cutawayProgress, classification, flashOn, telemetry, introProgress, flameConfig, flameAnalysis, selfHealingActive } = ctx;
      const deploy = THREE.MathUtils.smoothstep(introProgress, 0, 1);
      flameChamber.update(dt, elapsed, flameConfig || DEFAULT_FLAME_TEST_CONFIG, flameAnalysis || analyzeFlameConditions(flameConfig || DEFAULT_FLAME_TEST_CONFIG), Boolean(selfHealingActive));

      // Cutaway / Internal / Flame Lab reveals upper deck by raising dome cleanly
      const revealRatio = viewMode === 'internal' || viewMode === 'flame_lab' ? 1 : Math.max(cutawayProgress, explodedRatio * 0.85);
      upperDomeGroup.position.y = THREE.MathUtils.damp(upperDomeGroup.position.y, 2.4 + revealRatio * 3.1, 5, dt);
      domeShellMat.opacity = 1 - revealRatio * 0.85;
      upperDomeGroup.visible = revealRatio < 0.96;

      // Exploded radial expansion of VSAT towers, airlock, and cryo tanks
      vsatTowers[0].position.x = THREE.MathUtils.damp(vsatTowers[0].position.x, -4.6 - explodedRatio * 2.8, 4.5, dt);
      vsatTowers[1].position.x = THREE.MathUtils.damp(vsatTowers[1].position.x, 4.6 + explodedRatio * 2.8, 4.5, dt);
      airlockGroup.position.z = THREE.MathUtils.damp(airlockGroup.position.z, 2.8 + explodedRatio * 2.2, 4.5, dt);
      cryoGroup.position.x = THREE.MathUtils.damp(cryoGroup.position.x, 2.9 + explodedRatio * 2.0, 4.5, dt);

      // VSAT Sun-Tracking + Deployment Unfold Animation
      for (let i = 0; i < vsatWings.length; i++) {
        vsatWings[i].rotation.y = Math.sin(elapsed * 0.42 + i * 0.4) * 0.55;
        vsatWings[i].scale.x = 0.25 + deploy * 0.75;
      }

      // Earth-Link Dish Continuous Gimbal Tracking
      dishHead.rotation.y = Math.sin(elapsed * 0.5) * 0.35 - 0.5;
      dishHead.rotation.x = Math.cos(elapsed * 0.35) * 0.14;

      // Airlock Pressurization Hatch Pulse & Cycle
      const hatchCycle = (Math.sin(elapsed * 1.1) + 1) * 0.5;
      airlockRingMat.color.setHex(telemetry.pressureKPa < ctx.habitat.limits.pressureMinKPa ? 0xf43f5e : 0x10b981);
      airlockRingMat.emissive.copy(airlockRingMat.color);
      airlockRingMat.emissiveIntensity = 0.5 + hatchCycle * 1.1;
      hatchDoor.position.z = 0.9 + Math.sin(elapsed * 0.8) * 0.04;

      // Electrostatic Lunar Dust Drift
      const dPos = dustGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        dPos[i * 3] += dt * 0.45;
        dPos[i * 3 + 1] += Math.sin(elapsed * 1.3 + i) * dt * 0.12;
        if (dPos[i * 3] > 8) dPos[i * 3] = -8;
      }
      dustGeo.attributes.position.needsUpdate = true;

      // Alarm beacon & interior strobe
      const isDanger = classification !== 'normal';
      const isCrit = classification === 'critical' || classification === 'extreme_emergency';
      alarmBeaconMat.color.setHex(isCrit ? 0xff1e38 : isDanger ? 0xf59e0b : 0x06b6d4);
      alarmBeaconMat.emissive.copy(alarmBeaconMat.color);
      alarmBeaconMat.emissiveIntensity = isDanger ? (flashOn ? 3.2 : 0.4) : 0.8;
      interiorLight.color.setHex(isCrit && flashOn ? 0xff3b4d : 0xe0f2fe);
      interiorLight.intensity = isCrit && flashOn ? 4.2 : 2.5;
    },
    dispose: () => {
      dispose();
    },
  };
}

// ===========================================================================
// 3. MARS SURFACE HABITAT — CHRYSE PLANITIA
// ===========================================================================
function createMarsHabitatHandle(renderer: THREE.WebGLRenderer): HabitatAssemblyHandle {
  const { trackGeo, trackMat, trackTex, dispose } = createRegistry();
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const rootGroup = new THREE.Group();
  const interactables: THREE.Object3D[] = [];

  const marsGroundTex = trackTex(createTerrainTexture('#7c2d12', '#9a3412', '#451a03', anisotropy));
  const solarTex = trackTex(createSolarCellTexture(anisotropy));
  const particleTex = trackTex(createParticleTexture());

  // Martian Oxide Terrain
  const groundGeo = trackGeo(new THREE.CylinderGeometry(32, 34, 0.8, 48, 8));
  const posAttr = groundGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    if (vy > 0) {
      const dist = Math.hypot(vx, vz);
      const dune = dist > 7 ? Math.sin(vx * 0.25 + vz * 0.15) * 0.4 + Math.max(0, (dist - 18) * 0.12) : 0;
      posAttr.setY(i, 0.4 + dune);
    }
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    trackMat(new THREE.MeshStandardMaterial({ map: marsGroundTex, roughness: 0.94, metalness: 0.03 }))
  );
  ground.position.y = -0.4;
  ground.receiveShadow = true;
  rootGroup.add(ground);

  // Martian Basalt Boulders (InstancedMesh)
  const boulderGeo = trackGeo(new THREE.DodecahedronGeometry(0.55, 0));
  const boulderMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x5c2410, roughness: 0.92, metalness: 0.05 }));
  const boulderCount = 46;
  const boulders = new THREE.InstancedMesh(boulderGeo, boulderMat, boulderCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < boulderCount; i++) {
    const a = (i / boulderCount) * Math.PI * 2 + (i % 4) * 0.25;
    const rad = 8.5 + (i % 8) * 2.1;
    dummy.position.set(Math.cos(a) * rad, 0.14, Math.sin(a) * rad);
    dummy.rotation.set(i * 0.4, i * 0.9, 0);
    dummy.scale.set(0.5 + (i % 3) * 0.45, 0.35 + (i % 4) * 0.2, 0.5 + (i % 5) * 0.3);
    dummy.updateMatrix();
    boulders.setMatrixAt(i, dummy.matrix);
    boulders.setColorAt(i, new THREE.Color(0x7c2d12).lerp(new THREE.Color(0x451a03), (i % 4) * 0.2));
  }
  boulders.instanceMatrix.needsUpdate = true;
  if (boulders.instanceColor) boulders.instanceColor.needsUpdate = true;
  boulders.computeBoundingSphere();
  rootGroup.add(boulders);

  rootGroup.add(createContactShadowMesh(7.0, 0.55, trackGeo, trackMat, trackTex));

  // Shared Materials
  const regolithShellMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd6b49c, roughness: 0.82, metalness: 0.12, transparent: true, opacity: 1 }));
  const whiteAlloyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.6 }));
  const darkMetalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.48, metalness: 0.8 }));
  const glassMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.38, roughness: 0.14, metalness: 0.1, depthWrite: false }));
  const growLightMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0xd946ef, emissiveIntensity: 1.2, roughness: 0.3 }));
  const isruPulseMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x22d3ee, emissiveIntensity: 1.4, roughness: 0.2 }));
  const alarmBeaconMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.8, roughness: 0.25 }));

  // 1. Central Command Dome (x = 0, z = 0)
  const commandFloor = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.6, 2.8, 0.35, 24)), darkMetalMat);
  commandFloor.position.y = 0.175;
  rootGroup.add(commandFloor);

  const commandLowerWall = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.45, 2.55, 1.35, 24, 1, true)), whiteAlloyMat);
  commandLowerWall.position.y = 0.9;
  tagInteractable(commandLowerWall, 'Chryse Command Dome', 'Pressurized Martian surface command & ECLSS habitat', interactables);
  rootGroup.add(commandLowerWall);

  const { group: consoleMesh, consoleScreen } = buildInteriorConsoleScreen(
    anisotropy,
    'CHRYSE MARS // C&W WORKSTATION',
    trackGeo,
    trackMat,
    trackTex,
    alarmBeaconMat,
    1.55,
    0.95
  );
  consoleMesh.position.set(0, 1.45, -1.65);
  rootGroup.add(consoleMesh);

  const interiorLight = new THREE.PointLight(0xffe4e6, 2.5, 10, 1.4);
  interiorLight.position.set(0, 2.4, 0);
  rootGroup.add(interiorLight);

  const flameChamber = createFlameChamberAssembly(trackGeo, trackMat, particleTex, false);
  flameChamber.group.position.set(1.1, 0.36, 0.42);
  flameChamber.group.scale.setScalar(0.75);
  tagInteractable(flameChamber.group, 'Mars 0.38g Combustion Rig', 'Martian gravity & dust-atmosphere flame test chamber', interactables);
  rootGroup.add(flameChamber.group);

  // Removable 3D-Printed Regolith Ribbed Dome Shell
  const commandRoofGroup = new THREE.Group();
  commandRoofGroup.position.y = 1.55;
  const domeRoof = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(2.5, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)),
    regolithShellMat
  );
  commandRoofGroup.add(domeRoof);
  for (let r = 0; r < 4; r++) {
    const rib = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.53, 0.07, 8, 28, Math.PI)), darkMetalMat);
    rib.rotation.y = (r * Math.PI) / 4;
    commandRoofGroup.add(rib);
  }
  rootGroup.add(commandRoofGroup);

  // 2. Bio-Dome Greenhouse Module (x = -4.6, z = 0.6) connected by airlock tube
  const tunnelToBio = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.65, 0.65, 2.3, 14)), whiteAlloyMat);
  tunnelToBio.rotation.z = Math.PI / 2;
  tunnelToBio.position.set(-2.6, 0.95, 0.35);
  tunnelToBio.rotation.y = -0.15;
  rootGroup.add(tunnelToBio);

  const bioGroup = new THREE.Group();
  bioGroup.position.set(-4.6, 0, 0.65);
  const bioBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.9, 2.1, 0.32, 20)), darkMetalMat);
  bioBase.position.y = 0.16;
  bioGroup.add(bioBase);
  const bioGlass = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1.85, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52)), glassMat);
  bioGlass.position.y = 0.32;
  bioGlass.renderOrder = 2;
  bioGroup.add(bioGlass);

  // Hydroponic Grow Rows & Glowing LED Bars inside Bio-Dome
  const plantMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x15803d, emissiveIntensity: 0.4, roughness: 0.75 }));
  for (const rz of [-0.6, 0, 0.6]) {
    const plantBed = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 0.38, 0.36)), plantMat);
    plantBed.position.set(0, 0.52, rz);
    bioGroup.add(plantBed);
    const ledStrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.0, 0.06, 0.1)), growLightMat);
    ledStrip.position.set(0, 1.05, rz);
    bioGroup.add(ledStrip);
  }
  const bioLight = new THREE.PointLight(0xe879f9, 1.8, 6, 1.5);
  bioLight.position.set(0, 1.3, 0);
  bioGroup.add(bioLight);
  tagInteractable(bioGroup, 'Hydroponic Bio-Dome', 'Bioregenerative crop O2/CO2 exchange & magenta grow-array', interactables);
  rootGroup.add(bioGroup);

  // 3. ISRU Sabatier Plant (x = 4.4, z = 0.4)
  const tunnelToIsru = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.55, 0.55, 2.0, 14)), whiteAlloyMat);
  tunnelToIsru.rotation.z = Math.PI / 2;
  tunnelToIsru.position.set(2.5, 0.9, 0.25);
  rootGroup.add(tunnelToIsru);

  const isruGroup = new THREE.Group();
  isruGroup.position.set(4.3, 0, 0.4);
  const isruBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.28, 2.2)), darkMetalMat);
  isruBase.position.y = 0.14;
  isruGroup.add(isruBase);

  const reactorCol = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.48, 2.5, 16)), whiteAlloyMat);
  reactorCol.position.set(-0.5, 1.4, 0);
  isruGroup.add(reactorCol);

  const isruPulseRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.52, 0.06, 8, 24)), isruPulseMat);
  isruPulseRing.rotation.x = Math.PI / 2;
  isruPulseRing.position.set(-0.5, 0.7, 0);
  isruGroup.add(isruPulseRing);

  for (const tz of [-0.55, 0.55]) {
    const ch4Tank = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.46, 14, 12)), whiteAlloyMat);
    ch4Tank.position.set(0.6, 0.78, tz);
    isruGroup.add(ch4Tank);
  }
  tagInteractable(isruGroup, 'Sabatier ISRU Reactor', 'Mars CO2-to-CH4/O2 propellant & air synthesis plant', interactables);
  rootGroup.add(isruGroup);

  // 4. Meteorological Mast with Spinning Anemometer & Wind Vane
  const metTower = new THREE.Group();
  metTower.position.set(2.4, 0, -2.5);
  const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.12, 4.4, 10)), darkMetalMat);
  pole.position.y = 2.2;
  metTower.add(pole);

  const anemometerRotor = new THREE.Group();
  anemometerRotor.position.set(0, 4.45, 0);
  for (let c = 0; c < 3; c++) {
    const armAngle = (c / 3) * Math.PI * 2;
    const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.04, 0.04)), whiteAlloyMat);
    arm.position.set(Math.cos(armAngle) * 0.27, 0, Math.sin(armAngle) * 0.27);
    arm.rotation.y = -armAngle;
    anemometerRotor.add(arm);
    const cup = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 10, 8)), alarmBeaconMat);
    cup.position.set(Math.cos(armAngle) * 0.55, 0, Math.sin(armAngle) * 0.55);
    anemometerRotor.add(cup);
  }
  metTower.add(anemometerRotor);

  const windVane = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.7, 0.16, 0.04)), alarmBeaconMat);
  windVane.position.set(0, 3.85, 0);
  metTower.add(windVane);
  tagInteractable(metTower, 'Martian Met Mast', 'Wind anemometer & atmospheric dust sensor array', interactables);
  rootGroup.add(metTower);

  // Ground Solar Array Wing
  const marsSolar = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(3.4, 0.08, 1.8)),
    trackMat(new THREE.MeshStandardMaterial({ map: solarTex, roughness: 0.24, metalness: 0.55 }))
  );
  marsSolar.position.set(-2.3, 0.9, -3.2);
  marsSolar.rotation.x = 0.45;
  rootGroup.add(marsSolar);

  // Horizontal Martian Dust Wind Particles
  const dustCount = 130;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 18;
    dustPos[i * 3 + 1] = 0.2 + Math.random() * 4.5;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xfdba74, map: particleTex, size: 0.2, transparent: true, opacity: 0.55, depthWrite: false });
  rootGroup.add(new THREE.Points(dustGeo, dustMat));

  return {
    habitatType: 'mars',
    animationLabel: 'Martian Wind Anemometer, Dust Plume & Bio-Dome Cycle',
    badgeText: 'MARS HABITAT TWIN',
    rootGroup,
    consoleScreen,
    alarmBeaconMat,
    interiorLights: [interiorLight, bioLight],
    interactables,
    presets: {
      exterior: [
        { id: 'outpost', label: 'Outpost' },
        { id: 'biodome', label: 'Bio-Dome' },
        { id: 'isru', label: 'ISRU Plant' },
        { id: 'met', label: 'Met Tower' },
      ],
      internal: [
        { id: 'command', label: 'Command Hub' },
        { id: 'console', label: 'C&W Console' },
        { id: 'biodome_in', label: 'Bio-Dome' },
        { id: 'isru_in', label: 'ISRU View' },
      ],
    },
    defaultPresetId: { exterior: 'outpost', internal: 'console' },
    internalBounds: { minX: -1.8, maxX: 1.8, minZ: -1.4, maxZ: 1.4 },
    environment: {
      backgroundHex: 0x230e09,
      fogHex: 0x2b120c,
      fogDensity: 0.015,
      sunColorHex: 0xffd7ba,
      sunIntensity: 3.0,
      hemiSkyHex: 0xfb923c,
      hemiGroundHex: 0x451a03,
      hemiIntensity: 0.95,
      showEarthLimb: false,
    },
    applyPreset: (presetId, camTargets) => {
      if (presetId === 'flame_lab') {
        camTargets.orbitFocus = { x: 1.1, y: 0.72, z: 0.42 };
        camTargets.sphericalTarget = { radius: 2.1, theta: 0.85, phi: 1.24 };
        camTargets.lookTargetY = 0.72;
        return;
      }
      if (presetId === 'console') {
        camTargets.internalPosTarget = { x: 0.0, y: 1.45, z: -0.05 };
        camTargets.internalYawTarget = -Math.PI * 0.5;
        camTargets.internalPitchTarget = -0.02;
      } else if (presetId === 'biodome_in') {
        camTargets.internalPosTarget = { x: -2.0, y: 1.4, z: 0.55 };
        camTargets.internalYawTarget = Math.PI;
        camTargets.internalPitchTarget = -0.06;
      } else if (presetId === 'isru_in') {
        camTargets.internalPosTarget = { x: 1.8, y: 1.5, z: 0.35 };
        camTargets.internalYawTarget = 0.0;
        camTargets.internalPitchTarget = -0.05;
      } else if (presetId === 'command') {
        camTargets.internalPosTarget = { x: 1.2, y: 1.65, z: 1.1 };
        camTargets.internalYawTarget = -Math.PI * 0.72;
        camTargets.internalPitchTarget = -0.08;
      } else if (presetId === 'biodome') {
        camTargets.sphericalTarget = { radius: 11.5, theta: 2.2, phi: 1.15 };
        camTargets.lookTargetY = 1.2;
        camTargets.orbitFocus = { x: 0, y: 1.2, z: 0 };
      } else if (presetId === 'isru') {
        camTargets.sphericalTarget = { radius: 11.5, theta: -0.35, phi: 1.15 };
        camTargets.lookTargetY = 1.4;
        camTargets.orbitFocus = { x: 0, y: 1.4, z: 0 };
      } else if (presetId === 'met') {
        camTargets.sphericalTarget = { radius: 10.5, theta: -0.85, phi: 1.1 };
        camTargets.lookTargetY = 2.6;
        camTargets.orbitFocus = { x: 0, y: 2.6, z: 0 };
      } else {
        camTargets.sphericalTarget = { radius: 16.5, theta: 0.68, phi: 1.12 };
        camTargets.lookTargetY = 1.4;
        camTargets.orbitFocus = { x: 0, y: 1.4, z: 0 };
      }
    },
    update: (dt, elapsed, ctx) => {
      const { viewMode, explodedRatio, cutawayProgress, classification, flashOn, telemetry, introProgress, flameConfig, flameAnalysis, selfHealingActive } = ctx;
      const deploy = THREE.MathUtils.smoothstep(introProgress, 0, 1);
      flameChamber.update(dt, elapsed, flameConfig || DEFAULT_FLAME_TEST_CONFIG, flameAnalysis || analyzeFlameConditions(flameConfig || DEFAULT_FLAME_TEST_CONFIG), Boolean(selfHealingActive));

      const revealRatio = viewMode === 'internal' || viewMode === 'flame_lab' ? 1 : Math.max(cutawayProgress, explodedRatio * 0.85);
      commandRoofGroup.position.y = THREE.MathUtils.damp(commandRoofGroup.position.y, 1.55 + revealRatio * 3.0, 5, dt);
      regolithShellMat.opacity = 1 - revealRatio * 0.85;
      commandRoofGroup.visible = revealRatio < 0.96;

      bioGroup.position.x = THREE.MathUtils.damp(bioGroup.position.x, -4.6 - explodedRatio * 2.4, 4.5, dt);
      isruGroup.position.x = THREE.MathUtils.damp(isruGroup.position.x, 4.3 + explodedRatio * 2.4, 4.5, dt);

      // 1. Anemometer Spin & Wind Vane Flutter
      const windFactor = 1.8 + Math.min(4.0, telemetry.airflowVelocity * 10);
      anemometerRotor.rotation.y += dt * windFactor * (0.4 + deploy * 0.6);
      windVane.rotation.y = Math.sin(elapsed * 2.4) * 0.38;

      // 2. Bio-Dome Hydroponic Photosynthesis Grow-Light Cycle
      const bioCycle = 0.75 + Math.sin(elapsed * 1.9) * 0.45;
      growLightMat.emissiveIntensity = bioCycle;
      bioLight.intensity = 1.2 + bioCycle * 0.9;

      // 3. ISRU Sabatier Pulse Ring climbing reactor column
      const pulseY = 0.65 + ((elapsed * 0.9) % 1.9);
      isruPulseRing.position.y = pulseY;
      isruPulseMat.emissiveIntensity = 0.8 + Math.sin(elapsed * 5) * 0.5;

      // 4. Sweeping Martian Dust Wind
      const dPos = dustGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        dPos[i * 3] += dt * (2.6 + telemetry.airflowVelocity * 4.0);
        dPos[i * 3 + 1] += Math.sin(elapsed * 2.2 + i) * dt * 0.25;
        if (dPos[i * 3] > 9) dPos[i * 3] = -9;
      }
      dustGeo.attributes.position.needsUpdate = true;

      // Alarm Lights
      const isDanger = classification !== 'normal';
      const isCrit = classification === 'critical' || classification === 'extreme_emergency';
      alarmBeaconMat.color.setHex(isCrit ? 0xff1e38 : isDanger ? 0xf59e0b : 0x06b6d4);
      alarmBeaconMat.emissive.copy(alarmBeaconMat.color);
      alarmBeaconMat.emissiveIntensity = isDanger ? (flashOn ? 3.2 : 0.4) : 0.85;
      interiorLight.color.setHex(isCrit && flashOn ? 0xff3b4d : 0xffe4e6);
      interiorLight.intensity = isCrit && flashOn ? 4.2 : 2.6;
    },
    dispose: () => dispose(),
  };
}

// ===========================================================================
// 4. DEEP SPACE TRANSIT SPACECRAFT (ORION / GATEWAY)
// ===========================================================================
function createSpacecraftHabitatHandle(renderer: THREE.WebGLRenderer): HabitatAssemblyHandle {
  const { trackGeo, trackMat, trackTex, dispose } = createRegistry();
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const rootGroup = new THREE.Group();
  const interactables: THREE.Object3D[] = [];

  const solarTex = trackTex(createSolarCellTexture(anisotropy));
  const hullMaps = createHullPanelTexture(anisotropy);
  trackTex(hullMaps.map);
  trackTex(hullMaps.bumpMap);
  const particleTex = trackTex(createParticleTexture());

  const whiteHullMat = trackMat(new THREE.MeshStandardMaterial({ map: hullMaps.map, bumpMap: hullMaps.bumpMap, bumpScale: 0.015, color: 0xe2e8f0, roughness: 0.3, metalness: 0.72 }));
  const heatShieldMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.82, metalness: 0.18 }));
  const darkMetalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42, metalness: 0.82 }));
  const silverMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.22, metalness: 0.9 }));
  const solarMat = trackMat(new THREE.MeshStandardMaterial({ map: solarTex, emissive: 0x0c4a6e, emissiveIntensity: 0.25, roughness: 0.2, metalness: 0.5 }));
  const windowGlowMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 1.0, roughness: 0.15 }));
  const alarmBeaconMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.9, roughness: 0.2 }));
  const crewShellMat = trackMat(new THREE.MeshStandardMaterial({ map: hullMaps.map, color: 0xf1f5f9, roughness: 0.3, metalness: 0.7, transparent: true, opacity: 1 }));

  const craftGroup = new THREE.Group();
  rootGroup.add(craftGroup);

  // Conical Crew Module (centered around x = +2.1)
  const crewGroup = new THREE.Group();
  crewGroup.position.set(2.1, 0, 0);
  craftGroup.add(crewGroup);

  const capsuleHull = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.15, 2.25, 2.5, 24)), crewShellMat);
  capsuleHull.rotation.z = -Math.PI / 2;
  tagInteractable(capsuleHull, 'Orion Crew Capsule', 'Pressurized 20 m³ deep space crew cabin & avionics', interactables);
  crewGroup.add(capsuleHull);

  // Forward Docking Collar
  const dockCollar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.82, 1.0, 0.65, 20)), silverMat);
  dockCollar.rotation.z = -Math.PI / 2;
  dockCollar.position.x = 1.55;
  crewGroup.add(dockCollar);

  // Cockpit Windows
  for (const wz of [-0.65, 0.65]) {
    const win = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.28, 0.12)), windowGlowMat);
    win.position.set(0.55, 0.85, wz);
    win.rotation.z = -0.38;
    win.rotation.y = wz > 0 ? 0.35 : -0.35;
    crewGroup.add(win);
  }

  // Interior C&W Cockpit Console
  const { group: consoleMesh, consoleScreen } = buildInteriorConsoleScreen(
    anisotropy,
    'ORION ESM // C&W WORKSTATION',
    trackGeo,
    trackMat,
    trackTex,
    alarmBeaconMat,
    1.25,
    0.78
  );
  consoleMesh.position.set(0.3, 0.05, 0);
  consoleMesh.rotation.y = -Math.PI / 2;
  crewGroup.add(consoleMesh);

  const interiorLight = new THREE.PointLight(0xe0f2fe, 2.2, 8, 1.5);
  interiorLight.position.set(2.2, 0.4, 0);
  craftGroup.add(interiorLight);

  const flameChamber = createFlameChamberAssembly(trackGeo, trackMat, particleTex, false);
  flameChamber.group.position.set(-0.15, -0.58, 0.62);
  flameChamber.group.scale.setScalar(0.56);
  tagInteractable(flameChamber.group, 'Orion Microgravity Flame Rig', 'Deep-space capsule combustion & ventilation test rig', interactables);
  crewGroup.add(flameChamber.group);

  // Ablative Heat Shield (x = +0.75)
  const heatShield = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.28, 2.05, 0.34, 24)), heatShieldMat);
  heatShield.rotation.z = -Math.PI / 2;
  heatShield.position.set(0.75, 0, 0);
  tagInteractable(heatShield, 'Avcoat Heat Shield', '1650°C lunar/Mars atmospheric re-entry thermal shield', interactables);
  craftGroup.add(heatShield);

  // European Service Module (ESM) Cylinder (x = -1.6)
  const esmGroup = new THREE.Group();
  esmGroup.position.set(-1.6, 0, 0);
  craftGroup.add(esmGroup);

  const esmBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.92, 1.92, 3.6, 24)), whiteHullMat);
  esmBody.rotation.z = -Math.PI / 2;
  tagInteractable(esmBody, 'European Service Module', 'Cryogenic O2/H2O propellant, power & AJ10 propulsion', interactables);
  esmGroup.add(esmBody);

  // 4 Iconic X-Wing Angled Solar Arrays
  const xWings: THREE.Group[] = [];
  const xAngles = [Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.25, -Math.PI * 0.75];
  xAngles.forEach((ang, idx) => {
    const wing = new THREE.Group();
    wing.rotation.x = ang;
    const arm = new THREE.Group();
    arm.position.set(0, 2.05, 0);
    const mast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 8)), darkMetalMat);
    mast.position.y = 2.2;
    arm.add(mast);
    const panel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.45, 4.4, 0.05)), solarMat);
    panel.position.y = 2.35;
    arm.add(panel);
    wing.add(arm);
    tagInteractable(wing, `X-Wing Array ${idx + 1}`, 'Swept photovoltaic wing with thruster-plume clearance angle', interactables);
    esmGroup.add(wing);
    xWings.push(wing);
  });

  // Main AJ10 OMS Engine Nozzle + Glowing Plasma Plume Cone
  const nozzlePoints = [
    new THREE.Vector2(0.32, 0),
    new THREE.Vector2(0.55, -0.5),
    new THREE.Vector2(0.88, -1.2),
  ];
  const engineNozzle = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(nozzlePoints, 24)), darkMetalMat);
  engineNozzle.rotation.z = -Math.PI / 2;
  engineNozzle.position.set(-1.8, 0, 0);
  tagInteractable(engineNozzle, 'AJ10 Main OMS Engine', 'Primary orbital maneuvering thruster with active burn plume', interactables);
  esmGroup.add(engineNozzle);

  const plumeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  const plumeCone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.82, 4.2, 20, 1, true)), plumeMat);
  plumeCone.rotation.z = -Math.PI / 2;
  plumeCone.position.set(-5.0, 0, 0);
  esmGroup.add(plumeCone);

  const engineGlowLight = new THREE.PointLight(0x38bdf8, 2.8, 12, 1.5);
  engineGlowLight.position.set(-4.2, 0, 0);
  esmGroup.add(engineGlowLight);

  // Periodic RCS Thruster Quad Plumes
  const rcsPlumes: THREE.Mesh[] = [];
  const rcsPlumeMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  for (let r = 0; r < 4; r++) {
    const a = (r / 4) * Math.PI * 2;
    const puff = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.18, 1.0, 10)), rcsPlumeMat);
    puff.position.set(-0.9, Math.cos(a) * 2.45, Math.sin(a) * 2.45);
    puff.rotation.x = a;
    esmGroup.add(puff);
    rcsPlumes.push(puff);
  }

  // Exhaust Particle Trail
  const exhaustCount = 120;
  const exhaustGeo = new THREE.BufferGeometry();
  const exhaustPos = new Float32Array(exhaustCount * 3);
  for (let i = 0; i < exhaustCount; i++) {
    exhaustPos[i * 3] = -3.2 - Math.random() * 11;
    exhaustPos[i * 3 + 1] = (Math.random() - 0.5) * 1.1;
    exhaustPos[i * 3 + 2] = (Math.random() - 0.5) * 1.1;
  }
  exhaustGeo.setAttribute('position', new THREE.BufferAttribute(exhaustPos, 3));
  const exhaustMat = new THREE.PointsMaterial({ color: 0x7dd3fc, map: particleTex, size: 0.34, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
  esmGroup.add(new THREE.Points(exhaustGeo, exhaustMat));

  return {
    habitatType: 'spacecraft',
    animationLabel: 'OMS Thruster Burn, RCS Attitude Puffs & BBQ Roll',
    badgeText: 'DEEP SPACE CRAFT',
    rootGroup,
    consoleScreen,
    alarmBeaconMat,
    interiorLights: [interiorLight],
    interactables,
    presets: {
      exterior: [
        { id: 'cruise', label: 'Cruise' },
        { id: 'plume', label: 'OMS Plume' },
        { id: 'shield', label: 'Heat Shield' },
        { id: 'xwings', label: 'X-Wings' },
      ],
      internal: [
        { id: 'cockpit', label: 'Cockpit' },
        { id: 'console', label: 'C&W Console' },
        { id: 'docking', label: 'Docking Hatch' },
        { id: 'esm', label: 'ESM Core' },
      ],
    },
    defaultPresetId: { exterior: 'cruise', internal: 'console' },
    internalBounds: { minX: 1.0, maxX: 3.1, minZ: -0.9, maxZ: 0.9 },
    environment: {
      backgroundHex: 0x040711,
      fogHex: 0x040711,
      fogDensity: 0.006,
      sunColorHex: 0xfff5e4,
      sunIntensity: 3.2,
      hemiSkyHex: 0x38bdf8,
      hemiGroundHex: 0x090d1a,
      hemiIntensity: 0.85,
      showEarthLimb: false,
    },
    applyPreset: (presetId, camTargets) => {
      if (presetId === 'flame_lab') {
        camTargets.orbitFocus = { x: 1.95, y: -0.3, z: 0.62 };
        camTargets.sphericalTarget = { radius: 1.75, theta: 0.95, phi: 1.22 };
        camTargets.lookTargetY = -0.3;
        return;
      }
      if (presetId === 'console') {
        camTargets.internalPosTarget = { x: 1.5, y: 0.1, z: 0.0 };
        camTargets.internalYawTarget = 0.0;
        camTargets.internalPitchTarget = -0.02;
      } else if (presetId === 'cockpit') {
        camTargets.internalPosTarget = { x: 1.2, y: 0.35, z: 0.7 };
        camTargets.internalYawTarget = -0.5;
        camTargets.internalPitchTarget = -0.1;
      } else if (presetId === 'docking') {
        camTargets.internalPosTarget = { x: 2.3, y: 0.15, z: 0.0 };
        camTargets.internalYawTarget = 0.0;
        camTargets.internalPitchTarget = 0.05;
      } else if (presetId === 'esm') {
        camTargets.internalPosTarget = { x: 0.6, y: 0.25, z: 0.8 };
        camTargets.internalYawTarget = Math.PI - 0.3;
        camTargets.internalPitchTarget = -0.05;
      } else if (presetId === 'plume') {
        camTargets.sphericalTarget = { radius: 13.0, theta: -2.2, phi: 1.28 };
        camTargets.lookTargetY = 0;
        camTargets.orbitFocus = { x: 0, y: 0, z: 0 };
      } else if (presetId === 'shield') {
        camTargets.sphericalTarget = { radius: 10.5, theta: 0.8, phi: 1.4 };
        camTargets.lookTargetY = 0;
        camTargets.orbitFocus = { x: 0, y: 0, z: 0 };
      } else if (presetId === 'xwings') {
        camTargets.sphericalTarget = { radius: 14.5, theta: -0.9, phi: 0.85 };
        camTargets.lookTargetY = 0;
        camTargets.orbitFocus = { x: 0, y: 0, z: 0 };
      } else {
        camTargets.sphericalTarget = { radius: 14.0, theta: 0.68, phi: 1.1 };
        camTargets.lookTargetY = 0;
        camTargets.orbitFocus = { x: 0, y: 0, z: 0 };
      }
    },
    update: (dt, elapsed, ctx) => {
      const { viewMode, explodedRatio, cutawayProgress, classification, flashOn, introProgress, flameConfig, flameAnalysis, selfHealingActive } = ctx;
      const deploy = THREE.MathUtils.smoothstep(introProgress, 0, 1);
      flameChamber.update(dt, elapsed, flameConfig || DEFAULT_FLAME_TEST_CONFIG, flameAnalysis || analyzeFlameConditions(flameConfig || DEFAULT_FLAME_TEST_CONFIG), Boolean(selfHealingActive));

      // Thermal-conditioning gentle roll & pitch in exterior/cutaway mode
      if (viewMode !== 'internal' && viewMode !== 'flame_lab') {
        craftGroup.rotation.x = Math.sin(elapsed * 0.35) * 0.16;
        craftGroup.rotation.z = Math.sin(elapsed * 0.5) * 0.035;
      } else {
        craftGroup.rotation.x = THREE.MathUtils.damp(craftGroup.rotation.x, 0, 6, dt);
        craftGroup.rotation.z = THREE.MathUtils.damp(craftGroup.rotation.z, 0, 6, dt);
      }

      // Cutaway / Explode
      const revealRatio = viewMode === 'internal' || viewMode === 'flame_lab' ? 1 : cutawayProgress;
      crewShellMat.opacity = 1 - revealRatio * 0.82;
      crewGroup.position.x = THREE.MathUtils.damp(crewGroup.position.x, 2.1 + explodedRatio * 2.4, 4.5, dt);
      heatShield.position.x = THREE.MathUtils.damp(heatShield.position.x, 0.75 + explodedRatio * 0.8, 4.5, dt);
      esmGroup.position.x = THREE.MathUtils.damp(esmGroup.position.x, -1.6 - explodedRatio * 1.8, 4.5, dt);

      // X-wing deployment unfold + subtle gimbal
      for (let i = 0; i < xWings.length; i++) {
        const baseA = xAngles[i];
        xWings[i].rotation.x = baseA + (1 - deploy) * 0.6 + Math.sin(elapsed * 0.6 + i) * 0.04;
      }

      // Main OMS Plume Flicker
      const plumePulse = 0.88 + Math.sin(elapsed * 22) * 0.12 + Math.cos(elapsed * 37) * 0.08;
      plumeCone.scale.set(plumePulse, 0.9 + Math.sin(elapsed * 18) * 0.14, 0.9 + Math.cos(elapsed * 18) * 0.14);
      plumeMat.opacity = 0.55 + Math.sin(elapsed * 25) * 0.18;
      engineGlowLight.intensity = 2.4 + Math.sin(elapsed * 20) * 0.7;

      // Periodic RCS Attitude Puffs
      const rcsWindow = elapsed % 3.2;
      rcsPlumeMat.opacity = rcsWindow < 0.45 ? Math.sin((rcsWindow / 0.45) * Math.PI) * 0.75 : 0.0;

      // Exhaust particle stream shooting aft (-X)
      const ePos = exhaustGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < exhaustCount; i++) {
        ePos[i * 3] -= dt * 11.5;
        if (ePos[i * 3] < -14) {
          ePos[i * 3] = -3.0 - Math.random() * 0.5;
          ePos[i * 3 + 1] = (Math.random() - 0.5) * 0.9;
          ePos[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
        }
      }
      exhaustGeo.attributes.position.needsUpdate = true;

      // Alarm Lights
      const isDanger = classification !== 'normal';
      const isCrit = classification === 'critical' || classification === 'extreme_emergency';
      alarmBeaconMat.color.setHex(isCrit ? 0xff1e38 : isDanger ? 0xf59e0b : 0x06b6d4);
      alarmBeaconMat.emissive.copy(alarmBeaconMat.color);
      alarmBeaconMat.emissiveIntensity = isDanger ? (flashOn ? 3.2 : 0.4) : 0.9;
      interiorLight.color.setHex(isCrit && flashOn ? 0xff3b4d : 0xe0f2fe);
      interiorLight.intensity = isCrit && flashOn ? 4.0 : 2.2;
    },
    dispose: () => dispose(),
  };
}

// ===========================================================================
// 5. PRESSURIZED EXPLORATION ROVER (PRV-1)
// ===========================================================================
function createRoverHabitatHandle(renderer: THREE.WebGLRenderer): HabitatAssemblyHandle {
  const { trackGeo, trackMat, trackTex, dispose } = createRegistry();
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const rootGroup = new THREE.Group();
  const interactables: THREE.Object3D[] = [];

  const groundTex = trackTex(createTerrainTexture('#475569', '#64748b', '#1e293b', anisotropy));
  const treadTex = trackTex(createTireTreadTexture(anisotropy));
  const particleTex = trackTex(createParticleTexture());

  // Traverse Terrain
  const ground = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(28, 30, 0.8, 48)),
    trackMat(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.93, metalness: 0.06 }))
  );
  ground.position.y = -0.4;
  ground.receiveShadow = true;
  rootGroup.add(ground);

  // Scrolling Regolith Pebbles (InstancedMesh updated smoothly each frame for traverse speed!)
  const pebbleGeo = trackGeo(new THREE.DodecahedronGeometry(0.28, 0));
  const pebbleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 }));
  const pebbleCount = 54;
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
  const pebbleData = Array.from({ length: pebbleCount }, (_, i) => ({
    x: (Math.random() - 0.5) * 26,
    z: (i % 2 === 0 ? 1 : -1) * (2.6 + Math.random() * 10),
    s: 0.4 + Math.random() * 1.1,
    r: Math.random() * Math.PI,
  }));
  const dummy = new THREE.Object3D();
  pebbleData.forEach((p, i) => {
    dummy.position.set(p.x, 0.08, p.z);
    dummy.rotation.set(p.r, p.r * 0.7, 0);
    dummy.scale.set(p.s, p.s * 0.6, p.s);
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
  });
  pebbles.instanceMatrix.needsUpdate = true;
  pebbles.frustumCulled = false;
  rootGroup.add(pebbles);

  rootGroup.add(createContactShadowMesh(4.4, 0.55, trackGeo, trackMat, trackTex));

  // Rover Materials
  const whiteHullMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.34, metalness: 0.52 }));
  const goldTrimMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.24, metalness: 0.88 }));
  const chassisMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.78 }));
  const tireMat = trackMat(new THREE.MeshStandardMaterial({ map: treadTex, roughness: 0.75, metalness: 0.35 }));
  const canopyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.36, roughness: 0.12, metalness: 0.15, depthWrite: false }));
  const roofShellMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.38, metalness: 0.5, transparent: true, opacity: 1 }));
  const alarmBeaconMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.9, roughness: 0.2 }));
  const lidarScanMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));

  // Rover Chassis (grounded on wheels of radius 0.62 -> wheel axle at y = 0.62)
  const roverBody = new THREE.Group();
  rootGroup.add(roverBody);

  const frameRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.6, 0.36, 2.2)), chassisMat);
  frameRail.position.y = 0.95;
  roverBody.add(frameRail);

  // 6 Articulated Rocker-Bogie Wheels
  const wheels: THREE.Group[] = [];
  const wheelX = [-1.95, 0.0, 1.95];
  const wheelZ = [-1.42, 1.42];
  const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.62, 0.62, 0.44, 20));
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.28, 0.48, 12));
  wheelGeo.rotateX(Math.PI / 2);
  hubGeo.rotateX(Math.PI / 2);

  wheelZ.forEach((wz) => {
    wheelX.forEach((wx) => {
      const wg = new THREE.Group();
      wg.position.set(wx, 0.62, wz);
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      const hub = new THREE.Mesh(hubGeo, goldTrimMat);
      wg.add(tire, hub);
      const strut = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.55, 0.18)), chassisMat);
      strut.position.set(0, 0.3, wz > 0 ? -0.18 : 0.18);
      wg.add(strut);
      roverBody.add(wg);
      wheels.push(wg);
    });
  });

  // Pressurized Aft Cabin + Forward Cockpit
  const cabinFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.1, 0.2, 2.25)), chassisMat);
  cabinFloor.position.set(-0.2, 1.25, 0);
  roverBody.add(cabinFloor);

  const aftCabin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 1.55, 2.35)), whiteHullMat);
  aftCabin.position.set(-1.1, 2.1, 0);
  tagInteractable(aftCabin, 'PRV-1 Pressurized Cabin', '42 m³ RCA amine scrubber cabin for 2 EVA astronauts', interactables);
  roverBody.add(aftCabin);

  // Forward Cockpit Canopy (Transparent bubble showing cockpit seats & C&W console)
  const cockpitCanopy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.75, 1.38, 2.25)), canopyMat);
  cockpitCanopy.position.set(1.35, 2.05, 0);
  cockpitCanopy.renderOrder = 2;
  roverBody.add(cockpitCanopy);

  // Twin Astronaut Seats inside cockpit
  for (const sz of [-0.48, 0.48]) {
    const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.5, 0.72, 0.45)), chassisMat);
    seat.position.set(1.05, 1.7, sz);
    roverBody.add(seat);
  }

  // Cockpit C&W Console Screen facing aft seats
  const { group: consoleMesh, consoleScreen } = buildInteriorConsoleScreen(
    anisotropy,
    'PRV-1 ROVER // C&W WORKSTATION',
    trackGeo,
    trackMat,
    trackTex,
    alarmBeaconMat,
    1.18,
    0.72
  );
  consoleMesh.position.set(1.72, 1.88, 0);
  consoleMesh.rotation.y = -Math.PI / 2;
  roverBody.add(consoleMesh);

  const interiorLight = new THREE.PointLight(0xe0f2fe, 2.0, 6, 1.5);
  interiorLight.position.set(0.8, 2.4, 0);
  roverBody.add(interiorLight);

  const flameChamber = createFlameChamberAssembly(trackGeo, trackMat, particleTex, false);
  flameChamber.group.position.set(-0.75, 1.35, 0.38);
  flameChamber.group.scale.setScalar(0.6);
  tagInteractable(flameChamber.group, 'Rover Cabin Flame Test Rig', 'Mobile exploration cabin combustion & suppression test chamber', interactables);
  roverBody.add(flameChamber.group);

  // Roof Canopy Lid (for cutaway) + Suit-Port Backpacks
  const roofLid = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 0.2, 2.38)), roofShellMat);
  roofLid.position.set(-0.2, 2.95, 0);
  roverBody.add(roofLid);

  for (const sz of [-0.48, 0.48]) {
    const suitPack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 1.05, 0.62)), goldTrimMat);
    suitPack.position.set(-2.55, 2.05, sz);
    roverBody.add(suitPack);
  }

  // Roof LiDAR / Stereo Cam Mast + Laser Scan Fan!
  const mastGroup = new THREE.Group();
  mastGroup.position.set(1.0, 3.05, 0);
  const mastStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 0.85, 10)), chassisMat);
  mastStem.position.y = 0.42;
  mastGroup.add(mastStem);

  const mastHead = new THREE.Group();
  mastHead.position.y = 0.92;
  const sensorBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.28, 0.65)), whiteHullMat);
  mastHead.add(sensorBox);
  const lidarLens = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 12)), alarmBeaconMat);
  lidarLens.rotation.z = Math.PI / 2;
  lidarLens.position.x = 0.3;
  mastHead.add(lidarLens);
  const scanFan = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.85, 3.2, 16, 1, true)), lidarScanMat);
  scanFan.rotation.z = Math.PI * 0.5 + 0.24;
  scanFan.position.set(1.85, -0.38, 0);
  mastHead.add(scanFan);
  mastGroup.add(mastHead);
  tagInteractable(mastGroup, 'LiDAR Navigation Mast', 'Sweeping stereo terrain avoidance scanner', interactables);
  roverBody.add(mastGroup);

  // Articulated Robotic Sample Arm (Front Starboard)
  const armBase = new THREE.Group();
  armBase.position.set(2.25, 1.15, 0.85);
  const shoulder = new THREE.Group();
  const upperArm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 0.14, 0.14)), goldTrimMat);
  upperArm.position.x = 0.55;
  shoulder.add(upperArm);
  const elbow = new THREE.Group();
  elbow.position.x = 1.1;
  const forearm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.9, 0.11, 0.11)), whiteHullMat);
  forearm.position.x = 0.45;
  elbow.add(forearm);
  const scoop = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.16, 0.32, 8)), chassisMat);
  scoop.rotation.z = -Math.PI / 2;
  scoop.position.x = 0.96;
  elbow.add(scoop);
  shoulder.add(elbow);
  armBase.add(shoulder);
  tagInteractable(armBase, 'Robotic Sample Arm', 'Articulated 3-DOF regolith geological sampler', interactables);
  roverBody.add(armBase);

  // Forward LED Headlights
  const headlightMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfef9c3 }));
  for (const lz of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12)), headlightMat);
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(2.34, 1.15, lz);
    roverBody.add(lamp);
  }
  const headSpot = new THREE.SpotLight(0xfef9c3, 3.2, 16, Math.PI / 5, 0.5);
  headSpot.position.set(2.3, 1.2, 0);
  headSpot.target.position.set(8.5, 0, 0);
  roverBody.add(headSpot, headSpot.target);

  // Wheel Dust Plume
  const dustCount = 65;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = -2.2 - Math.random() * 4.5;
    dustPos[i * 3 + 1] = 0.15 + Math.random() * 0.9;
    dustPos[i * 3 + 2] = (i % 2 === 0 ? 1.42 : -1.42) + (Math.random() - 0.5) * 0.4;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xcbd5e1, map: particleTex, size: 0.24, transparent: true, opacity: 0.42, depthWrite: false });
  rootGroup.add(new THREE.Points(dustGeo, dustMat));

  return {
    habitatType: 'rover',
    animationLabel: '6×6 Rocker-Bogie Drive, LiDAR Scan & Robotic Sample Arm',
    badgeText: 'ROVER PRV-1 TWIN',
    rootGroup,
    consoleScreen,
    alarmBeaconMat,
    interiorLights: [interiorLight],
    interactables,
    presets: {
      exterior: [
        { id: 'traverse', label: 'Traverse' },
        { id: 'bogie', label: '6x6 Bogie' },
        { id: 'arm', label: 'Sample Arm' },
        { id: 'lidar', label: 'LiDAR Mast' },
      ],
      internal: [
        { id: 'cockpit', label: 'Cockpit' },
        { id: 'console', label: 'C&W Console' },
        { id: 'suitport', label: 'Suit-Port' },
        { id: 'deck', label: 'Cabin View' },
      ],
    },
    defaultPresetId: { exterior: 'traverse', internal: 'console' },
    internalBounds: { minX: -1.4, maxX: 1.4, minZ: -0.7, maxZ: 0.7 },
    environment: {
      backgroundHex: 0x060a14,
      fogHex: 0x060a14,
      fogDensity: 0.012,
      sunColorHex: 0xfff5e4,
      sunIntensity: 3.1,
      hemiSkyHex: 0x94a3b8,
      hemiGroundHex: 0x1e293b,
      hemiIntensity: 0.85,
      showEarthLimb: false,
    },
    applyPreset: (presetId, camTargets) => {
      if (presetId === 'flame_lab') {
        camTargets.orbitFocus = { x: -0.75, y: 1.65, z: 0.38 };
        camTargets.sphericalTarget = { radius: 1.9, theta: 0.78, phi: 1.24 };
        camTargets.lookTargetY = 1.65;
        return;
      }
      if (presetId === 'console') {
        camTargets.internalPosTarget = { x: 0.35, y: 1.9, z: 0.0 };
        camTargets.internalYawTarget = 0.0;
        camTargets.internalPitchTarget = -0.02;
      } else if (presetId === 'cockpit') {
        camTargets.internalPosTarget = { x: 0.2, y: 2.05, z: 0.45 };
        camTargets.internalYawTarget = -0.25;
        camTargets.internalPitchTarget = -0.08;
      } else if (presetId === 'suitport') {
        camTargets.internalPosTarget = { x: -0.5, y: 1.95, z: 0.0 };
        camTargets.internalYawTarget = Math.PI;
        camTargets.internalPitchTarget = -0.04;
      } else if (presetId === 'deck') {
        camTargets.internalPosTarget = { x: -1.1, y: 2.15, z: 0.55 };
        camTargets.internalYawTarget = -0.35;
        camTargets.internalPitchTarget = -0.08;
      } else if (presetId === 'bogie') {
        camTargets.sphericalTarget = { radius: 9.0, theta: 1.5, phi: 1.32 };
        camTargets.lookTargetY = 1.0;
        camTargets.orbitFocus = { x: 0, y: 1.0, z: 0 };
      } else if (presetId === 'arm') {
        camTargets.sphericalTarget = { radius: 8.5, theta: 0.45, phi: 1.2 };
        camTargets.lookTargetY = 1.4;
        camTargets.orbitFocus = { x: 0, y: 1.4, z: 0 };
      } else if (presetId === 'lidar') {
        camTargets.sphericalTarget = { radius: 9.5, theta: 0.72, phi: 0.92 };
        camTargets.lookTargetY = 2.8;
        camTargets.orbitFocus = { x: 0, y: 2.8, z: 0 };
      } else {
        camTargets.sphericalTarget = { radius: 11.5, theta: 0.68, phi: 1.14 };
        camTargets.lookTargetY = 1.5;
        camTargets.orbitFocus = { x: 0, y: 1.5, z: 0 };
      }
    },
    update: (dt, elapsed, ctx) => {
      const { viewMode, explodedRatio, cutawayProgress, classification, flashOn, flameConfig, flameAnalysis, selfHealingActive } = ctx;
      flameChamber.update(dt, elapsed, flameConfig || DEFAULT_FLAME_TEST_CONFIG, flameAnalysis || analyzeFlameConditions(flameConfig || DEFAULT_FLAME_TEST_CONFIG), Boolean(selfHealingActive));

      const revealRatio = viewMode === 'internal' || viewMode === 'flame_lab' ? 1 : Math.max(cutawayProgress, explodedRatio * 0.85);
      roofLid.position.y = THREE.MathUtils.damp(roofLid.position.y, 2.95 + revealRatio * 2.2, 5, dt);
      roofShellMat.opacity = 1 - revealRatio * 0.9;
      roofLid.visible = revealRatio < 0.96;

      // 1. 6x6 Wheel Spin + Rocker-Bogie Suspension Bob + Cabin Pitch
      for (let i = 0; i < wheels.length; i++) {
        const w = wheels[i];
        w.children[0].rotation.z -= dt * 3.4; // tire tread spin forward (+X)
        w.children[1].rotation.z -= dt * 3.4;
        w.position.y = 0.62 + Math.sin(elapsed * 4.5 + i * 1.1) * 0.045;
      }
      if (viewMode !== 'internal' && viewMode !== 'flame_lab') {
        roverBody.position.y = Math.sin(elapsed * 4.5) * 0.035;
        roverBody.rotation.z = Math.cos(elapsed * 2.8) * 0.025;
      } else {
        roverBody.position.y = THREE.MathUtils.damp(roverBody.position.y, 0, 6, dt);
        roverBody.rotation.z = THREE.MathUtils.damp(roverBody.rotation.z, 0, 6, dt);
      }

      // 2. Scroll Terrain Pebbles backward (-X) for realistic motion
      for (let i = 0; i < pebbleCount; i++) {
        const p = pebbleData[i];
        p.x -= dt * 2.2;
        if (p.x < -13) p.x = 13;
        dummy.position.set(p.x, 0.08, p.z);
        dummy.rotation.set(p.r, p.r * 0.7, 0);
        dummy.scale.set(p.s, p.s * 0.6, p.s);
        dummy.updateMatrix();
        pebbles.setMatrixAt(i, dummy.matrix);
      }
      pebbles.instanceMatrix.needsUpdate = true;

      // 3. Sweeping LiDAR Sensor Head
      mastHead.rotation.y = Math.sin(elapsed * 1.55) * 0.85;
      lidarScanMat.opacity = 0.14 + Math.abs(Math.sin(elapsed * 3.1)) * 0.15;

      // 4. Articulated Robotic Arm Sampling Kinematics
      shoulder.rotation.z = -0.32 + Math.sin(elapsed * 0.85) * 0.35;
      shoulder.rotation.y = Math.cos(elapsed * 0.55) * 0.3;
      elbow.rotation.z = -0.55 + Math.cos(elapsed * 1.15) * 0.42;

      // 5. Rear Wheel Regolith Dust Kick-up
      const dPos = dustGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        dPos[i * 3] -= dt * 3.2;
        dPos[i * 3 + 1] += dt * 0.35;
        if (dPos[i * 3] < -7.5) {
          dPos[i * 3] = -1.9 + Math.random() * 0.6;
          dPos[i * 3 + 1] = 0.12 + Math.random() * 0.2;
        }
      }
      dustGeo.attributes.position.needsUpdate = true;

      // Alarm Lights
      const isDanger = classification !== 'normal';
      const isCrit = classification === 'critical' || classification === 'extreme_emergency';
      alarmBeaconMat.color.setHex(isCrit ? 0xff1e38 : isDanger ? 0xf59e0b : 0x06b6d4);
      alarmBeaconMat.emissive.copy(alarmBeaconMat.color);
      alarmBeaconMat.emissiveIntensity = isDanger ? (flashOn ? 3.2 : 0.4) : 0.9;
      interiorLight.color.setHex(isCrit && flashOn ? 0xff3b4d : 0xe0f2fe);
    },
    dispose: () => dispose(),
  };
}

// ===========================================================================
// 6. ESA COLUMBUS SCIENCE RESEARCH MODULE
// ===========================================================================
function createModuleHabitatHandle(renderer: THREE.WebGLRenderer): HabitatAssemblyHandle {
  const { trackGeo, trackMat, trackTex, dispose } = createRegistry();
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const rootGroup = new THREE.Group();
  const interactables: THREE.Object3D[] = [];

  const hullMaps = createHullPanelTexture(anisotropy);
  trackTex(hullMaps.map);
  trackTex(hullMaps.bumpMap);

  const hullMat = trackMat(new THREE.MeshStandardMaterial({ map: hullMaps.map, bumpMap: hullMaps.bumpMap, bumpScale: 0.015, color: 0xf1f5f9, roughness: 0.32, metalness: 0.65 }));
  const cutawayShellMat = trackMat(new THREE.MeshStandardMaterial({ map: hullMaps.map, color: 0xf8fafc, roughness: 0.32, metalness: 0.65, transparent: true, opacity: 1 }));
  const goldMliMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.22, metalness: 0.9 }));
  const darkMetalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.46, metalness: 0.8 }));
  const silverMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.24, metalness: 0.88 }));
  const coolantPulseMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 1.2, roughness: 0.2 }));
  const alarmBeaconMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.9, roughness: 0.2 }));

  const moduleGroup = new THREE.Group();
  rootGroup.add(moduleGroup);

  hullMat.side = THREE.DoubleSide;
  cutawayShellMat.side = THREE.DoubleSide;

  // Main Cylindrical Lab Pressure Vessel (Lower & Side Structural Hull)
  const lowerHull = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(2.15, 2.15, 6.8, 32, 1, true, Math.PI * 0.78, Math.PI * 1.44)),
    hullMat
  );
  lowerHull.rotation.z = Math.PI / 2;
  tagInteractable(lowerHull, 'Columbus Whipple Hull', 'ESA Pressurized 75 m³ Microgravity Research Laboratory', interactables);
  moduleGroup.add(lowerHull);

  // Removable Upper Whipple Shield Cover (Cutaway + Explode)
  const upperCoverGroup = new THREE.Group();
  const upperHull = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(2.2, 2.2, 6.8, 32, 1, true, Math.PI * 0.22, Math.PI * 0.56)),
    cutawayShellMat
  );
  upperHull.rotation.z = Math.PI / 2;
  upperCoverGroup.add(upperHull);
  moduleGroup.add(upperCoverGroup);

  // Endcones & Common Berthing Mechanism (CBM) Ring (-X)
  const aftCone = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.35, 2.15, 0.9, 28)), goldMliMat);
  aftCone.rotation.z = Math.PI / 2;
  aftCone.position.x = -3.85;
  moduleGroup.add(aftCone);

  const cbmRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.28, 0.14, 12, 28)), silverMat);
  cbmRing.rotation.y = Math.PI / 2;
  cbmRing.position.x = -4.35;
  tagInteractable(cbmRing, 'CBM Docking Ring', 'Common Berthing Mechanism & IMV air exchange collar', interactables);
  moduleGroup.add(cbmRing);

  const fwdCone = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.15, 1.2, 0.9, 28)), goldMliMat);
  fwdCone.rotation.z = Math.PI / 2;
  fwdCone.position.x = 3.85;
  moduleGroup.add(fwdCone);

  // Internal Deck + Science Racks + Spinning Biolab Centrifuge!
  const deckFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.4, 0.16, 2.4)), darkMetalMat);
  deckFloor.position.y = -1.05;
  moduleGroup.add(deckFloor);

  const { group: consoleMesh, consoleScreen } = buildInteriorConsoleScreen(
    anisotropy,
    'COLUMBUS LAB // C&W WORKSTATION',
    trackGeo,
    trackMat,
    trackTex,
    alarmBeaconMat,
    1.45,
    0.9
  );
  consoleMesh.position.set(0.2, 0.15, -1.35);
  moduleGroup.add(consoleMesh);

  // Biolab Centrifuge Rack (Spinning Drum inside Cabin!)
  const biolabBay = new THREE.Group();
  biolabBay.position.set(-1.6, 0.05, 1.05);
  const biolabHousing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 1.5, 0.55)), darkMetalMat);
  biolabBay.add(biolabHousing);
  const centrifugeRotor = new THREE.Group();
  centrifugeRotor.position.set(0, 0.15, -0.32);
  const rotorRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.45, 0.06, 10, 24)), silverMat);
  centrifugeRotor.add(rotorRim);
  for (let b = 0; b < 4; b++) {
    const ba = (b / 4) * Math.PI * 2;
    const vial = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.34, 0.1)), coolantPulseMat);
    vial.position.set(Math.cos(ba) * 0.28, Math.sin(ba) * 0.28, 0);
    vial.rotation.z = ba;
    centrifugeRotor.add(vial);
  }
  biolabBay.add(centrifugeRotor);
  tagInteractable(biolabBay, 'Biolab Centrifuge Rack', 'Active microgravity cellular & crystal growth centrifuge', interactables);
  moduleGroup.add(biolabBay);

  const interiorLight = new THREE.PointLight(0xe0f2fe, 2.4, 9, 1.5);
  interiorLight.position.set(0, 1.0, 0);
  moduleGroup.add(interiorLight);

  const flameChamber = createFlameChamberAssembly(trackGeo, trackMat, trackTex(createParticleTexture()), false);
  flameChamber.group.position.set(1.4, -0.97, 0.45);
  flameChamber.group.scale.setScalar(0.7);
  tagInteractable(flameChamber.group, 'Columbus Combustion Rack', 'ESA Microgravity Combustion Lab Bench', interactables);
  moduleGroup.add(flameChamber.group);

  // External Expose-R Orbital Experiment Facility (Forward Starboard Rotating Carousel!)
  const exposeGroup = new THREE.Group();
  exposeGroup.position.set(4.6, -0.1, 1.25);
  const exposeArm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, 0.16, 0.16)), silverMat);
  exposeArm.position.set(-0.5, 0, -0.4);
  exposeArm.rotation.y = 0.55;
  exposeGroup.add(exposeArm);

  const carouselBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.75, 0.8, 0.2, 20)), darkMetalMat);
  exposeGroup.add(carouselBase);
  const exposeCarousel = new THREE.Group();
  exposeCarousel.position.y = 0.14;
  for (let s = 0; s < 6; s++) {
    const sa = (s / 6) * Math.PI * 2;
    const tray = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.08, 0.26)), goldMliMat);
    tray.position.set(Math.cos(sa) * 0.45, 0, Math.sin(sa) * 0.45);
    tray.rotation.y = -sa;
    exposeCarousel.add(tray);
  }
  exposeGroup.add(exposeCarousel);
  tagInteractable(exposeGroup, 'Expose-R Astrobiology Carousel', 'Rotating external cosmic UV & vacuum sample pallet', interactables);
  moduleGroup.add(exposeGroup);

  // External Coolant Loop Pipe + Traveling Coolant Pulse Ring
  const coolantPipe = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 5.8, 10)), silverMat);
  coolantPipe.rotation.z = Math.PI / 2;
  coolantPipe.position.set(0, -1.65, 1.9);
  moduleGroup.add(coolantPipe);

  const coolantBead = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.14, 0.05, 8, 16)), coolantPulseMat);
  coolantBead.rotation.y = Math.PI / 2;
  coolantBead.position.set(-2.6, -1.65, 1.9);
  moduleGroup.add(coolantBead);

  // Articulated S-Band Comms Antenna Boom
  const commsBoom = new THREE.Group();
  commsBoom.position.set(-2.4, 2.25, -0.6);
  const boomStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 8)), darkMetalMat);
  boomStem.position.y = 0.6;
  commsBoom.add(boomStem);
  const dish = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.45, 0.26, 16)), silverMat);
  dish.position.y = 1.25;
  dish.rotation.x = Math.PI;
  commsBoom.add(dish);
  moduleGroup.add(commsBoom);

  return {
    habitatType: 'module',
    animationLabel: 'Biolab Centrifuge Spin, Expose-R Carousel & Coolant Flow',
    badgeText: 'COLUMBUS LAB TWIN',
    rootGroup,
    consoleScreen,
    alarmBeaconMat,
    interiorLights: [interiorLight],
    interactables,
    presets: {
      exterior: [
        { id: 'orbital', label: 'Orbital' },
        { id: 'exposer', label: 'Expose-R' },
        { id: 'cbm', label: 'CBM Ring' },
        { id: 'coolant', label: 'Coolant Loop' },
      ],
      internal: [
        { id: 'aisle', label: 'Lab Aisle' },
        { id: 'console', label: 'C&W Console' },
        { id: 'biolab', label: 'Biolab Spin' },
        { id: 'payload', label: 'Payload Bay' },
      ],
    },
    defaultPresetId: { exterior: 'orbital', internal: 'console' },
    internalBounds: { minX: -2.6, maxX: 2.6, minZ: -0.65, maxZ: 0.65 },
    environment: {
      backgroundHex: 0x070a18,
      fogHex: 0x070a18,
      fogDensity: 0.01,
      sunColorHex: 0xffedd5,
      sunIntensity: 3.1,
      hemiSkyHex: 0x38bdf8,
      hemiGroundHex: 0x1e1b4b,
      hemiIntensity: 0.95,
      showEarthLimb: true,
    },
    applyPreset: (presetId, camTargets) => {
      if (presetId === 'flame_lab') {
        camTargets.orbitFocus = { x: 1.4, y: -0.6, z: 0.45 };
        camTargets.sphericalTarget = { radius: 1.85, theta: -0.9, phi: 1.24 };
        camTargets.lookTargetY = -0.6;
        return;
      }
      if (presetId === 'console') {
        camTargets.internalPosTarget = { x: 0.2, y: 0.15, z: 0.2 };
        camTargets.internalYawTarget = -Math.PI * 0.5;
        camTargets.internalPitchTarget = -0.02;
      } else if (presetId === 'biolab') {
        camTargets.internalPosTarget = { x: -1.6, y: 0.1, z: -0.2 };
        camTargets.internalYawTarget = Math.PI * 0.5;
        camTargets.internalPitchTarget = -0.04;
      } else if (presetId === 'payload') {
        camTargets.internalPosTarget = { x: 1.8, y: 0.1, z: 0.0 };
        camTargets.internalYawTarget = 0.0;
        camTargets.internalPitchTarget = -0.04;
      } else if (presetId === 'aisle') {
        camTargets.internalPosTarget = { x: -2.4, y: 0.05, z: 0.0 };
        camTargets.internalYawTarget = 0.0;
        camTargets.internalPitchTarget = -0.04;
      } else if (presetId === 'exposer') {
        camTargets.sphericalTarget = { radius: 9.0, theta: 0.55, phi: 1.15 };
        camTargets.lookTargetY = 0.1;
        camTargets.orbitFocus = { x: 0, y: 0.1, z: 0 };
      } else if (presetId === 'cbm') {
        camTargets.sphericalTarget = { radius: 9.5, theta: -2.4, phi: 1.35 };
        camTargets.lookTargetY = 0;
        camTargets.orbitFocus = { x: 0, y: 0, z: 0 };
      } else if (presetId === 'coolant') {
        camTargets.sphericalTarget = { radius: 10.5, theta: 1.2, phi: 1.65 };
        camTargets.lookTargetY = -0.6;
        camTargets.orbitFocus = { x: 0, y: -0.6, z: 0 };
      } else {
        camTargets.sphericalTarget = { radius: 13.5, theta: 0.68, phi: 1.08 };
        camTargets.lookTargetY = 0.2;
        camTargets.orbitFocus = { x: 0, y: 0.2, z: 0 };
      }
    },
    update: (dt, elapsed, ctx) => {
      const { viewMode, explodedRatio, cutawayProgress, classification, flashOn, telemetry, flameConfig, flameAnalysis, selfHealingActive } = ctx;
      flameChamber.update(dt, elapsed, flameConfig || DEFAULT_FLAME_TEST_CONFIG, flameAnalysis || analyzeFlameConditions(flameConfig || DEFAULT_FLAME_TEST_CONFIG), Boolean(selfHealingActive));

      const revealRatio = viewMode === 'internal' || viewMode === 'flame_lab' ? 1 : cutawayProgress;
      upperCoverGroup.position.y = THREE.MathUtils.damp(upperCoverGroup.position.y, revealRatio * 2.8, 5, dt);
      cutawayShellMat.opacity = 1 - revealRatio;
      upperCoverGroup.visible = revealRatio < 0.96;

      exposeGroup.position.x = THREE.MathUtils.damp(exposeGroup.position.x, 4.6 + explodedRatio * 2.2, 4.5, dt);
      cbmRing.position.x = THREE.MathUtils.damp(cbmRing.position.x, -4.35 - explodedRatio * 1.8, 4.5, dt);

      // 1. Biolab Centrifuge Continuous Spin
      centrifugeRotor.rotation.z -= dt * 4.2;

      // 2. Expose-R Astrobiology Carousel Rotation
      exposeCarousel.rotation.y += dt * 0.65;

      // 3. Traveling Coolant Pulse Bead along external heat-exchanger loop
      const coolantCycle = ((elapsed * 1.8) % 5.6) - 2.8;
      coolantBead.position.x = coolantCycle;
      coolantPulseMat.color.setHex(telemetry.coolingSystemStatus !== 'nominal' ? 0xf59e0b : 0x38bdf8);
      coolantPulseMat.emissive.copy(coolantPulseMat.color);

      // 4. S-Band Telemetry Antenna Tracking
      commsBoom.rotation.z = Math.sin(elapsed * 0.7) * 0.3;
      commsBoom.rotation.x = Math.cos(elapsed * 0.5) * 0.25;

      // Alarm Lights
      const isDanger = classification !== 'normal';
      const isCrit = classification === 'critical' || classification === 'extreme_emergency';
      alarmBeaconMat.color.setHex(isCrit ? 0xff1e38 : isDanger ? 0xf59e0b : 0x06b6d4);
      alarmBeaconMat.emissive.copy(alarmBeaconMat.color);
      alarmBeaconMat.emissiveIntensity = isDanger ? (flashOn ? 3.2 : 0.4) : 0.9;
      interiorLight.color.setHex(isCrit && flashOn ? 0xff3b4d : 0xe0f2fe);
      interiorLight.intensity = isCrit && flashOn ? 4.0 : 2.4;
    },
    dispose: () => dispose(),
  };
}

// ===========================================================================
// 7. CUSTOM ENCLOSED HABITAT — SPINNING ARTIFICIAL-GRAVITY TORUS RING
// ===========================================================================
function createCustomHabitatHandle(renderer: THREE.WebGLRenderer): HabitatAssemblyHandle {
  const { trackGeo, trackMat, trackTex, dispose } = createRegistry();
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const rootGroup = new THREE.Group();
  const interactables: THREE.Object3D[] = [];

  const hullMaps = createHullPanelTexture(anisotropy);
  trackTex(hullMaps.map);
  trackTex(hullMaps.bumpMap);

  const ringHullMat = trackMat(new THREE.MeshStandardMaterial({ map: hullMaps.map, bumpMap: hullMaps.bumpMap, bumpScale: 0.015, color: 0xe2e8f0, roughness: 0.28, metalness: 0.72 }));
  const goldMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.24, metalness: 0.88 }));
  const darkMetalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.82 }));
  const coreMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 1.2, roughness: 0.2 }));
  const hubShroudMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.65, transparent: true, opacity: 1 }));
  const alarmBeaconMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.9, roughness: 0.2 }));

  // Subtle Lagrange Reference Calibration Ring beneath habitat
  const gridHelper = new THREE.PolarGridHelper(11, 12, 6, 48, 0x1e3a8a, 0x0f172a);
  gridHelper.position.y = -3.4;
  rootGroup.add(gridHelper);

  // Stationary Central Zero-G Docking & ECLSS Hub
  const centralHub = new THREE.Group();
  rootGroup.add(centralHub);

  const coreColumn = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.95, 0.95, 3.6, 20)), darkMetalMat);
  tagInteractable(coreColumn, 'Zero-G Docking Core', 'Stationary central hub & plasma ECLSS power column', interactables);
  centralHub.add(coreColumn);

  const plasmaCore = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.48, 0.48, 2.2, 16)), coreMat);
  centralHub.add(plasmaCore);

  const hubTopCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.4, 1.1, 0.9, 20)), hubShroudMat);
  hubTopCap.position.y = 2.05;
  centralHub.add(hubTopCap);

  // Interior C&W Console inside Central Hub
  const { group: consoleMesh, consoleScreen } = buildInteriorConsoleScreen(
    anisotropy,
    'CUSTOM RING // C&W WORKSTATION',
    trackGeo,
    trackMat,
    trackTex,
    alarmBeaconMat,
    1.4,
    0.88
  );
  consoleMesh.position.set(0, 0.5, -1.35);
  centralHub.add(consoleMesh);

  const interiorLight = new THREE.PointLight(0x67e8f9, 2.5, 11, 1.4);
  interiorLight.position.set(0, 1.4, 0);
  centralHub.add(interiorLight);

  const flameChamber = createFlameChamberAssembly(trackGeo, trackMat, trackTex(createParticleTexture()), false);
  flameChamber.group.position.set(1.05, -0.35, 0.45);
  flameChamber.group.scale.setScalar(0.68);
  tagInteractable(flameChamber.group, 'Spin-Gravity Flame Test Rig', 'Centripetal variable-gravity combustion test rig (0g–2g)', interactables);
  centralHub.add(flameChamber.group);

  // Spinning Artificial-Gravity Torus Ring + 4 Spokes + 4 Modular Life-Support Pods!
  const spinningRingGroup = new THREE.Group();
  rootGroup.add(spinningRingGroup);

  const torus = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(4.8, 0.78, 20, 64)), ringHullMat);
  torus.rotation.x = Math.PI / 2;
  tagInteractable(torus, 'Artificial-Gravity Torus', 'Centripetal rotating living ring (1G / 0.38G configurable)', interactables);
  spinningRingGroup.add(torus);

  const spokePulses: THREE.Mesh[] = [];
  const podModules: THREE.Group[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const spoke = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 4.1, 12)), darkMetalMat);
    spoke.position.set(Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = -a;
    spinningRingGroup.add(spoke);

    // Traveling radial energy/air pulse ring along each spoke
    const pulse = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.32, 0.05, 8, 16)), coreMat);
    pulse.position.set(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4);
    pulse.rotation.y = Math.PI / 2 - a;
    spinningRingGroup.add(pulse);
    spokePulses.push(pulse);

    // Modular Habitat Pod on Outer Rim
    const pod = new THREE.Group();
    pod.position.set(Math.cos(a) * 5.75, 0, Math.sin(a) * 5.75);
    pod.rotation.y = -a;
    const podBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.3, 1.15, 1.8)), goldMat);
    pod.add(podBody);
    const podWindow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.4, 1.1)), coreMat);
    podWindow.position.x = 0.64;
    pod.add(podWindow);
    tagInteractable(pod, `Modular Hab Pod ${i + 1}`, 'Configurable pressurized volume & life-support bay', interactables);
    spinningRingGroup.add(pod);
    podModules.push(pod);
  }

  // Counter-Rotating Dorsal Gyroscope Ring
  const gyroRing = new THREE.Group();
  gyroRing.position.y = 1.65;
  const gyroTorus = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.6, 0.16, 12, 48)), goldMat);
  gyroTorus.rotation.x = Math.PI / 2;
  gyroRing.add(gyroTorus);
  rootGroup.add(gyroRing);

  return {
    habitatType: 'custom',
    animationLabel: 'Spin-Gravity Torus, Counter-Gyro & Spoke Pulses',
    badgeText: 'CUSTOM RING TWIN',
    rootGroup,
    consoleScreen,
    alarmBeaconMat,
    interiorLights: [interiorLight],
    interactables,
    presets: {
      exterior: [
        { id: 'ring', label: 'Spin Ring' },
        { id: 'hub', label: 'Core Hub' },
        { id: 'gyro', label: 'Gyro Array' },
        { id: 'dock', label: 'Dock View' },
      ],
      internal: [
        { id: 'hub_deck', label: 'Hub Deck' },
        { id: 'console', label: 'C&W Console' },
        { id: 'core', label: 'Plasma Core' },
        { id: 'spoke', label: 'Spoke View' },
      ],
    },
    defaultPresetId: { exterior: 'ring', internal: 'console' },
    internalBounds: { minX: -1.8, maxX: 1.8, minZ: -1.2, maxZ: 1.2 },
    environment: {
      backgroundHex: 0x050814,
      fogHex: 0x050814,
      fogDensity: 0.008,
      sunColorHex: 0xfff5e4,
      sunIntensity: 3.0,
      hemiSkyHex: 0x22d3ee,
      hemiGroundHex: 0x0f172a,
      hemiIntensity: 1.0,
      showEarthLimb: false,
    },
    applyPreset: (presetId, camTargets) => {
      if (presetId === 'flame_lab') {
        camTargets.orbitFocus = { x: 1.05, y: 0.0, z: 0.45 };
        camTargets.sphericalTarget = { radius: 1.95, theta: 0.8, phi: 1.22 };
        camTargets.lookTargetY = 0.0;
        return;
      }
      if (presetId === 'console') {
        camTargets.internalPosTarget = { x: 0.0, y: 0.5, z: 0.35 };
        camTargets.internalYawTarget = -Math.PI * 0.5;
        camTargets.internalPitchTarget = -0.02;
      } else if (presetId === 'core') {
        camTargets.internalPosTarget = { x: 1.5, y: 0.6, z: 1.1 };
        camTargets.internalYawTarget = -Math.PI * 0.78;
        camTargets.internalPitchTarget = -0.1;
      } else if (presetId === 'spoke') {
        camTargets.internalPosTarget = { x: -1.4, y: 0.45, z: 0.2 };
        camTargets.internalYawTarget = 0.0;
        camTargets.internalPitchTarget = -0.04;
      } else if (presetId === 'hub_deck') {
        camTargets.internalPosTarget = { x: 1.2, y: 1.1, z: 1.2 };
        camTargets.internalYawTarget = -Math.PI * 0.75;
        camTargets.internalPitchTarget = -0.22;
      } else if (presetId === 'hub') {
        camTargets.sphericalTarget = { radius: 9.5, theta: 0.7, phi: 0.9 };
        camTargets.lookTargetY = 0.4;
        camTargets.orbitFocus = { x: 0, y: 0.4, z: 0 };
      } else if (presetId === 'gyro') {
        camTargets.sphericalTarget = { radius: 13.0, theta: 1.1, phi: 0.72 };
        camTargets.lookTargetY = 0.8;
        camTargets.orbitFocus = { x: 0, y: 0.8, z: 0 };
      } else if (presetId === 'dock') {
        camTargets.sphericalTarget = { radius: 15.0, theta: 0.2, phi: 1.48 };
        camTargets.lookTargetY = 0;
        camTargets.orbitFocus = { x: 0, y: 0, z: 0 };
      } else {
        camTargets.sphericalTarget = { radius: 15.5, theta: 0.75, phi: 0.96 };
        camTargets.lookTargetY = 0.2;
        camTargets.orbitFocus = { x: 0, y: 0.2, z: 0 };
      }
    },
    update: (dt, elapsed, ctx) => {
      const { viewMode, explodedRatio, cutawayProgress, classification, flashOn, habitat, flameConfig, flameAnalysis, selfHealingActive } = ctx;
      flameChamber.update(dt, elapsed, flameConfig || DEFAULT_FLAME_TEST_CONFIG, flameAnalysis || analyzeFlameConditions(flameConfig || DEFAULT_FLAME_TEST_CONFIG), Boolean(selfHealingActive));

      const revealRatio = viewMode === 'internal' || viewMode === 'flame_lab' ? 1 : cutawayProgress;
      hubTopCap.position.y = THREE.MathUtils.damp(hubTopCap.position.y, 2.05 + revealRatio * 2.2, 5, dt);
      hubShroudMat.opacity = 1 - revealRatio * 0.88;
      hubTopCap.visible = revealRatio < 0.96;

      // Explode outward pods + raise gyro
      gyroRing.position.y = THREE.MathUtils.damp(gyroRing.position.y, 1.65 + explodedRatio * 2.4, 4.5, dt);
      for (let i = 0; i < podModules.length; i++) {
        const a = (i / 4) * Math.PI * 2;
        const r = 5.75 + explodedRatio * 2.5;
        podModules[i].position.x = THREE.MathUtils.damp(podModules[i].position.x, Math.cos(a) * r, 4.5, dt);
        podModules[i].position.z = THREE.MathUtils.damp(podModules[i].position.z, Math.sin(a) * r, 4.5, dt);
        // Pod scale subtly reflects configured habitat volumeM3
        const volScale = THREE.MathUtils.clamp(0.85 + habitat.volumeM3 / 600, 0.85, 1.35);
        podModules[i].scale.setScalar(volScale);
      }

      // 1. Artificial Gravity Torus Spin + Counter-Rotating Gyro
      spinningRingGroup.rotation.y += dt * 0.42;
      gyroRing.rotation.y -= dt * 1.15;

      // 2. Spoke Energy/Air Pulses traveling from Core -> Outer Ring
      const pulseProgress = (elapsed * 1.2) % 3.2;
      const dist = 1.2 + pulseProgress;
      for (let i = 0; i < spokePulses.length; i++) {
        const a = (i / 4) * Math.PI * 2;
        spokePulses[i].position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
      }

      // 3. Calibration Grid slow drift
      gridHelper.rotation.y += dt * 0.08;

      // Alarm Lights
      const isDanger = classification !== 'normal';
      const isCrit = classification === 'critical' || classification === 'extreme_emergency';
      coreMat.color.setHex(isCrit ? 0xf43f5e : isDanger ? 0xf59e0b : 0x22d3ee);
      coreMat.emissive.copy(coreMat.color);
      coreMat.emissiveIntensity = isCrit && flashOn ? 2.4 : 1.2;

      alarmBeaconMat.color.setHex(isCrit ? 0xff1e38 : isDanger ? 0xf59e0b : 0x06b6d4);
      alarmBeaconMat.emissive.copy(alarmBeaconMat.color);
      alarmBeaconMat.emissiveIntensity = isDanger ? (flashOn ? 3.2 : 0.4) : 0.9;
      interiorLight.color.setHex(isCrit && flashOn ? 0xff3b4d : 0x67e8f9);
    },
    dispose: () => dispose(),
  };
}

// ===========================================================================
// PUBLIC FACTORY DISPATCHER
// ===========================================================================
export function buildHabitatSceneHandle(
  type: HabitatType,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean
): HabitatAssemblyHandle {
  switch (type) {
    case 'lunar':
      return createLunarHabitatHandle(renderer);
    case 'mars':
      return createMarsHabitatHandle(renderer);
    case 'spacecraft':
      return createSpacecraftHabitatHandle(renderer);
    case 'rover':
      return createRoverHabitatHandle(renderer);
    case 'module':
      return createModuleHabitatHandle(renderer);
    case 'custom':
      return createCustomHabitatHandle(renderer);
    case 'iss':
    default:
      return createIssHabitatHandle(renderer, isSoftwareGl);
  }
}

export const HABITAT_ANIMATION_META: Record<
  HabitatType,
  { shortName: string; animationSummary: string }
> = {
  iss: { shortName: 'ISS Destiny', animationSummary: 'Sun-Tracking Arrays & IMV Airflow' },
  lunar: { shortName: 'Lunar Base', animationSummary: 'VSAT Tracking & Suit-Port Cycle' },
  mars: { shortName: 'Mars Outpost', animationSummary: 'Dust Wind, Anemometer & Bio-Dome' },
  spacecraft: { shortName: 'Orion Craft', animationSummary: 'OMS Burn Plume & RCS Attitude' },
  rover: { shortName: 'Rover PRV-1', animationSummary: '6x6 Bogie Drive, LiDAR & Sample Arm' },
  module: { shortName: 'Columbus Lab', animationSummary: 'Biolab Centrifuge & Expose-R' },
  custom: { shortName: 'Custom Ring', animationSummary: 'Spin-Gravity Torus & Gyro Core' },
};

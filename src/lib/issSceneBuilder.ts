import * as THREE from 'three';
import {
  CategoryRiskScores,
  DetectedHazard,
  EnvironmentalTelemetry,
  RiskClassification,
} from '../types/habitat';
import { createFlameChamberAssembly, FlameChamberAssembly } from './flameChamber3d';

export interface ConsoleScreenUpdater {
  texture: THREE.CanvasTexture;
  update: (
    telemetry: EnvironmentalTelemetry,
    riskScore: number,
    classification: RiskClassification,
    hazards?: DetectedHazard[],
    categoryScores?: CategoryRiskScores,
    flashOn?: boolean,
    audioActive?: boolean
  ) => void;
}

export interface IssSceneAssembly {
  habitatGroup: THREE.Group;
  cutawayShellGroup: THREE.Group;
  cutawayMaterials: THREE.MeshStandardMaterial[];
  solarWings: THREE.Group[];
  radiators: THREE.Group[];
  radiatorMaterials: THREE.MeshStandardMaterial[];
  cupolaGroup: THREE.Group;
  imvFanRotor: THREE.Group;
  interiorLights: THREE.PointLight[];
  fireLight: THREE.PointLight;
  alarmBeaconMat: THREE.MeshStandardMaterial;
  statusMaterials: {
    cdra: THREE.MeshStandardMaterial;
    ogs: THREE.MeshStandardMaterial;
    pdu: THREE.MeshStandardMaterial;
    wrs: THREE.MeshStandardMaterial;
    imv: THREE.MeshStandardMaterial;
    floorStrip: THREE.MeshStandardMaterial;
  };
  particleTex: THREE.CanvasTexture;
  consoleScreen: ConsoleScreenUpdater;
  flameChamber: FlameChamberAssembly;
  interactables: THREE.Object3D[];
  disposables: {
    geometries: THREE.BufferGeometry[];
    materials: THREE.Material[];
    textures: THREE.Texture[];
  };
}

export function createParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.35, 'rgba(255, 235, 200, 0.85)');
  grad.addColorStop(0.7, 'rgba(255, 160, 80, 0.3)');
  grad.addColorStop(1, 'rgba(255, 100, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSolarCellTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#09183d';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle photovoltaic wafer gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, 'rgba(30, 64, 175, 0.35)');
  grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.15)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Cell grid
  ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
  ctx.lineWidth = 2;
  const cols = 8;
  const rows = 16;
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * 512;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    const y = (j / rows) * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Gold copper busbar strips
  ctx.fillStyle = 'rgba(217, 119, 6, 0.65)';
  ctx.fillRect(0, 252, 512, 8);
  ctx.fillRect(253, 0, 6, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.anisotropy = anisotropy;
  return tex;
}

export function createHullPanelTexture(anisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#dde5ee';
  ctx.fillRect(0, 0, 512, 512);

  // Whipple micrometeoroid shield panel seams
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    const p = i * 128;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(512, p);
    ctx.stroke();
  }

  // Subtle rivets
  ctx.fillStyle = '#64748b';
  for (let x = 16; x < 512; x += 64) {
    for (let y = 16; y < 512; y += 64) {
      ctx.fillRect(x, y, 3, 3);
    }
  }

  // Aerospace accent stripe
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 240, 512, 10);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.anisotropy = anisotropy;

  // Grayscale bump map
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#909090';
  bCtx.fillRect(0, 0, 256, 256);
  bCtx.strokeStyle = '#303030';
  bCtx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    const p = i * 64;
    bCtx.beginPath();
    bCtx.moveTo(p, 0);
    bCtx.lineTo(p, 256);
    bCtx.stroke();
    bCtx.beginPath();
    bCtx.moveTo(0, p);
    bCtx.lineTo(256, p);
    bCtx.stroke();
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);
  bumpMap.anisotropy = anisotropy;

  return { map, bumpMap };
}

function createDeckGratingTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Yellow safety edge stripes
  ctx.fillStyle = 'rgba(245, 158, 11, 0.55)';
  ctx.fillRect(0, 8, 512, 6);
  ctx.fillRect(0, 242, 512, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.anisotropy = anisotropy;
  return tex;
}

function drawWarningTriangle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  fill: string,
  stroke: string
) {
  const h = size * 0.866;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.58);
  ctx.lineTo(cx + size * 0.54, cy + h * 0.42);
  ctx.lineTo(cx - size * 0.54, cy + h * 0.42);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.stroke();

  ctx.fillStyle = stroke;
  ctx.font = `bold ${Math.round(size * 0.52)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', cx, cy + size * 0.08);
  ctx.restore();
}

export function createConsoleScreenUpdater(
  anisotropy: number,
  stationTitle = 'ISS DESTINY // C&W WORKSTATION'
): ConsoleScreenUpdater {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 480;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;

  const update = (
    t: EnvironmentalTelemetry,
    riskScore: number,
    classification: RiskClassification,
    hazards: DetectedHazard[] = [],
    categoryScores?: CategoryRiskScores,
    flashOn: boolean = false,
    audioActive: boolean = true
  ) => {
    const isDanger = classification !== 'normal';
    const isHighOrAbove =
      classification === 'high_risk' ||
      classification === 'critical' ||
      classification === 'extreme_emergency';
    const isCritical =
      classification === 'critical' || classification === 'extreme_emergency';

    const accent =
      classification === 'extreme_emergency'
        ? '#f43f5e'
        : classification === 'critical'
        ? '#ef4444'
        : classification === 'high_risk'
        ? '#f97316'
        : classification === 'caution'
        ? '#eab308'
        : '#06b6d4';

    // Full background — rapidly flashes bright red when danger flash is active
    if (isCritical && flashOn) {
      ctx.fillStyle = classification === 'extreme_emergency' ? '#5f0915' : '#450a0a';
    } else if (isHighOrAbove && flashOn) {
      ctx.fillStyle = '#3b1106';
    } else if (classification === 'caution' && flashOn) {
      ctx.fillStyle = '#2b2004';
    } else {
      ctx.fillStyle = '#030814';
    }
    ctx.fillRect(0, 0, 768, 480);

    // Subtle cockpit scanline grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 480; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(768, y);
      ctx.stroke();
    }

    // Outer illuminated frame
    ctx.strokeStyle = flashOn && isDanger ? '#ff2a3c' : accent;
    ctx.lineWidth = isCritical ? 8 : 5;
    ctx.strokeRect(8, 8, 752, 464);

    // Hazard diagonal caution stripes when critical/extreme and flashOn
    if (isCritical && flashOn) {
      ctx.fillStyle = '#ef4444';
      for (let x = 14; x < 740; x += 48) {
        ctx.fillRect(x, 12, 24, 6);
        ctx.fillRect(x, 462, 24, 6);
      }
    }

    // TOP MASTER CAUTION & WARNING BAR
    ctx.fillStyle =
      isCritical && flashOn
        ? '#b91c1c'
        : isDanger
        ? 'rgba(127, 29, 29, 0.55)'
        : 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(18, 22, 732, 62);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 22, 732, 62);

    if (isDanger) {
      drawWarningTriangle(
        ctx,
        52,
        53,
        42,
        flashOn ? '#fef08a' : accent,
        '#0f172a'
      );
    } else {
      ctx.fillStyle = '#10b981';
      ctx.fillRect(36, 37, 28, 32);
      ctx.fillStyle = '#022c22';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('OK', 38, 60);
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(stationTitle, 88, 48);

    ctx.fillStyle = isDanger ? '#fde047' : '#38bdf8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(
      isDanger
        ? `MASTER ALARM ACTIVE · ${hazards.length} HAZARD(S) · VOICE ${audioActive ? 'ON' : 'MUTED'}`
        : 'LIFE-SUPPORT & CABIN ENVELOPE MONITOR',
      88,
      72
    );

    // Top-right Risk Classification Badge
    const classLabel = classification.replace('_', ' ').toUpperCase();
    ctx.fillStyle = flashOn && isDanger ? '#ef4444' : '#0f172a';
    ctx.fillRect(540, 30, 198, 46);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(540, 30, 198, 46);
    ctx.fillStyle = flashOn && isDanger ? '#ffffff' : accent;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(classLabel, 639, 50);
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`RISK: ${riskScore}/100`, 639, 69);
    ctx.textAlign = 'left';

    // LEFT COLUMN: 5-PARAMETER TELEMETRY MATRIX
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(18, 96, 356, 294);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 96, 356, 294);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('CABIN TELEMETRY SENSORS', 32, 120);

    const rows = [
      {
        label: 'O2 LEVEL',
        val: `${t.oxygenPercent.toFixed(1)} %`,
        ratio: Math.min(1, Math.max(0, (t.oxygenPercent - 12) / 18)),
        bad: t.oxygenPercent < 19.5 || t.oxygenPercent > 23.5,
      },
      {
        label: 'CO2 CONC',
        val: `${t.carbonDioxidePpm} ppm`,
        ratio: Math.min(1, Math.max(0, t.carbonDioxidePpm / 8000)),
        bad: t.carbonDioxidePpm > 3000,
      },
      {
        label: 'PRESSURE',
        val: `${t.pressureKPa.toFixed(1)} kPa`,
        ratio: Math.min(1, Math.max(0, t.pressureKPa / 115)),
        bad: t.pressureKPa < 96 || t.pressureKPa > 104,
      },
      {
        label: 'CABIN TEMP',
        val: `${t.internalTemperatureC.toFixed(1)} °C`,
        ratio: Math.min(1, Math.max(0, (t.internalTemperatureC - 5) / 40)),
        bad: t.internalTemperatureC < 18 || t.internalTemperatureC > 27,
      },
      {
        label: 'RADIATION',
        val: `${t.radiationDoseRateUSvH.toFixed(1)} µSv/h`,
        ratio: Math.min(1, Math.max(0, t.radiationDoseRateUSvH / 200)),
        bad: t.radiationDoseRateUSvH > 35,
      },
    ];

    rows.forEach((row, idx) => {
      const y = 148 + idx * 48;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(row.label, 32, y);

      ctx.fillStyle = row.bad ? '#fb7185' : '#f8fafc';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(row.val, 358, y);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(32, y + 9, 326, 10);
      ctx.fillStyle = row.bad ? '#ef4444' : '#06b6d4';
      ctx.fillRect(32, y + 9, Math.max(8, Math.round(326 * row.ratio)), 10);
    });

    // RIGHT TOP PANEL: DOMAIN RISK BREAKDOWN
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(388, 96, 362, 152);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(388, 96, 362, 152);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('RISK DOMAIN MATRIX (0-100)', 402, 120);

    const domains: Array<[string, number]> = categoryScores
      ? [
          ['ATMOS', categoryScores.atmospheric],
          ['THERM', categoryScores.thermal],
          ['FIRE', categoryScores.fire],
          ['RAD', categoryScores.radiation],
          ['VENT', categoryScores.ventilation],
          ['ECLSS', categoryScores.lifeSupport],
        ]
      : [
          ['ATMOS', Math.round(riskScore * 0.8)],
          ['THERM', Math.round(riskScore * 0.5)],
          ['FIRE', t.fireDetected ? 95 : t.smokeDetected ? 65 : 0],
          ['RAD', Math.round(t.radiationDoseRateUSvH * 0.35)],
          ['VENT', t.airflowVelocity < 0.08 ? 65 : 8],
          ['ECLSS', t.co2ScrubberStatus === 'failed' ? 80 : 5],
        ];

    domains.forEach(([dLabel, dVal], i) => {
      const col = i % 2;
      const r = Math.floor(i / 2);
      const bx = 402 + col * 172;
      const by = 140 + r * 34;
      const barColor =
        dVal >= 75
          ? '#ef4444'
          : dVal >= 45
          ? '#f97316'
          : dVal >= 20
          ? '#eab308'
          : '#10b981';

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px monospace';
      ctx.fillText(dLabel, bx, by);
      ctx.fillStyle = barColor;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`${dVal}`, bx + 128, by);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(bx, by + 6, 154, 7);
      ctx.fillStyle = barColor;
      ctx.fillRect(bx, by + 6, Math.max(4, Math.round(154 * (Math.min(100, dVal) / 100))), 7);
    });

    // RIGHT BOTTOM PANEL: ACTIVE HAZARD & VOICE ALARM BOX
    ctx.fillStyle =
      isCritical && flashOn
        ? 'rgba(153, 27, 27, 0.92)'
        : isDanger
        ? 'rgba(69, 10, 10, 0.8)'
        : 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(388, 258, 362, 132);
    ctx.strokeStyle = isDanger ? accent : '#334155';
    ctx.lineWidth = isDanger ? 3 : 2;
    ctx.strokeRect(388, 258, 362, 132);

    if (isDanger) {
      drawWarningTriangle(ctx, 434, 322, 52, flashOn ? '#fde047' : '#ef4444', '#0f172a');
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('WARNING // HAZARD ALERT', 474, 292);

      const topHazardName =
        hazards[0]?.name ||
        (t.fireDetected ? 'Avionics Bay Fire' : 'Environmental Threshold Breach');
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(
        topHazardName.length > 32 ? `${topHazardName.slice(0, 30)}..` : topHazardName,
        474,
        320
      );

      ctx.fillStyle = '#fecaca';
      ctx.font = '13px monospace';
      const volPct =
        classification === 'extreme_emergency'
          ? 100
          : classification === 'critical'
          ? 70
          : classification === 'high_risk'
          ? 40
          : 18;
      ctx.fillText(
        `ALARM BEEP: ${audioActive ? `${volPct}% VOL` : 'MUTED'} | VOICE ON`,
        474,
        352
      );
    } else {
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('SYSTEM STATUS: ALL CLEAR', 406, 294);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px monospace';
      ctx.fillText('No active atmospheric or fire', 406, 326);
      ctx.fillText('hazards. Voice & alarm standby.', 406, 348);
    }

    // BOTTOM SUBSYSTEM STRIP
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(18, 402, 732, 54);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 402, 732, 54);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(
      `CDRA: ${t.co2ScrubberStatus.toUpperCase()}  |  OGS: ${t.oxygenGenStatus.toUpperCase()}  |  FLOW: ${t.airflowVelocity.toFixed(
        2
      )} m/s  |  BUS: ${t.powerSupplyPercent.toFixed(0)}%  |  CREW: ${t.activeOccupants}`,
      32,
      435
    );

    texture.needsUpdate = true;
  };

  return { texture, update };
}

export function buildIssSceneAssembly(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean
): IssSceneAssembly {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const interactables: THREE.Object3D[] = [];

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

  const tagSubsystem = (obj: THREE.Object3D, name: string, detail: string) => {
    obj.userData.subsystemName = name;
    obj.userData.subsystemDetail = detail;
    interactables.push(obj);
  };

  // Textures
  const solarTex = trackTex(createSolarCellTexture(maxAniso));
  const { map: hullTex, bumpMap: hullBump } = createHullPanelTexture(maxAniso);
  trackTex(hullTex);
  trackTex(hullBump);
  const deckTex = trackTex(createDeckGratingTexture(maxAniso));
  const particleTex = trackTex(createParticleTexture());
  const consoleScreen = createConsoleScreenUpdater(maxAniso);
  trackTex(consoleScreen.texture);

  // Materials (varied roughness >= 0.25 across adjacent parts)
  const hullMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: hullTex,
      bumpMap: hullBump,
      bumpScale: 0.02,
      metalness: 0.45,
      roughness: 0.38,
    })
  );

  const cutawayHullMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: hullTex,
      bumpMap: hullBump,
      bumpScale: 0.02,
      metalness: 0.45,
      roughness: 0.38,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
    })
  );

  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.28,
    })
  );

  const trussMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.88,
      roughness: 0.32,
    })
  );

  const goldMliMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.92,
      roughness: 0.24,
    })
  );

  const solarMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: solarTex,
      metalness: 0.72,
      roughness: 0.16,
      emissive: 0x0a1e4d,
      emissiveIntensity: 0.35,
    })
  );

  const radiatorMatLeft = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.25,
      roughness: 0.55,
      emissive: 0x000000,
      emissiveIntensity: 0.2,
    })
  );

  const radiatorMatRight = trackMat(radiatorMatLeft.clone());

  const glassMat = trackMat(
    isSoftwareGl
      ? new THREE.MeshStandardMaterial({
          color: 0x7dd3fc,
          metalness: 0.08,
          roughness: 0.12,
          transparent: true,
          opacity: 0.36,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0x7dd3fc,
          metalness: 0.05,
          roughness: 0.08,
          transmission: 0.78,
          transparent: true,
          opacity: 0.88,
          ior: 1.5,
          depthWrite: false,
        })
  );

  const interiorWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.18,
      roughness: 0.72,
      side: THREE.BackSide,
    })
  );

  const rackBodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.55,
      roughness: 0.52,
    })
  );

  const rackTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.78,
      roughness: 0.26,
    })
  );

  const deckMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: deckTex,
      metalness: 0.35,
      roughness: 0.68,
    })
  );

  const screenMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: consoleScreen.texture,
      toneMapped: false,
    })
  );

  const alarmBeaconMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.3,
    })
  );

  const makeStatusMat = (hex: number) =>
    trackMat(
      new THREE.MeshStandardMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: 1.4,
        roughness: 0.25,
        metalness: 0.2,
      })
    );

  const statusMaterials = {
    cdra: makeStatusMat(0x10b981),
    ogs: makeStatusMat(0x06b6d4),
    pdu: makeStatusMat(0x10b981),
    wrs: makeStatusMat(0x3b82f6),
    imv: makeStatusMat(0x14b8a6),
    floorStrip: makeStatusMat(0x06b6d4),
  };

  // Root group
  const habitatGroup = new THREE.Group();

  // =========================================================================
  // A. DESTINY US LAB PRIMARY MODULE (Split for Cutaway + Sealed Interior)
  // =========================================================================
  const destinyLength = 7.6;
  const destinyRadius = 2.05;

  // 1. Fixed Lower/Back Hull Cradle (theta from 0.68*PI to 1.88*PI)
  const fixedHullGeo = trackGeo(
    new THREE.CylinderGeometry(
      destinyRadius,
      destinyRadius,
      destinyLength,
      36,
      1,
      true,
      0.68 * Math.PI,
      1.20 * Math.PI
    )
  );
  fixedHullGeo.rotateZ(Math.PI / 2);
  const fixedHullMesh = new THREE.Mesh(fixedHullGeo, hullMat);
  fixedHullMesh.castShadow = !isSoftwareGl;
  fixedHullMesh.receiveShadow = !isSoftwareGl;
  habitatGroup.add(fixedHullMesh);

  // Inner cabin wall liner (BackSide so interior looks enclosed in Internal mode)
  const innerFixedGeo = trackGeo(
    new THREE.CylinderGeometry(
      destinyRadius - 0.08,
      destinyRadius - 0.08,
      destinyLength,
      32,
      1,
      true,
      0.68 * Math.PI,
      1.20 * Math.PI
    )
  );
  innerFixedGeo.rotateZ(Math.PI / 2);
  habitatGroup.add(new THREE.Mesh(innerFixedGeo, interiorWallMat));

  // 2. Removable / Liftable Upper-Front Cutaway Shroud (theta from -0.12*PI to 0.68*PI)
  const cutawayShellGroup = new THREE.Group();
  const cutawayGeo = trackGeo(
    new THREE.CylinderGeometry(
      destinyRadius,
      destinyRadius,
      destinyLength,
      36,
      1,
      true,
      -0.12 * Math.PI,
      0.80 * Math.PI
    )
  );
  cutawayGeo.rotateZ(Math.PI / 2);
  const cutawayMesh = new THREE.Mesh(cutawayGeo, cutawayHullMat);
  cutawayMesh.castShadow = !isSoftwareGl;
  cutawayShellGroup.add(cutawayMesh);

  // Gold MLI thermal ribs along upper shroud
  const ribArcGeo = trackGeo(
    new THREE.TorusGeometry(destinyRadius + 0.06, 0.045, 10, 28, 0.80 * Math.PI)
  );
  ribArcGeo.rotateY(Math.PI / 2);
  for (const xPos of [-2.4, 0, 2.4]) {
    const rib = new THREE.Mesh(ribArcGeo, goldMliMat);
    rib.position.x = xPos;
    rib.rotation.x = -0.12 * Math.PI;
    cutawayShellGroup.add(rib);
  }
  habitatGroup.add(cutawayShellGroup);

  // Common Berthing Mechanism (CBM) end pressure collars
  const collarGeo = trackGeo(new THREE.TorusGeometry(destinyRadius + 0.06, 0.12, 14, 36));
  collarGeo.rotateY(Math.PI / 2);
  for (const xPos of [-3.8, 3.8]) {
    const collar = new THREE.Mesh(collarGeo, darkMetalMat);
    collar.position.x = xPos;
    habitatGroup.add(collar);
  }

  // =========================================================================
  // B. INTEGRATED TRUSS STRUCTURE (ITS), SOLAR WINGS & RADIATORS
  // =========================================================================
  const trussGroup = new THREE.Group();
  trussGroup.position.set(0, 2.75, 0);

  // Main spine beam
  const spineGeo = trackGeo(new THREE.BoxGeometry(27.5, 0.42, 0.42));
  const spineMesh = new THREE.Mesh(spineGeo, trussMat);
  spineMesh.castShadow = !isSoftwareGl;
  trussGroup.add(spineMesh);

  // Cross-brace truss bays (Instanced-style clean geometry blocks)
  const bayRingGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.72, 0.72));
  for (let x = -13; x <= 13; x += 2.6) {
    const bay = new THREE.Mesh(bayRingGeo, darkMetalMat);
    bay.position.x = x;
    trussGroup.add(bay);
  }

  // S0 central saddle struts attaching truss to Destiny & Nodes
  const strutGeo = trackGeo(new THREE.CylinderGeometry(0.1, 0.12, 1.0, 10));
  for (const xOff of [-1.2, 1.2]) {
    const strut = new THREE.Mesh(strutGeo, darkMetalMat);
    strut.position.set(xOff, -0.55, 0);
    trussGroup.add(strut);
  }

  // SARJ (Solar Alpha Rotary Joints)
  const sarjGeo = trackGeo(new THREE.CylinderGeometry(0.55, 0.55, 0.45, 18));
  sarjGeo.rotateZ(Math.PI / 2);
  for (const xPos of [-6.8, 6.8]) {
    const sarj = new THREE.Mesh(sarjGeo, goldMliMat);
    sarj.position.x = xPos;
    trussGroup.add(sarj);
  }
  habitatGroup.add(trussGroup);

  // 4 Pairs of Double Solar Array Wings (P6, P4, S4, S6)
  const solarWings: THREE.Group[] = [];
  const wingGeo = trackGeo(new THREE.BoxGeometry(1.75, 0.05, 6.6));
  const mastGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 13.8, 8));
  mastGeo.rotateX(Math.PI / 2);
  const canisterGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 12));

  for (const xPos of [-12.6, -8.8, 8.8, 12.6]) {
    const wingPair = new THREE.Group();
    wingPair.position.set(xPos, 2.75, 0);
    wingPair.rotation.x = 0.22; // Slight orbital tilt for dramatic sun catch

    const mast = new THREE.Mesh(mastGeo, trussMat);
    wingPair.add(mast);

    const canister = new THREE.Mesh(canisterGeo, goldMliMat);
    wingPair.add(canister);

    const fwdWing = new THREE.Mesh(wingGeo, solarMat);
    fwdWing.position.z = 3.9;
    wingPair.add(fwdWing);

    const aftWing = new THREE.Mesh(wingGeo, solarMat);
    aftWing.position.z = -3.9;
    wingPair.add(aftWing);

    tagSubsystem(
      wingPair,
      'Photovoltaic Solar Array Wing',
      '120 kW orbital EPS solar array blanket & beta gimbal mast'
    );
    habitatGroup.add(wingPair);
    solarWings.push(wingPair);
  }

  // Thermal Radiator Wings (P1 & S1 Truss)
  const radiators: THREE.Group[] = [];
  const radPanelGeo = trackGeo(new THREE.BoxGeometry(1.2, 0.05, 4.4));
  const radMastGeo = trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 4.8, 8));
  radMastGeo.rotateX(Math.PI / 2);

  [
    { x: -3.8, mat: radiatorMatLeft, label: 'Port ATCS Radiator Array' },
    { x: 3.8, mat: radiatorMatRight, label: 'Starboard ATCS Radiator Array' },
  ].forEach(({ x, mat, label }) => {
    const radGroup = new THREE.Group();
    radGroup.position.set(x, 2.75, -2.7);
    const mast = new THREE.Mesh(radMastGeo, darkMetalMat);
    radGroup.add(mast);
    for (const xOff of [-0.68, 0.68]) {
      const panel = new THREE.Mesh(radPanelGeo, mat);
      panel.position.set(xOff, 0, -0.35);
      radGroup.add(panel);
    }
    tagSubsystem(radGroup, label, 'Ammonia external loop thermal rejection radiator panels');
    habitatGroup.add(radGroup);
    radiators.push(radGroup);
  });

  // =========================================================================
  // C. CONNECTED ISS MODULES (HARMONY, COLUMBUS, KIBO, UNITY, ZVEZDA, CUPOLA)
  // =========================================================================
  // Forward Harmony Node 2 (x = +5.3)
  const nodeGeo = trackGeo(new THREE.CylinderGeometry(1.75, 1.75, 2.9, 24));
  nodeGeo.rotateZ(Math.PI / 2);
  const harmony = new THREE.Mesh(nodeGeo, hullMat);
  harmony.position.set(5.3, 0, 0);
  habitatGroup.add(harmony);

  // Columbus Lab (Port +Z)
  const sideLabGeo = trackGeo(new THREE.CylinderGeometry(1.45, 1.45, 3.6, 24));
  sideLabGeo.rotateX(Math.PI / 2);
  const columbus = new THREE.Mesh(sideLabGeo, hullMat);
  columbus.position.set(5.3, 0, 3.3);
  habitatGroup.add(columbus);

  // Kibo JEM Lab (Starboard -Z) + Exposed Facility deck
  const kibo = new THREE.Mesh(sideLabGeo, hullMat);
  kibo.position.set(5.3, 0, -3.5);
  habitatGroup.add(kibo);
  const kiboEfGeo = trackGeo(new THREE.BoxGeometry(2.1, 0.35, 1.8));
  const kiboEf = new THREE.Mesh(kiboEfGeo, darkMetalMat);
  kiboEf.position.set(5.3, -0.2, -5.9);
  habitatGroup.add(kiboEf);

  // Forward PMA-2 / IDA Docking Port
  const pmaGroup = new THREE.Group();
  pmaGroup.position.set(7.4, 0, 0);
  const pmaConeGeo = trackGeo(new THREE.CylinderGeometry(0.95, 1.4, 1.4, 24));
  pmaConeGeo.rotateZ(-Math.PI / 2);
  const pmaCone = new THREE.Mesh(pmaConeGeo, darkMetalMat);
  pmaGroup.add(pmaCone);
  const idaRingGeo = trackGeo(new THREE.TorusGeometry(0.95, 0.09, 12, 24));
  idaRingGeo.rotateY(Math.PI / 2);
  const idaRing = new THREE.Mesh(idaRingGeo, goldMliMat);
  idaRing.position.x = 0.72;
  pmaGroup.add(idaRing);
  tagSubsystem(pmaGroup, 'PMA-2 / IDA Docking Port', 'International Docking Adapter & forward pressure seal');
  habitatGroup.add(pmaGroup);

  // Aft Unity Node 1 & Zvezda Service Module
  const unity = new THREE.Mesh(nodeGeo, hullMat);
  unity.position.set(-5.3, 0, 0);
  habitatGroup.add(unity);

  const zvezdaGeo = trackGeo(new THREE.CylinderGeometry(1.3, 1.65, 4.4, 24));
  zvezdaGeo.rotateZ(Math.PI / 2);
  const zvezda = new THREE.Mesh(zvezdaGeo, hullMat);
  zvezda.position.set(-8.9, 0, 0);
  habitatGroup.add(zvezda);

  // Zvezda auxiliary solar wings
  const smWingGeo = trackGeo(new THREE.BoxGeometry(1.1, 0.04, 3.0));
  for (const zSign of [-1, 1]) {
    const smWing = new THREE.Mesh(smWingGeo, solarMat);
    smWing.position.set(-8.6, 0.1, zSign * 2.9);
    habitatGroup.add(smWing);
  }

  // Cupola 7-Window Observation Dome (mounted on Nadir/Earth-facing side of Unity/Node)
  const cupolaGroup = new THREE.Group();
  cupolaGroup.position.set(-5.3, -1.85, 0.65);
  cupolaGroup.rotation.x = 0.35;
  const cupBaseGeo = trackGeo(new THREE.CylinderGeometry(0.85, 1.05, 0.45, 8));
  const cupBase = new THREE.Mesh(cupBaseGeo, darkMetalMat);
  cupolaGroup.add(cupBase);

  const cupDomeGeo = trackGeo(new THREE.SphereGeometry(0.82, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2));
  const cupGlass = new THREE.Mesh(cupDomeGeo, glassMat);
  cupGlass.rotation.x = Math.PI;
  cupGlass.position.y = -0.15;
  cupGlass.renderOrder = 3;
  cupolaGroup.add(cupGlass);

  // Structural window mullions
  const mullionGeo = trackGeo(new THREE.TorusGeometry(0.83, 0.04, 8, 24, Math.PI));
  for (let i = 0; i < 3; i++) {
    const mul = new THREE.Mesh(mullionGeo, darkMetalMat);
    mul.rotation.z = Math.PI;
    mul.rotation.y = (i * Math.PI) / 3;
    mul.position.y = -0.15;
    cupolaGroup.add(mul);
  }
  tagSubsystem(cupolaGroup, 'Cupola Observation Dome', '7-window robotic workstation & Earth observation bay');
  habitatGroup.add(cupolaGroup);

  // =========================================================================
  // D. ISS INTERIOR CABIN (DESTINY LAB WALKTHROUGH & ISPR RACKS)
  // =========================================================================
  const interiorGroup = new THREE.Group();

  // 1. Deck Floor (y = -1.28) + non-fighting recessed LED strip (y = -1.255, offset >= 0.025)
  const deckGeo = trackGeo(new THREE.BoxGeometry(7.2, 0.08, 2.3));
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.position.set(0, -1.28, 0);
  deckMesh.receiveShadow = !isSoftwareGl;
  interiorGroup.add(deckMesh);

  const floorStripGeo = trackGeo(new THREE.BoxGeometry(6.8, 0.02, 0.1));
  const floorStripMesh = new THREE.Mesh(floorStripGeo, statusMaterials.floorStrip);
  floorStripMesh.position.set(0, -1.23, 0);
  interiorGroup.add(floorStripMesh);

  // 2. Overhead Arch Ribs & Ceiling Diffuser Lighting
  const archGeo = trackGeo(new THREE.TorusGeometry(1.88, 0.07, 10, 28, Math.PI));
  for (const xPos of [-2.8, -1.0, 1.0, 2.8]) {
    const arch = new THREE.Mesh(archGeo, rackTrimMat);
    arch.rotation.y = Math.PI / 2;
    arch.position.set(xPos, 0, 0);
    interiorGroup.add(arch);
  }

  // Overhead IMV Ventilation Supply Pipe (TubeGeometry)
  const imvCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.4, 1.48, 0),
    new THREE.Vector3(0, 1.54, 0),
    new THREE.Vector3(3.4, 1.48, 0),
  ]);
  const imvPipeGeo = trackGeo(new THREE.TubeGeometry(imvCurve, 24, 0.14, 10, false));
  interiorGroup.add(new THREE.Mesh(imvPipeGeo, rackTrimMat));

  // Overhead ceiling LED fixtures
  const ceilingLightGeo = trackGeo(new THREE.BoxGeometry(1.3, 0.06, 0.28));
  const ceilingLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    })
  );
  for (const xPos of [-2.1, 0, 2.1]) {
    const fixture = new THREE.Mesh(ceilingLightGeo, ceilingLightMat);
    fixture.position.set(xPos, 1.62, 0.35);
    interiorGroup.add(fixture);
  }

  // Crew Handrails along both sides of corridor (TubeGeometry)
  const handrailMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.75,
      roughness: 0.25,
    })
  );
  for (const zSide of [-0.92, 0.92]) {
    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.2, -0.35, zSide),
      new THREE.Vector3(0, -0.35, zSide),
      new THREE.Vector3(3.2, -0.35, zSide),
    ]);
    const railGeo = trackGeo(new THREE.TubeGeometry(railCurve, 20, 0.032, 8, false));
    interiorGroup.add(new THREE.Mesh(railGeo, handrailMat));
  }

  // Helper to construct a modular ISPR Rack Bay (facing aisle)
  const rackHousingGeo = trackGeo(new THREE.BoxGeometry(1.65, 2.15, 0.52));
  const rackBezelGeo = trackGeo(new THREE.BoxGeometry(1.48, 1.92, 0.08));
  const statusBarGeo = trackGeo(new THREE.BoxGeometry(1.3, 0.06, 0.04));

  const buildRackBay = (
    x: number,
    z: number,
    facingSign: 1 | -1,
    statusMat: THREE.MeshStandardMaterial,
    name: string,
    detail: string
  ) => {
    const g = new THREE.Group();
    g.position.set(x, -0.16, z);

    const housing = new THREE.Mesh(rackHousingGeo, rackBodyMat);
    g.add(housing);

    const bezel = new THREE.Mesh(rackBezelGeo, rackTrimMat);
    bezel.position.z = facingSign * 0.25;
    g.add(bezel);

    const led = new THREE.Mesh(statusBarGeo, statusMat);
    led.position.set(0, 0.82, facingSign * 0.31);
    g.add(led);

    tagSubsystem(g, name, detail);
    interiorGroup.add(g);
    return g;
  };

  // --- PORT RACKS (z = +1.28, facing -Z toward corridor) ---
  // 1. ECLSS CDRA CO2 Scrubber Rack
  const cdraRack = buildRackBay(
    -2.1,
    1.28,
    -1,
    statusMaterials.cdra,
    'ECLSS CDRA CO₂ Scrubber Rack',
    'Dual-bed zeolite carbon dioxide removal assembly'
  );
  const canisterPairGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 1.1, 14));
  for (const xOff of [-0.32, 0.32]) {
    const bed = new THREE.Mesh(canisterPairGeo, goldMliMat);
    bed.position.set(xOff, -0.05, -0.34);
    cdraRack.add(bed);
  }

  // 2. OGS Oxygen Generation System Rack
  const ogsRack = buildRackBay(
    0,
    1.28,
    -1,
    statusMaterials.ogs,
    'OGS Oxygen Generation Rack',
    'Water electrolysis O₂ generator & pressurized reserve tank'
  );
  const o2TankGeo = trackGeo(new THREE.SphereGeometry(0.22, 16, 12));
  const o2Tank = new THREE.Mesh(o2TankGeo, rackTrimMat);
  o2Tank.position.set(-0.28, 0.05, -0.25);
  ogsRack.add(o2Tank);
  const o2CellGeo = trackGeo(new THREE.BoxGeometry(0.45, 0.85, 0.16));
  const o2Cell = new THREE.Mesh(o2CellGeo, darkMetalMat);
  o2Cell.position.set(0.32, -0.1, -0.34);
  ogsRack.add(o2Cell);

  // 3. Avionics / PDU Electrical Bay Rack (Fire / Smoke Origin!)
  const pduRack = buildRackBay(
    2.1,
    1.28,
    -1,
    statusMaterials.pdu,
    'Avionics PDU Power Rack',
    'Primary power distribution breakers & thermal heat sinks'
  );
  const finGeo = trackGeo(new THREE.BoxGeometry(0.06, 1.2, 0.16));
  for (let i = -3; i <= 3; i++) {
    const fin = new THREE.Mesh(finGeo, darkMetalMat);
    fin.position.set(i * 0.16, -0.08, -0.34);
    pduRack.add(fin);
  }

  // --- STARBOARD RACKS (z = -1.28, facing +Z toward corridor) ---
  // 4. Water Recovery System (WRS) Rack
  const wrsRack = buildRackBay(
    -2.1,
    -1.28,
    1,
    statusMaterials.wrs,
    'WRS Water Recovery Rack',
    'Catalytic reactor & potable water recycling columns'
  );
  const colGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 1.25, 12));
  for (const xOff of [-0.36, 0, 0.36]) {
    const col = new THREE.Mesh(colGeo, glassMat);
    col.position.set(xOff, -0.05, 0.34);
    wrsRack.add(col);
  }

  // 5. Crew Telemetry & Master Caution/Warning Workstation Console
  const consoleRack = buildRackBay(
    0,
    -1.28,
    1,
    alarmBeaconMat,
    'Crew C&W Telemetry Console',
    'Panoramic Caution & Warning console with hazard alarm strobe'
  );

  // Overhead Master Alarm Strobe Beacon Bar
  const beaconGeo = trackGeo(new THREE.BoxGeometry(1.32, 0.1, 0.14));
  const beaconBar = new THREE.Mesh(beaconGeo, alarmBeaconMat);
  beaconBar.position.set(0, 0.88, 0.36);
  consoleRack.add(beaconBar);

  // Main Panoramic C&W Wall Display
  const monitorBezelGeo = trackGeo(new THREE.BoxGeometry(1.52, 0.94, 0.06));
  const monitorBezel = new THREE.Mesh(monitorBezelGeo, darkMetalMat);
  monitorBezel.position.set(0, 0.28, 0.33);
  monitorBezel.rotation.x = -0.06;
  consoleRack.add(monitorBezel);

  const monitorGeo = trackGeo(new THREE.PlaneGeometry(1.44, 0.88));
  const monitor = new THREE.Mesh(monitorGeo, screenMat);
  monitor.position.set(0, 0.28, 0.37);
  monitor.rotation.x = -0.06;
  consoleRack.add(monitor);

  // Angled Lower Flight-Deck Annunciator & Keypad Desk
  const deskGeo = trackGeo(new THREE.BoxGeometry(1.42, 0.09, 0.62));
  const desk = new THREE.Mesh(deskGeo, darkMetalMat);
  desk.position.set(0, -0.34, 0.52);
  desk.rotation.x = 0.24;
  consoleRack.add(desk);

  const annunciatorGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.04, 0.18));
  [-0.44, 0, 0.44].forEach((ax, idx) => {
    const annMat =
      idx === 1 ? alarmBeaconMat : idx === 0 ? statusMaterials.cdra : statusMaterials.ogs;
    const ann = new THREE.Mesh(annunciatorGeo, annMat);
    ann.position.set(ax, -0.27, 0.5);
    ann.rotation.x = 0.24;
    consoleRack.add(ann);
  });

  // 6. IMV Ventilation & Diffuser Fan Rack (Animated Rotor!)
  const imvRack = buildRackBay(
    2.1,
    -1.28,
    1,
    statusMaterials.imv,
    'IMV Cabin Ventilation Fan',
    'Active inter-module air circulation fan (speed tracks airflow)'
  );
  const shroudGeo = trackGeo(new THREE.TorusGeometry(0.42, 0.06, 10, 24));
  const fanShroud = new THREE.Mesh(shroudGeo, darkMetalMat);
  fanShroud.position.set(0, 0.02, 0.34);
  imvRack.add(fanShroud);

  const imvFanRotor = new THREE.Group();
  imvFanRotor.position.set(0, 0.02, 0.35);
  const bladeGeo = trackGeo(new THREE.BoxGeometry(0.72, 0.09, 0.03));
  for (let b = 0; b < 3; b++) {
    const blade = new THREE.Mesh(bladeGeo, handrailMat);
    blade.rotation.z = (b * Math.PI) / 3;
    imvFanRotor.add(blade);
  }
  imvRack.add(imvFanRotor);

  // Bulkhead Hatch Frames at x = ±3.78 (with open vestibule tunnel into adjacent nodes!)
  const jambGeo = trackGeo(new THREE.BoxGeometry(0.18, 2.4, 0.45));
  const lintelGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.45, 2.3));
  for (const xEnd of [-3.78, 3.78]) {
    for (const zJamb of [-0.95, 0.95]) {
      const jamb = new THREE.Mesh(jambGeo, darkMetalMat);
      jamb.position.set(xEnd, -0.1, zJamb);
      interiorGroup.add(jamb);
    }
    const lintel = new THREE.Mesh(lintelGeo, darkMetalMat);
    lintel.position.set(xEnd, 1.15, 0);
    interiorGroup.add(lintel);
  }

  habitatGroup.add(interiorGroup);

  // =========================================================================
  // E. INTERIOR LIGHTING (3 Unshadowed PointLights + 1 Fire Accent Light)
  // =========================================================================
  const interiorLights: THREE.PointLight[] = [];
  for (const xPos of [-2.2, 0, 2.2]) {
    const pt = new THREE.PointLight(0xe0f2fe, 2.8, 7.5, 1.6);
    pt.position.set(xPos, 1.25, 0);
    habitatGroup.add(pt);
    interiorLights.push(pt);
  }

  const fireLight = new THREE.PointLight(0xff4500, 0, 6.5, 1.5);
  fireLight.position.set(2.1, 0.1, 0.72);
  habitatGroup.add(fireLight);

  // =========================================================================
  // F. CIR MICROGRAVITY COMBUSTION & FLAME TESTING LAB RIG
  // =========================================================================
  const flameChamber = createFlameChamberAssembly(trackGeo, trackMat, particleTex, isSoftwareGl);
  flameChamber.group.position.set(1.05, -0.78, 0.56);
  flameChamber.group.scale.setScalar(0.68);
  flameChamber.group.rotation.y = Math.PI;
  const benchGeo = trackGeo(new THREE.BoxGeometry(0.95, 0.48, 0.74));
  const benchMesh = new THREE.Mesh(benchGeo, rackBodyMat);
  benchMesh.position.set(0, -0.24, 0);
  flameChamber.group.add(benchMesh);
  tagSubsystem(
    flameChamber.group,
    'CIR Flame Combustion Test Rig',
    'Microgravity & multi-atmosphere combustion test chamber (gravity, O₂, pressure, airflow, diluent analysis)'
  );
  interiorGroup.add(flameChamber.group);

  return {
    habitatGroup,
    cutawayShellGroup,
    cutawayMaterials: [cutawayHullMat],
    solarWings,
    radiators,
    radiatorMaterials: [radiatorMatLeft, radiatorMatRight],
    cupolaGroup,
    imvFanRotor,
    interiorLights,
    fireLight,
    alarmBeaconMat,
    statusMaterials,
    particleTex,
    consoleScreen,
    flameChamber,
    interactables,
    disposables: {
      geometries,
      materials,
      textures,
    },
  };
}

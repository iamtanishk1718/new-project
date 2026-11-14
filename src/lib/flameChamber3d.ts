import * as THREE from 'three';
import {
  FlameAnalysisResult,
  FlameTestConfig,
} from '../types/habitat';

export interface FlameChamberAssembly {
  group: THREE.Group;
  flameLight: THREE.PointLight;
  update: (
    dt: number,
    elapsed: number,
    config: FlameTestConfig,
    analysis: FlameAnalysisResult,
    selfHealingActive: boolean
  ) => void;
}

// Pre-allocated scratchpad colors (zero GC in render loop)
const _blueCoreColor = new THREE.Color(0x38bdf8);
const _coolFlameColor = new THREE.Color(0x60a5fa);
const _sootOrangeColor = new THREE.Color(0xf97316);
const _sootYellowColor = new THREE.Color(0xfde047);
const _uvChemColor = new THREE.Color(0x22d3ee);
const _uvVioletColor = new THREE.Color(0xa855f7);
const _irHotColor = new THREE.Color(0xffffff);
const _irMidColor = new THREE.Color(0xef4444);
const _healMistColor = new THREE.Color(0x2dd4bf);
const _workColor = new THREE.Color();

export function createFlameChamberAssembly(
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  particleTex: THREE.Texture,
  isSoftwareGl: boolean
): FlameChamberAssembly {
  const group = new THREE.Group();

  // Shared materials
  const chassisMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.82,
      roughness: 0.34,
    })
  );
  const brushedAlumMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.86,
      roughness: 0.28,
    })
  );
  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.25,
    })
  );
  const ceramicMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.1,
      roughness: 0.65,
    })
  );
  const glassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      metalness: 0.08,
      roughness: 0.12,
      transparent: true,
      opacity: isSoftwareGl ? 0.24 : 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  const ductWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.65,
      roughness: 0.42,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  const igniterCoilMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      emissive: 0xf97316,
      emissiveIntensity: 0.0,
      metalness: 0.7,
      roughness: 0.3,
    })
  );
  const flowArrowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.8,
      roughness: 0.25,
    })
  );
  const gravArrowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 0.8,
      roughness: 0.25,
    })
  );

  // 1. Base Pedestal & Structural Rig Frame (total height ~ 1.05m, width ~ 0.9m)
  const basePlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 0.08, 0.72)), chassisMat);
  basePlate.position.y = 0.04;
  group.add(basePlate);

  const topManifold = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 0.09, 0.72)), chassisMat);
  topManifold.position.y = 1.02;
  group.add(topManifold);

  const postGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.96, 10));
  for (const px of [-0.4, 0.4]) {
    for (const pz of [-0.3, 0.3]) {
      const post = new THREE.Mesh(postGeo, brushedAlumMat);
      post.position.set(px, 0.52, pz);
      group.add(post);
    }
  }

  // 2. Optical Combustion Vessel + Confinement Sleeve
  const vesselRadius = 0.28;
  const quartzCylinder = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(vesselRadius, vesselRadius, 0.82, 24, 1, true)),
    glassMat
  );
  quartzCylinder.position.y = 0.52;
  quartzCylinder.renderOrder = 4;
  group.add(quartzCylinder);

  // Narrow Avionics Duct Plates (visible when confinement === 'narrow_duct')
  const narrowDuctGroup = new THREE.Group();
  narrowDuctGroup.position.y = 0.52;
  const ductPlateGeo = trackGeo(new THREE.BoxGeometry(0.54, 0.72, 0.02));
  for (const dz of [-0.11, 0.11]) {
    const plate = new THREE.Mesh(ductPlateGeo, ductWallMat);
    plate.position.z = dz;
    plate.renderOrder = 3;
    narrowDuctGroup.add(plate);
  }
  narrowDuctGroup.visible = false;
  group.add(narrowDuctGroup);

  // Quartz Collar Rings
  const collarGeo = trackGeo(new THREE.TorusGeometry(vesselRadius + 0.01, 0.022, 8, 28));
  collarGeo.rotateX(Math.PI / 2);
  for (const cy of [0.11, 0.93]) {
    const ring = new THREE.Mesh(collarGeo, brassMat);
    ring.position.y = cy;
    group.add(ring);
  }

  // 3. Specimen Holder & Burner Pedestal (centered at y = 0.32)
  const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.065, 0.22, 14)), brassMat);
  stem.position.y = 0.19;
  group.add(stem);

  const ceramicDisc = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16)), ceramicMat);
  ceramicDisc.position.y = 0.31;
  group.add(ceramicDisc);

  // Fuel Specimen Meshes (toggle visibility by fuelType)
  const fuelHolderGroup = new THREE.Group();
  fuelHolderGroup.position.y = 0.34;
  group.add(fuelHolderGroup);

  const celluloseStrip = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.02, 0.12, 0.09)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.85 }))
  );
  celluloseStrip.position.y = 0.05;
  fuelHolderGroup.add(celluloseStrip);

  const pmmaRod = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.13, 14)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.15, transparent: true, opacity: 0.75 }))
  );
  pmmaRod.position.y = 0.06;
  pmmaRod.visible = false;
  fuelHolderGroup.add(pmmaRod);

  const kaptonWire = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.045, 0.008, 8, 20)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.45 }))
  );
  kaptonWire.position.y = 0.05;
  kaptonWire.visible = false;
  fuelHolderGroup.add(kaptonWire);

  const heptaneDrop = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.034, 14, 12)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.12, transparent: true, opacity: 0.85 }))
  );
  heptaneDrop.position.y = 0.05;
  heptaneDrop.visible = false;
  fuelHolderGroup.add(heptaneDrop);

  const liIonCell = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.11, 14)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.65, roughness: 0.3 }))
  );
  liIonCell.position.y = 0.05;
  liIonCell.visible = false;
  fuelHolderGroup.add(liIonCell);

  // Nichrome Igniter Coil Ring
  const igniterCoil = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.058, 0.006, 8, 20)), igniterCoilMat);
  igniterCoil.rotation.x = Math.PI / 2;
  igniterCoil.position.y = 0.36;
  group.add(igniterCoil);

  // 4. Forced Airflow Diffuser Fan (-X intake port) + Airflow Chevrons
  const fanHousing = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16)), chassisMat);
  fanHousing.rotation.z = Math.PI / 2;
  fanHousing.position.set(-0.36, 0.52, 0);
  group.add(fanHousing);

  const diffuserRotor = new THREE.Group();
  diffuserRotor.position.set(-0.33, 0.52, 0);
  const fanBladeGeo = trackGeo(new THREE.BoxGeometry(0.015, 0.21, 0.035));
  for (let b = 0; b < 3; b++) {
    const blade = new THREE.Mesh(fanBladeGeo, flowArrowMat);
    blade.rotation.x = (b * Math.PI) / 3;
    diffuserRotor.add(blade);
  }
  group.add(diffuserRotor);

  // Airflow direction arrows (+X)
  const flowArrows: THREE.Mesh[] = [];
  const chevronGeo = trackGeo(new THREE.ConeGeometry(0.025, 0.065, 8));
  chevronGeo.rotateZ(-Math.PI / 2);
  for (let i = 0; i < 3; i++) {
    const arr = new THREE.Mesh(chevronGeo, flowArrowMat);
    arr.position.set(-0.22 + i * 0.075, 0.52, 0.26);
    group.add(arr);
    flowArrows.push(arr);
  }

  // Gravity Vector Indicator (+Y / -Y arrow on right post)
  const gravGaugeGroup = new THREE.Group();
  gravGaugeGroup.position.set(0.36, 0.52, 0.28);
  const gravShaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8)), gravArrowMat);
  gravGaugeGroup.add(gravShaft);
  const gravTip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.032, 0.07, 10)), gravArrowMat);
  gravTip.rotation.x = Math.PI;
  gravTip.position.y = -0.16;
  gravGaugeGroup.add(gravTip);
  group.add(gravGaugeGroup);

  // 5. Volumetric Multi-Layer 3D Flame Assembly (anchored at specimen tip y = 0.39)
  const flameAnchor = new THREE.Group();
  flameAnchor.position.set(0, 0.39, 0);
  group.add(flameAnchor);

  const innerFlameMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const outerFlameMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const coronaFlameMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );

  const sphereGeo = trackGeo(new THREE.SphereGeometry(0.085, 22, 16));
  const innerFlameMesh = new THREE.Mesh(sphereGeo, innerFlameMat);
  innerFlameMesh.position.y = 0.06;
  innerFlameMesh.renderOrder = 5;
  flameAnchor.add(innerFlameMesh);

  const outerFlameMesh = new THREE.Mesh(sphereGeo, outerFlameMat);
  outerFlameMesh.position.y = 0.08;
  outerFlameMesh.renderOrder = 6;
  flameAnchor.add(outerFlameMesh);

  const coronaFlameMesh = new THREE.Mesh(sphereGeo, coronaFlameMat);
  coronaFlameMesh.position.y = 0.09;
  coronaFlameMesh.renderOrder = 7;
  flameAnchor.add(coronaFlameMesh);

  // Dynamic Flame PointLight
  const flameLight = new THREE.PointLight(0xf97316, 0, 3.8, 1.6);
  flameLight.position.set(0, 0.55, 0);
  group.add(flameLight);

  // 6. Ember / Soot / Suppression Mist Particle System (Zero-GC fixed buffers)
  const pCount = 72;
  const pGeo = trackGeo(new THREE.BufferGeometry());
  const pPos = new Float32Array(pCount * 3);
  const pLife = new Float32Array(pCount);
  for (let i = 0; i < pCount; i++) {
    pLife[i] = Math.random();
    pPos[i * 3] = (Math.random() - 0.5) * 0.08;
    pPos[i * 3 + 1] = Math.random() * 0.25;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));

  const pMat = trackMat(
    new THREE.PointsMaterial({
      color: 0xfdba74,
      map: particleTex,
      size: 0.055,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const flameParticles = new THREE.Points(pGeo, pMat);
  flameParticles.position.set(0, 0.39, 0);
  flameParticles.renderOrder = 8;
  group.add(flameParticles);

  const update = (
    dt: number,
    elapsed: number,
    config: FlameTestConfig,
    analysis: FlameAnalysisResult,
    selfHealingActive: boolean
  ) => {
    // Update specimen & confinement visuals
    celluloseStrip.visible = config.fuelType === 'cellulose';
    pmmaRod.visible = config.fuelType === 'pmma';
    kaptonWire.visible = config.fuelType === 'kapton';
    heptaneDrop.visible = config.fuelType === 'heptane';
    liIonCell.visible = config.fuelType === 'li_ion';

    narrowDuctGroup.visible = config.confinement === 'narrow_duct';
    quartzCylinder.visible = config.confinement !== 'narrow_duct';
    glassMat.opacity = config.confinement === 'quartz_vessel' ? 0.44 : 0.26;

    // Spin forced-flow diffuser rotor & animate flow arrows
    diffuserRotor.rotation.x += dt * (1.2 + config.airflowMs * 32);
    const arrowSpeed = 0.25 + config.airflowMs * 2.2;
    for (let i = 0; i < flowArrows.length; i++) {
      const phase = ((elapsed * arrowSpeed + i * 0.33) % 1.0);
      flowArrows[i].position.x = -0.24 + phase * 0.48;
      flowArrows[i].scale.setScalar(0.55 + Math.min(1.1, config.airflowMs * 1.4));
    }
    flowArrowMat.emissiveIntensity = 0.2 + Math.min(1.8, config.airflowMs * 2.5);

    // Gravity indicator scale & brightness
    gravGaugeGroup.visible = config.gravityG > 0.01;
    gravGaugeGroup.scale.y = 0.45 + Math.min(1.6, config.gravityG * 0.85);
    gravArrowMat.emissiveIntensity = config.gravityG < 0.02 ? 0.15 : 0.6 + config.gravityG * 0.6;

    // Igniter coil glow
    igniterCoilMat.emissiveIntensity = config.ignited ? (analysis.isSustained ? 1.8 : 2.6) : 0.0;

    // Flame geometry scaling & tilt
    if (!analysis.isSustained || selfHealingActive) {
      flameAnchor.visible = false;
      flameLight.intensity = THREE.MathUtils.damp(flameLight.intensity, 0, 8, dt);
    } else {
      flameAnchor.visible = true;
      // Map physical dimensions (mm) cleanly into 3D rig scale (max ~0.46m tall inside 0.82m vessel)
      const normW = THREE.MathUtils.clamp(analysis.flameWidthMm / 44, 0.48, 1.85);
      const normH = THREE.MathUtils.clamp(analysis.flameHeightMm / 62, 0.52, 3.6);
      const flicker =
        1.0 +
        Math.sin(elapsed * (11 + config.gravityG * 10 + config.airflowMs * 16)) *
          (0.03 + config.gravityG * 0.055 + config.airflowMs * 0.06);
      const sway =
        Math.cos(elapsed * 9.5) * (0.012 + config.gravityG * 0.025 + config.airflowMs * 0.04);

      const tiltRad = -(analysis.tiltAngleDeg * Math.PI) / 180;
      flameAnchor.rotation.z = THREE.MathUtils.damp(flameAnchor.rotation.z, tiltRad + sway, 8, dt);

      // Inner blue reaction zone stays closer to spherical in 0g, slightly taller in 1g
      const innerH = THREE.MathUtils.clamp(0.65 + (normH - 0.65) * 0.55, 0.55, 2.2);
      innerFlameMesh.scale.set(normW * 0.78, innerH * flicker, normW * 0.78);
      innerFlameMesh.position.y = 0.042 * innerH;

      // Outer luminous plume stretches upward strongly with gravity
      outerFlameMesh.scale.set(normW * 1.08, normH * flicker, normW * 1.08);
      outerFlameMesh.position.y = 0.056 * normH;

      // Subtle outer corona halo
      coronaFlameMesh.scale.set(normW * 1.38, normH * 1.18 * flicker, normW * 1.38);
      coronaFlameMesh.position.y = 0.06 * normH;

      // Color Palette by Imaging Mode & Combustion Physics
      if (config.imagingMode === 'chemilum') {
        innerFlameMat.color.copy(_uvChemColor);
        outerFlameMat.color.copy(_uvVioletColor);
        coronaFlameMat.color.copy(_uvChemColor);
        innerFlameMat.opacity = 0.96;
        outerFlameMat.opacity = 0.72;
        coronaFlameMat.opacity = 0.4;
        flameLight.color.copy(_uvChemColor);
      } else if (config.imagingMode === 'infrared') {
        const heatRatio = THREE.MathUtils.clamp((analysis.peakTempC - 400) / 1800, 0, 1);
        innerFlameMat.color.copy(_irHotColor);
        _workColor.copy(_sootOrangeColor).lerp(_irHotColor, heatRatio);
        outerFlameMat.color.copy(_workColor);
        coronaFlameMat.color.copy(_irMidColor);
        innerFlameMat.opacity = 0.98;
        outerFlameMat.opacity = 0.85;
        coronaFlameMat.opacity = 0.45;
        flameLight.color.copy(_irMidColor);
      } else {
        // Optical view: blends blue CH* chemiluminescence vs yellow-orange soot incandescence
        const soot = analysis.sootLuminosity;
        if (analysis.coolFlameActive) {
          innerFlameMat.color.copy(_coolFlameColor);
          outerFlameMat.color.copy(_blueCoreColor);
          coronaFlameMat.color.copy(_coolFlameColor);
          innerFlameMat.opacity = 0.72;
          outerFlameMat.opacity = 0.42;
          coronaFlameMat.opacity = 0.2;
          flameLight.color.copy(_coolFlameColor);
        } else {
          _workColor.copy(_blueCoreColor).lerp(_sootYellowColor, soot * 0.45);
          innerFlameMat.color.copy(_workColor);
          _workColor.copy(_blueCoreColor).lerp(_sootOrangeColor, Math.min(1, soot * 1.25));
          outerFlameMat.color.copy(_workColor);
          _workColor.copy(_sootOrangeColor).lerp(_sootYellowColor, 0.5);
          coronaFlameMat.color.copy(_workColor);
          innerFlameMat.opacity = 0.88;
          outerFlameMat.opacity = 0.45 + soot * 0.42;
          coronaFlameMat.opacity = 0.16 + soot * 0.25;
          flameLight.color.copy(outerFlameMat.color);
        }
      }

      const targetIntensity = (analysis.coolFlameActive ? 1.1 : 2.2 + analysis.sootLuminosity * 2.2) * flicker;
      flameLight.intensity = THREE.MathUtils.damp(flameLight.intensity, targetIntensity, 10, dt);
    }

    // Particle kinematics (Flame soot/sparks OR Self-Healing cyan mist)
    if (selfHealingActive) {
      pMat.color.copy(_healMistColor);
      pMat.opacity = THREE.MathUtils.damp(pMat.opacity, 0.85, 5, dt);
      const posArr = pGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pCount; i++) {
        pLife[i] += dt * 1.2;
        if (pLife[i] > 1) {
          pLife[i] = 0;
          const ang = Math.random() * Math.PI * 2;
          posArr[i * 3] = Math.cos(ang) * 0.22;
          posArr[i * 3 + 1] = 0.35 + (Math.random() - 0.5) * 0.12;
          posArr[i * 3 + 2] = Math.sin(ang) * 0.22;
        } else {
          // Swirl inward to quench specimen
          posArr[i * 3] *= 1 - dt * 1.8;
          posArr[i * 3 + 2] *= 1 - dt * 1.8;
          posArr[i * 3 + 1] -= dt * 0.15;
        }
      }
      pGeo.attributes.position.needsUpdate = true;
    } else if (analysis.isSustained) {
      pMat.color.copy(
        config.imagingMode === 'chemilum'
          ? _uvChemColor
          : analysis.coolFlameActive
          ? _coolFlameColor
          : analysis.sootLuminosity > 0.35
          ? _sootOrangeColor
          : _blueCoreColor
      );
      pMat.opacity = THREE.MathUtils.damp(pMat.opacity, 0.65, 6, dt);
      const posArr = pGeo.attributes.position.array as Float32Array;
      const riseRate = 0.08 + config.gravityG * 0.58;
      const driftRate = config.airflowMs * 1.15;
      for (let i = 0; i < pCount; i++) {
        pLife[i] += dt * (0.9 + config.gravityG * 0.8 + config.airflowMs * 1.2);
        if (pLife[i] > 1) {
          pLife[i] = 0;
          posArr[i * 3] = (Math.random() - 0.5) * 0.04;
          posArr[i * 3 + 1] = 0.02 + Math.random() * 0.04;
          posArr[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
        } else {
          posArr[i * 3] += (driftRate + (Math.sin(i * 3.1 + elapsed * 4) * 0.05)) * dt;
          posArr[i * 3 + 1] += riseRate * dt;
          posArr[i * 3 + 2] += Math.cos(i * 2.7 + elapsed * 4) * 0.05 * dt;
        }
      }
      pGeo.attributes.position.needsUpdate = true;
    } else {
      pMat.opacity = THREE.MathUtils.damp(pMat.opacity, 0.0, 6, dt);
    }
  };

  return {
    group,
    flameLight,
    update,
  };
}

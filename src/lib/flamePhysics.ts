import {
  FlameAnalysisResult,
  FlameConfinementMode,
  FlameDiluentGas,
  FlameFuelType,
  FlameTestConfig,
} from '../types/habitat';

export const DEFAULT_FLAME_TEST_CONFIG: FlameTestConfig = {
  ignited: true,
  gravityG: 0.0,
  oxygenPercent: 21.0,
  pressureKPa: 101.3,
  airflowMs: 0.14,
  diluentGas: 'nitrogen',
  fuelType: 'cellulose',
  humidityPercent: 48,
  ambientTempC: 22.0,
  confinement: 'open_rack',
  imagingMode: 'optical',
  syncWithHabitat: false,
};

export interface FlamePresetDefinition {
  id: string;
  label: string;
  subtitle: string;
  patch: Partial<FlameTestConfig>;
}

export const FLAME_TEST_PRESETS: FlamePresetDefinition[] = [
  {
    id: 'iss_microgravity',
    label: 'ISS Microgravity (0g)',
    subtitle: 'Spherical blue diffusion flame under gentle cabin IMV flow',
    patch: {
      ignited: true,
      gravityG: 0.0,
      oxygenPercent: 21.0,
      pressureKPa: 101.3,
      airflowMs: 0.12,
      diluentGas: 'nitrogen',
      fuelType: 'cellulose',
      humidityPercent: 48,
      ambientTempC: 22,
      confinement: 'open_rack',
    },
  },
  {
    id: 'lunar_artemis',
    label: 'Lunar Exploration (0.16g)',
    subtitle: 'Artemis 55 kPa / 32% O₂ hyperoxic exploration atmosphere',
    patch: {
      ignited: true,
      gravityG: 0.16,
      oxygenPercent: 32.0,
      pressureKPa: 55.2,
      airflowMs: 0.15,
      diluentGas: 'nitrogen',
      fuelType: 'cellulose',
      humidityPercent: 42,
      ambientTempC: 23,
      confinement: 'open_rack',
    },
  },
  {
    id: 'mars_outpost',
    label: 'Mars Gravity (0.38g)',
    subtitle: 'Chryse habitat moderate buoyancy plume at 82 kPa',
    patch: {
      ignited: true,
      gravityG: 0.38,
      oxygenPercent: 22.5,
      pressureKPa: 82.0,
      airflowMs: 0.18,
      diluentGas: 'nitrogen',
      fuelType: 'pmma',
      humidityPercent: 40,
      ambientTempC: 21,
      confinement: 'open_rack',
    },
  },
  {
    id: 'earth_control',
    label: 'Earth 1g Control',
    subtitle: 'Strong natural buoyancy plume with luminous soot tip',
    patch: {
      ignited: true,
      gravityG: 1.0,
      oxygenPercent: 21.0,
      pressureKPa: 101.3,
      airflowMs: 0.05,
      diluentGas: 'nitrogen',
      fuelType: 'cellulose',
      humidityPercent: 50,
      ambientTempC: 22,
      confinement: 'open_rack',
    },
  },
  {
    id: 'hypergravity',
    label: 'Centrifuge 1.8g',
    subtitle: 'High buoyancy stretch, high soot & turbulent flicker',
    patch: {
      ignited: true,
      gravityG: 1.8,
      oxygenPercent: 21.0,
      pressureKPa: 101.3,
      airflowMs: 0.08,
      diluentGas: 'nitrogen',
      fuelType: 'heptane',
      humidityPercent: 45,
      ambientTempC: 23,
      confinement: 'open_rack',
    },
  },
  {
    id: 'cool_flame',
    label: 'FLEX Cool Flame',
    subtitle: 'Heptane droplet low-temp blue chemiluminescence in 0g',
    patch: {
      ignited: true,
      gravityG: 0.0,
      oxygenPercent: 18.2,
      pressureKPa: 75.0,
      airflowMs: 0.03,
      diluentGas: 'nitrogen',
      fuelType: 'heptane',
      humidityPercent: 35,
      ambientTempC: 20,
      confinement: 'quartz_vessel',
    },
  },
  {
    id: 'co2_inert',
    label: 'CO₂ Suppression',
    subtitle: 'High heat-capacity CO₂ diluent quench test',
    patch: {
      ignited: true,
      gravityG: 0.0,
      oxygenPercent: 19.5,
      pressureKPa: 101.3,
      airflowMs: 0.12,
      diluentGas: 'co2_suppress',
      fuelType: 'cellulose',
      humidityPercent: 50,
      ambientTempC: 22,
      confinement: 'open_rack',
    },
  },
  {
    id: 'li_ion_runaway',
    label: 'Li-Ion Battery Jet',
    subtitle: 'High-energy electrolyte flare in narrow avionics duct',
    patch: {
      ignited: true,
      gravityG: 0.0,
      oxygenPercent: 24.0,
      pressureKPa: 101.3,
      airflowMs: 0.34,
      diluentGas: 'nitrogen',
      fuelType: 'li_ion',
      humidityPercent: 30,
      ambientTempC: 34,
      confinement: 'narrow_duct',
    },
  },
];

interface FuelSpec {
  label: string;
  baseLocPercent: number;
  adiabaticBaseC: number;
  baseSpreadMmS: number;
  sootTendency: number;
  heatOfCombustionKJg: number;
  minPressureKPa: number;
  blowOffFactor: number;
}

export const FLAME_FUEL_SPECS: Record<FlameFuelType, FuelSpec> = {
  cellulose: {
    label: 'Cellulose Wick (BASS)',
    baseLocPercent: 16.2,
    adiabaticBaseC: 1420,
    baseSpreadMmS: 3.8,
    sootTendency: 0.48,
    heatOfCombustionKJg: 16.5,
    minPressureKPa: 34,
    blowOffFactor: 1.0,
  },
  pmma: {
    label: 'Cast Acrylic (PMMA)',
    baseLocPercent: 17.3,
    adiabaticBaseC: 1640,
    baseSpreadMmS: 2.1,
    sootTendency: 0.72,
    heatOfCombustionKJg: 25.2,
    minPressureKPa: 38,
    blowOffFactor: 0.85,
  },
  kapton: {
    label: 'Kapton Wire Insulation',
    baseLocPercent: 26.2,
    adiabaticBaseC: 1380,
    baseSpreadMmS: 1.4,
    sootTendency: 0.36,
    heatOfCombustionKJg: 18.0,
    minPressureKPa: 46,
    blowOffFactor: 0.65,
  },
  heptane: {
    label: 'n-Heptane Droplet (FLEX)',
    baseLocPercent: 13.8,
    adiabaticBaseC: 1760,
    baseSpreadMmS: 5.4,
    sootTendency: 0.85,
    heatOfCombustionKJg: 44.6,
    minPressureKPa: 30,
    blowOffFactor: 1.15,
  },
  li_ion: {
    label: 'Li-Ion Electrolyte Vapor',
    baseLocPercent: 11.5,
    adiabaticBaseC: 1890,
    baseSpreadMmS: 7.2,
    sootTendency: 0.92,
    heatOfCombustionKJg: 31.8,
    minPressureKPa: 25,
    blowOffFactor: 1.55,
  },
};

interface DiluentSpec {
  label: string;
  locShiftPercent: number;
  tempMultiplier: number;
  conductivityFactor: number;
  sootFactor: number;
}

export const FLAME_DILUENT_SPECS: Record<FlameDiluentGas, DiluentSpec> = {
  nitrogen: {
    label: 'Standard Air (N₂ Balance)',
    locShiftPercent: 0,
    tempMultiplier: 1.0,
    conductivityFactor: 1.0,
    sootFactor: 1.0,
  },
  co2_suppress: {
    label: 'CO₂ Enriched Inerting Mix',
    locShiftPercent: 5.4,
    tempMultiplier: 0.78,
    conductivityFactor: 0.86,
    sootFactor: 0.55,
  },
  helium: {
    label: 'Heliox (He / O₂)',
    locShiftPercent: 2.6,
    tempMultiplier: 0.89,
    conductivityFactor: 1.75,
    sootFactor: 0.42,
  },
  argon: {
    label: 'Argon-Oxygen (Ar / O₂)',
    locShiftPercent: -2.3,
    tempMultiplier: 1.14,
    conductivityFactor: 0.82,
    sootFactor: 1.18,
  },
};

const CONFINEMENT_FACTORS: Record<
  FlameConfinementMode,
  { label: string; spreadGain: number; tempBonusC: number; blowOffShield: number }
> = {
  open_rack: { label: 'Open Rack Rig', spreadGain: 1.0, tempBonusC: 0, blowOffShield: 1.0 },
  narrow_duct: { label: 'Narrow Avionics Duct', spreadGain: 1.38, tempBonusC: 85, blowOffShield: 0.78 },
  quartz_vessel: { label: 'Quartz Combustion Vessel', spreadGain: 0.92, tempBonusC: 120, blowOffShield: 1.28 },
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function analyzeFlameConditions(cfg: FlameTestConfig): FlameAnalysisResult {
  const fuel = FLAME_FUEL_SPECS[cfg.fuelType];
  const diluent = FLAME_DILUENT_SPECS[cfg.diluentGas];
  const conf = CONFINEMENT_FACTORS[cfg.confinement];

  const pressureNorm = cfg.pressureKPa / 101.3;
  // Low pressure increases LOC slightly; high humidity & cold ambient also raise LOC
  const humidityLocShift = Math.max(0, (cfg.humidityPercent - 40) * 0.032);
  const pressureLocShift = pressureNorm < 0.75 ? (0.75 - pressureNorm) * 4.5 : -(pressureNorm - 1) * 1.1;
  const tempLocShift = (22 - cfg.ambientTempC) * 0.04;
  const effectiveLoc = clamp(
    fuel.baseLocPercent + diluent.locShiftPercent + humidityLocShift + pressureLocShift + tempLocShift,
    9.5,
    33.0
  );

  // Oxygen index above LOC
  const o2Excess = cfg.oxygenPercent - effectiveLoc;
  const flammabilityMarginPercent = Math.round(clamp((o2Excess / effectiveLoc) * 100, -100, 150));

  // Buoyancy velocity scale V_b ~ sqrt(g * L) and forced velocity V_f
  const gravityEff = Math.max(0, cfg.gravityG);
  const buoyantVelMs = 0.28 * Math.sqrt(gravityEff);
  const forcedVelMs = Math.max(0, cfg.airflowMs);
  const totalTransportVel = Math.hypot(buoyantVelMs, forcedVelMs);

  // Dimensionless Richardson Number Ri = Gr / Re^2 ~ (g * L) / U^2
  const richardsonNumber =
    forcedVelMs < 0.015
      ? gravityEff > 0.01
        ? 45.0
        : 0.0
      : Number(((gravityEff * 0.098) / Math.pow(forcedVelMs, 2)).toFixed(2));

  // Damköhler Number Da = chemical reaction rate / convective residence rate
  const o2Ratio = Math.max(0.1, cfg.oxygenPercent / 21.0);
  const reactionFactor =
    Math.pow(o2Ratio, 1.35) *
    Math.pow(clamp(pressureNorm, 0.25, 1.3), 1.1) *
    (cfg.diluentGas === 'co2_suppress' ? 0.62 : cfg.diluentGas === 'helium' ? 0.82 : cfg.diluentGas === 'argon' ? 1.15 : 1.0);
  const residenceScale = Math.max(0.08, forcedVelMs / (0.48 * fuel.blowOffFactor * conf.blowOffShield));
  const damkohlerNumber = Number(clamp((reactionFactor * 1.15) / residenceScale, 0.05, 18.0).toFixed(2));

  // Extinction Checks
  let extinctionReason: string | null = null;
  if (!cfg.ignited) {
    extinctionReason = 'Igniter Standby (Unignited Specimen)';
  } else if (cfg.pressureKPa < fuel.minPressureKPa) {
    extinctionReason = `Low-Pressure Quench (< ${fuel.minPressureKPa} kPa)`;
  } else if (cfg.oxygenPercent < effectiveLoc) {
    if (cfg.diluentGas === 'co2_suppress') {
      extinctionReason = `CO₂ Thermal Inerting Quench (LOC ${effectiveLoc.toFixed(1)}% O₂)`;
    } else if (cfg.diluentGas === 'helium') {
      extinctionReason = `Heliox Conductive Heat-Loss Quench (LOC ${effectiveLoc.toFixed(1)}% O₂)`;
    } else {
      extinctionReason = `Hypoxic Oxygen Starvation (< LOC ${effectiveLoc.toFixed(1)}% O₂)`;
    }
  } else if (damkohlerNumber < 0.58 && forcedVelMs > 0.35) {
    extinctionReason = `Forced-Flow Blow-Off Extinction (Da ${damkohlerNumber.toFixed(2)} < 0.58)`;
  } else if (
    gravityEff < 0.03 &&
    forcedVelMs < 0.012 &&
    cfg.oxygenPercent < effectiveLoc + 1.8 &&
    cfg.fuelType !== 'li_ion'
  ) {
    extinctionReason = 'Zero-Flow Oxygen Diffusion Asphyxiation';
  }

  const isSustained = cfg.ignited && extinctionReason === null;

  // Cool flame phenomenon (n-heptane / thin cellulose in low-gravity low-O2 gentle flow)
  const coolFlameActive =
    isSustained &&
    gravityEff < 0.12 &&
    forcedVelMs < 0.14 &&
    cfg.oxygenPercent <= effectiveLoc + 4.8 &&
    (cfg.fuelType === 'heptane' || cfg.fuelType === 'cellulose');

  if (!isSustained) {
    return {
      isSustained: false,
      extinctionReason,
      regimeLabel: cfg.ignited ? 'Extinguished / Sub-Limit State' : 'Igniter Standby',
      peakTempC: Number(cfg.ambientTempC.toFixed(1)),
      peakTempK: Number((cfg.ambientTempC + 273.15).toFixed(1)),
      flameHeightMm: 0,
      flameWidthMm: 0,
      aspectRatio: 1.0,
      tiltAngleDeg: 0,
      spreadRateMmS: 0,
      massLossRateMgS: 0,
      heatReleaseWatts: 0,
      sootVolumePpm: 0,
      coYieldRatio: 0,
      damkohlerNumber,
      richardsonNumber,
      sootLuminosity: 0,
      blueFraction: 0,
      coolFlameActive: false,
      flammabilityMarginPercent,
      riskAdvisory: cfg.ignited
        ? `Flame cannot sustain under current conditions: ${extinctionReason}.`
        : 'Specimen mounted in optical test chamber. Engage Nichrome Igniter to initiate combustion test.',
      recommendedSuppressant:
        cfg.oxygenPercent > 23.5
          ? 'Vent O₂ concentration below 21% and pulse N₂/CO₂ mist.'
          : 'Maintain nominal cabin ventilation & verify igniter interlock.',
    };
  }

  // Peak Flame Temperature (°C)
  const o2TempBoost = Math.pow(cfg.oxygenPercent / 21.0, 0.52);
  const pressureTempFactor = 0.86 + 0.14 * clamp(pressureNorm, 0.3, 1.25);
  const humidityCoolC = cfg.humidityPercent * 0.95;
  const microgravityRadLossC = gravityEff < 0.08 ? 175 : 0;
  let peakTempC =
    fuel.adiabaticBaseC * diluent.tempMultiplier * o2TempBoost * pressureTempFactor +
    conf.tempBonusC +
    (cfg.ambientTempC - 22) * 0.8 -
    humidityCoolC -
    microgravityRadLossC;

  if (coolFlameActive) {
    peakTempC = Math.min(peakTempC, 540 + (cfg.oxygenPercent - effectiveLoc) * 28);
  }
  peakTempC = clamp(peakTempC, 380, 2650);
  const peakTempK = peakTempC + 273.15;

  // Flame Geometry (Height, Width, Aspect Ratio, Tilt)
  const gravityStretch = 1.0 + 2.35 * Math.pow(gravityEff, 0.62);
  const o2SizeScale = clamp(0.65 + (cfg.oxygenPercent - 12) * 0.036, 0.55, 1.55);
  const pressureCompression = 1.0 / Math.pow(clamp(pressureNorm, 0.35, 1.3), 0.25);

  const flameWidthMm = Number(
    clamp(
      (28 + (gravityEff < 0.1 ? 10 : 0)) * o2SizeScale * pressureCompression * (1 - Math.min(0.32, forcedVelMs * 0.35)),
      16,
      78
    ).toFixed(1)
  );
  const flowPlumeStretch = gravityEff < 0.15 ? 1 + forcedVelMs * 2.1 : 1 + forcedVelMs * 0.6;
  const flameHeightMm = Number(
    clamp(
      flameWidthMm * gravityStretch * flowPlumeStretch * (coolFlameActive ? 0.82 : 1.0),
      18,
      235
    ).toFixed(1)
  );
  const aspectRatio = Number((flameHeightMm / Math.max(1, flameWidthMm)).toFixed(2));

  // Tilt Angle from vertical (+Y buoyancy vs +X forced flow)
  const effectiveVerticalVel = Math.max(0.035, buoyantVelMs);
  const tiltAngleDeg = Number(
    clamp((Math.atan2(forcedVelMs, effectiveVerticalVel) * 180) / Math.PI, 0, 84).toFixed(1)
  );

  // Flame Spread Rate & Mass Loss Rate
  const flowTransportFactor =
    0.55 + 1.45 * Math.min(1.6, totalTransportVel / 0.25) - Math.max(0, forcedVelMs - 0.52) * 1.1;
  const spreadRateMmS = Number(
    clamp(
      fuel.baseSpreadMmS *
        Math.pow(o2Ratio, 1.65) *
        Math.pow(clamp(pressureNorm, 0.3, 1.3), 0.45) *
        conf.spreadGain *
        Math.max(0.25, flowTransportFactor) *
        (coolFlameActive ? 0.35 : 1.0),
      0.2,
      42.0
    ).toFixed(2)
  );

  const massLossRateMgS = Number(
    clamp(spreadRateMmS * 1.85 * o2SizeScale * (cfg.fuelType === 'heptane' ? 1.4 : 1.0), 0.4, 85.0).toFixed(2)
  );
  const heatReleaseWatts = Number(
    clamp((massLossRateMgS / 1000) * fuel.heatOfCombustionKJg * 1000 * (coolFlameActive ? 0.35 : 1.0), 6, 2800).toFixed(1)
  );

  // Soot vs Blue Chemiluminescence
  const sootBase =
    fuel.sootTendency *
    diluent.sootFactor *
    Math.pow(clamp(pressureNorm, 0.3, 1.3), 1.45) *
    (0.32 + 0.68 * clamp(gravityEff, 0, 1.5)) *
    clamp(o2Ratio, 0.5, 1.7);

  const sootLuminosity = coolFlameActive ? 0.05 : Number(clamp(sootBase, 0.04, 1.0).toFixed(2));
  const blueFraction = coolFlameActive
    ? 0.96
    : Number(clamp(1.0 - sootLuminosity * 0.72 + (cfg.diluentGas === 'helium' ? 0.15 : 0), 0.18, 0.98).toFixed(2));
  const sootVolumePpm = Number(clamp(sootLuminosity * 42 * Math.pow(pressureNorm, 1.1), 0.2, 68).toFixed(1));
  const coYieldRatio = Number(
    clamp(0.025 + (gravityEff < 0.1 ? 0.045 : 0.012) + (cfg.oxygenPercent < 19 ? 0.06 : 0) + (coolFlameActive ? 0.09 : 0), 0.01, 0.24).toFixed(3)
  );

  // Regime Label
  let regimeLabel = 'Buoyant Diffusion Flame';
  if (coolFlameActive) {
    regimeLabel = 'Microgravity Cool Flame (CH₂O / OH* Blue Glow)';
  } else if (cfg.oxygenPercent >= 26.0) {
    regimeLabel = 'Hyperoxic Flashover Acceleration Regime';
  } else if (gravityEff < 0.05 && forcedVelMs < 0.08) {
    regimeLabel = 'Spherical Microgravity Diffusion Flame';
  } else if (gravityEff < 0.15 && forcedVelMs >= 0.08) {
    regimeLabel = 'Wake-Stabilized Forced-Flow Microgravity Plume';
  } else if (gravityEff > 1.25) {
    regimeLabel = 'Hypergravity Turbulent Buoyant Plume';
  } else if (forcedVelMs > 0.38) {
    regimeLabel = 'Shear-Tilted Mixed Convection Flame';
  }

  let riskAdvisory =
    'Combustion remains localized inside the optical test chamber. Standard IMV monitoring active.';
  if (cfg.oxygenPercent >= 25.0 || spreadRateMmS > 12) {
    riskAdvisory =
      'SEVERE FIRE SPREAD HAZARD: Hyperoxic flame front propagates rapidly with intense thermal radiation. Reduce O₂ < 23% immediately.';
  } else if (cfg.fuelType === 'li_ion') {
    riskAdvisory =
      'THERMAL RUNAWAY JET: Electrolyte combustion sustains even at low O₂ and emits high CO/HF toxins. Trigger CO₂/Water-Mist quench.';
  } else if (coolFlameActive) {
    riskAdvisory =
      'INVISIBLE COOL FLAME WARNING: Low-luminosity blue flame produces high CO & formaldehyde without triggering standard optical smoke sensors.';
  } else if (gravityEff < 0.05 && forcedVelMs > 0.25) {
    riskAdvisory =
      'AIRFLOW-DRIVEN SPREAD: In microgravity, cabin ventilation fans act like bellows—turn off HVAC/IMV fans to choke the flame.';
  }

  const recommendedSuppressant =
    cfg.fuelType === 'li_ion'
      ? 'Fine Water Mist Cooling + Power Bus Isolation'
      : gravityEff < 0.08
      ? 'Shut Down IMV Ventilation Fans + Pulse CO₂ Inerting'
      : 'Directional CO₂ / Nitrogen Purge Nozzle';

  return {
    isSustained: true,
    extinctionReason: null,
    regimeLabel,
    peakTempC: Number(peakTempC.toFixed(1)),
    peakTempK: Number(peakTempK.toFixed(1)),
    flameHeightMm,
    flameWidthMm,
    aspectRatio,
    tiltAngleDeg,
    spreadRateMmS,
    massLossRateMgS,
    heatReleaseWatts,
    sootVolumePpm,
    coYieldRatio,
    damkohlerNumber,
    richardsonNumber,
    sootLuminosity,
    blueFraction,
    coolFlameActive,
    flammabilityMarginPercent,
    riskAdvisory,
    recommendedSuppressant,
  };
}

export type FlameSensitivityAxis = 'gravity' | 'oxygen' | 'pressure' | 'airflow';

export interface FlameSensitivityPoint {
  axisLabel: string;
  axisValue: number;
  peakTempC: number;
  spreadRateMmS: number;
  flameHeightMm: number;
  sootVolumePpm: number;
  sustained: number;
}

export function generateFlameSensitivityCurve(
  baseConfig: FlameTestConfig,
  axis: FlameSensitivityAxis
): FlameSensitivityPoint[] {
  const activeBase = { ...baseConfig, ignited: true };
  if (axis === 'gravity') {
    const steps = [0, 0.08, 0.16, 0.38, 0.65, 1.0, 1.4, 1.8];
    return steps.map((g) => {
      const res = analyzeFlameConditions({ ...activeBase, gravityG: g });
      return {
        axisLabel: `${g.toFixed(2)}g`,
        axisValue: g,
        peakTempC: res.peakTempC,
        spreadRateMmS: res.spreadRateMmS,
        flameHeightMm: res.flameHeightMm,
        sootVolumePpm: res.sootVolumePpm,
        sustained: res.isSustained ? 1 : 0,
      };
    });
  }
  if (axis === 'oxygen') {
    const steps = [12, 15, 17, 19, 21, 24, 28, 32, 36];
    return steps.map((o2) => {
      const res = analyzeFlameConditions({ ...activeBase, oxygenPercent: o2 });
      return {
        axisLabel: `${o2}%`,
        axisValue: o2,
        peakTempC: res.peakTempC,
        spreadRateMmS: res.spreadRateMmS,
        flameHeightMm: res.flameHeightMm,
        sootVolumePpm: res.sootVolumePpm,
        sustained: res.isSustained ? 1 : 0,
      };
    });
  }
  if (axis === 'pressure') {
    const steps = [30, 42, 55, 70, 85, 101.3, 115];
    return steps.map((p) => {
      const res = analyzeFlameConditions({ ...activeBase, pressureKPa: p });
      return {
        axisLabel: `${Math.round(p)} kPa`,
        axisValue: p,
        peakTempC: res.peakTempC,
        spreadRateMmS: res.spreadRateMmS,
        flameHeightMm: res.flameHeightMm,
        sootVolumePpm: res.sootVolumePpm,
        sustained: res.isSustained ? 1 : 0,
      };
    });
  }
  const steps = [0.0, 0.05, 0.12, 0.22, 0.35, 0.5, 0.65, 0.8];
  return steps.map((v) => {
    const res = analyzeFlameConditions({ ...activeBase, airflowMs: v });
    return {
      axisLabel: `${v.toFixed(2)} m/s`,
      axisValue: v,
      peakTempC: res.peakTempC,
      spreadRateMmS: res.spreadRateMmS,
      flameHeightMm: res.flameHeightMm,
      sootVolumePpm: res.sootVolumePpm,
      sustained: res.isSustained ? 1 : 0,
    };
  });
}

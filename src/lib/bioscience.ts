/**
 * Bioscience & Spaceflight Human Physiology Engine
 * Grounded in NASA Human Integration Design Handbook (HIDH) & NASA OSDR / GeneLab research.
 */

export interface BiosciencePhysiologyReport {
  oxygenPartialPressureKPa: number; // ppO2 = (O2% / 100) * total_pressure
  bloodOxygenSaturationEstimateSpO2: number; // %
  hypoxiaState: 'nominal' | 'mild_hypoxia' | 'moderate_hypoxia' | 'severe_hypoxia' | 'critical_anoxia';
  hypoxiaSymptoms: string;
  co2PartialPressureKPa: number; // ppCO2
  hypercapniaState: 'nominal' | 'mild_headache' | 'acidosis_risk' | 'severe_hypercapnia' | 'lethal_narcosis';
  hypercapniaSymptoms: string;
  hourlyMetabolicDemand: {
    crewO2ConsumedLPerHour: number;
    crewCO2ProducedLPerHour: number;
    hourlyHeatOutputWatts: number;
  };
  radiationCellularResponse: {
    dnaDoubleStrandBreaksPerCellPerHour: number;
    careerCancerRiskIncreasePercent: number;
    activePathwayDescription: string;
    uniprotReference: string;
    reactomePathwayId: string;
  };
}

export function computeHumanPhysiology(
  o2Percent: number,
  co2Ppm: number,
  pressureKPa: number,
  occupants: number,
  activityLevel: 'resting' | 'normal' | 'high',
  radiationRateUSvH: number,
  cumulativeDoseMSv: number
): BiosciencePhysiologyReport {
  // 1. Partial Pressure Calculations (Dalton's Law)
  const ppO2 = (o2Percent / 100) * pressureKPa;
  const ppCO2 = (co2Ppm / 1000000) * pressureKPa;

  // 2. Blood Oxygen Saturation Estimate (Hill Equation approximation for alveolar O2)
  // Sea level nominal ppO2 is ~21.2 kPa. Below 16 kPa, SpO2 begins to drop.
  let spO2 = 98.5;
  let hypoxiaState: BiosciencePhysiologyReport['hypoxiaState'] = 'nominal';
  let hypoxiaSymptoms = 'Normal physiological oxygenation. Alveolar gas exchange balanced.';

  if (ppO2 >= 18.0) {
    spO2 = 98.0 + Math.min(1.5, (ppO2 - 18.0) * 0.4);
    hypoxiaState = 'nominal';
  } else if (ppO2 >= 15.0) {
    spO2 = 94.0 + (ppO2 - 15.0) * 1.3;
    hypoxiaState = 'mild_hypoxia';
    hypoxiaSymptoms = 'Compensatory tachypnea, mild peripheral vasodilation, nighttime visual acuity decrease.';
  } else if (ppO2 >= 12.0) {
    spO2 = 85.0 + (ppO2 - 12.0) * 3.0;
    hypoxiaState = 'moderate_hypoxia';
    hypoxiaSymptoms = 'Impaired cognitive calculation, executive fatigue, peripheral cyanosis, headache.';
  } else if (ppO2 >= 8.0) {
    spO2 = 65.0 + (ppO2 - 8.0) * 5.0;
    hypoxiaState = 'severe_hypoxia';
    hypoxiaSymptoms = 'Severe confusion, loss of fine motor coordination, tunnel vision, risk of blackout.';
  } else {
    spO2 = Math.max(30.0, ppO2 * 6.5);
    hypoxiaState = 'critical_anoxia';
    hypoxiaSymptoms = 'Unconsciousness within 30-60 seconds. Irreversible neurological cellular damage.';
  }

  // 3. Carbon Dioxide Hypercapnia State
  let hypercapniaState: BiosciencePhysiologyReport['hypercapniaState'] = 'nominal';
  let hypercapniaSymptoms = 'Safe metabolic clearance. Normal blood pH (7.35 - 7.45).';

  if (co2Ppm < 2500) {
    hypercapniaState = 'nominal';
  } else if (co2Ppm < 4000) {
    hypercapniaState = 'mild_headache';
    hypercapniaSymptoms = 'Subtle frontal headache in sensitive crew, mild nasal congestion, reduced sleep quality.';
  } else if (co2Ppm < 7000) {
    hypercapniaState = 'acidosis_risk';
    hypercapniaSymptoms = 'Respiratory acidosis initiation, dyspnea on mild exertion, pulse rate increase, visual clouding.';
  } else if (co2Ppm < 15000) {
    hypercapniaState = 'severe_hypercapnia';
    hypercapniaSymptoms = 'Heavy labored breathing, marked lethargy, sweating, dizziness, mental confusion.';
  } else {
    hypercapniaState = 'lethal_narcosis';
    hypercapniaSymptoms = 'CO2 narcosis, convulsions, coma, central nervous system depression.';
  }

  // 4. Metabolic Consumption Rates (NASA HIDH Table 6.2-1)
  const activityMultipliers = {
    resting: { o2: 18.0, co2: 15.0, watts: 85 }, // L/person/hr, Watts
    normal: { o2: 28.5, co2: 24.2, watts: 125 },
    high: { o2: 55.0, co2: 48.0, watts: 280 },
  };

  const mult = activityMultipliers[activityLevel] || activityMultipliers.normal;
  const crewO2Consumed = mult.o2 * occupants;
  const crewCO2Produced = mult.co2 * occupants;
  const crewHeatWatts = mult.watts * occupants;

  // 5. Radiation Cellular Damage & Pathway Response (NASA Space Radiation & DeepMind Science)
  // Background in LEO is ~15-25 µSv/h. Heavy ions generate ~35 double-strand breaks per Gy.
  const doseRateGyPerHr = (radiationRateUSvH / 1000000) * 1.5; // RBE weighting
  const dsbPerCellPerHour = Math.max(0.01, doseRateGyPerHr * 35.0);
  const careerRisk = Math.min(25.0, cumulativeDoseMSv * 0.04); // 4% excess REID per Sv

  let pathwayDescription = 'Constitutive basal DNA repair. Base excision repair active.';
  if (radiationRateUSvH > 80) {
    pathwayDescription = 'ATM/ATR serine-threonine kinase cascade triggered by double-strand breaks; p53 checkpoint phosphorylation and BRCA1/Rad51 homologous recombination repair active.';
  } else if (radiationRateUSvH > 35) {
    pathwayDescription = 'Moderate oxidative stress response; Nrf2-mediated antioxidant synthesis and H2AX histone gamma phosphorylation.';
  }

  return {
    oxygenPartialPressureKPa: Number(ppO2.toFixed(2)),
    bloodOxygenSaturationEstimateSpO2: Number(spO2.toFixed(1)),
    hypoxiaState,
    hypoxiaSymptoms,
    co2PartialPressureKPa: Number(ppCO2.toFixed(3)),
    hypercapniaState,
    hypercapniaSymptoms,
    hourlyMetabolicDemand: {
      crewO2ConsumedLPerHour: Number(crewO2Consumed.toFixed(1)),
      crewCO2ProducedLPerHour: Number(crewCO2Produced.toFixed(1)),
      hourlyHeatOutputWatts: Math.round(crewHeatWatts),
    },
    radiationCellularResponse: {
      dnaDoubleStrandBreaksPerCellPerHour: Number(dsbPerCellPerHour.toFixed(4)),
      careerCancerRiskIncreasePercent: Number(careerRisk.toFixed(2)),
      activePathwayDescription: pathwayDescription,
      uniprotReference: 'UniProt P04637 (Cellular tumor antigen p53) & Q13315 (ATM kinase)',
      reactomePathwayId: 'R-HSA-5693532 (DNA Double-Strand Break Repair)',
    },
  };
}

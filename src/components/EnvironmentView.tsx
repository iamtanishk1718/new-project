import React from 'react';
import {
  EnvironmentalTelemetry,
  FlameAnalysisResult,
  FlameTestConfig,
  HabitatProfile,
  HabitatType,
  RiskAssessmentResult,
} from '../types/habitat';
import { ThresholdConfigPanel } from './ThresholdConfigPanel';
import { ThreeHabitatCanvas } from './ThreeHabitatCanvas';
import { AnimatedDropdown } from './AnimatedDropdown';
import { HABITAT_ANIMATION_META } from '../lib/habitatScenesBuilder';
import { getTelemetryMetricAccent, TelemetryAccentTone } from '../lib/telemetryAccent';
import {
  Wind,
  Thermometer,
  Shield,
  Flame,
  Users,
  Radio,
  Building,
  RotateCcw,
  AlertTriangle,
  Sliders,
} from 'lucide-react';

interface Props {
  telemetry: EnvironmentalTelemetry;
  setTelemetry: React.Dispatch<React.SetStateAction<EnvironmentalTelemetry>>;
  habitat: HabitatProfile;
  setHabitat: React.Dispatch<React.SetStateAction<HabitatProfile>>;
  habitatProfiles: Record<HabitatType, HabitatProfile>;
  onSelectHabitat: (type: HabitatType) => void;
  onUpdateHabitatThresholds: (type: HabitatType, updated: HabitatProfile) => void;
  assessment: RiskAssessmentResult;
  subTab: 'telemetry' | 'thresholds';
  setSubTab: React.Dispatch<React.SetStateAction<'telemetry' | 'thresholds'>>;
  onResetNominal: () => void;
  globalAudioEnabled?: boolean;
  onToggleGlobalAudio?: () => void;
  onTriggerGlobalTestAlarm?: () => void;
  flameConfig?: FlameTestConfig;
  flameAnalysis?: FlameAnalysisResult;
  onUpdateFlameConfig?: (patch: Partial<FlameTestConfig>) => void;
  selfHealingActive?: boolean;
  selfHealingStatusLabel?: string;
  onOpenFlameLab?: () => void;
}

export const EnvironmentView: React.FC<Props> = ({
  telemetry,
  setTelemetry,
  habitat,
  setHabitat,
  habitatProfiles,
  onSelectHabitat,
  onUpdateHabitatThresholds,
  assessment,
  subTab,
  setSubTab,
  onResetNominal,
  globalAudioEnabled,
  onToggleGlobalAudio,
  onTriggerGlobalTestAlarm,
  flameConfig,
  flameAnalysis,
  onUpdateFlameConfig,
  selfHealingActive,
  selfHealingStatusLabel,
  onOpenFlameLab,
}) => {
  const updateField = <K extends keyof EnvironmentalTelemetry>(
    key: K,
    value: EnvironmentalTelemetry[K]
  ) => {
    setTelemetry((prev) => ({ ...prev, [key]: value }));
  };

  const handleHabitatChange = (type: HabitatType) => {
    if (habitatProfiles[type]) {
      onSelectHabitat(type);
    }
  };

  const loadStressTestCondition = () => {
    setTelemetry((prev) => ({
      ...prev,
      oxygenPercent: 17.6,
      carbonDioxidePpm: 4200,
      pressureKPa: 88.5,
      internalTemperatureC: 28.5,
      airflowVelocity: 0.04,
      co2ScrubberStatus: 'degraded',
      radiationDoseRateUSvH: 85.0,
      powerSupplyPercent: 62.0,
    }));
  };

  const o2Accent = getTelemetryMetricAccent(telemetry, habitat, 'oxygenPercent');
  const co2Accent = getTelemetryMetricAccent(telemetry, habitat, 'carbonDioxidePpm');
  const pressureAccent = getTelemetryMetricAccent(telemetry, habitat, 'pressureKPa');
  const airflowAccent = getTelemetryMetricAccent(telemetry, habitat, 'airflowVelocity');
  const tempAccent = getTelemetryMetricAccent(telemetry, habitat, 'internalTemperatureC');
  const humidityAccent = getTelemetryMetricAccent(telemetry, habitat, 'relativeHumidity');
  const reserveAccent = getTelemetryMetricAccent(telemetry, habitat, 'oxygenReserveHours');
  const waterRecycAccent = getTelemetryMetricAccent(telemetry, habitat, 'waterRecyclingEfficiency');
  const powerAccent = getTelemetryMetricAccent(telemetry, habitat, 'powerSupplyPercent');
  const batteryAccent = getTelemetryMetricAccent(telemetry, habitat, 'batteryBackupPercent');
  const combustibleAccent = getTelemetryMetricAccent(telemetry, habitat, 'combustibleGasPpm');
  const fireAccent = getTelemetryMetricAccent(telemetry, habitat, 'fireSmoke');
  const radiationAccent = getTelemetryMetricAccent(telemetry, habitat, 'radiationDoseRateUSvH');

  const worstToneIcon = (tones: TelemetryAccentTone[]) => {
    if (tones.includes('red')) return 'text-red-500';
    if (tones.includes('amber')) return 'text-amber-400';
    return 'text-cyan-400';
  };

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions & Sub-Tab Switcher */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white font-mono uppercase tracking-wide">
            Environmental Parameter & Threshold Configuration
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Calibrate sensor inputs, select habitat profiles, and define 5-tier environmental risk thresholds.
          </p>
        </div>

        <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono shrink-0">
            <button
              type="button"
              onClick={() => setSubTab('telemetry')}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
                subTab === 'telemetry'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sensor Telemetry
            </button>
            <button
              type="button"
              onClick={() => setSubTab('thresholds')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
                subTab === 'thresholds'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Risk Thresholds</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadStressTestCondition}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-mono whitespace-nowrap hover:bg-amber-500/30 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Load Stress Test</span>
          </button>
          <button
            type="button"
            onClick={onResetNominal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono whitespace-nowrap hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Nominal</span>
          </button>
        </div>
      </div>

      {subTab === 'thresholds' ? (
        <ThresholdConfigPanel
          habitat={habitat}
          habitatProfiles={habitatProfiles}
          onSelectHabitat={onSelectHabitat}
          onUpdateHabitatThresholds={onUpdateHabitatThresholds}
          telemetry={telemetry}
          assessment={assessment}
        />
      ) : (
        <>
      {/* SECTION G: HABITAT ARCHITECTURE SELECTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 font-mono">
              Habitat Profile & Architectural Envelope
            </h2>
          </div>
          <span className="text-[11px] font-mono text-cyan-400">
            Selected: {habitat.name}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {(Object.keys(habitatProfiles) as HabitatType[]).map((type) => {
            const h = habitatProfiles[type];
            const isSelected = habitat.type === type;
            const animMeta = HABITAT_ANIMATION_META[type];
            return (
              <button
                key={type}
                type="button"
                data-habitat-option={type}
                onClick={() => handleHabitatChange(type)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/60 text-white shadow-lg'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold truncate">{h.name.split('-')[0]}</div>
                <div className="text-[10px] font-mono text-cyan-400 mt-1 uppercase">
                  {type}
                </div>
                <div className="text-[10px] font-mono text-slate-300 truncate mt-0.5">
                  {animMeta.animationSummary}
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                  {h.volumeM3} m³ · Max {h.maxOccupancy}
                </div>
              </button>
            );
          })}
        </div>

        {/* Live 3D Animated Preview for the Selected Habitat */}
        <div className="mt-4 w-full h-[460px]">
          <ThreeHabitatCanvas
            telemetry={telemetry}
            habitat={habitat}
            classification={assessment.classification}
            riskScore={assessment.overallRiskScore}
            hazards={assessment.hazards}
            categoryScores={assessment.categoryScores}
            globalAudioEnabled={globalAudioEnabled}
            onToggleGlobalAudio={onToggleGlobalAudio}
            onTriggerGlobalTestAlarm={onTriggerGlobalTestAlarm}
            flameConfig={flameConfig}
            flameAnalysis={flameAnalysis}
            onUpdateFlameConfig={onUpdateFlameConfig}
            selfHealingActive={selfHealingActive}
            selfHealingStatusLabel={selfHealingStatusLabel}
            onOpenFlameLab={onOpenFlameLab}
          />
        </div>

        {/* Habitat Volume & Custom Specs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-800 text-xs">
          <div>
            <label className="text-slate-400 font-mono block mb-1">
              HABITAT VOLUME (m³):
            </label>
            <input
              type="number"
              value={habitat.volumeM3}
              onChange={(e) =>
                setHabitat((prev) => ({ ...prev, volumeM3: Math.max(10, parseFloat(e.target.value) || 10) }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-slate-400 font-mono block mb-1">
              MAX CREW CAPACITY:
            </label>
            <input
              type="number"
              value={habitat.maxOccupancy}
              onChange={(e) =>
                setHabitat((prev) => ({ ...prev, maxOccupancy: Math.max(1, parseInt(e.target.value) || 1) }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-slate-400 font-mono block mb-1">
              MISSION DURATION (DAYS):
            </label>
            <input
              type="number"
              value={habitat.missionDurationDays}
              onChange={(e) =>
                setHabitat((prev) => ({
                  ...prev,
                  missionDurationDays: Math.max(1, parseInt(e.target.value) || 1),
                }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* SECTIONS A TO F: 6 PARAMETER CATEGORIES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* A. ATMOSPHERIC PARAMETERS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
            <Wind className={`w-4 h-4 transition-colors duration-300 ${worstToneIcon([o2Accent.tone, co2Accent.tone, pressureAccent.tone, airflowAccent.tone])}`} />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              A. Atmospheric Parameters
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            {/* O2 Concentration */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-slate-300">Oxygen Concentration (O₂ %)</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`text-[10px] uppercase ${o2Accent.statusText}`}>{o2Accent.statusLabel}</span>
                  <span className={`font-bold tabular-nums transition-colors duration-300 ${o2Accent.valueText}`}>
                    {telemetry.oxygenPercent.toFixed(1)} %
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="10.0"
                max="38.0"
                step="0.1"
                value={telemetry.oxygenPercent}
                onChange={(e) => updateField('oxygenPercent', parseFloat(e.target.value))}
                className={`w-full cursor-pointer transition-colors ${o2Accent.sliderAccent}`}
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                <span>10% (Acute Anoxia)</span>
                <span>Limits: {habitat.limits.o2MinPercent} - {habitat.limits.o2MaxPercent}%</span>
                <span>38% (Hyperoxic)</span>
              </div>
            </div>

            {/* CO2 Concentration */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-slate-300">Carbon Dioxide (CO₂ ppm)</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`text-[10px] uppercase ${co2Accent.statusText}`}>{co2Accent.statusLabel}</span>
                  <span className={`font-bold tabular-nums transition-colors duration-300 ${co2Accent.valueText}`}>
                    {telemetry.carbonDioxidePpm} ppm
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="400"
                max="16000"
                step="50"
                value={telemetry.carbonDioxidePpm}
                onChange={(e) => updateField('carbonDioxidePpm', parseInt(e.target.value))}
                className={`w-full cursor-pointer transition-colors ${co2Accent.sliderAccent}`}
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                <span>400 (Earth Ambient)</span>
                <span>Max: {habitat.limits.co2MaxPpm} ppm</span>
                <span>16,000 (Lethal Narcosis)</span>
              </div>
            </div>

            {/* Pressure */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-slate-300">Atmospheric Pressure (kPa)</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`text-[10px] uppercase ${pressureAccent.statusText}`}>{pressureAccent.statusLabel}</span>
                  <span className={`font-bold tabular-nums transition-colors duration-300 ${pressureAccent.valueText}`}>
                    {telemetry.pressureKPa.toFixed(1)} kPa
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="45.0"
                max="115.0"
                step="0.5"
                value={telemetry.pressureKPa}
                onChange={(e) => updateField('pressureKPa', parseFloat(e.target.value))}
                className={`w-full cursor-pointer transition-colors ${pressureAccent.sliderAccent}`}
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                <span>45 kPa (Depress Hazard)</span>
                <span>Limits: {habitat.limits.pressureMinKPa}–{habitat.limits.pressureMaxKPa} kPa</span>
                <span>115 kPa</span>
              </div>
            </div>

            {/* Airflow Velocity */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-slate-300">Airflow Velocity (m/s)</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`text-[10px] uppercase ${airflowAccent.statusText}`}>{airflowAccent.statusLabel}</span>
                  <span className={`font-bold tabular-nums transition-colors duration-300 ${airflowAccent.valueText}`}>
                    {telemetry.airflowVelocity.toFixed(2)} m/s
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.80"
                step="0.01"
                value={telemetry.airflowVelocity}
                onChange={(e) => updateField('airflowVelocity', parseFloat(e.target.value))}
                className={`w-full cursor-pointer transition-colors ${airflowAccent.sliderAccent}`}
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                <span>0.00 (Dead Pocket)</span>
                <span>Min: {habitat.limits.airflowMinMs} m/s</span>
                <span>0.80 m/s (Draft)</span>
              </div>
            </div>

            {/* Ventilation Rate */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  VENTILATION EFFICIENCY:
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={telemetry.ventilationRatePercent}
                  onChange={(e) => updateField('ventilationRatePercent', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  AIR EXCHANGE RATE (1/hr):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={telemetry.cabinAirExchangeRate}
                  onChange={(e) => updateField('cabinAirExchangeRate', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 font-mono text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* B. THERMAL PARAMETERS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
            <Thermometer className={`w-4 h-4 transition-colors duration-300 ${worstToneIcon([tempAccent.tone, humidityAccent.tone])}`} />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              B. Thermal Parameters
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            {/* Internal Temp */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-slate-300">Internal Habitat Temperature (°C)</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`text-[10px] uppercase ${tempAccent.statusText}`}>{tempAccent.statusLabel}</span>
                  <span className={`font-bold tabular-nums transition-colors duration-300 ${tempAccent.valueText}`}>
                    {telemetry.internalTemperatureC.toFixed(1)} °C
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="5.0"
                max="45.0"
                step="0.2"
                value={telemetry.internalTemperatureC}
                onChange={(e) => updateField('internalTemperatureC', parseFloat(e.target.value))}
                className={`w-full cursor-pointer transition-colors ${tempAccent.sliderAccent}`}
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                <span>5°C (Hypothermia)</span>
                <span>Comfort: {habitat.limits.tempMinC} - {habitat.limits.tempMaxC}°C</span>
                <span>45°C (Thermal Runaway)</span>
              </div>
            </div>

            {/* External Environmental Temp */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-slate-300">External Planetary / Orbit Temp (°C)</span>
                <span className="font-mono font-bold text-slate-300 tabular-nums">
                  {telemetry.externalTemperatureC.toFixed(1)} °C
                </span>
              </div>
              <input
                type="range"
                min="-150.0"
                max="120.0"
                step="1.0"
                value={telemetry.externalTemperatureC}
                onChange={(e) => updateField('externalTemperatureC', parseFloat(e.target.value))}
                className="w-full accent-slate-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                <span>-150°C (Lunar Shadow)</span>
                <span>External Deep Space Radiative Sink</span>
                <span>+120°C (Solar High)</span>
              </div>
            </div>

            {/* Relative Humidity */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-slate-300">Relative Humidity (%)</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`text-[10px] uppercase ${humidityAccent.statusText}`}>{humidityAccent.statusLabel}</span>
                  <span className={`font-bold tabular-nums transition-colors duration-300 ${humidityAccent.valueText}`}>
                    {telemetry.relativeHumidity.toFixed(0)} %
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="95"
                step="1"
                value={telemetry.relativeHumidity}
                onChange={(e) => updateField('relativeHumidity', parseInt(e.target.value))}
                className={`w-full cursor-pointer transition-colors ${humidityAccent.sliderAccent}`}
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                <span>10% (Static Spark Risk)</span>
                <span>Nominal: {habitat.limits.humidityMinPercent} - {habitat.limits.humidityMaxPercent}%</span>
                <span>95% (Condensation / Mold)</span>
              </div>
            </div>

            {/* System Status Selectors */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <AnimatedDropdown
                label="COOLING LOOP STATUS:"
                testId="dropdown-cooling-status"
                value={telemetry.coolingSystemStatus}
                onChange={(val) => updateField('coolingSystemStatus', val)}
                options={[
                  { value: 'nominal', label: 'Nominal', tone: 'emerald' },
                  { value: 'degraded', label: 'Degraded', tone: 'amber' },
                  { value: 'failed', label: 'Failed / Pump Jam', tone: 'rose' },
                ]}
              />

              <AnimatedDropdown
                label="HEATING SYSTEM STATUS:"
                testId="dropdown-heating-status"
                value={telemetry.heatingSystemStatus}
                onChange={(val) => updateField('heatingSystemStatus', val)}
                options={[
                  { value: 'nominal', label: 'Nominal', tone: 'emerald' },
                  { value: 'degraded', label: 'Degraded', tone: 'amber' },
                  { value: 'failed', label: 'Failed', tone: 'rose' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* C. LIFE-SUPPORT PARAMETERS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
            <Shield className={`w-4 h-4 transition-colors duration-300 ${worstToneIcon([reserveAccent.tone, waterRecycAccent.tone, powerAccent.tone, batteryAccent.tone])}`} />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              C. Life-Support Infrastructure
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  O₂ RESERVE AUTONOMY (HRS):
                </label>
                <input
                  type="number"
                  value={telemetry.oxygenReserveHours}
                  onChange={(e) => updateField('oxygenReserveHours', parseInt(e.target.value) || 0)}
                  className={`w-full bg-slate-950 border rounded px-3 py-1.5 font-mono transition-colors focus:outline-none ${reserveAccent.inputSurface}`}
                />
              </div>

              <AnimatedDropdown
                label="CO₂ SCRUBBER STATUS:"
                testId="dropdown-scrubber-status"
                value={telemetry.co2ScrubberStatus}
                onChange={(val) => updateField('co2ScrubberStatus', val)}
                options={[
                  { value: 'nominal', label: 'Nominal (CDRA Cycling)', tone: 'emerald' },
                  { value: 'degraded', label: 'Degraded (High delta P)', tone: 'amber' },
                  { value: 'failed', label: 'Failed (Offline)', tone: 'rose' },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <AnimatedDropdown
                label="O₂ GEN SYSTEM (OGS):"
                testId="dropdown-ogs-status"
                value={telemetry.oxygenGenStatus}
                onChange={(val) => updateField('oxygenGenStatus', val)}
                options={[
                  { value: 'active', label: 'Active (Electrolysis)', tone: 'emerald' },
                  { value: 'standby', label: 'Standby', tone: 'amber' },
                  { value: 'fault', label: 'Fault / Electrolyzer Trip', tone: 'rose' },
                ]}
              />

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  WATER RECYCLING EFFICIENCY (%):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={telemetry.waterRecyclingEfficiency}
                  onChange={(e) => updateField('waterRecyclingEfficiency', parseFloat(e.target.value) || 0)}
                  className={`w-full bg-slate-950 border rounded px-3 py-1.5 font-mono transition-colors focus:outline-none ${waterRecycAccent.inputSurface}`}
                />
              </div>
            </div>

            {/* Power & Batteries */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  POWER BUS AVAILABILITY (%):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={telemetry.powerSupplyPercent}
                  onChange={(e) => updateField('powerSupplyPercent', parseInt(e.target.value) || 0)}
                  className={`w-full bg-slate-950 border rounded px-3 py-1.5 font-mono transition-colors focus:outline-none ${powerAccent.inputSurface}`}
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  BATTERY BACKUP (%):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={telemetry.batteryBackupPercent}
                  onChange={(e) => updateField('batteryBackupPercent', parseInt(e.target.value) || 0)}
                  className={`w-full bg-slate-950 border rounded px-3 py-1.5 font-mono transition-colors focus:outline-none ${batteryAccent.inputSurface}`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="emergPower"
                checked={telemetry.emergencyPowerActive}
                onChange={(e) => updateField('emergencyPowerActive', e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
              <label htmlFor="emergPower" className="font-mono text-slate-300 cursor-pointer select-none">
                Emergency Power Shedding Bus Active
              </label>
            </div>
          </div>
        </div>

        {/* D. FIRE & COMBUSTION PARAMETERS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
            <Flame className={`w-4 h-4 transition-colors duration-300 ${fireAccent.iconText}`} />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              D. Fire & Combustion Safety
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div className={`flex items-center gap-2 p-3 bg-slate-950 rounded-lg border transition-colors ${telemetry.smokeDetected ? 'border-amber-500/70' : 'border-slate-800'}`}>
                <input
                  type="checkbox"
                  id="smokeCheck"
                  checked={telemetry.smokeDetected}
                  onChange={(e) => updateField('smokeDetected', e.target.checked)}
                  className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                />
                <label htmlFor="smokeCheck" className={`font-mono font-semibold cursor-pointer ${telemetry.smokeDetected ? 'text-amber-300' : 'text-slate-200'}`}>
                  Smoke Detected
                </label>
              </div>

              <div className={`flex items-center gap-2 p-3 bg-slate-950 rounded-lg border transition-colors ${telemetry.fireDetected ? 'border-red-600/80 bg-red-950/30' : 'border-slate-800'}`}>
                <input
                  type="checkbox"
                  id="fireCheck"
                  checked={telemetry.fireDetected}
                  onChange={(e) => updateField('fireDetected', e.target.checked)}
                  className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                />
                <label htmlFor="fireCheck" className={`font-mono font-semibold cursor-pointer ${telemetry.fireDetected ? 'text-red-400' : 'text-slate-200'}`}>
                  Active Fire Alarm
                </label>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-slate-300">Combustible Gas Concentration (ppm)</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`text-[10px] uppercase ${combustibleAccent.statusText}`}>{combustibleAccent.statusLabel}</span>
                  <span className={`font-bold tabular-nums transition-colors duration-300 ${combustibleAccent.valueText}`}>
                    {telemetry.combustibleGasPpm.toFixed(1)} ppm
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="0.0"
                max="50.0"
                step="0.5"
                value={telemetry.combustibleGasPpm}
                onChange={(e) => updateField('combustibleGasPpm', parseFloat(e.target.value))}
                className={`w-full cursor-pointer transition-colors ${combustibleAccent.sliderAccent}`}
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                <span>0.0 ppm (Nominal)</span>
                <span>Warning Limit: 3.5 ppm</span>
                <span>50.0 ppm (Explosive Hazard)</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                EQUIPMENT HEAT GENERATION RATE (kW):
              </label>
              <input
                type="number"
                step="0.1"
                value={telemetry.heatGenerationRateKW}
                onChange={(e) => updateField('heatGenerationRateKW', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-white"
              />
            </div>
          </div>
        </div>

        {/* E. HUMAN OCCUPANCY PARAMETERS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
            <Users className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              E. Human Crew Occupancy & Metabolism
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  CURRENT OCCUPANTS:
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={telemetry.activeOccupants}
                  onChange={(e) => {
                    const count = Math.max(1, parseInt(e.target.value) || 1);
                    updateField('activeOccupants', count);
                    setHabitat((prev) => ({ ...prev, activeOccupants: count }));
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-white"
                />
              </div>

              <AnimatedDropdown
                label="CREW ACTIVITY LEVEL:"
                testId="dropdown-crew-activity"
                value={telemetry.crewActivityLevel}
                onChange={(val) => updateField('crewActivityLevel', val)}
                options={[
                  { value: 'resting', label: 'Resting / Sleep Cycle', tone: 'cyan' },
                  { value: 'normal', label: 'Nominal Routine Operations', tone: 'emerald' },
                  { value: 'high', label: 'High Exertion / EVA Prep / Exercise', tone: 'amber' },
                ]}
              />
            </div>

            <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-slate-400 text-[11px] font-mono leading-relaxed">
              NASA HIDH metabolic rate: Exertion directly drives O2 consumption rate (V_O2) and exhaled CO2 production (V_CO2).
            </div>
          </div>
        </div>

        {/* F. RADIATION PARAMETERS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
            <Radio className={`w-4 h-4 transition-colors duration-300 ${radiationAccent.iconText}`} />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              F. Ionizing Radiation Environment
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-slate-300">Radiation Dose Rate (µSv/h)</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`text-[10px] uppercase ${radiationAccent.statusText}`}>{radiationAccent.statusLabel}</span>
                  <span className={`font-bold tabular-nums transition-colors duration-300 ${radiationAccent.valueText}`}>
                    {telemetry.radiationDoseRateUSvH.toFixed(1)} µSv/h
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="5.0"
                max="400.0"
                step="1.0"
                value={telemetry.radiationDoseRateUSvH}
                onChange={(e) => updateField('radiationDoseRateUSvH', parseFloat(e.target.value))}
                className={`w-full cursor-pointer transition-colors ${radiationAccent.sliderAccent}`}
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                <span>15 (LEO Normal)</span>
                <span>Max: {habitat.limits.radiationMaxUSvH} µSv/h</span>
                <span>400 (Solar Storm Flare)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  ACCUMULATED MISSION DOSE (mSv):
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={telemetry.accumulatedDoseMSv}
                  onChange={(e) => updateField('accumulatedDoseMSv', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  SHIELDING EFFECTIVENESS (%):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={telemetry.shieldingEffectivenessPercent}
                  onChange={(e) =>
                    updateField('shieldingEffectivenessPercent', parseInt(e.target.value) || 0)
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

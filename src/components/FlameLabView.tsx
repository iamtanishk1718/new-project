import React, { useMemo, useState } from 'react';
import {
  EnvironmentalTelemetry,
  FlameAnalysisResult,
  FlameConfinementMode,
  FlameDiluentGas,
  FlameFuelType,
  FlameImagingMode,
  FlameTestConfig,
  HabitatProfile,
  HabitatType,
  RiskAssessmentResult,
} from '../types/habitat';
import {
  FLAME_DILUENT_SPECS,
  FLAME_FUEL_SPECS,
  FLAME_TEST_PRESETS,
  FlameSensitivityAxis,
  generateFlameSensitivityCurve,
} from '../lib/flamePhysics';
import { ThreeHabitatCanvas } from './ThreeHabitatCanvas';
import { HabitatSelectorBar } from './HabitatSelectorBar';
import { AnimatedDropdown } from './AnimatedDropdown';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Flame,
  Gauge,
  Wind,
  Thermometer,
  Droplets,
  ShieldAlert,
  Sparkles,
  Power,
  RefreshCw,
  Sliders,
  Eye,
  TrendingUp,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  telemetry: EnvironmentalTelemetry;
  habitat: HabitatProfile;
  habitatProfiles: Record<HabitatType, HabitatProfile>;
  onSelectHabitat: (type: HabitatType) => void;
  assessment: RiskAssessmentResult;
  flameConfig: FlameTestConfig;
  flameAnalysis: FlameAnalysisResult;
  onUpdateFlameConfig: (patch: Partial<FlameTestConfig>) => void;
  globalAudioEnabled?: boolean;
  onToggleGlobalAudio?: () => void;
  onTriggerGlobalTestAlarm?: () => void;
  selfHealingActive?: boolean;
  selfHealingStatusLabel?: string;
}

const GRAVITY_PRESETS = [
  { label: '0.00g μg', value: 0.0 },
  { label: '0.16g Lunar', value: 0.16 },
  { label: '0.38g Mars', value: 0.38 },
  { label: '1.00g Earth', value: 1.0 },
  { label: '1.80g Hyper', value: 1.8 },
];

const IMAGING_OPTIONS: { id: FlameImagingMode; label: string; desc: string }[] = [
  { id: 'optical', label: 'Optical Visible', desc: 'True soot & CH* glow' },
  { id: 'chemilum', label: 'UV-CH* / OH*', desc: 'Reaction zone radical map' },
  { id: 'infrared', label: 'Thermal IR', desc: 'Blackbody heat field' },
];

const CONFINEMENT_OPTIONS: { id: FlameConfinementMode; label: string }[] = [
  { id: 'open_rack', label: 'Open Rack Rig' },
  { id: 'narrow_duct', label: 'Narrow Avionics Duct' },
  { id: 'quartz_vessel', label: 'Quartz Combustion Vessel' },
];

const SENSITIVITY_AXES: { id: FlameSensitivityAxis; label: string; unit: string }[] = [
  { id: 'gravity', label: 'Gravity (g)', unit: 'g' },
  { id: 'oxygen', label: 'Oxygen (%)', unit: '%' },
  { id: 'pressure', label: 'Pressure (kPa)', unit: 'kPa' },
  { id: 'airflow', label: 'Airflow (m/s)', unit: 'm/s' },
];

export const FlameLabView: React.FC<Props> = ({
  telemetry,
  habitat,
  habitatProfiles,
  onSelectHabitat,
  assessment,
  flameConfig,
  flameAnalysis,
  onUpdateFlameConfig,
  globalAudioEnabled,
  onToggleGlobalAudio,
  onTriggerGlobalTestAlarm,
  selfHealingActive = false,
  selfHealingStatusLabel,
}) => {
  const [sensitivityAxis, setSensitivityAxis] = useState<FlameSensitivityAxis>('gravity');

  const sensitivityData = useMemo(
    () => generateFlameSensitivityCurve(flameConfig, sensitivityAxis),
    [flameConfig, sensitivityAxis]
  );

  const handleToggleSync = () => {
    const nextSync = !flameConfig.syncWithHabitat;
    if (nextSync) {
      onUpdateFlameConfig({
        syncWithHabitat: true,
        oxygenPercent: Number(telemetry.oxygenPercent.toFixed(1)),
        pressureKPa: Number(telemetry.pressureKPa.toFixed(1)),
        airflowMs: Number(telemetry.airflowVelocity.toFixed(2)),
        humidityPercent: Math.round(telemetry.relativeHumidity),
        ambientTempC: Number(telemetry.internalTemperatureC.toFixed(1)),
      });
    } else {
      onUpdateFlameConfig({ syncWithHabitat: false });
    }
  };

  return (
    <div className="space-y-6" data-testid="flame-lab-view">
      {/* Header Strip */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <h1 className="text-base font-bold text-white font-mono uppercase tracking-wide">
              3D Combustion & Flame Analysis Laboratory (CIR Test Rig)
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Inspect live 3D flame morphology mounted inside the active habitat module across gravity regimes (0g–2g), oxygen fraction, chamber pressure, forced IMV airflow, diluent inerting gases, fuel specimens, confinement geometry, and humidity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleSync}
            data-testid="flame-sync-habitat-btn"
            className={`px-3 py-2 rounded-lg text-xs font-mono border inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              flameConfig.syncWithHabitat
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200 font-semibold'
                : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              {flameConfig.syncWithHabitat ? 'Synced with Habitat Atmosphere' : 'Sync with Habitat Atmosphere'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateFlameConfig({ ignited: !flameConfig.ignited })}
            data-testid="flame-igniter-btn"
            className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap border ${
              flameConfig.ignited
                ? 'bg-rose-600 hover:bg-rose-500 border-rose-400 text-white'
                : 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{flameConfig.ignited ? 'Quench Ignition' : 'Ignite Specimen'}</span>
          </button>
        </div>
      </div>

      {/* Habitat Switcher + Live 3D Twin Locked on Mounted CIR Flame Rig */}
      <div className="space-y-3">
        <HabitatSelectorBar
          activeType={habitat.type}
          habitatProfiles={habitatProfiles}
          onSelectHabitat={onSelectHabitat}
        />

        <div className="w-full h-[490px]">
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
            initialViewMode="flame_lab"
            flameConfig={flameConfig}
            flameAnalysis={flameAnalysis}
            onUpdateFlameConfig={onUpdateFlameConfig}
            selfHealingActive={selfHealingActive}
            selfHealingStatusLabel={selfHealingStatusLabel}
          />
        </div>
      </div>

      {/* Benchmark Presets Strip */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>NASA CIR / BASS / FLEX Reference Combustion Presets</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Active Regime: <strong className="text-amber-300">{flameAnalysis.regimeLabel}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {FLAME_TEST_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              data-testid={`flame-preset-${preset.id}`}
              onClick={() => onUpdateFlameConfig({ ...preset.patch, syncWithHabitat: false })}
              className="p-3 rounded-lg border border-slate-800 bg-slate-950/80 hover:border-cyan-500/60 hover:bg-slate-950 text-left transition-colors"
            >
              <div className="text-xs font-semibold text-white">{preset.label}</div>
              <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{preset.subtitle}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Parameter Workbench (Left) + Quantitative Combustion Telemetry (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Workbench Controls */}
        <div className="xl:col-span-6 bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                Chamber Environmental & Specimen Parameters
              </h2>
            </div>
            {flameConfig.syncWithHabitat && (
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded">
                HABITAT LOCKED
              </span>
            )}
          </div>

          {/* Gravity Vector Control */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-mono text-slate-300">Gravitational Acceleration (g)</span>
              <span className="font-mono font-bold text-amber-300 tabular-nums" data-testid="flame-gravity-value">
                {flameConfig.gravityG.toFixed(2)} g
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.02"
              value={flameConfig.gravityG}
              data-testid="flame-gravity-slider"
              onChange={(e) => onUpdateFlameConfig({ gravityG: parseFloat(e.target.value) })}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {GRAVITY_PRESETS.map((gp) => {
                const active = Math.abs(flameConfig.gravityG - gp.value) < 0.02;
                return (
                  <button
                    key={gp.label}
                    type="button"
                    onClick={() => onUpdateFlameConfig({ gravityG: gp.value })}
                    className={`py-1 px-1.5 rounded text-[10px] font-mono border transition-colors ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {gp.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Oxygen Concentration */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-mono text-slate-300 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-cyan-400" />
                Oxygen Mole Fraction (O₂ %)
              </span>
              <span className="font-mono font-bold text-cyan-300 tabular-nums">
                {flameConfig.oxygenPercent.toFixed(1)} %
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="40"
              step="0.5"
              value={flameConfig.oxygenPercent}
              data-testid="flame-oxygen-slider"
              onChange={(e) => onUpdateFlameConfig({ oxygenPercent: parseFloat(e.target.value), syncWithHabitat: false })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
              <span>10% (Hypoxic Quench)</span>
              <span>21% Sea Level</span>
              <span>40% (Severe Hyperoxic)</span>
            </div>
          </div>

          {/* Chamber Pressure */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-mono text-slate-300 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                Chamber Ambient Pressure (kPa)
              </span>
              <span className="font-mono font-bold text-blue-300 tabular-nums">
                {flameConfig.pressureKPa.toFixed(1)} kPa
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="120"
              step="1"
              value={flameConfig.pressureKPa}
              data-testid="flame-pressure-slider"
              onChange={(e) => onUpdateFlameConfig({ pressureKPa: parseFloat(e.target.value), syncWithHabitat: false })}
              className="w-full accent-blue-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
              <span>30 kPa (Suit / Blowdown)</span>
              <span>55 kPa Artemis</span>
              <span>101.3 kPa · 120 kPa</span>
            </div>
          </div>

          {/* Forced Airflow */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-mono text-slate-300 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-teal-400" />
                Forced IMV Airflow Velocity (m/s)
              </span>
              <span className="font-mono font-bold text-teal-300 tabular-nums">
                {flameConfig.airflowMs.toFixed(2)} m/s
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.80"
              step="0.02"
              value={flameConfig.airflowMs}
              data-testid="flame-airflow-slider"
              onChange={(e) => onUpdateFlameConfig({ airflowMs: parseFloat(e.target.value), syncWithHabitat: false })}
              className="w-full accent-teal-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
              <span>0.00 m/s (Pure Diffusion)</span>
              <span>0.15 m/s IMV</span>
              <span>0.80 m/s (Shear / Blow-Off)</span>
            </div>
          </div>

          {/* Fuel Specimen & Diluent Gas Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <AnimatedDropdown
              label="FUEL SPECIMEN"
              testId="flame-fuel-dropdown"
              value={flameConfig.fuelType}
              onChange={(val) => onUpdateFlameConfig({ fuelType: val as FlameFuelType })}
              options={(Object.keys(FLAME_FUEL_SPECS) as FlameFuelType[]).map((k) => ({
                value: k,
                label: FLAME_FUEL_SPECS[k].label,
                tone: k === 'li_ion' ? 'rose' : k === 'heptane' ? 'amber' : 'cyan',
              }))}
            />

            <AnimatedDropdown
              label="DILUENT / BUFFER GAS MIX"
              testId="flame-diluent-dropdown"
              value={flameConfig.diluentGas}
              onChange={(val) => onUpdateFlameConfig({ diluentGas: val as FlameDiluentGas })}
              options={(Object.keys(FLAME_DILUENT_SPECS) as FlameDiluentGas[]).map((k) => ({
                value: k,
                label: FLAME_DILUENT_SPECS[k].label,
                tone: k === 'co2_suppress' ? 'emerald' : k === 'argon' ? 'amber' : 'cyan',
              }))}
            />
          </div>

          {/* Humidity & Ambient Temperature */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-mono text-slate-300 flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-sky-400" />
                  Relative Humidity
                </span>
                <span className="font-mono font-bold text-sky-300 tabular-nums">
                  {flameConfig.humidityPercent}%
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="95"
                step="1"
                value={flameConfig.humidityPercent}
                onChange={(e) =>
                  onUpdateFlameConfig({ humidityPercent: parseInt(e.target.value, 10), syncWithHabitat: false })
                }
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-mono text-slate-300 flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                  Ambient Temp
                </span>
                <span className="font-mono font-bold text-orange-300 tabular-nums">
                  {flameConfig.ambientTempC.toFixed(1)} °C
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="45"
                step="0.5"
                value={flameConfig.ambientTempC}
                onChange={(e) =>
                  onUpdateFlameConfig({ ambientTempC: parseFloat(e.target.value), syncWithHabitat: false })
                }
                className="w-full accent-orange-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Chamber Confinement & Optical Diagnostic Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <div className="text-[11px] font-mono text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Test Confinement Geometry</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {CONFINEMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateFlameConfig({ confinement: opt.id })}
                    className={`px-3 py-1.5 rounded-lg border text-left text-xs font-mono transition-colors ${
                      flameConfig.confinement === opt.id
                        ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-200 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-mono text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>3D Spectral Imaging Filter</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {IMAGING_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateFlameConfig({ imagingMode: opt.id })}
                    className={`px-3 py-1.5 rounded-lg border text-left text-xs font-mono transition-colors flex items-center justify-between ${
                      flameConfig.imagingMode === opt.id
                        ? 'bg-amber-500/15 border-amber-400/60 text-amber-200 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[10px] opacity-75">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Quantitative Analysis & Advisory */}
        <div className="xl:col-span-6 space-y-4">
          {/* Combustion State Banner */}
          <div
            data-testid="flame-status-banner"
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              !flameAnalysis.isSustained
                ? 'bg-slate-900/90 border-slate-700 text-slate-200'
                : flameAnalysis.coolFlameActive
                ? 'bg-sky-950/60 border-sky-500/50 text-sky-100'
                : flameAnalysis.flammabilityMarginPercent > 35
                ? 'bg-rose-950/70 border-rose-500/60 text-rose-100'
                : 'bg-amber-950/60 border-amber-500/50 text-amber-100'
            }`}
          >
            {flameAnalysis.isSustained ? (
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-300" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
            )}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider font-bold">
                  {flameAnalysis.isSustained ? 'ACTIVE COMBUSTION DETECTED' : 'NON-SUSTAINING / EXTINGUISHED'}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950/70 border border-white/15">
                  Margin vs LOC: {flameAnalysis.flammabilityMarginPercent > 0 ? '+' : ''}
                  {flameAnalysis.flammabilityMarginPercent}%
                </span>
              </div>
              <div className="text-sm font-semibold text-white">{flameAnalysis.regimeLabel}</div>
              {flameAnalysis.extinctionReason && (
                <div className="text-xs font-mono text-emerald-300" data-testid="flame-extinction-reason">
                  Extinction Mechanism: {flameAnalysis.extinctionReason}
                </div>
              )}
              <p className="text-xs opacity-90 leading-relaxed">{flameAnalysis.riskAdvisory}</p>
            </div>
          </div>

          {/* 9 Quantitative Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase text-slate-400">Peak Flame Temp</div>
              <div className="text-xl font-bold font-mono tabular-nums text-amber-300 mt-1">
                {flameAnalysis.peakTempC.toFixed(0)} °C
              </div>
              <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                {flameAnalysis.peakTempK.toFixed(0)} K
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase text-slate-400">Flame Geometry</div>
              <div className="text-xl font-bold font-mono tabular-nums text-cyan-300 mt-1">
                {flameAnalysis.flameHeightMm.toFixed(0)} × {flameAnalysis.flameWidthMm.toFixed(0)} mm
              </div>
              <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                Aspect Ratio {flameAnalysis.aspectRatio.toFixed(2)} : 1
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase text-slate-400">Plume Tilt Angle</div>
              <div className="text-xl font-bold font-mono tabular-nums text-teal-300 mt-1">
                {flameAnalysis.tiltAngleDeg.toFixed(1)}°
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Buoyancy vs IMV Vector
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase text-slate-400">Flame Spread Rate</div>
              <div className="text-xl font-bold font-mono tabular-nums text-rose-300 mt-1">
                {flameAnalysis.spreadRateMmS.toFixed(2)} mm/s
              </div>
              <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                Mass Loss: {flameAnalysis.massLossRateMgS.toFixed(1)} mg/s
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase text-slate-400">Heat Release Rate</div>
              <div className="text-xl font-bold font-mono tabular-nums text-orange-300 mt-1">
                {flameAnalysis.heatReleaseWatts.toFixed(0)} W
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Radiative + Convective Load
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase text-slate-400">Soot & CO Yield</div>
              <div className="text-xl font-bold font-mono tabular-nums text-purple-300 mt-1">
                {flameAnalysis.sootVolumePpm.toFixed(1)} ppm
              </div>
              <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                CO/CO₂ Ratio: {flameAnalysis.coYieldRatio.toFixed(3)}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase text-slate-400">Damköhler Number (Da)</div>
              <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
                {flameAnalysis.damkohlerNumber.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Blow-off threshold &lt; 0.58
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase text-slate-400">Richardson Number (Ri)</div>
              <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
                {flameAnalysis.richardsonNumber.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {flameAnalysis.richardsonNumber < 0.3
                  ? 'Forced Convection Dominated'
                  : flameAnalysis.richardsonNumber > 3
                  ? 'Buoyancy Dominated'
                  : 'Mixed Convection'}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase text-slate-400">Spectral Balance</div>
              <div className="text-xl font-bold font-mono tabular-nums text-sky-300 mt-1">
                {Math.round(flameAnalysis.blueFraction * 100)}% CH*
              </div>
              <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                Soot Luminosity: {Math.round(flameAnalysis.sootLuminosity * 100)}%
              </div>
            </div>
          </div>

          {/* Recommended Suppressant Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Recommended Spacecraft Fire Suppression Action
              </div>
              <div className="text-sm font-semibold text-white mt-0.5">
                {flameAnalysis.recommendedSuppressant}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Condition Parametric Sensitivity Curve */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                Multi-Condition Combustion Sensitivity Sweep
              </h2>
              <p className="text-[11px] text-slate-400">
                Holding remaining chamber parameters constant while sweeping the selected independent variable.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {SENSITIVITY_AXES.map((ax) => (
              <button
                key={ax.id}
                type="button"
                data-testid={`sensitivity-axis-${ax.id}`}
                onClick={() => setSensitivityAxis(ax.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  sensitivityAxis === ax.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {ax.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={sensitivityData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="axisLabel" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="left" stroke="#fbbf24" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#38bdf8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }} />
              <Bar
                yAxisId="right"
                dataKey="flameHeightMm"
                name="Flame Height (mm)"
                fill="#0284c7"
                fillOpacity={0.35}
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="peakTempC"
                name="Peak Temp (°C)"
                stroke="#fbbf24"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="spreadRateMmS"
                name="Spread Rate (mm/s)"
                stroke="#fb7185"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

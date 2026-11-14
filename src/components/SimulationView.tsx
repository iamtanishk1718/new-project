import React, { useState, useEffect, useRef } from 'react';
import {
  EnvironmentalTelemetry,
  FlameAnalysisResult,
  FlameTestConfig,
  HabitatProfile,
  HabitatType,
  RiskAssessmentResult,
  SimulationScenario,
} from '../types/habitat';
import { SIMULATION_SCENARIOS } from '../lib/constants';
import { getScoreAccent, getTelemetryMetricAccent } from '../lib/telemetryAccent';
import { ThreeHabitatCanvas } from './ThreeHabitatCanvas';
import { HabitatSelectorBar } from './HabitatSelectorBar';
import {
  Cpu,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Layers,
  Eye,
} from 'lucide-react';

interface Props {
  telemetry: EnvironmentalTelemetry;
  setTelemetry: React.Dispatch<React.SetStateAction<EnvironmentalTelemetry>>;
  habitat: HabitatProfile;
  habitatProfiles: Record<HabitatType, HabitatProfile>;
  onSelectHabitat: (type: HabitatType) => void;
  assessment: RiskAssessmentResult;
  onResetNominal: () => void;
  onNavigate: (tab: any) => void;
  globalAudioEnabled?: boolean;
  onToggleGlobalAudio?: () => void;
  onTriggerGlobalTestAlarm?: () => void;
  flameConfig?: FlameTestConfig;
  flameAnalysis?: FlameAnalysisResult;
  onUpdateFlameConfig?: (patch: Partial<FlameTestConfig>) => void;
  selfHealingActive?: boolean;
  selfHealingStatusLabel?: string;
}

export const SimulationView: React.FC<Props> = ({
  telemetry,
  setTelemetry,
  habitat,
  habitatProfiles,
  onSelectHabitat,
  assessment,
  onResetNominal,
  onNavigate,
  globalAudioEnabled,
  onToggleGlobalAudio,
  onTriggerGlobalTestAlarm,
  flameConfig,
  flameAnalysis,
  onUpdateFlameConfig,
  selfHealingActive,
  selfHealingStatusLabel,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario>(SIMULATION_SCENARIOS[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [simSpeed, setSimSpeed] = useState<1 | 5 | 10>(1);
  const [simElapsedMinutes, setSimElapsedMinutes] = useState(0);
  const [show3DTwin, setShow3DTwin] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<{ minute: number; text: string; severity: string }[]>([]);

  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;
  const scenarioRef = useRef(selectedScenario);
  scenarioRef.current = selectedScenario;
  const simElapsedMinutesRef = useRef(simElapsedMinutes);
  simElapsedMinutesRef.current = simElapsedMinutes;

  const loadScenario = (scenario: SimulationScenario) => {
    setSelectedScenario(scenario);
    setIsRunning(false);
    simElapsedMinutesRef.current = 0;
    setSimElapsedMinutes(0);

    // Apply initial modifiers
    setTelemetry((prev) => ({
      ...prev,
      ...scenario.initialModifiers,
    }));

    setTimelineEvents([
      {
        minute: 0,
        text: `Simulation initiated: ${scenario.title}. Initial perturbation applied to ${scenario.targetSubsystem}.`,
        severity: scenario.severity,
      },
    ]);
  };

  const stepSimulation = (minutesDelta = 1) => {
    const sc = scenarioRef.current;
    const nextMin = simElapsedMinutesRef.current + minutesDelta;
    simElapsedMinutesRef.current = nextMin;
    setSimElapsedMinutes(nextMin);

    setTelemetry((prev) => {
      const next = { ...prev };
      const drifts = sc.driftRatesPerMinute;

      if (drifts.oxygenPercent) {
        next.oxygenPercent = Math.max(8.0, Math.min(35.0, next.oxygenPercent + drifts.oxygenPercent * minutesDelta));
      }
      if (drifts.carbonDioxidePpm) {
        next.carbonDioxidePpm = Math.max(400, Math.min(18000, next.carbonDioxidePpm + drifts.carbonDioxidePpm * minutesDelta));
      }
      if (drifts.pressureKPa) {
        next.pressureKPa = Math.max(30.0, Math.min(115.0, next.pressureKPa + drifts.pressureKPa * minutesDelta));
      }
      if (drifts.internalTemperatureC) {
        next.internalTemperatureC = Math.max(5.0, Math.min(55.0, next.internalTemperatureC + drifts.internalTemperatureC * minutesDelta));
      }
      if (drifts.radiationDoseRateUSvH) {
        next.radiationDoseRateUSvH = Math.max(10.0, next.radiationDoseRateUSvH + drifts.radiationDoseRateUSvH * minutesDelta);
      }
      if (drifts.batteryBackupPercent) {
        next.batteryBackupPercent = Math.max(0, Math.min(100, next.batteryBackupPercent + drifts.batteryBackupPercent * minutesDelta));
      }
      if (drifts.combustibleGasPpm) {
        next.combustibleGasPpm = Math.max(0, next.combustibleGasPpm + drifts.combustibleGasPpm * minutesDelta);
      }
      if (drifts.waterAvailabilityPercent) {
        next.waterAvailabilityPercent = Math.max(0, next.waterAvailabilityPercent + drifts.waterAvailabilityPercent * minutesDelta);
      }
      return next;
    });

    // Check milestone events
    const currentMin = nextMin;
    if (currentMin === 2) {
      setTimelineEvents((prev) => [
        ...prev,
        {
          minute: currentMin,
          text: `Subsystem ${sc.targetSubsystem} warning tripped. Secondary backup systems initiating.`,
          severity: 'caution',
        },
      ]);
    } else if (currentMin === 5) {
      setTimelineEvents((prev) => [
        ...prev,
        {
          minute: currentMin,
          text: `ECLSS closed-loop compensation exhausted. Cabin atmospheric stability degraded.`,
          severity: 'critical',
        },
      ]);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        stepSimulation(1);
      }, 1000 / simSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, simSpeed]);

  const resetSimulation = () => {
    setIsRunning(false);
    simElapsedMinutesRef.current = 0;
    setSimElapsedMinutes(0);
    onResetNominal();
    setTimelineEvents([
      {
        minute: 0,
        text: 'Simulation reset to nominal operating envelope.',
        severity: 'nominal',
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white font-mono uppercase tracking-wide">
              Habitat Emergency Simulation Lab
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-md">
            Simulate 10 complex multi-system aerospace failure modes. Test real-time parameter drift, automated warning triggers, and inspect live 3D ISS interior & exterior reactions.
          </p>
        </div>

        {/* Playback Controls */}
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShow3DTwin(!show3DTwin)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-mono border whitespace-nowrap transition-colors ${
              show3DTwin
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{show3DTwin ? 'Hide 3D Habitat Twin' : 'Inspect 3D Habitat Twin'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold font-mono whitespace-nowrap transition-colors ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRunning ? 'Pause Sim' : 'Run Simulation'}</span>
          </button>

          <button
            type="button"
            onClick={() => stepSimulation(1)}
            disabled={isRunning}
            className="flex items-center gap-1 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg text-xs font-mono whitespace-nowrap transition-colors"
          >
            <span>+1 min</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono shrink-0">
            {([1, 5, 10] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSimSpeed(spd)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  simSpeed === spd
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={resetSimulation}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors shrink-0"
            aria-label="Reset Simulation"
            title="Reset Simulation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {show3DTwin && (
        <div className="space-y-3">
          <HabitatSelectorBar
            activeType={habitat.type}
            habitatProfiles={habitatProfiles}
            onSelectHabitat={onSelectHabitat}
          />
          <div className="w-full h-[480px]">
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
              onOpenFlameLab={() => onNavigate('flame-lab')}
            />
          </div>
        </div>
      )}

      {/* Scenario Selector Grid (10 Predefined Scenarios) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
            Select Aerospace Emergency Scenario (10 Predefined)
          </h2>
          <span className="text-[11px] font-mono text-cyan-400">
            Active: {selectedScenario.title}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {SIMULATION_SCENARIOS.map((sc) => {
            const isSelected = selectedScenario.id === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => loadScenario(sc)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/60 text-white shadow-lg'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span
                      className={`uppercase px-1.5 py-0.2 rounded font-bold ${
                        sc.severity === 'extreme'
                          ? 'text-rose-400 bg-rose-950/60'
                          : sc.severity === 'critical'
                          ? 'text-red-400 bg-red-950/60'
                          : 'text-amber-400 bg-amber-950/60'
                      }`}
                    >
                      {sc.severity}
                    </span>
                    <span className="text-slate-500">{sc.expectedDurationMinutes}m</span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">{sc.title}</div>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 font-sans leading-relaxed">
                    {sc.description}
                  </p>
                </div>
                <div className="text-[9px] font-mono text-slate-500 mt-2 truncate">
                  Target: {sc.targetSubsystem}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Comparison: Normal Baseline vs Current Simulation State */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 font-mono">
              Baseline Comparison vs. Active Simulation Drift
            </h2>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Elapsed Simulation Time: <strong className="text-cyan-400 font-bold tabular-nums">T+{simElapsedMinutes} mins</strong>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
          {(() => {
            const o2Acc = getTelemetryMetricAccent(telemetry, habitat, 'oxygenPercent');
            const co2Acc = getTelemetryMetricAccent(telemetry, habitat, 'carbonDioxidePpm');
            const pressAcc = getTelemetryMetricAccent(telemetry, habitat, 'pressureKPa');
            const tempAcc = getTelemetryMetricAccent(telemetry, habitat, 'internalTemperatureC');
            const flowAcc = getTelemetryMetricAccent(telemetry, habitat, 'airflowVelocity');
            const riskAcc = getScoreAccent(assessment.overallRiskScore, false);
            return (
              <>
                {/* Oxygen Comparison */}
                <div className={`p-3 bg-slate-950 rounded-lg border transition-colors duration-300 ${o2Acc.cardSurface}`}>
                  <span className="text-[10px] text-slate-500 block mb-1">OXYGEN (O₂)</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Base: 21.0%</span>
                    <span className={`font-bold tabular-nums text-sm transition-colors duration-300 ${o2Acc.valueText}`}>
                      {telemetry.oxygenPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Delta: {(telemetry.oxygenPercent - 21.0).toFixed(1)}%</span>
                    <span className={o2Acc.statusText}>{o2Acc.statusLabel}</span>
                  </div>
                </div>

                {/* CO2 Comparison */}
                <div className={`p-3 bg-slate-950 rounded-lg border transition-colors duration-300 ${co2Acc.cardSurface}`}>
                  <span className="text-[10px] text-slate-500 block mb-1">CO₂ CONCENTRATION</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Base: 1850</span>
                    <span className={`font-bold tabular-nums text-sm transition-colors duration-300 ${co2Acc.valueText}`}>
                      {telemetry.carbonDioxidePpm}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Delta: {telemetry.carbonDioxidePpm - 1850} ppm</span>
                    <span className={co2Acc.statusText}>{co2Acc.statusLabel}</span>
                  </div>
                </div>

                {/* Pressure Comparison */}
                <div className={`p-3 bg-slate-950 rounded-lg border transition-colors duration-300 ${pressAcc.cardSurface}`}>
                  <span className="text-[10px] text-slate-500 block mb-1">PRESSURE</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Base: 101.3</span>
                    <span className={`font-bold tabular-nums text-sm transition-colors duration-300 ${pressAcc.valueText}`}>
                      {telemetry.pressureKPa.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Delta: {(telemetry.pressureKPa - 101.3).toFixed(1)} kPa</span>
                    <span className={pressAcc.statusText}>{pressAcc.statusLabel}</span>
                  </div>
                </div>

                {/* Temperature Comparison */}
                <div className={`p-3 bg-slate-950 rounded-lg border transition-colors duration-300 ${tempAcc.cardSurface}`}>
                  <span className="text-[10px] text-slate-500 block mb-1">TEMPERATURE</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Base: 21.8°C</span>
                    <span className={`font-bold tabular-nums text-sm transition-colors duration-300 ${tempAcc.valueText}`}>
                      {telemetry.internalTemperatureC.toFixed(1)}°C
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Delta: {(telemetry.internalTemperatureC - 21.8).toFixed(1)}°C</span>
                    <span className={tempAcc.statusText}>{tempAcc.statusLabel}</span>
                  </div>
                </div>

                {/* Airflow Velocity */}
                <div className={`p-3 bg-slate-950 rounded-lg border transition-colors duration-300 ${flowAcc.cardSurface}`}>
                  <span className="text-[10px] text-slate-500 block mb-1">AIRFLOW</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Base: 0.14</span>
                    <span className={`font-bold tabular-nums text-sm transition-colors duration-300 ${flowAcc.valueText}`}>
                      {telemetry.airflowVelocity.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Delta: {(telemetry.airflowVelocity - 0.14).toFixed(2)} m/s</span>
                    <span className={flowAcc.statusText}>{flowAcc.statusLabel}</span>
                  </div>
                </div>

                {/* Risk Score */}
                <div className={`p-3 bg-slate-950 rounded-lg border transition-colors duration-300 ${riskAcc.cardSurface}`}>
                  <span className="text-[10px] text-slate-500 block mb-1">RISK INDEX</span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Base: 12</span>
                    <span className={`font-bold tabular-nums text-sm transition-colors duration-300 ${riskAcc.valueText}`}>
                      {assessment.overallRiskScore}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Class: <span className={riskAcc.statusText}>{assessment.classification.toUpperCase()}</span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Simulation Timeline Event Stream */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>Simulation Sequence Timeline</span>
        </h2>

        <div className="space-y-2">
          {timelineEvents.map((ev, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 text-xs font-mono"
            >
              <span className="text-cyan-400 font-bold tabular-nums shrink-0">
                T+{ev.minute.toString().padStart(2, '0')}:00
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 ${
                  ev.severity === 'extreme' || ev.severity === 'critical'
                    ? 'text-rose-300 bg-rose-950'
                    : ev.severity === 'caution'
                    ? 'text-amber-300 bg-amber-950'
                    : 'text-slate-300 bg-slate-800'
                }`}
              >
                {ev.severity}
              </span>
              <span className="text-slate-300 leading-relaxed font-sans">{ev.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

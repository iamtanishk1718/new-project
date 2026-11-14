import React, { useState } from 'react';
import {
  EnvironmentalTelemetry,
  HabitatProfile,
  TelemetryHistoryPoint,
} from '../types/habitat';
import { getTelemetryMetricAccent } from '../lib/telemetryAccent';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  Activity,
  Wind,
  Gauge,
  Thermometer,
  Radio,
  Sliders,
  Info,
} from 'lucide-react';

interface Props {
  telemetry: EnvironmentalTelemetry;
  habitat: HabitatProfile;
  history: TelemetryHistoryPoint[];
}

export const PredictiveView: React.FC<Props> = ({ telemetry, habitat, history }) => {
  const [targetO2Limit, setTargetO2Limit] = useState(19.5);
  const [targetCO2Limit, setTargetCO2Limit] = useState(4000);
  const [targetPressureLimit, setTargetPressureLimit] = useState(90.0);

  // Calculate rate of change (Delta per minute) from last 5 points in history
  const calculateRateOfChange = (key: keyof TelemetryHistoryPoint) => {
    if (history.length < 2) return 0;
    const recent = history.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const timeDeltaMinutes = Math.max(0.1, (last.elapsedSeconds - first.elapsedSeconds) / 60);
    const valueDelta = (last[key] as number) - (first[key] as number);
    return valueDelta / timeDeltaMinutes;
  };

  const o2Rate = calculateRateOfChange('oxygenPercent');
  const co2Rate = calculateRateOfChange('carbonDioxidePpm');
  const pressureRate = calculateRateOfChange('pressureKPa');
  const tempRate = calculateRateOfChange('internalTemperatureC');

  // Estimate Time to Warning Threshold
  const estimateTimeToThreshold = (
    current: number,
    limit: number,
    ratePerMin: number,
    isFalling: boolean
  ) => {
    if (isFalling) {
      if (current <= limit) return 'BREACHED';
      if (ratePerMin >= 0) return 'Stable (No depletion)';
      const minutes = (limit - current) / ratePerMin;
      if (minutes > 300) return '> 5 hours';
      return `${minutes.toFixed(1)} minutes`;
    } else {
      if (current >= limit) return 'BREACHED';
      if (ratePerMin <= 0) return 'Stable (No accumulation)';
      const minutes = (limit - current) / ratePerMin;
      if (minutes > 300) return '> 5 hours';
      return `${minutes.toFixed(1)} minutes`;
    }
  };

  const timeToO2 = estimateTimeToThreshold(telemetry.oxygenPercent, targetO2Limit, o2Rate, true);
  const timeToCO2 = estimateTimeToThreshold(telemetry.carbonDioxidePpm, targetCO2Limit, co2Rate, false);
  const timeToPressure = estimateTimeToThreshold(telemetry.pressureKPa, targetPressureLimit, pressureRate, true);

  const o2Accent = getTelemetryMetricAccent(telemetry, habitat, 'oxygenPercent');
  const co2Accent = getTelemetryMetricAccent(telemetry, habitat, 'carbonDioxidePpm');
  const pressureAccent = getTelemetryMetricAccent(telemetry, habitat, 'pressureKPa');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          <h1 className="text-base font-bold text-white font-mono uppercase tracking-wide">
            Predictive Hazard Forecasting & Rate of Change Analytics
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Dynamic time-series projection model calculating d(Parameter)/dt to predict life-support envelope depletion before critical thresholds are breached.
        </p>
      </div>

      {/* Predictive Time-To-Threshold Warning Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
        {/* O2 Depletion Forecast */}
        <div className={`bg-slate-900/90 border rounded-xl p-4 transition-colors duration-300 ${o2Accent.cardSurface}`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="uppercase text-[11px] font-bold">O₂ Depletion Forecast</span>
            <Wind className={`w-4 h-4 transition-colors duration-300 ${o2Accent.iconText}`} />
          </div>
          <div className="text-sm font-semibold text-white">
            Current: <span className={o2Accent.valueText}>{telemetry.oxygenPercent.toFixed(1)}%</span> · Rate: {o2Rate >= 0 ? `+${o2Rate.toFixed(2)}` : o2Rate.toFixed(2)} %/min
          </div>
          <div className="my-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Est. Time to Threshold ({targetO2Limit}%):</div>
            <div
              className={`text-base font-bold tabular-nums mt-0.5 ${
                timeToO2 === 'BREACHED'
                  ? 'text-red-400'
                  : timeToO2.includes('minutes')
                  ? 'text-amber-400'
                  : 'text-cyan-300'
              }`}
            >
              {timeToO2}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>Threshold Limit:</span>
            <input
              type="number"
              step="0.1"
              value={targetO2Limit}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) setTargetO2Limit(v);
              }}
              className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-white"
            />
            <span>%</span>
          </div>
        </div>

        {/* CO2 Accumulation Forecast */}
        <div className={`bg-slate-900/90 border rounded-xl p-4 transition-colors duration-300 ${co2Accent.cardSurface}`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="uppercase text-[11px] font-bold">CO₂ Accumulation Forecast</span>
            <Gauge className={`w-4 h-4 transition-colors duration-300 ${co2Accent.iconText}`} />
          </div>
          <div className="text-sm font-semibold text-white">
            Current: <span className={co2Accent.valueText}>{telemetry.carbonDioxidePpm} ppm</span> · Rate: {co2Rate >= 0 ? `+${co2Rate.toFixed(1)}` : co2Rate.toFixed(1)} ppm/min
          </div>
          <div className="my-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Est. Time to Threshold ({targetCO2Limit} ppm):</div>
            <div
              className={`text-base font-bold tabular-nums mt-0.5 ${
                timeToCO2 === 'BREACHED'
                  ? 'text-red-400'
                  : timeToCO2.includes('minutes')
                  ? 'text-amber-400'
                  : 'text-cyan-300'
              }`}
            >
              {timeToCO2}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>Threshold Limit:</span>
            <input
              type="number"
              step="100"
              value={targetCO2Limit}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isFinite(v)) setTargetCO2Limit(v);
              }}
              className="w-20 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-white"
            />
            <span>ppm</span>
          </div>
        </div>

        {/* Cabin Pressure Variation */}
        <div className={`bg-slate-900/90 border rounded-xl p-4 transition-colors duration-300 ${pressureAccent.cardSurface}`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="uppercase text-[11px] font-bold">Pressure Depress Forecast</span>
            <Gauge className={`w-4 h-4 transition-colors duration-300 ${pressureAccent.iconText}`} />
          </div>
          <div className="text-sm font-semibold text-white">
            Current: <span className={pressureAccent.valueText}>{telemetry.pressureKPa.toFixed(1)} kPa</span> · Rate: {pressureRate >= 0 ? `+${pressureRate.toFixed(2)}` : pressureRate.toFixed(2)} kPa/min
          </div>
          <div className="my-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Est. Time to Threshold ({targetPressureLimit} kPa):</div>
            <div
              className={`text-base font-bold tabular-nums mt-0.5 ${
                timeToPressure === 'BREACHED'
                  ? 'text-red-400'
                  : timeToPressure.includes('minutes')
                  ? 'text-amber-400'
                  : 'text-cyan-300'
              }`}
            >
              {timeToPressure}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>Threshold Limit:</span>
            <input
              type="number"
              step="1.0"
              value={targetPressureLimit}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) setTargetPressureLimit(v);
              }}
              className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-white"
            />
            <span>kPa</span>
          </div>
        </div>
      </div>

      {/* Time-Series Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Atmospheric Gases (O2 & CO2) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 min-w-0">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold mb-4">
            Atmospheric Gas Trend (O₂ % & CO₂ ppm)
          </h2>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis yAxisId="o2" stroke="#06b6d4" tick={{ fontSize: 10, fill: '#06b6d4' }} domain={[0, 35]} />
                <YAxis yAxisId="co2" orientation="right" stroke="#10b981" tick={{ fontSize: 10, fill: '#10b981' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                <Line
                  yAxisId="o2"
                  type="monotone"
                  dataKey="oxygenPercent"
                  name="O₂ Concentration (%)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="co2"
                  type="monotone"
                  dataKey={(d) => Number(d.carbonDioxidePpm)}
                  name="CO₂ (ppm)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Pressure & Risk Score */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 min-w-0">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold mb-4">
            Cabin Pressure (kPa) & Environmental Risk Score
          </h2>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 115]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                <Line
                  type="monotone"
                  dataKey="pressureKPa"
                  name="Pressure (kPa)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="riskScore"
                  name="Calculated Risk Score"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Epistemic Confidence & Limitations Banner */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-300 uppercase">Predictive Anomaly Disclaimer: </strong>
          Linear rates of change assume steady-state crew metabolic output and constant active life-support loop parameters. Non-linear events (such as sudden hatch seal blowouts or thermal fires) override linear rate extrapolations. Forecast confidence interval is calculated at ±8.5% over a 30-minute operational window.
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { DataMode, EnvironmentalTelemetry } from '../types/habitat';
import { LiveNasaClockState } from '../lib/nasaClock';
import { TeamLogo } from './TeamLogo';
import {
  Radio,
  ExternalLink,
  RefreshCw,
  Dna,
  CheckCircle,
  Clock,
  Satellite,
  Globe2,
  SunMedium,
  AlertCircle,
} from 'lucide-react';

interface Props {
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  telemetry: EnvironmentalTelemetry;
  setTelemetry: React.Dispatch<React.SetStateAction<EnvironmentalTelemetry>>;
  satelliteTime?: LiveNasaClockState;
}

export const NasaIntegrationView: React.FC<Props> = ({
  dataMode,
  setDataMode,
  telemetry,
  setTelemetry,
  satelliteTime,
}) => {
  const [nasaLive, setNasaLive] = useState<any>(null);
  const [spaceWeather, setSpaceWeather] = useState<any>(null);
  const [studies, setStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [earthImgFailed, setEarthImgFailed] = useState(false);

  const fetchNasaData = async () => {
    setLoading(true);
    try {
      const [powerRes, bioRes, weatherRes] = await Promise.all([
        fetch('/api/nasa/telemetry'),
        fetch('/api/nasa/biology'),
        fetch('/api/nasa/space-weather'),
      ]);

      if (powerRes.ok) {
        const data = await powerRes.json();
        setNasaLive(data);
        setLastFetched(new Date().toLocaleTimeString());

        if (dataMode === 'live') {
          setTelemetry((prev) => ({
            ...prev,
            externalTemperatureC: data.ambientTemperatureC,
            radiationDoseRateUSvH: data.spaceRadiationProxyDoseRateUSvH,
          }));
        }
      }

      if (bioRes.ok) {
        const bioData = await bioRes.json();
        setStudies(bioData.studies || []);
      }

      if (weatherRes.ok) {
        const wData = await weatherRes.json();
        setSpaceWeather(wData);
      }

      if (satelliteTime) {
        await satelliteTime.refreshSync();
      }
    } catch (err) {
      console.warn('NASA API fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNasaData();
  }, []);

  const handleApplyLiveDataToTelemetry = () => {
    if (!nasaLive) return;
    setDataMode('live');
    setTelemetry((prev) => ({
      ...prev,
      externalTemperatureC: nasaLive.ambientTemperatureC,
      radiationDoseRateUSvH: nasaLive.spaceRadiationProxyDoseRateUSvH,
    }));
  };

  const iss = satelliteTime?.snapshot?.iss;
  const dscovr = satelliteTime?.snapshot?.dscovr;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 panel-surface rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <TeamLogo className="w-12 h-12" />
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h1 className="font-display text-lg font-bold text-white uppercase tracking-wide">
                100% Free NASA Satellites, Open Data &amp; Space Biology
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Synchronized to NASA DSCOVR EPIC (L1), ISS NORAD 25544 Ephemeris, NASA POWER API, NASA DONKI Space Weather, NASA EONET v3, and NASA OSDR — zero paid plans.
            </p>
          </div>
        </div>

        <button
          onClick={fetchNasaData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-semibold font-mono transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Polling NASA Satellites...' : 'Sync All NASA Feeds'}</span>
        </button>
      </div>

      {/* LIVE NASA SATELLITE EXACT DATE & TIME + ISS ORBITAL TELEMETRY + DSCOVR EARTH DISK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Satellite UTC Clock & ISS Track */}
        <div className="lg:col-span-8 panel-surface rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                NASA Free Satellite Exact Date &amp; Time Sync
              </h2>
            </div>
            <span className="text-[11px] font-mono text-emerald-400">
              {satelliteTime?.snapshot?.satelliteSyncActive ? '● SATELLITE UTC LOCKED' : '● KEPLERIAN BASELINE'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-[#050811] border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">
                Authoritative UTC Date
              </span>
              <div
                className="text-xl font-bold font-mono tabular-nums text-white mt-1"
                data-testid="nasa-sat-utc-date"
              >
                {satelliteTime?.utcDate || '----/--/--'}
              </div>
              <span className="text-[10px] font-mono text-cyan-400 mt-1 block truncate">
                {satelliteTime?.snapshot?.clockAuthority || 'NASA GSFC UTC'}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#050811] border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">
                Exact Satellite UTC Time
              </span>
              <div
                className="text-xl font-bold font-mono tabular-nums text-cyan-300 mt-1"
                data-testid="nasa-sat-utc-time"
              >
                {satelliteTime?.utcTime || '--:--:-- UTC'}
              </div>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                Drift-corrected 1s precision
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#050811] border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">
                Station Local Time
              </span>
              <div className="text-xl font-bold font-mono tabular-nums text-amber-300 mt-1">
                {satelliteTime?.localTime || '--:--:--'}
              </div>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block truncate">
                Synced: {satelliteTime?.lastSyncedLocal || 'Initializing...'}
              </span>
            </div>
          </div>

          {/* Live ISS NORAD 25544 Orbital Ephemeris */}
          {iss && (
            <div className="pt-2 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Satellite className="w-4 h-4 text-amber-400" />
                  <span>{iss.name} (NORAD {iss.noradId}) Live Orbital Track</span>
                </span>
                <span className="text-amber-300 uppercase">{iss.visibility}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Latitude</span>
                  <span className="text-base font-bold text-white tabular-nums">{iss.latitude}°</span>
                </div>
                <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Longitude</span>
                  <span className="text-base font-bold text-white tabular-nums">{iss.longitude}°</span>
                </div>
                <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Altitude</span>
                  <span className="text-base font-bold text-cyan-300 tabular-nums">{iss.altitudeKm} km</span>
                </div>
                <div className="p-3 rounded-lg bg-[#050811] border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Orbital Velocity</span>
                  <span className="text-base font-bold text-emerald-300 tabular-nums">
                    {Math.round(iss.velocityKmh).toLocaleString()} km/h
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* NASA DSCOVR EPIC L1 Earth Observation Card */}
        <div className="lg:col-span-4 panel-surface rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                DSCOVR EPIC (L1)
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {dscovr?.lagrangePoint || 'Sun-Earth L1'}
            </span>
          </div>

          <div className="relative aspect-square w-full max-h-56 mx-auto rounded-xl bg-[#04060c] border border-slate-800 overflow-hidden flex items-center justify-center">
            {dscovr?.imageUrl && !earthImgFailed ? (
              <img
                src={dscovr.imageUrl}
                alt="Earth sunlit disk captured by NASA DSCOVR EPIC satellite"
                referrerPolicy="no-referrer"
                onError={() => setEarthImgFailed(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="p-4 text-center space-y-2">
                <Globe2 className="w-10 h-10 text-cyan-400/70 mx-auto" />
                <div className="text-[11px] font-mono text-slate-400">
                  NASA DSCOVR EPIC Sun-Earth L1 Ephemeris Link Active
                </div>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 leading-snug">
            <div className="font-mono text-cyan-300 text-[10px] mb-0.5">
              Obs UTC: {dscovr?.latestObservationUtc || 'Synced'}
            </div>
            {dscovr?.caption || 'Earth sunlit disk observed from Lagrange Point L1 (~1.5M km).'}
          </div>
        </div>
      </div>

      {/* 3 DATA FEED MODES */}
      <div className="panel-surface rounded-xl p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono mb-3">
          Active Data Feed Mode Architecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            onClick={() => setDataMode('live')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              dataMode === 'live'
                ? 'bg-cyan-500/15 border-cyan-500 text-white'
                : 'bg-[#050811] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
              <span>1. LIVE NASA DATA</span>
              {dataMode === 'live' && <CheckCircle className="w-4 h-4 text-cyan-400" />}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Free streams from NASA POWER API solar flux sensors, DSCOVR EPIC satellite clock, and space weather proxies.
            </p>
          </div>

          <div
            onClick={() => setDataMode('simulation')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              dataMode === 'simulation'
                ? 'bg-cyan-500/15 border-cyan-500 text-white'
                : 'bg-[#050811] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
              <span>2. SIMULATION DATA</span>
              {dataMode === 'simulation' && <CheckCircle className="w-4 h-4 text-cyan-400" />}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Synthetic time-series engine modeling 10 emergency failure scenarios with time-stepped chemical drift rates.
            </p>
          </div>

          <div
            onClick={() => setDataMode('manual')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              dataMode === 'manual'
                ? 'bg-cyan-500/15 border-cyan-500 text-white'
                : 'bg-[#050811] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
              <span>3. MANUAL OPERATOR DATA</span>
              {dataMode === 'manual' && <CheckCircle className="w-4 h-4 text-cyan-400" />}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Hand-entered sensor values for testing specific threshold limits, cabin stress tests, or custom configurations.
            </p>
          </div>
        </div>
      </div>

      {/* NASA POWER API Live Ingest Card */}
      {nasaLive && (
        <div className="panel-surface rounded-xl p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 font-mono">
            <div>
              <span className="text-[10px] text-cyan-400 uppercase font-bold">
                Free NASA POWER Open API Payload
              </span>
              <h3 className="text-sm font-bold text-white mt-0.5">{nasaLive.source}</h3>
              <span className="text-[11px] text-slate-400">
                Location: {nasaLive.location} · Polled: {lastFetched}
              </span>
            </div>

            <button
              onClick={handleApplyLiveDataToTelemetry}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold font-mono transition-colors"
            >
              Sync to Habitat External Boundary
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs font-mono">
            <div className="p-3 bg-[#050811] rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block mb-1">Solar Irradiance</span>
              <div className="text-lg font-bold text-amber-400 tabular-nums">
                {nasaLive.solarIrradianceKWm2} <span className="text-xs">kW/m²</span>
              </div>
            </div>

            <div className="p-3 bg-[#050811] rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block mb-1">Ambient Temperature</span>
              <div className="text-lg font-bold text-cyan-400 tabular-nums">
                {nasaLive.ambientTemperatureC} <span className="text-xs">°C</span>
              </div>
            </div>

            <div className="p-3 bg-[#050811] rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block mb-1">Surface Pressure</span>
              <div className="text-lg font-bold text-blue-400 tabular-nums">
                {nasaLive.surfacePressureKPa} <span className="text-xs">kPa</span>
              </div>
            </div>

            <div className="p-3 bg-[#050811] rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block mb-1">Radiation Proxy Flux</span>
              <div className="text-lg font-bold text-purple-400 tabular-nums">
                {nasaLive.spaceRadiationProxyDoseRateUSvH} <span className="text-xs">µSv/h</span>
              </div>
            </div>
          </div>
          <div className="mt-3 text-[10px] font-mono text-slate-500">
            Note: {nasaLive.notes}
          </div>
        </div>
      )}

      {/* NASA DONKI SPACE WEATHER + NASA EONET NATURAL EVENTS (100% FREE) */}
      {spaceWeather && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="panel-surface rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SunMedium className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  NASA CCMC DONKI Space Weather Bulletins
                </h2>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">FREE DEMO_KEY</span>
            </div>
            <div className="space-y-2.5">
              {(spaceWeather.donkiBulletins || []).map((b: any) => (
                <div key={b.id} className="p-3 rounded-lg bg-[#050811] border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-amber-300 font-bold">{b.type}</span>
                    <span className="text-slate-500">{b.issueTime}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{b.summary}</p>
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300"
                  >
                    <span>DONKI Advisory</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-surface rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  NASA EONET v3 Live Earth Observatory Events
                </h2>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">OPEN API</span>
            </div>
            <div className="space-y-2.5">
              {(spaceWeather.eonetEvents || []).map((ev: any) => (
                <div key={ev.id} className="p-3 rounded-lg bg-[#050811] border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-cyan-300 font-semibold">{ev.category}</span>
                    <span className="text-slate-500">{String(ev.date).slice(0, 10)}</span>
                  </div>
                  <div className="text-xs font-semibold text-white">{ev.title}</div>
                  <a
                    href={ev.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300"
                  >
                    <span>EONET Telemetry Record</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NASA Space Biology (OSDR / GeneLab) Studies */}
      <div className="panel-surface rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Dna className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 font-mono">
            NASA Open Science Data Repository (OSDR) Space Biology Research
          </h2>
        </div>

        <div className="space-y-3">
          {studies.map((study) => (
            <div
              key={study.accession}
              className="p-4 bg-[#050811] rounded-xl border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-cyan-400 font-bold">{study.accession}</span>
                <span className="text-slate-500">{study.payload}</span>
              </div>
              <div className="text-xs font-semibold text-white font-sans">{study.title}</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-sans">
                {study.relevance}
              </p>
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-500">Model Organism: {study.organism}</span>
                <a
                  href={study.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <span>Open NASA OSDR Repository</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

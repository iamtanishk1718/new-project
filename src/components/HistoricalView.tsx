import React, { useCallback, useEffect, useState } from 'react';
import {
  EnvironmentalTelemetry,
  HabitatProfile,
  RiskAssessmentResult,
  TelemetryHistoryPoint,
} from '../types/habitat';
import {
  auth,
  fetchHistoricalReadings,
  fetchMissionLogsFromFirestore,
  saveMissionLogToFirestore,
  saveReadingToFirestore,
} from '../lib/firebase';
import {
  FileText,
  Download,
  Printer,
  Database,
  Clock,
  RefreshCw,
  BookOpen,
} from 'lucide-react';

const LOCAL_READINGS_KEY = 'firefall_saved_readings_v1';
const LOCAL_LOGS_KEY = 'firefall_mission_logs_v1';

interface SavedReadingRecord {
  id: string;
  docId?: string;
  habitatId: string;
  timestamp: string;
  oxygenPercent: number;
  carbonDioxidePpm: number;
  pressureKPa: number;
  temperatureC?: number;
  internalTemperatureC?: number;
  radiationDoseRateUSvH?: number;
  riskScore?: number;
}

interface SavedMissionLogRecord {
  id: string;
  docId?: string;
  habitatId: string;
  timestamp?: string;
  savedAt?: string;
  author?: string;
  category: string;
  notes: string;
}

interface Props {
  history: TelemetryHistoryPoint[];
  telemetry: EnvironmentalTelemetry;
  habitat: HabitatProfile;
  assessment: RiskAssessmentResult;
}

function readLocalList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalList<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, 40)));
  } catch {
    // Ignore storage quota errors
  }
}

export const HistoricalView: React.FC<Props> = ({
  history,
  telemetry,
  habitat,
  assessment,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'caution' | 'critical'>('all');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [newLogNote, setNewLogNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [savedReadings, setSavedReadings] = useState<SavedReadingRecord[]>(() =>
    readLocalList<SavedReadingRecord>(LOCAL_READINGS_KEY)
  );
  const [savedLogs, setSavedLogs] = useState<SavedMissionLogRecord[]>(() =>
    readLocalList<SavedMissionLogRecord>(LOCAL_LOGS_KEY)
  );

  const loadArchiveRecords = useCallback(async () => {
    setIsLoadingArchive(true);
    try {
      const localReadings = readLocalList<SavedReadingRecord>(LOCAL_READINGS_KEY);
      const localLogs = readLocalList<SavedMissionLogRecord>(LOCAL_LOGS_KEY);

      if (auth.currentUser) {
        const [cloudReadings, cloudLogs] = await Promise.all([
          fetchHistoricalReadings(20),
          fetchMissionLogsFromFirestore(20),
        ]);
        const mergedReadings = [
          ...localReadings,
          ...cloudReadings.filter((cr) => !localReadings.some((lr) => lr.id === cr.id)),
        ].slice(0, 30);
        const mergedLogs = [
          ...localLogs,
          ...cloudLogs.filter((cl) => !localLogs.some((ll) => ll.id === cl.id)),
        ].slice(0, 30);
        setSavedReadings(mergedReadings);
        setSavedLogs(mergedLogs);
      } else {
        setSavedReadings(localReadings);
        setSavedLogs(localLogs);
      }
    } finally {
      setIsLoadingArchive(false);
    }
  }, []);

  useEffect(() => {
    loadArchiveRecords();
  }, [loadArchiveRecords]);

  // Export CSV
  const handleExportCSV = () => {
    if (history.length === 0) return;
    const headers = [
      'Timestamp',
      'ElapsedSec',
      'OxygenPercent',
      'CarbonDioxidePpm',
      'PressureKPa',
      'InternalTemperatureC',
      'RadiationDoseRateUSvH',
      'RiskScore',
      'HealthScore',
    ];

    const rows = history.map((p) => [
      p.timestamp,
      p.elapsedSeconds,
      p.oxygenPercent,
      p.carbonDioxidePpm,
      p.pressureKPa,
      p.internalTemperatureC,
      p.radiationDoseRateUSvH,
      p.riskScore,
      p.healthScore,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FLAME_IN_FIREFALL_TELEMETRY_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print/PDF Report
  const handlePrintReport = () => {
    window.print();
  };

  // Save snapshot & optional flight director log
  const handleSaveArchive = async () => {
    setIsSaving(true);
    setSyncStatus(null);
    try {
      const nowIso = new Date().toISOString();
      const stamp = Date.now();

      const readingEntry: SavedReadingRecord = {
        id: `read_${stamp}`,
        habitatId: habitat.id,
        timestamp: nowIso,
        temperatureC: telemetry.internalTemperatureC,
        riskScore: assessment.overallRiskScore,
        ...telemetry,
      };

      const nextReadings = [readingEntry, ...readLocalList<SavedReadingRecord>(LOCAL_READINGS_KEY)];
      writeLocalList(LOCAL_READINGS_KEY, nextReadings);

      let nextLogs = readLocalList<SavedMissionLogRecord>(LOCAL_LOGS_KEY);
      if (newLogNote.trim()) {
        const logEntry: SavedMissionLogRecord = {
          id: `log_${stamp}`,
          habitatId: habitat.id,
          timestamp: nowIso,
          author: 'Flight Controller',
          category: 'operator_log',
          notes: newLogNote.trim(),
        };
        nextLogs = [logEntry, ...nextLogs];
        writeLocalList(LOCAL_LOGS_KEY, nextLogs);
        setNewLogNote('');

        if (auth.currentUser) {
          await saveMissionLogToFirestore(logEntry).catch(() => undefined);
        }
      }

      if (auth.currentUser) {
        await saveReadingToFirestore({
          ...readingEntry,
          healthScore: assessment.overallHealthScore,
        }).catch(() => undefined);
      }

      setSavedReadings(nextReadings.slice(0, 30));
      setSavedLogs(nextLogs.slice(0, 30));
      setSyncStatus('Telemetry snapshot and flight log saved to Mission Archive.');
    } catch (err: any) {
      setSyncStatus(`Archive error: ${err?.message || 'Unable to save record.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredHistory = history.filter((p) => {
    if (filterSeverity === 'critical') return p.riskScore >= 60;
    if (filterSeverity === 'caution') return p.riskScore >= 25;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white font-mono uppercase tracking-wide">
              Historical Telemetry & Mission Flight Logs
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Audit trail of habitat environmental readings, calculated risk scores, simulation sessions, and flight director logs · Team Tejasvi (NASA Space Apps Challenge).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleSaveArchive}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-semibold font-mono transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Telemetry Snapshot'}</span>
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="p-3 bg-cyan-950/40 border border-cyan-800 rounded-lg text-xs text-cyan-200 font-mono">
          {syncStatus}
        </div>
      )}

      {/* Operator Log Entry Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono mb-2">
          Add Mission Flight Director Log Note
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newLogNote}
            onChange={(e) => setNewLogNote(e.target.value)}
            placeholder="Log entry (e.g. Scrubber desiccant bed inspected; oxygen valve calibrated)..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-sans text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleSaveArchive}
            disabled={isSaving}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-semibold transition-colors shrink-0"
          >
            Record Log
          </button>
        </div>
      </div>

      {/* Filter Bar & Telemetry Records Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 font-mono">
              Recorded Telemetry Sequence ({filteredHistory.length} Samples)
            </h2>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <span className="text-slate-500 text-[10px] uppercase px-2">Filter:</span>
            {(['all', 'caution', 'critical'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2.5 py-0.5 rounded capitalize transition-colors ${
                  filterSeverity === sev
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[11px] uppercase">
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">O₂ %</th>
                <th className="pb-2">CO₂ ppm</th>
                <th className="pb-2">Pressure</th>
                <th className="pb-2">Temp</th>
                <th className="pb-2">Radiation</th>
                <th className="pb-2">Health Score</th>
                <th className="pb-2">Risk Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredHistory.slice(-15).reverse().map((point, idx) => (
                <tr key={idx} className="hover:bg-slate-950/40 transition-colors">
                  <td className="py-2.5 text-slate-400">{point.timestamp}</td>
                  <td className="py-2.5 text-cyan-300 tabular-nums">{point.oxygenPercent.toFixed(1)}%</td>
                  <td className="py-2.5 text-emerald-300 tabular-nums">{point.carbonDioxidePpm}</td>
                  <td className="py-2.5 text-blue-300 tabular-nums">{point.pressureKPa.toFixed(1)} kPa</td>
                  <td className="py-2.5 text-amber-300 tabular-nums">{point.internalTemperatureC.toFixed(1)}°C</td>
                  <td className="py-2.5 text-purple-300 tabular-nums">{point.radiationDoseRateUSvH.toFixed(1)} µSv/h</td>
                  <td className="py-2.5 text-slate-200 tabular-nums">{point.healthScore}/100</td>
                  <td className="py-2.5 tabular-nums">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        point.riskScore >= 60
                          ? 'bg-rose-950 text-rose-300'
                          : point.riskScore >= 30
                          ? 'bg-amber-950 text-amber-300'
                          : 'bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {point.riskScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saved Mission Archive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Mission Flight Director Logs ({savedLogs.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={loadArchiveRecords}
              disabled={isLoadingArchive}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingArchive ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {savedLogs.length === 0 ? (
            <p className="text-xs text-slate-500 font-mono">
              No flight logs recorded yet. Enter a note above and click "Record Log".
            </p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {savedLogs.map((log, i) => (
                <div
                  key={log.docId || log.id || i}
                  className="p-3 rounded-lg bg-slate-950/75 border border-slate-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-slate-400">
                    <span className="uppercase text-cyan-400">{log.category.replace('_', ' ')}</span>
                    <span>{new Date(log.timestamp || log.savedAt || Date.now()).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-200">{log.notes}</p>
                  {log.author && (
                    <div className="text-[10px] font-mono text-slate-500">Logged by {log.author}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Saved Telemetry Snapshots ({savedReadings.length})
              </h2>
            </div>
          </div>

          {savedReadings.length === 0 ? (
            <p className="text-xs text-slate-500 font-mono">
              No telemetry snapshots archived yet. Click "Save Telemetry Snapshot" above to archive current readings.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase">
                    <th className="pb-2">Time</th>
                    <th className="pb-2">O₂</th>
                    <th className="pb-2">CO₂</th>
                    <th className="pb-2">kPa</th>
                    <th className="pb-2">Temp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {savedReadings.map((r, i) => (
                    <tr key={r.docId || r.id || i}>
                      <td className="py-2 text-slate-400 whitespace-nowrap">
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 text-cyan-300 tabular-nums">{Number(r.oxygenPercent).toFixed(1)}%</td>
                      <td className="py-2 text-emerald-300 tabular-nums">{r.carbonDioxidePpm}</td>
                      <td className="py-2 text-blue-300 tabular-nums">{Number(r.pressureKPa).toFixed(1)}</td>
                      <td className="py-2 text-amber-300 tabular-nums">
                        {Number(r.temperatureC ?? r.internalTemperatureC ?? 0).toFixed(1)}°C
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

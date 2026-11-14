import { useCallback, useEffect, useRef, useState } from 'react';

export interface NasaSatelliteIssTrack {
  noradId: number;
  name: string;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  velocityKmh: number;
  visibility: string;
  footprintKm: number;
  solarLat: number;
  solarLon: number;
  timestampIso: string;
}

export interface NasaSatelliteDscovrInfo {
  satellite: string;
  latestObservationUtc: string;
  caption: string;
  imageUrl: string | null;
  lagrangePoint: string;
}

export interface NasaSatelliteTimeData {
  utcIso: string;
  unixMs: number;
  utcDateFormatted: string;
  utcTimeFormatted: string;
  source: string;
  satelliteSyncActive: boolean;
  clockAuthority: string;
  iss: NasaSatelliteIssTrack;
  dscovr: NasaSatelliteDscovrInfo;
}

export interface LiveNasaClockState {
  utcDate: string;
  utcTime: string;
  utcIso: string;
  localTime: string;
  snapshot: NasaSatelliteTimeData | null;
  syncing: boolean;
  lastSyncedLocal: string | null;
  refreshSync: () => Promise<void>;
}

function computeClockStrings(nowMs: number, offsetMs: number) {
  const syncedDate = new Date(nowMs + offsetMs);
  const iso = syncedDate.toISOString();
  return {
    utcDate: iso.slice(0, 10),
    utcTime: `${iso.slice(11, 19)} UTC`,
    utcIso: iso,
    localTime: syncedDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  };
}

export function useNasaSatelliteTime(): LiveNasaClockState {
  const [snapshot, setSnapshot] = useState<NasaSatelliteTimeData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedLocal, setLastSyncedLocal] = useState<string | null>(null);
  const offsetMsRef = useRef<number>(0);

  const [tick, setTick] = useState(() => computeClockStrings(Date.now(), 0));

  const refreshSync = useCallback(async () => {
    setSyncing(true);
    try {
      const reqStart = Date.now();
      const res = await fetch('/api/nasa/satellite-time');
      if (!res.ok) return;
      const data = (await res.json()) as NasaSatelliteTimeData;
      const reqEnd = Date.now();
      const midpoint = Math.round((reqStart + reqEnd) / 2);
      if (Number.isFinite(data.unixMs)) {
        offsetMsRef.current = data.unixMs - midpoint;
      }
      setSnapshot(data);
      setLastSyncedLocal(new Date().toLocaleTimeString());
      setTick(computeClockStrings(Date.now(), offsetMsRef.current));
    } catch {
      // Retain existing offset if offline
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    refreshSync();
    const syncTimer = window.setInterval(refreshSync, 30_000);
    return () => window.clearInterval(syncTimer);
  }, [refreshSync]);

  useEffect(() => {
    const tickTimer = window.setInterval(() => {
      setTick(computeClockStrings(Date.now(), offsetMsRef.current));
    }, 1000);
    return () => window.clearInterval(tickTimer);
  }, []);

  return {
    utcDate: tick.utcDate,
    utcTime: tick.utcTime,
    utcIso: tick.utcIso,
    localTime: tick.localTime,
    snapshot,
    syncing,
    lastSyncedLocal,
    refreshSync,
  };
}

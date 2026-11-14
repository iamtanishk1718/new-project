import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchNasaSatelliteTime,
  fetchNasaSpaceWeatherAndEvents,
  getNasaSpaceBiologyDatasets,
} from './nasaService.ts';

test('fetchNasaSatelliteTime returns valid UTC date/time formatting and ISS/DSCOVR telemetry', async () => {
  const snap = await fetchNasaSatelliteTime();
  assert.match(snap.utcDateFormatted, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(snap.utcTimeFormatted, /^\d{2}:\d{2}:\d{2} UTC$/);
  assert.ok(Number.isFinite(snap.unixMs));
  assert.equal(snap.iss.noradId, 25544);
  assert.ok(Number.isFinite(snap.iss.latitude));
  assert.ok(Number.isFinite(snap.iss.longitude));
  assert.ok(Number.isFinite(snap.iss.altitudeKm));
  assert.ok(Number.isFinite(snap.iss.velocityKmh));
  assert.ok(snap.dscovr.satellite.includes('DSCOVR'));
});

test('fetchNasaSpaceWeatherAndEvents returns DONKI bulletins and EONET array cleanly', async () => {
  const bundle = await fetchNasaSpaceWeatherAndEvents();
  assert.ok(Array.isArray(bundle.donkiBulletins));
  assert.ok(bundle.donkiBulletins.length >= 1);
  assert.ok(Array.isArray(bundle.eonetEvents));
  assert.ok(bundle.sourceNotes.includes('Free'));
});

test('getNasaSpaceBiologyDatasets returns OSDR accessions', () => {
  const datasets = getNasaSpaceBiologyDatasets();
  assert.equal(datasets.length, 3);
  assert.equal(datasets[0].accession, 'OSDR-495');
});

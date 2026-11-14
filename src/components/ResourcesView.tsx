import React, { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { TEAM_INFO } from '../lib/teamInfo';
import { TeamLogo } from './TeamLogo';

type ResourceCategory =
  | 'all'
  | 'nasa_data'
  | 'free_integrations'
  | 'visualization_audio'
  | 'core_stack';

interface ResourceItem {
  id: string;
  name: string;
  identifier: string;
  category: Exclude<ResourceCategory, 'all'>;
  categoryLabel: string;
  usedIn: string;
  description: string;
  url?: string;
}

const RESOURCES: ResourceItem[] = [
  {
    id: 'nasa-dscovr-epic',
    name: 'NASA DSCOVR EPIC Satellite (Exact UTC Time & Earth L1 Imagery)',
    identifier: 'epic.gsfc.nasa.gov/api/natural · 100% Free',
    category: 'nasa_data',
    categoryLabel: 'Free NASA Satellite & Data',
    usedIn: 'Mission Control Header & NASA Satellites View',
    description:
      'Provides authoritative Goddard Space Flight Center UTC clock headers and live sunlit Earth full-disk observations from the Deep Space Climate Observatory at Sun-Earth Lagrange Point L1.',
    url: 'https://epic.gsfc.nasa.gov/',
  },
  {
    id: 'iss-norad-25544',
    name: 'ISS NORAD 25544 Live Orbital Ephemeris',
    identifier: 'api.wheretheiss.at/v1/satellites/25544 · Free',
    category: 'nasa_data',
    categoryLabel: 'Free NASA Satellite & Data',
    usedIn: 'Mission Control & NASA Satellites View',
    description:
      'Streams real-time International Space Station latitude, longitude, orbital altitude (km), ground velocity (km/h), solar angles, and daylight/eclipse phase.',
    url: 'https://wheretheiss.at/w/developer',
  },
  {
    id: 'nasa-power',
    name: 'NASA POWER API (Prediction Of Worldwide Energy Resources)',
    identifier: 'power.larc.nasa.gov/api · Free Open API',
    category: 'nasa_data',
    categoryLabel: 'Free NASA Satellite & Data',
    usedIn: 'NASA Data & Biology (Live Mode)',
    description:
      'Supplies free daily solar irradiance (ALLSKY_SFC_SW_DWN), ambient temperature (T2M), surface barometric pressure (PS), and relative humidity (RH2M) telemetry.',
    url: 'https://power.larc.nasa.gov/',
  },
  {
    id: 'nasa-donki-eonet',
    name: 'NASA CCMC DONKI Space Weather & NASA EONET v3',
    identifier: 'api.nasa.gov/DONKI · eonet.gsfc.nasa.gov/api/v3 · Free DEMO_KEY',
    category: 'nasa_data',
    categoryLabel: 'Free NASA Satellite & Data',
    usedIn: 'NASA Satellites & Space Weather Monitor',
    description:
      'Delivers free real-time solar flare / coronal mass ejection bulletins (DONKI) and NASA Earth Observatory Natural Event Tracker (EONET) incident feeds.',
    url: 'https://api.nasa.gov/',
  },
  {
    id: 'nasa-osdr',
    name: 'NASA Open Science Data Repository (OSDR / GeneLab)',
    identifier: 'OSDR-495 · OSDR-352 · OSDR-512 · Free Open Science',
    category: 'nasa_data',
    categoryLabel: 'Free NASA Satellite & Data',
    usedIn: 'Bioscience Telemetry & NASA Biology View',
    description:
      'Provides peer-reviewed spaceflight mouse oxidative stress, astronaut hypercapnia (elevated CO₂), and heavy-ion/solar proton radiation cellular studies.',
    url: 'https://osdr.nasa.gov/bio/repo/',
  },
  {
    id: 'nasa-hidh',
    name: 'NASA Human Integration Design Handbook (HIDH) & NASA-STD-3001',
    identifier: 'NASA-STD-3001 / RP-1357 · 7 Habitat Profiles',
    category: 'nasa_data',
    categoryLabel: 'Free NASA Satellite & Data',
    usedIn: 'Risk Assessment Engine, Thresholds & 3D Habitats',
    description:
      'Open NASA engineering standard governing crew metabolic oxygen consumption, CO₂ clearance, cabin pressure/thermal envelopes, and 7 spacecraft digital twin profiles.',
    url: 'https://www.nasa.gov/reference/human-integration-design-handbook/',
  },
  {
    id: 'free-chat-webhooks',
    name: 'Telegram Bot API, Discord Webhooks & Slack Free Incoming Webhooks',
    identifier: 'Zero-Cost Alert Channels',
    category: 'free_integrations',
    categoryLabel: 'Free Open Integrations',
    usedIn: 'Integration Hub & Smart Alert Routing',
    description:
      '100% free alert delivery channels authenticated via AES-256-GCM encrypted server vault tokens with SSRF validation and deduplication.',
  },
  {
    id: 'free-iot-dev',
    name: 'Home Assistant, ESP32 HTTP Bridge, Trello & GitHub Issues',
    identifier: 'Open-Source Hardware & Free Dev Workflows',
    category: 'free_integrations',
    categoryLabel: 'Free Open Integrations',
    usedIn: 'Automation Rules & Hardware Relays',
    description:
      'Triggers open-source Home Assistant sirens, ESP32 microcontroller habitat nodes, free Trello maintenance cards, and GitHub engineering anomaly issues.',
  },
  {
    id: 'threejs',
    name: 'Three.js (WebGL 3D Engine, OrbitControls & RoomEnvironment)',
    identifier: 'three · @types/three',
    category: 'visualization_audio',
    categoryLabel: '3D, Audio & Charts',
    usedIn: '3D Habitat Digital Twins & 3D Flame Lab',
    description:
      'Renders all 7 animated 3D space habitats, procedural PBR hull/solar textures, cutaway modes, walkable Destiny Lab interior, and the Microgravity Flame Chamber.',
    url: 'https://threejs.org/',
  },
  {
    id: 'web-audio-speech',
    name: 'Web Audio API, Speech Synthesis & Browser Notification API',
    identifier: 'Native Browser Standards (Zero External Cost)',
    category: 'visualization_audio',
    categoryLabel: '3D, Audio & Charts',
    usedIn: 'Caution & Warning Klaxon & OS Notifications',
    description:
      'Synthesizes severity-scaled Caution & Warning acoustic alarms, spoken hazard callouts, and background desktop OS notifications with zero paid third-party services.',
  },
  {
    id: 'recharts',
    name: 'Recharts',
    identifier: 'recharts',
    category: 'visualization_audio',
    categoryLabel: '3D, Audio & Charts',
    usedIn: 'Predictive Analytics & Trend Graphs',
    description:
      'Draws interactive time-series charts for oxygen, carbon dioxide, pressure, temperature, radiation, and overall habitat risk trajectories.',
    url: 'https://recharts.org/',
  },
  {
    id: 'react-vite-express',
    name: 'React 19, TypeScript, Vite, Express.js & Tailwind CSS v4',
    identifier: 'react · typescript · vite · express · tailwindcss',
    category: 'core_stack',
    categoryLabel: 'Core Stack',
    usedIn: 'Full-Stack Application',
    description:
      'Open-source frontend and Express backend architecture powering real-time telemetry simulation, NASA API proxying, and HMAC-SHA256 operator sessions.',
    url: 'https://react.dev/',
  },
];

const CATEGORIES: Array<{ id: ResourceCategory; label: string }> = [
  { id: 'all', label: 'All Free Resources' },
  { id: 'nasa_data', label: 'NASA Satellites & Data' },
  { id: 'free_integrations', label: 'Free Integrations' },
  { id: 'visualization_audio', label: '3D, Audio & Charts' },
  { id: 'core_stack', label: 'Core Stack' },
];

export const ResourcesView: React.FC = () => {
  const [category, setCategory] = useState<ResourceCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredResources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return RESOURCES.filter((item) => {
      const matchesCategory = category === 'all' || item.category === category;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.identifier.toLowerCase().includes(q) ||
        item.usedIn.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [category, searchQuery]);

  return (
    <div className="space-y-6" data-testid="resources-view">
      {/* Header Banner */}
      <section className="p-6 panel-surface rounded-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <TeamLogo className="w-14 h-14" />
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-wide">
                Free NASA Open Resources &amp; Technical References
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                100% free NASA satellite APIs, aerospace standards, zero-cost open integrations, and open-source libraries powering {TEAM_INFO.projectTitle} by Team {TEAM_INFO.teamName}.
              </p>
            </div>
          </div>

          <div className="text-xs font-mono text-cyan-300 tabular-nums shrink-0">
            Showing {filteredResources.length} of {RESOURCES.length} free resources
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#050811] border border-slate-800 rounded-lg">
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search free NASA resources..."
              aria-label="Search resources"
              className="w-full bg-[#050811] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </section>

      {/* Resources Grid */}
      {filteredResources.length === 0 ? (
        <div className="p-8 panel-surface rounded-xl text-center text-sm text-slate-400">
          No resources match your current filter. Try clearing the search query.
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResources.map((res, index) => (
            <article
              key={res.id}
              data-testid={`resource-card-${res.id}`}
              className="p-5 panel-surface rounded-xl flex flex-col justify-between gap-4 hover:border-slate-700 transition-colors"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono text-cyan-400">
                      {res.categoryLabel} · {res.usedIn}
                    </div>
                    <h2 className="text-base font-bold text-white mt-1">{res.name}</h2>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>

                <div className="text-xs font-mono text-slate-400 break-all">
                  {res.identifier}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{res.description}</p>
              </div>

              {res.url && (
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <span>Open Official Documentation</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

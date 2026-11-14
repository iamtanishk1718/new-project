export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  focusDomain: string;
  summary: string;
  modules: Array<{
    label: string;
    tabId:
      | 'dashboard'
      | 'environment'
      | 'risk'
      | 'recommendations'
      | 'predictive'
      | 'simulation'
      | 'emergency'
      | 'nasa'
      | 'historical'
      | 'assistant';
  }>;
}

export const TEAM_INFO = {
  teamName: 'Tejasvi',
  projectTitle: 'FLAME IN FIREFALL',
  projectSubtitle:
    'AI-Powered Space Habitat Environmental Monitoring and Risk Prediction System',
  challenge: 'NASA Space Apps Challenge',
  missionStatement:
    'Team Tejasvi engineered Flame in Firefall to safeguard astronauts inside enclosed orbital, lunar, Martian, and deep-space habitats through multi-parameter environmental risk scoring, predictive anomaly detection, interactive 3D digital twins, and synthesized caution-and-warning cockpit telemetry.',
};

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tanishk-sharma',
    name: 'Tanishk Sharma',
    initials: 'TS',
    role: 'Team Lead & Systems Architect',
    focusDomain: 'AI Risk Engine & Mission Control',
    summary:
      'Designed the core multi-parameter environmental risk scoring architecture, Gemini AI advisory orchestration, and real-time Mission Control command layout.',
    modules: [
      { label: 'Mission Control', tabId: 'dashboard' },
      { label: 'Risk Assessment', tabId: 'risk' },
      { label: 'AI Safety Advisor', tabId: 'recommendations' },
    ],
  },
  {
    id: 'sm-hasan-abidi',
    name: 'S.M Hasan Abidi',
    initials: 'HA',
    role: '3D Digital Twin & Simulation Engineer',
    focusDomain: 'Three.js Habitat Models & Cockpit HUD',
    summary:
      'Built the 7 animated 3D space habitat assemblies, walkable Destiny Lab interior, cutaway inspection views, and glass-cockpit Caution & Warning display canvases.',
    modules: [
      { label: 'Habitat Simulation', tabId: 'simulation' },
      { label: 'Mission Control', tabId: 'dashboard' },
    ],
  },
  {
    id: 'shivam-sharma',
    name: 'Shivam Sharma',
    initials: 'SS',
    role: 'Telemetry, Thresholds & Auth Engineer',
    focusDomain: '5-Tier Bounds, OTP Auth & Backend APIs',
    summary:
      'Engineered the configurable 5-tier risk threshold matrix per habitat, server-verified OTP operator authentication, and Express API routing.',
    modules: [
      { label: 'Telemetry & Inputs', tabId: 'environment' },
      { label: 'Risk Assessment', tabId: 'risk' },
    ],
  },
  {
    id: 'komal-rajak',
    name: 'Komal Rajak',
    initials: 'KR',
    role: 'Predictive Analytics & Acoustics Lead',
    focusDomain: 'Forecasting, Emergency Protocols & C&W Audio',
    summary:
      'Developed time-series hazard forecasting, automated emergency protocol escalation, and severity-scaled Caution & Warning acoustic and voice alert synthesis.',
    modules: [
      { label: 'Predictive Analytics', tabId: 'predictive' },
      { label: 'Emergency Response', tabId: 'emergency' },
    ],
  },
  {
    id: 'aishwarya-deshpande',
    name: 'Aishwarya Deshpande',
    initials: 'AD',
    role: 'NASA Data Integration & Mission UX Lead',
    focusDomain: 'NASA POWER / Biology Feeds & Flight Logs',
    summary:
      'Integrated NASA POWER & Space Biology datasets, historical telemetry auditing, CSV/print mission reports, and interactive operator chat workflows.',
    modules: [
      { label: 'NASA Data & Biology', tabId: 'nasa' },
      { label: 'Mission Logs & Export', tabId: 'historical' },
      { label: 'AI Safety Chat', tabId: 'assistant' },
    ],
  },
];

import React from 'react';
import {
  Activity,
  Sliders,
  ShieldAlert,
  Brain,
  TrendingUp,
  Cpu,
  Flame,
  FileText,
  MessageSquare,
  Radio,
  Users,
  BookOpen,
  ChevronRight,
  Menu,
  X,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Plug,
  AlertOctagon,
  Clock,
  Cloud,
  LogIn,
  LogOut,
  Moon,
  Globe,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { DataMode, HabitatProfile, RiskClassification } from '../types/habitat';
import { BrowserNotifPermissionState } from '../lib/emergencyAlerts';
import { LiveNasaClockState } from '../lib/nasaClock';
import { TeamLogo } from './TeamLogo';

export type ActiveTab =
  | 'dashboard'
  | 'environment'
  | 'risk'
  | 'recommendations'
  | 'predictive'
  | 'simulation'
  | 'flame-lab'
  | 'emergency'
  | 'integrations'
  | 'nasa'
  | 'historical'
  | 'assistant'
  | 'team'
  | 'resources';

interface Props {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  habitat: HabitatProfile;
  classification: RiskClassification;
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  notificationPermission?: BrowserNotifPermissionState;
  globalAudioEnabled?: boolean;
  onToggleGlobalAudio?: () => void;
  onOpenAlertHub?: () => void;
  satelliteTime?: LiveNasaClockState;
  firebaseUser?: User | null;
  firestoreConnected?: boolean | null;
  onFirebaseLogin?: () => Promise<void>;
  onFirebaseLogout?: () => Promise<void>;
  themeVariant?: 'deep-space' | 'orbital';
  onChangeThemeVariant?: (variant: 'deep-space' | 'orbital') => void;
}

interface NavGroup {
  heading: string;
  items: { id: ActiveTab; label: string; icon: React.FC<any> }[];
}

export const Navigation: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  habitat,
  classification,
  dataMode,
  setDataMode,
  isSidebarOpen,
  setIsSidebarOpen,
  notificationPermission = 'default',
  globalAudioEnabled = true,
  onToggleGlobalAudio,
  onOpenAlertHub,
  satelliteTime,
  firebaseUser = null,
  firestoreConnected = null,
  onFirebaseLogin,
  onFirebaseLogout,
  themeVariant = 'deep-space',
  onChangeThemeVariant,
}) => {
  const navGroups: NavGroup[] = [
    {
      heading: 'Flight Telemetry',
      items: [
        { id: 'dashboard', label: 'Mission Control', icon: Activity },
        { id: 'environment', label: 'Telemetry & Inputs', icon: Sliders },
        { id: 'risk', label: 'Risk Assessment', icon: ShieldAlert },
        { id: 'predictive', label: 'Predictive Analytics', icon: TrendingUp },
      ],
    },
    {
      heading: 'Digital Twins & Physics',
      items: [
        { id: 'simulation', label: 'Habitat Simulation', icon: Cpu },
        { id: 'flame-lab', label: '3D Flame Lab', icon: Flame },
      ],
    },
    {
      heading: 'AI & Emergency Ops',
      items: [
        { id: 'recommendations', label: 'AI Safety Advisor', icon: Brain },
        { id: 'assistant', label: 'AI Safety Chat', icon: MessageSquare },
        { id: 'emergency', label: 'Emergency Response', icon: AlertOctagon },
        { id: 'integrations', label: 'Free Integrations', icon: Plug },
      ],
    },
    {
      heading: 'NASA Feeds & Logs',
      items: [
        { id: 'nasa', label: 'NASA Satellites & Bio', icon: Radio },
        { id: 'historical', label: 'Mission Logs & Export', icon: FileText },
        { id: 'team', label: 'Team Tejasvi', icon: Users },
        { id: 'resources', label: 'Resources & Credits', icon: BookOpen },
      ],
    },
  ];

  const getClassificationStyle = (c: RiskClassification) => {
    switch (c) {
      case 'extreme_emergency':
        return { text: 'EXTREME', cls: 'text-rose-300 bg-rose-950/75 border-rose-500/70', glyph: '✖' };
      case 'critical':
        return { text: 'CRITICAL', cls: 'text-red-300 bg-red-950/75 border-red-500/70', glyph: '✖' };
      case 'high_risk':
        return { text: 'HIGH RISK', cls: 'text-amber-300 bg-amber-950/75 border-amber-500/70', glyph: '▲' };
      case 'caution':
        return { text: 'CAUTION', cls: 'text-yellow-300 bg-yellow-950/75 border-yellow-500/70', glyph: '▲' };
      default:
        return { text: 'NOMINAL', cls: 'text-emerald-300 bg-emerald-950/65 border-emerald-500/45', glyph: '●' };
    }
  };

  const riskBadge = getClassificationStyle(classification);

  return (
    <>
      {/* 3-Zone Top Bar: Wordmark + Logo | Concise Single-Line Nav | Telemetry Status & Controls */}
      <header className="sticky top-0 z-50 flex items-center justify-between gap-6 px-5 py-3 deep-space-shell border-b backdrop-blur-md transition-colors duration-200">
        {/* Zone 1: Brand Wordmark + Tejasvi Emblem */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 lg:hidden"
            aria-label="Toggle Navigation Sidebar"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dashboard');
            }}
            className="flex items-center gap-2.5 whitespace-nowrap"
          >
            <TeamLogo className="w-9 h-9" />
            <div className="leading-tight">
              <span className="font-display text-base font-bold tracking-[0.09em] uppercase text-white block">
                Team Tejasvi
              </span>
              <span className="text-[10px] font-mono tracking-wider text-cyan-400/90 hidden sm:block">
                FLAME IN FIREFALL
              </span>
            </div>
          </a>
        </div>

        {/* Zone 2: Concise Single-Line Primary Links */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-400 h-full">
          {(
            [
              { id: 'dashboard', label: 'Mission Control' },
              { id: 'environment', label: 'Telemetry' },
              { id: 'simulation', label: 'Simulation' },
              { id: 'flame-lab', label: 'Flame Lab', testId: 'nav-top-flame-lab' },
              { id: 'nasa', label: 'NASA Feeds' },
              { id: 'integrations', label: 'Integrations' },
            ] as { id: ActiveTab; label: string; testId?: string }[]
          ).map((link) => {
            const active = activeTab === link.id;
            return (
              <button
                key={link.id}
                type="button"
                data-testid={link.testId}
                onClick={() => setActiveTab(link.id)}
                className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
                  active
                    ? link.id === 'flame-lab'
                      ? 'border-amber-400 text-amber-300 font-semibold'
                      : 'border-cyan-400 text-white font-semibold'
                    : 'border-transparent hover:text-slate-100'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Satellite UTC Readout + Risk State + Audio/Alert Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {satelliteTime && (
            <button
              type="button"
              onClick={() => setActiveTab('nasa')}
              title={`Synced via ${satelliteTime.snapshot?.source || 'NASA Satellite UTC'}`}
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md panel-surface-subtle hover:border-cyan-500/40 text-[11px] font-mono tabular-nums text-slate-200 whitespace-nowrap transition-colors"
              data-testid="nav-nasa-utc-clock"
            >
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>{satelliteTime.utcDate}</span>
              <span className="text-cyan-300 font-semibold">{satelliteTime.utcTime}</span>
            </button>
          )}

          <div
            className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold uppercase border whitespace-nowrap ${riskBadge.cls}`}
          >
            {riskBadge.glyph} {riskBadge.text}
          </div>

          {onToggleGlobalAudio && (
            <button
              type="button"
              onClick={onToggleGlobalAudio}
              title={globalAudioEnabled ? 'Silence Global Alarm' : 'Enable Global Alarm Audio'}
              aria-label={globalAudioEnabled ? 'Silence Global Alarm' : 'Enable Global Alarm Audio'}
              data-testid="nav-audio-toggle"
              className={`p-1.5 rounded-lg border transition-colors ${
                globalAudioEnabled && (classification === 'critical' || classification === 'extreme_emergency')
                  ? 'bg-rose-950/80 border-rose-500 text-rose-200'
                  : globalAudioEnabled
                  ? 'bg-[#090e1a] border-slate-700 text-cyan-300 hover:border-cyan-500/60'
                  : 'bg-[#090e1a] border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {globalAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => (onOpenAlertHub ? onOpenAlertHub() : setActiveTab('emergency'))}
            title="Emergency Notifications & Free Relay Alerts"
            aria-label="Open Emergency Notifications & Alerts"
            data-testid="nav-alert-hub-btn"
            className={`p-1.5 rounded-lg border transition-colors ${
              classification === 'critical' || classification === 'extreme_emergency'
                ? 'bg-rose-950/85 border-rose-500 text-rose-200'
                : notificationPermission === 'granted'
                ? 'bg-[#090e1a] border-emerald-500/45 text-emerald-300 hover:border-emerald-400'
                : 'bg-[#090e1a] border-slate-700 text-amber-300 hover:border-amber-400'
            }`}
          >
            {classification === 'critical' || classification === 'extreme_emergency' ? (
              <BellRing className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Collapsible Aerospace Module Rail */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 pt-16 deep-space-shell border-r backdrop-blur-md transition-transform duration-200 lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full p-4 justify-between overflow-y-auto">
          <div className="space-y-4">
            {/* Active Habitat Telemetry Summary */}
            <div className="p-3 panel-surface-subtle rounded-lg">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500">
                <span>Active Habitat</span>
                <span className="text-cyan-400">{habitat.type.toUpperCase()}</span>
              </div>
              <div className="text-xs font-semibold text-white truncate mt-0.5">{habitat.name}</div>
              <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
                {habitat.volumeM3} m³ · Crew {habitat.activeOccupants}/{habitat.maxOccupancy}
              </div>
            </div>

            {/* Data Mode Switcher */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
                Data Feed Mode
              </span>
              <div className="grid grid-cols-3 gap-1 mt-1 p-1 panel-surface-subtle rounded-lg text-[10px] font-mono">
                {(['simulation', 'live', 'manual'] as DataMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setDataMode(mode)}
                    className={`py-1 px-1 rounded capitalize transition-colors ${
                      dataMode === mode
                        ? 'bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Display Theme Variant Switcher */}
            {onChangeThemeVariant && (
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
                  Night-Shift Palette
                </span>
                <div
                  className="grid grid-cols-2 gap-1 mt-1 p-1 panel-surface-subtle rounded-lg text-[10px] font-mono"
                  role="group"
                  aria-label="Display Theme Variant"
                >
                  <button
                    type="button"
                    data-testid="theme-btn-deep-space"
                    onClick={() => onChangeThemeVariant('deep-space')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded transition-colors ${
                      themeVariant === 'deep-space'
                        ? 'bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/40 text-glow-cyan'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Moon className="w-3 h-3 shrink-0" />
                    <span>Deep Space</span>
                  </button>
                  <button
                    type="button"
                    data-testid="theme-btn-orbital"
                    onClick={() => onChangeThemeVariant('orbital')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded transition-colors ${
                      themeVariant === 'orbital'
                        ? 'bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Globe className="w-3 h-3 shrink-0" />
                    <span>Orbital</span>
                  </button>
                </div>
              </div>
            )}

            {/* Categorized Navigation Groups */}
            <div className="space-y-3.5">
              {navGroups.map((group) => (
                <div key={group.heading} className="space-y-1">
                  <div className="px-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    {group.heading}
                  </div>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-cyan-500/12 text-cyan-300 border border-cyan-500/35'
                            : 'text-slate-400 hover:bg-slate-900/90 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Firebase Cloud Sync & Team Tejasvi Footer */}
          <div className="pt-3 mt-4 border-t border-slate-800/80 space-y-2.5">
            {onFirebaseLogin && (
              <div className="p-2.5 rounded-lg panel-surface-subtle space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="flex items-center gap-1.5 text-slate-400 uppercase tracking-wider">
                    <Cloud className="w-3 h-3 text-cyan-400" />
                    <span>Firebase Sync</span>
                  </span>
                  <span
                    className={
                      firestoreConnected === false
                        ? 'text-amber-400'
                        : firebaseUser
                        ? 'text-emerald-400'
                        : 'text-cyan-400'
                    }
                  >
                    {firestoreConnected === false
                      ? 'Offline'
                      : firebaseUser
                      ? 'Synced'
                      : 'Ready'}
                  </span>
                </div>
                {firebaseUser ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-slate-200 truncate">
                      {firebaseUser.displayName || firebaseUser.email || 'Operator'}
                    </span>
                    {onFirebaseLogout && (
                      <button
                        type="button"
                        onClick={onFirebaseLogout}
                        title="Sign out of Firebase"
                        className="p-1 rounded border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition-colors shrink-0"
                      >
                        <LogOut className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onFirebaseLogin}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/35 text-[11px] font-mono text-cyan-300 transition-colors"
                  >
                    <LogIn className="w-3 h-3" />
                    <span>Google Cloud Sign-In</span>
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <TeamLogo className="w-8 h-8" glow={false} />
              <div className="min-w-0 font-mono">
                <div className="text-[11px] font-bold text-slate-200 truncate">Team Tejasvi</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {satelliteTime ? satelliteTime.utcTime : 'NASA Space Apps'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

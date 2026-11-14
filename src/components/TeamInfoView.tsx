import React, { useState } from 'react';
import { TEAM_INFO, TEAM_MEMBERS, TeamMember } from '../lib/teamInfo';
import { ArrowLeft, ArrowUpRight, Layers, ShieldCheck } from 'lucide-react';
import { TeamLogo } from './TeamLogo';

interface Props {
  onNavigateModule?: (tabId: TeamMember['modules'][number]['tabId']) => void;
  onBackToAuth?: () => void;
  isAuthenticated?: boolean;
}

export const TeamInfoView: React.FC<Props> = ({
  onNavigateModule,
  onBackToAuth,
  isAuthenticated = true,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(TEAM_MEMBERS[0].id);
  const selectedMember =
    TEAM_MEMBERS.find((member) => member.id === selectedMemberId) || TEAM_MEMBERS[0];

  return (
    <div className="space-y-6" data-testid="team-info-view">
      {/* Team Mission Header */}
      <section className="p-6 panel-surface rounded-xl">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
              <span>{TEAM_INFO.challenge}</span>
              <span aria-hidden="true">·</span>
              <span>Team {TEAM_INFO.teamName}</span>
              <span aria-hidden="true">·</span>
              <span>5 Engineers</span>
            </div>

            <div className="flex items-center gap-4">
              <TeamLogo className="w-16 h-16" />
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Team {TEAM_INFO.teamName}
                </h1>
                <p className="text-sm text-cyan-400 font-medium">
                  {TEAM_INFO.projectTitle} — {TEAM_INFO.projectSubtitle}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed pt-1">
              {TEAM_INFO.missionStatement}
            </p>
          </div>

          {onBackToAuth && (
            <div className="shrink-0">
              <button
                type="button"
                onClick={onBackToAuth}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Operator Sign In</span>
              </button>
            </div>
          )}
        </div>

        {/* Factual Platform Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800">
          <div>
            <div className="text-xs font-mono text-slate-400">Team Members</div>
            <div className="text-xl font-bold font-mono tabular-nums text-white mt-0.5">
              {TEAM_MEMBERS.length}
            </div>
          </div>
          <div>
            <div className="text-xs font-mono text-slate-400">Habitat Profiles</div>
            <div className="text-xl font-bold font-mono tabular-nums text-cyan-400 mt-0.5">
              7
            </div>
          </div>
          <div>
            <div className="text-xs font-mono text-slate-400">Risk Severity Tiers</div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-400 mt-0.5">
              5
            </div>
          </div>
          <div>
            <div className="text-xs font-mono text-slate-400">Core Modules</div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-0.5">
              11
            </div>
          </div>
        </div>
      </section>

      {/* Team Members Roster Grid */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
          <div>
            <h2 className="text-base font-bold text-white">Team Tejasvi Roster</h2>
            <p className="text-xs text-slate-400">
              Select a team member to inspect system ownership and jump directly to their modules.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Selected: {selectedMember.name}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {TEAM_MEMBERS.map((member, index) => {
            const isSelected = member.id === selectedMember.id;
            return (
              <article
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className={`p-5 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-4 ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-500/60'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
                data-testid={`team-member-card-${member.id}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-lg border flex items-center justify-center font-mono text-sm font-bold shrink-0 ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      >
                        {member.initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-white truncate">
                          {member.name}
                        </h3>
                        <p className="text-xs text-cyan-400 font-medium truncate">
                          {member.role}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                      0{index + 1}
                    </span>
                  </div>

                  <div className="text-xs font-mono text-slate-400">
                    Focus: {member.focusDomain}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {member.summary}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                  {member.modules.map((mod) => (
                    <button
                      key={mod.tabId + mod.label}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isAuthenticated && onNavigateModule) {
                          onNavigateModule(mod.tabId);
                        } else if (onBackToAuth) {
                          onBackToAuth();
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>{mod.label}</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Active Member Spotlight & Architecture Attribution */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <Layers className="w-4 h-4" />
            <span>Contributor Spotlight</span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold text-white">{selectedMember.name}</h3>
            <span className="text-xs font-mono text-slate-400">{selectedMember.role}</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{selectedMember.summary}</p>
          <div className="text-xs font-mono text-slate-400 pt-1">
            Primary Domain: {selectedMember.focusDomain} · Team {TEAM_INFO.teamName}
          </div>
        </div>

        <div className="lg:col-span-5 p-5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>System Integrity & Security</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Flame in Firefall combines direct Mission Control operator sessions, local and optional cloud persistence, deterministic 5-tier environmental risk scoring, and animated 3D digital twins for all 7 NASA habitat classes.
          </p>
          <div className="text-xs font-mono text-slate-400">
            Team {TEAM_INFO.teamName} · Project Flame in Firefall
          </div>
        </div>
      </section>
    </div>
  );
};

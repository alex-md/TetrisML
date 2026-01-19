import React, { useMemo } from 'react';
import { AgentState, LeaderboardEntry } from '../types';
import { UserRound, Crown, Dna, Trophy, Shield } from 'lucide-react';

interface ProfilesPageProps {
  agents: AgentState[];
  leaderboard: LeaderboardEntry[];
}

type Archetype = {
  name: string;
  description: string;
  tone: string;
};

const getArchetype = (agent: AgentState): Archetype => {
  const signals = agent.genome.summary.sensitivities;
  const linesBias = signals.linesCleared ?? 0;
  const holesBias = signals.holes ?? 0;
  const bumpBias = signals.bumpiness ?? 0;
  const wellBias = signals.wells ?? 0;
  const centerBias = signals.centerDev ?? 0;

  if (linesBias > 0.35 && holesBias < -0.35) {
    return {
      name: 'The Perfectionist',
      description: 'Obsessed with clean clears and immaculate stacks. Rarely tolerates holes.',
      tone: 'text-cyan-300'
    };
  }
  if (wellBias > 0.25 && linesBias > 0.2) {
    return {
      name: 'The Tetris Hunter',
      description: 'Carves wells and stores power clears, hunting for four-line strikes.',
      tone: 'text-purple-300'
    };
  }
  if (centerBias < -0.2 && bumpBias < -0.3) {
    return {
      name: 'The Architect',
      description: 'Builds centered, symmetrical stacks to keep options open.',
      tone: 'text-emerald-300'
    };
  }
  return {
    name: 'The Pragmatist',
    description: 'Balanced heuristics focused on steady survival and incremental gains.',
    tone: 'text-amber-300'
  };
};

const ProfilesPage: React.FC<ProfilesPageProps> = ({ agents, leaderboard }) => {
  const topAgents = useMemo(() => {
    return [...agents].sort((a, b) => b.score - a.score).slice(0, 3);
  }, [agents]);

  const leaderboardRows = useMemo(() => {
    return leaderboard.slice(0, 10).map(entry => {
      const agent = agents.find(a => a.id === entry.id);
      const archetype = agent ? getArchetype(agent) : null;
      return {
        entry,
        archetype
      };
    });
  }, [leaderboard, agents]);

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <header className="glass-panel rounded-2xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserRound size={20} className="text-cyan-300" />
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Profiles</div>
            <div className="text-lg font-bold text-white">Competitor Biographies</div>
          </div>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Crown size={14} />
          <span>Top performers</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {topAgents.map((agent, index) => {
          const archetype = getArchetype(agent);
          return (
            <div key={agent.id} className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Rank #{index + 1}</div>
                  <div className="text-lg font-semibold text-white">Specimen {agent.id.slice(0, 4)}</div>
                </div>
                <Crown size={18} className="text-amber-300" />
              </div>
              <div className={`text-base font-semibold ${archetype.tone}`}>{archetype.name}</div>
              <p className="text-sm text-slate-300 leading-relaxed">{archetype.description}</p>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Score {agent.score.toLocaleString()}</span>
                <span>Lines {agent.lines}</span>
                <span>Gen {agent.genome.generation}</span>
              </div>
            </div>
          );
        })}
        {topAgents.length === 0 && (
          <div className="glass-panel rounded-2xl p-6 text-sm text-slate-500 lg:col-span-3">
            No competitors loaded.
          </div>
        )}
      </div>

      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Hall of Fame</div>
          <Trophy size={16} className="text-amber-300" />
        </div>
        <div className="grid grid-cols-1 gap-2">
          {leaderboardRows.map((row, index) => (
            <div key={row.entry.id} className="flex items-center justify-between rounded-xl bg-slate-900/60 border border-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-500 w-6">#{index + 1}</div>
                <div>
                  <div className="text-sm text-white font-semibold">Specimen {row.entry.id.slice(0, 4)}</div>
                  <div className="text-xs text-slate-500">{row.archetype ? row.archetype.name : 'Unclassified'}</div>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs text-slate-400">
                <span className="text-cyan-300 font-mono">{row.entry.score.toLocaleString()}</span>
                <span>Lines {row.entry.lines}</span>
                <span>Gen {row.entry.generation}</span>
                <span className="uppercase tracking-widest text-[10px] text-slate-500">{row.entry.bornMethod}</span>
              </div>
            </div>
          ))}
          {leaderboardRows.length === 0 && (
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <Shield size={14} className="text-slate-500" />
              No leaderboard entries loaded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilesPage;

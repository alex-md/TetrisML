import React, { useMemo } from 'react';
import { LeaderboardEntry, SimulationStats } from '../types';
import { Trophy, Crown, Medal, ShieldCheck } from 'lucide-react';

interface HighScoresPageProps {
  leaderboard: LeaderboardEntry[];
  stats: SimulationStats;
}

const HighScoresPage: React.FC<HighScoresPageProps> = ({ leaderboard, stats }) => {
  const sorted = useMemo(() => [...leaderboard].sort((a, b) => b.score - a.score), [leaderboard]);
  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3, 15);

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <header className="glass-panel rounded-2xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy size={20} className="text-amber-300" />
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">High Scores</div>
            <div className="text-lg font-bold text-white">Hall of Champions</div>
          </div>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <ShieldCheck size={14} />
          <span>Best ever {Math.round(stats.bestEverFitness).toLocaleString()}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {podium.map((entry, index) => (
          <div key={entry.id} className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Rank #{index + 1}</div>
              {index === 0 ? <Crown size={18} className="text-amber-300" /> : <Medal size={18} className="text-cyan-300" />}
            </div>
            <div className="text-2xl font-semibold text-white">{entry.score.toLocaleString()}</div>
            <div className="text-xs text-slate-400 flex justify-between">
              <span>Specimen {entry.id.slice(0, 4)}</span>
              <span>Gen {entry.generation}</span>
            </div>
            <div className="text-xs text-slate-500">Lines {entry.lines} • Level {entry.level}</div>
          </div>
        ))}
        {podium.length === 0 && (
          <div className="glass-panel rounded-2xl p-6 text-sm text-slate-500 lg:col-span-3">
            No scores recorded yet.
          </div>
        )}
      </div>

      <div className="glass-panel rounded-2xl p-5 flex-1 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Leaderboard</div>
          <div className="text-xs text-slate-500">Top {sorted.length}</div>
        </div>
        <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1" style={{ maxHeight: '360px' }}>
          {rest.map((entry, index) => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl bg-slate-900/60 border border-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-500 w-6">#{index + 4}</div>
                <div>
                  <div className="text-sm text-white font-semibold">Specimen {entry.id.slice(0, 4)}</div>
                  <div className="text-xs text-slate-500">Born {entry.bornMethod}</div>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs text-slate-400">
                <span className="text-cyan-300 font-mono">{entry.score.toLocaleString()}</span>
                <span>Lines {entry.lines}</span>
                <span>Gen {entry.generation}</span>
              </div>
            </div>
          ))}
          {rest.length === 0 && podium.length > 0 && (
            <div className="text-xs text-slate-500">Only podium entries recorded.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HighScoresPage;

import React, { useMemo } from 'react';
import { AgentState, LineageNode, SimulationStats, TelemetryFrame } from '../types';
import { Activity, Flame, Radar, Gauge, TrendingUp, Waves, Crown } from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

interface TelemetryPageProps {
  stats: SimulationStats;
  agents: AgentState[];
  telemetryHistory: TelemetryFrame[];
  lineageHistory: LineageNode[][];
}

const TelemetryPage: React.FC<TelemetryPageProps> = ({ stats, agents, telemetryHistory, lineageHistory }) => {
  const alive = agents.filter(agent => agent.isAlive).length;
  const avgLines = agents.length > 0 ? agents.reduce((sum, agent) => sum + agent.lines, 0) / agents.length : 0;
  const avgScore = agents.length > 0 ? agents.reduce((sum, agent) => sum + agent.score, 0) / agents.length : 0;
  const latestTelemetry = telemetryHistory[telemetryHistory.length - 1];
  const latestLineage = lineageHistory[lineageHistory.length - 1] || [];
  const safeNumber = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);

  const distribution = useMemo(() => {
    if (!latestLineage.length) return null;
    const totals = latestLineage.reduce((acc, node) => {
      acc.holes += node.metrics.holes;
      acc.bumpiness += node.metrics.bumpiness;
      acc.maxHeight += node.metrics.maxHeight;
      acc.wells += node.metrics.wells;
      return acc;
    }, { holes: 0, bumpiness: 0, maxHeight: 0, wells: 0 });
    const count = Math.max(1, latestLineage.length);
    return {
      holes: totals.holes / count,
      bumpiness: totals.bumpiness / count,
      maxHeight: totals.maxHeight / count,
      wells: totals.wells / count
    };
  }, [latestLineage]);

  const chartData = useMemo(() => {
    if (!telemetryHistory.length) {
      return [{
        gen: stats.generation,
        avgScore: Math.round(avgScore),
        avgLines: Number(avgLines.toFixed(1)),
        holeDensity: latestTelemetry ? Number((latestTelemetry.holeDensity * 100).toFixed(1)) : 0
      }];
    }
    return telemetryHistory.map(frame => ({
      gen: frame.generation,
      avgScore: Math.round(safeNumber(frame.avgScore)),
      avgLines: Number(safeNumber(frame.avgLines).toFixed(1)),
      holeDensity: Number((safeNumber(frame.holeDensity) * 100).toFixed(1))
    }));
  }, [telemetryHistory, stats.generation, avgScore, avgLines, latestTelemetry]);

  return (
    <div className="h-full w-full flex flex-col gap-4 overflow-auto pr-2">
      <header className="glass-panel rounded-2xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radar size={20} className="text-cyan-300" />
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Telemetry</div>
            <div className="text-lg font-bold text-white">Performance Diagnostics</div>
          </div>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Gauge size={14} />
          <span>Gen {stats.generation}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Live Agents</div>
            <Activity size={16} className="text-emerald-300" />
          </div>
          <div className="mt-4 text-3xl font-semibold text-white">{alive}</div>
          <div className="text-xs text-slate-500">of {stats.populationSize} total</div>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Avg Score</div>
            <Flame size={16} className="text-amber-300" />
          </div>
          <div className="mt-4 text-3xl font-semibold text-white">{Math.round(avgScore)}</div>
          <div className="text-xs text-slate-500">population mean</div>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Avg Lines</div>
            <Gauge size={16} className="text-cyan-300" />
          </div>
          <div className="mt-4 text-3xl font-semibold text-white">{avgLines.toFixed(1)}</div>
          <div className="text-xs text-slate-500">per run</div>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Hole Density</div>
            <Waves size={16} className="text-rose-300" />
          </div>
          <div className="mt-4 text-3xl font-semibold text-white">
            {latestTelemetry ? `${Math.round(latestTelemetry.holeDensity * 100)}%` : '—'}
          </div>
          <div className="text-xs text-slate-500">board turbulence</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <section className="glass-panel rounded-2xl p-5 relative overflow-hidden min-h-[320px]">
          <div className="absolute inset-0 pointer-events-none heatmap-overlay" />
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Telemetry Pulse</div>
            <TrendingUp size={16} className="text-cyan-300" />
          </div>
          <div className="mt-4 h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="gen" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="avgScore" stroke="#e2e8f0" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="avgLines" stroke="#94a3b8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="holeDensity" stroke="#64748b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Lines show average score, average lines, and hole density across recent generations.
          </div>
        </section>

        <aside className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Stability Pulse</div>
            <div className="mt-3 text-lg font-semibold text-white">{stats.stage}</div>
            <div className="text-xs text-slate-500">Mutation rate {stats.mutationRate.toFixed(2)}</div>
          </div>
          <div className="divider-line" />
          <div className="text-sm text-slate-300 leading-relaxed">
            Latest telemetry summary:
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between"><span>Avg Max Height</span><span>{latestTelemetry ? latestTelemetry.avgMaxHeight.toFixed(1) : '—'}</span></div>
            <div className="flex justify-between"><span>Avg Bumpiness</span><span>{latestTelemetry ? latestTelemetry.avgBumpiness.toFixed(1) : '—'}</span></div>
            <div className="flex justify-between"><span>Avg Wells</span><span>{latestTelemetry ? latestTelemetry.avgWells.toFixed(1) : '—'}</span></div>
            <div className="flex justify-between"><span>Row Transitions</span><span>{latestTelemetry ? latestTelemetry.avgRowTransitions.toFixed(1) : '—'}</span></div>
            <div className="flex justify-between"><span>Col Transitions</span><span>{latestTelemetry ? latestTelemetry.avgColTransitions.toFixed(1) : '—'}</span></div>
          </div>
          <div className="divider-line" />
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Board Pressure</div>
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between"><span>Avg Holes</span><span>{distribution ? distribution.holes.toFixed(1) : '—'}</span></div>
            <div className="flex justify-between"><span>Avg Bumpiness</span><span>{distribution ? distribution.bumpiness.toFixed(1) : '—'}</span></div>
            <div className="flex justify-between"><span>Avg Max Height</span><span>{distribution ? distribution.maxHeight.toFixed(1) : '—'}</span></div>
            <div className="flex justify-between"><span>Avg Wells</span><span>{distribution ? distribution.wells.toFixed(1) : '—'}</span></div>
          </div>
        </aside>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Top Live Agents</div>
          <Crown size={16} className="text-amber-300" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {[...agents].sort((a, b) => b.score - a.score).slice(0, 6).map((agent, index) => (
            <div key={agent.id} className="flex items-center justify-between rounded-xl bg-slate-900/60 border border-slate-800 px-4 py-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="text-slate-500 w-6">#{index + 1}</div>
                <div>
                  <div className="text-sm text-white font-semibold">Specimen {agent.id.slice(0, 4)}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest">Gen {agent.genome.generation}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-slate-400">
                <span className="text-cyan-300 font-mono">{agent.score.toLocaleString()}</span>
                <span>Lines {agent.lines}</span>
                <span>Lvl {agent.level}</span>
              </div>
            </div>
          ))}
          {agents.length === 0 && (
            <div className="text-xs text-slate-500">No agents loaded.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TelemetryPage;

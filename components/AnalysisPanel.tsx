
import React from 'react';
import {
  YAxis, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { SimulationStats, Genome } from '../types';
import {
  Brain, Activity, Dna,
  Microscope, Globe
} from 'lucide-react';

interface Props {
  stats: SimulationStats;
  fitnessHistory: { gen: number; fitness: number }[];
  selectedGenome: Genome | null; // If null, shows global stats
  bestGenome: Genome | null;
}

const AnalysisPanel: React.FC<Props> = ({ stats, fitnessHistory, selectedGenome, bestGenome }) => {

  // Decide what to show: Selected Agent OR Best Agent OR Global
  const activeGenome = selectedGenome || bestGenome;
  const isGlobalView = !selectedGenome;

  const signalEntries = activeGenome
    ? Object.entries(activeGenome.summary.sensitivities)
        .map(([key, value]) => ({ key, value: value as number }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 10)
    : [];

  return (
    <div className="flex flex-col h-full space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2 text-cyan-400">
          {isGlobalView ? <Globe size={18} /> : <Microscope size={18} />}
          <h2 className="text-sm font-bold uppercase tracking-wider">
            {isGlobalView ? "Global Telemetry" : `Specimen: ${activeGenome?.id.substring(0, 6)}`}
          </h2>
        </div>
        {!isGlobalView && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {selectedGenome ? 'SELECTED' : 'ALPHA'}
          </span>
        )}
      </div>

      {/* 1. Fitness Graph (Always visible but shrinks in individual mode) */}
      <div className={`flex-1 min-h-0 bg-slate-900/40 rounded border border-slate-700/50 p-3 relative flex flex-col`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] text-slate-500 uppercase font-bold flex gap-2 items-center">
            <Activity size={10} /> Fitness Trend
          </span>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-cyan-500 font-mono">
              MEDIAN: {Math.floor(stats.medianFitness || 0)}
            </span>
            <span className="text-[9px] text-slate-500 font-mono">
              BEST EVER: {Math.floor(stats.bestEverFitness || 0)}
            </span>
          </div>
        </div>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fitnessHistory}>
              <defs>
                <linearGradient id="colorFit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', fontSize: '10px' }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ display: 'none' }}
              />
              <Area type="monotone" dataKey="fitness" stroke="#06b6d4" strokeWidth={2} fill="url(#colorFit)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Neural Map (Visible if Agent Exists) */}
      {activeGenome && (
        <div className="flex-1 min-h-0 bg-slate-900/40 rounded border border-slate-700/50 p-4 relative overflow-y-auto custom-scrollbar">

          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                <Brain size={12} /> Policy Sensitivities
              </h4>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Gen {activeGenome.generation}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            <div className="space-y-2">
              {signalEntries.map(entry => (
                <div key={entry.key}>
                  <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                    <span className="uppercase tracking-widest">{entry.key}</span>
                    <span className="font-mono">{entry.value.toFixed(2)}</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${entry.value >= 0 ? 'bg-cyan-400' : 'bg-rose-400'}`}
                      style={{ width: `${Math.min(100, Math.abs(entry.value) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="h-full min-h-[120px] relative flex items-center justify-center text-center text-xs text-slate-400">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <Dna size={80} className="text-cyan-500 animate-pulse-slow" />
              </div>
              <div className="relative z-10">
                <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Exploration</div>
                <div className="mt-2 text-2xl font-semibold text-cyan-300">{activeGenome.summary.exploration.toFixed(2)}</div>
                <div className="mt-2 text-[10px] text-slate-500">ES sigma for this generation</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="block text-slate-500">Method</span>
              <span className="text-cyan-400 capitalize">{activeGenome.bornMethod}</span>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="block text-slate-500">Policy Inputs</span>
              <span className="text-purple-400">{Object.keys(activeGenome.summary.sensitivities).length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisPanel;

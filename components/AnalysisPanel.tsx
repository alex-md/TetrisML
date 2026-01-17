
import React from 'react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { SimulationStats, Genome } from '../types';
import {
  Brain, Activity, Dna, Target, Shield, Layout,
  Maximize2, Minimize2, AlignCenter, ArrowDownToLine, Eraser, Grip,
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

  const radarData = activeGenome ? [
    { subject: 'Speed', A: activeGenome.traits.reactionSpeed * 100, fullMark: 100 },
    { subject: 'Foresight', A: activeGenome.traits.foresight * 100, fullMark: 100 },
    { subject: 'Calm', A: (1 - activeGenome.traits.anxiety) * 100, fullMark: 100 },
  ] : [];

  const weightGroups = activeGenome ? [
    {
      title: "Mechanics",
      items: [
        { key: 'lines', icon: Target, label: 'Lines', raw: activeGenome.weights.lines, color: 'bg-yellow-500' },
        { key: 'height', icon: Shield, label: 'Height', raw: Math.abs(activeGenome.weights.height), color: 'bg-emerald-500' },
        { key: 'holes', icon: Layout, label: 'Holes', raw: Math.abs(activeGenome.weights.holes), color: 'bg-indigo-500' },
      ]
    },
    {
      title: "Structure",
      items: [
        { key: 'wells', icon: ArrowDownToLine, label: 'Wells', raw: Math.abs(activeGenome.weights.wells), color: 'bg-red-500' },
        { key: 'rowTrans', icon: AlignCenter, label: 'Row Un', raw: Math.abs(activeGenome.weights.rowTransitions), color: 'bg-blue-400' },
        { key: 'eroded', icon: Eraser, label: 'Burn', raw: activeGenome.weights.erodedCells, color: 'bg-purple-500' },
      ]
    }
  ] : [];

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
                <Brain size={12} /> Neural Weights
              </h4>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Gen {activeGenome.generation}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {/* Left: Weights */}
            <div className="space-y-3">
              {weightGroups.map((group) => (
                <div key={group.title} className="space-y-1.5">
                  <div className="text-[9px] text-slate-600 uppercase tracking-widest">{group.title}</div>
                  {group.items.map((t) => (
                    <div key={t.key}>
                      <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                        <span>{t.label}</span>
                        <span className="font-mono">{t.raw.toFixed(1)}</span>
                      </div>
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${t.color}`} style={{ width: `${Math.min(100, Math.abs(t.raw) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Right: Radar */}
            <div className="h-full min-h-[120px] relative">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <Dna size={80} className="text-cyan-500 animate-pulse-slow" />
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 8 }} />
                  <Radar name="Agent" dataKey="A" stroke="#22d3ee" strokeWidth={1.5} fill="#22d3ee" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="block text-slate-500">Method</span>
              <span className="text-cyan-400 capitalize">{activeGenome.bornMethod}</span>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="block text-slate-500">Center Bias</span>
              <span className="text-purple-400">{activeGenome.weights.centerDev.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisPanel;

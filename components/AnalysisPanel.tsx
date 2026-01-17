
import React from 'react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
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

  const radarData = activeGenome ? [
    { subject: 'Speed', A: activeGenome.traits.reactionSpeed * 100, fullMark: 100 },
    { subject: 'Foresight', A: activeGenome.traits.foresight * 100, fullMark: 100 },
    { subject: 'Calm', A: (1 - activeGenome.traits.anxiety) * 100, fullMark: 100 },
  ] : [];

  const neuralNodes = activeGenome ? [
    { key: 'lines', label: 'Lines', weight: activeGenome.weights.lines, x: 18, y: 28 },
    { key: 'height', label: 'Height', weight: activeGenome.weights.height, x: 46, y: 16 },
    { key: 'holes', label: 'Holes', weight: activeGenome.weights.holes, x: 74, y: 30 },
    { key: 'wells', label: 'Wells', weight: activeGenome.weights.wells, x: 24, y: 68 },
    { key: 'rowTransitions', label: 'Row Un', weight: activeGenome.weights.rowTransitions, x: 50, y: 54 },
    { key: 'erodedCells', label: 'Burn', weight: activeGenome.weights.erodedCells, x: 76, y: 70 },
    { key: 'centerDev', label: 'Center', weight: activeGenome.weights.centerDev, x: 52, y: 86 },
  ] : [];
  const neuralLinks = [
    [0, 1],
    [1, 2],
    [0, 4],
    [1, 4],
    [2, 4],
    [3, 4],
    [4, 5],
    [4, 6],
  ];

  const getPersonality = (genome: Genome) => {
    const { weights, traits } = genome;
    const descriptors = [];
    if (weights.lines > 0.8) descriptors.push({ title: 'The Perfectionist', note: 'Obsessed with clean clears and elegant stacks.' });
    if (weights.holes < -0.9 || weights.rowTransitions < -0.8) descriptors.push({ title: 'The Sculptor', note: 'Carves away chaos, avoids messy wells.' });
    if (weights.wells < -0.8) descriptors.push({ title: 'The Risk Taker', note: 'Dives into wells for bold setups.' });
    if (weights.centerDev < -0.2) descriptors.push({ title: 'The Balancer', note: 'Keeps play centered and measured.' });
    if (traits.foresight > 0.75) descriptors.push({ title: 'The Strategist', note: 'Plans two steps ahead with patience.' });
    if (traits.anxiety > 0.7) descriptors.push({ title: 'The Sprinter', note: 'Prefers fast, decisive drops under pressure.' });
    if (descriptors.length === 0) {
      descriptors.push({ title: 'The Generalist', note: 'Adapts to the board without a fixed obsession.' });
    }
    return descriptors[0];
  };

  const personality = activeGenome ? getPersonality(activeGenome) : null;

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

          <div className="grid grid-cols-1 gap-4">
            <div className="neural-map">
              <svg className="neural-links" viewBox="0 0 100 100" preserveAspectRatio="none">
                {neuralLinks.map(([from, to]) => {
                  const start = neuralNodes[from];
                  const end = neuralNodes[to];
                  if (!start || !end) return null;
                  return (
                    <line
                      key={`${start.key}-${end.key}`}
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke="rgba(34, 211, 238, 0.35)"
                      strokeWidth="0.6"
                    />
                  );
                })}
              </svg>
              {neuralNodes.map((node, index) => {
                const intensity = Math.min(1, Math.abs(node.weight) / 3);
                return (
                  <div
                    key={node.key}
                    className="neural-node"
                    style={{
                      left: `${node.x}%`,
                      top: `${node.y}%`,
                      ['--intensity' as string]: intensity,
                      ['--pulse-delay' as string]: `${index * 0.2}s`,
                    }}
                    title={`${node.label}: ${node.weight.toFixed(2)}`}
                  >
                    <strong>{node.weight.toFixed(1)}</strong>
                    <span>{node.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="h-40 relative">
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

          <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-3 text-[10px]">
            <div className="text-[9px] uppercase tracking-widest text-slate-500">Competitor Bio</div>
            {personality && (
              <>
                <div className="mt-2 text-cyan-300 font-bold">{personality.title}</div>
                <div className="mt-1 text-slate-400">{personality.note}</div>
              </>
            )}
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

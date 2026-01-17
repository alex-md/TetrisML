
import React from 'react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { SimulationStats, Genome } from '../types';
import { 
  Brain, Zap, Users, Activity, Dna, TrendingUp, Layout, Target, Shield, 
  MousePointer2, AlertTriangle, Layers, Maximize2, Minimize2, AlignCenter,
  ArrowDownToLine, Eraser, Grip
} from 'lucide-react';

interface Props {
  stats: SimulationStats;
  fitnessHistory: { gen: number; fitness: number }[];
  topGenome?: Genome;
}

const StatsPanel: React.FC<Props> = ({ stats, fitnessHistory, topGenome }) => {
  
  const radarData = topGenome ? [
    { subject: 'Speed', A: topGenome.traits.reactionSpeed * 100, fullMark: 100 },
    { subject: 'Foresight', A: topGenome.traits.foresight * 100, fullMark: 100 },
    { subject: 'Calm', A: (1 - topGenome.traits.anxiety) * 100, fullMark: 100 },
  ] : [];

  // Grouping weights for clearer display
  const weightGroups = topGenome ? [
      {
          title: "Core Mechanics",
          items: [
              { key: 'lines', icon: Target, label: 'Clear Lines', raw: topGenome.weights.lines, color: 'bg-yellow-500' },
              { key: 'height', icon: Shield, label: 'Low Height', raw: Math.abs(topGenome.weights.height), color: 'bg-emerald-500' },
              { key: 'holes', icon: Layout, label: 'Avoid Holes', raw: Math.abs(topGenome.weights.holes), color: 'bg-indigo-500' },
              { key: 'bumpiness', icon: Activity, label: 'Smooth Surface', raw: Math.abs(topGenome.weights.bumpiness), color: 'bg-pink-500' },
          ]
      },
      {
          title: "Structure",
          items: [
              { key: 'wells', icon: ArrowDownToLine, label: 'Avoid Wells', raw: Math.abs(topGenome.weights.wells), color: 'bg-red-500' },
              { key: 'maxHeight', icon: Maximize2, label: 'Max Height', raw: Math.abs(topGenome.weights.maxHeight), color: 'bg-orange-500' },
              { key: 'rowTransitions', icon: AlignCenter, label: 'Row Unity', raw: Math.abs(topGenome.weights.rowTransitions), color: 'bg-blue-400' },
              { key: 'colTransitions', icon: AlignCenter, label: 'Col Unity', raw: Math.abs(topGenome.weights.colTransitions), color: 'bg-blue-600' },
          ]
      },
      {
          title: "Advanced",
          items: [
              { key: 'erodedCells', icon: Eraser, label: 'Burn Efficiency', raw: topGenome.weights.erodedCells, color: 'bg-purple-500' },
              { key: 'landingHeight', icon: Minimize2, label: 'Low Landing', raw: Math.abs(topGenome.weights.landingHeight), color: 'bg-teal-500' },
              { key: 'holeDepth', icon: Layers, label: 'Hole Depth', raw: Math.abs(topGenome.weights.holeDepth), color: 'bg-slate-400' },
              { key: 'blockades', icon: Grip, label: 'Blockades', raw: Math.abs(topGenome.weights.blockades), color: 'bg-zinc-500' },
          ]
      }
  ] : [];

  return (
    <div className="space-y-6">
      {/* 1. Core Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
            <Activity className="w-3 h-3" />
            <span>Generation</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.generation}</div>
        </div>
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
            <Users className="w-3 h-3" />
            <span>Alive</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.populationSize}</div>
        </div>
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
            <Zap className="w-3 h-3" />
            <span>Best Score</span>
          </div>
          <div className="text-2xl font-bold text-cyan-400">{Math.floor(stats.maxFitness)}</div>
        </div>
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col justify-between">
          <div className="flex items-center space-x-2 text-slate-400 text-xs mb-1">
            <Brain className="w-3 h-3" />
            <span>Diversity</span>
          </div>
          <div className={`text-2xl font-bold ${stats.diversity < 10 ? 'text-red-500 animate-pulse' : 'text-purple-400'}`}>
            {stats.diversity}%
          </div>
        </div>
      </div>

      {/* 2. Alpha Profile (The "Mind" of the Best Agent) */}
      {topGenome ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden relative shadow-lg">
          {/* Background Decor */}
          <div className="absolute -top-4 -right-4 text-slate-700/20 rotate-12 pointer-events-none">
             <Dna size={150} />
          </div>
          
          <div className="p-5 relative z-10">
            <div className="flex items-center justify-between mb-4">
               <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                     <span className="relative flex h-3 w-3">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                     </span>
                     Alpha Brain Map
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Analyzing Agent <span className="font-mono text-cyan-400">{topGenome.id.substring(0,6)}</span>
                  </p>
               </div>
               
               <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-700/50 rounded-full border border-slate-600">
                  <MousePointer2 size={12} className="text-slate-300" />
                  <span className="text-[10px] text-slate-300">Click to Control</span>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Weight Groups */}
                {weightGroups.map((group) => (
                    <div key={group.title} className="space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{group.title}</h4>
                        <div className="grid grid-cols-1 gap-2">
                            {group.items.map((t) => (
                                <div key={t.key} className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                                            <t.icon size={10} /> {t.label}
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-500">{t.raw.toFixed(2)}</span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full ${t.color}`} style={{ width: `${Math.min(100, Math.abs(t.raw) * 100)}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Radar Chart for Traits */}
            <div className="mt-6 h-32 relative border-t border-slate-700/50 pt-2">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider absolute top-2 left-0">Behavioral Matrix</h4>
                 <div className="absolute top-2 right-0 text-[10px] text-slate-500 flex flex-col items-end">
                     <span>Center Dev: {topGenome.weights.centerDev.toFixed(2)}</span>
                 </div>
                 <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                            name="Agent"
                            dataKey="A"
                            stroke="#22d3ee"
                            strokeWidth={2}
                            fill="#22d3ee"
                            fillOpacity={0.3}
                        />
                    </RadarChart>
                 </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-48 bg-slate-800/50 rounded-xl border border-slate-700 flex items-center justify-center text-slate-500">
           No generations loaded.
        </div>
      )}

      {/* 3. Evolution Graph */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 h-48 flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-500" />
              <span className="text-sm font-semibold text-white">Fitness History</span>
            </div>
            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">Last 50 Gens</span>
        </div>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fitnessHistory}>
              <defs>
                <linearGradient id="colorFit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="gen" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', fontSize: '12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                itemStyle={{ color: '#fff' }}
                labelStyle={{ display: 'none' }}
                formatter={(value) => [`${value}`, 'Max Score']}
              />
              <Area 
                type="monotone" 
                dataKey="fitness" 
                stroke="#06b6d4" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#colorFit)" 
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;

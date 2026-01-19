
import React from 'react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { SimulationStats, Genome } from '../types';
import { 
  Brain, Zap, Users, Activity, Dna, TrendingUp, MousePointer2
} from 'lucide-react';

interface Props {
  stats: SimulationStats;
  fitnessHistory: { gen: number; fitness: number }[];
  topGenome?: Genome;
}

const StatsPanel: React.FC<Props> = ({ stats, fitnessHistory, topGenome }) => {
  
  const signalEntries = topGenome
    ? Object.entries(topGenome.summary.sensitivities)
        .map(([key, value]) => ({ key, value: value as number }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 12)
    : [];

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
            <span>Best Fitness</span>
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
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top Sensitivities</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {signalEntries.map(entry => (
                      <div key={entry.key} className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest">{entry.key}</span>
                          <span className="text-[9px] font-mono text-slate-500">{entry.value.toFixed(2)}</span>
                        </div>
                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${entry.value >= 0 ? 'bg-cyan-400' : 'bg-rose-400'}`}
                            style={{ width: `${Math.min(100, Math.abs(entry.value) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </div>

            <div className="mt-6 h-20 relative border-t border-slate-700/50 pt-2">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider absolute top-2 left-0">Exploration Sigma</h4>
              <div className="absolute top-2 right-0 text-[10px] text-slate-500 flex flex-col items-end">
                <span>{topGenome.summary.exploration.toFixed(2)}</span>
              </div>
              <div className="mt-6 text-xs text-slate-400">Higher sigma = more exploration pressure in ES updates.</div>
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
                formatter={(value) => [`${value}`, 'Max Fitness']}
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

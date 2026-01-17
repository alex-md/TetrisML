import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AgentState, Genome, LeaderboardEntry, SimulationStats } from '../types';
import SimulationCanvas from '../components/SimulationCanvas';
import AnalysisPanel from '../components/AnalysisPanel';
import Leaderboard from '../components/Leaderboard';
import { BOARD_WIDTH } from '../constants';
import {
  Play,
  Pause,
  RefreshCw,
  Cpu,
  Terminal,
  Activity,
  Users,
  Zap,
  Layers
} from 'lucide-react';

interface SimulationPageProps {
  agents: AgentState[];
  stats: SimulationStats;
  fitnessHistory: { gen: number; fitness: number }[];
  leaderboard: LeaderboardEntry[];
  isPlaying: boolean;
  selectedAgentId: string | null;
  onTogglePlay: () => void;
  onReset: () => void;
  onAgentClick: (id: string) => void;
}

const SimulationPage: React.FC<SimulationPageProps> = ({
  agents,
  stats,
  fitnessHistory,
  leaderboard,
  isPlaying,
  selectedAgentId,
  onTogglePlay,
  onReset,
  onAgentClick
}) => {
  const arenaRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(6);
  const [genPulse, setGenPulse] = useState(false);

  const bestAgent = useMemo(() => {
    if (agents.length === 0) return null;
    return agents.reduce((prev, current) => (prev.score > current.score ? prev : current), agents[0]);
  }, [agents]);

  const selectedAgent = selectedAgentId ? agents.find(a => a.id === selectedAgentId) : null;
  const targetGenome: Genome | null = selectedAgent?.genome || null;

  useEffect(() => {
    setGenPulse(true);
    const timer = window.setTimeout(() => setGenPulse(false), 420);
    return () => window.clearTimeout(timer);
  }, [stats.generation]);

  useEffect(() => {
    if (!arenaRef.current) return;

    const CELL_SIZE = 8;
    const GAP = 16;
    const BOARD_PX_W = BOARD_WIDTH * CELL_SIZE;
    const cellWidth = BOARD_PX_W + GAP;

    const updateCols = () => {
      const width = arenaRef.current?.clientWidth || 0;
      if (!width) return;
      const nextCols = Math.max(2, Math.min(8, Math.floor((width - GAP) / cellWidth)));
      setCols(nextCols || 2);
    };

    updateCols();

    const resizeObserver = new ResizeObserver(() => updateCols());
    resizeObserver.observe(arenaRef.current);
    window.addEventListener('resize', updateCols);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCols);
    };
  }, []);

  return (
    <div className="h-full w-full flex flex-col gap-4 overflow-hidden text-slate-200">
      <div className="h-[64px] glass-panel rounded-2xl px-5 flex items-center justify-between nav-glow">
        <div className="flex items-center gap-3">
          <Terminal size={18} className="text-cyan-300" />
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Session</div>
            <h2 className="text-lg font-bold text-white">TetrisML / Arena</h2>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Live Evolution
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Cpu size={14} />
            <span className="font-mono">Gen {stats.generation}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
        <aside className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1 order-2 lg:order-1">
          <div className="glass-panel rounded-2xl p-4 neon-glow border-l-4 border-l-cyan-500">
            <h1 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-2">
              <Terminal size={20} className="text-cyan-400" />
              Tetris ML
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] font-mono text-cyan-300 tracking-widest uppercase">
                System Online
              </span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-3 grid grid-cols-2 gap-2">
            <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
              <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1">
                <Layers size={10} /> GEN
              </div>
              <div className="text-xl font-mono text-white leading-none mt-1">{stats.generation}</div>
            </div>
            <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
              <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1">
                <Users size={10} /> POP
              </div>
              <div className="text-xl font-mono text-white leading-none mt-1">{stats.populationSize}</div>
            </div>
            <div className="bg-slate-900/50 p-2 rounded border border-slate-800 col-span-2">
              <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1">
                <Zap size={10} /> MAX FITNESS
              </div>
              <div className="text-xl font-mono text-cyan-400 leading-none mt-1">{Math.floor(stats.maxFitness)}</div>
            </div>
            <div className="bg-slate-900/50 p-2 rounded border border-slate-800 col-span-2">
              <div className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1">
                <Activity size={10} /> DIVERSITY
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${stats.diversity < 10 ? 'bg-red-500' : 'bg-purple-500'}`}
                    style={{ width: `${stats.diversity}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-mono ${stats.diversity < 10 ? 'text-red-500 animate-pulse' : 'text-purple-400'}`}
                >
                  {stats.diversity}%
                </span>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-3 flex-1 min-h-0 flex flex-col">
            <Leaderboard entries={leaderboard} />
          </div>

          <div className="glass-panel rounded-2xl p-3 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={onTogglePlay}
                className={`flex-1 py-2 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all ${isPlaying ? 'bg-amber-500/10 text-amber-500 border border-amber-500/50 hover:bg-amber-500/20' : 'bg-green-500 text-black hover:bg-green-400'}`}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {isPlaying ? 'HALT' : 'RUN'}
              </button>
              <button
                onClick={onReset}
                className="w-10 flex items-center justify-center rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-900"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col gap-4 min-w-0 relative order-1 lg:order-2" ref={arenaRef}>
          <div className={`h-10 glass-panel rounded-lg flex items-center px-4 justify-between ${genPulse ? 'gen-pulse' : ''}`}>
            <div className="flex items-center gap-3">
              <Cpu size={14} className="text-slate-500" />
              <span className="text-xs font-mono text-slate-300">
                STATUS: <span className="text-cyan-400">{stats.stage.toUpperCase()}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${stats.diversity < 10 ? 'bg-red-500' : 'bg-green-500'}`}></div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                {stats.diversity < 10 ? 'GENE POOL CRITICAL' : 'OPTIMAL'}
              </span>
            </div>
          </div>

          <div className="flex-1 glass-panel rounded-2xl relative overflow-hidden flex flex-col p-1 arena-surface">
            <div className="absolute inset-0 pointer-events-none z-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-transparent to-transparent"></div>
            <SimulationCanvas
              agents={agents}
              cols={cols}
              onAgentClick={onAgentClick}
            />
            {selectedAgentId && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 border border-slate-600 text-slate-300 px-4 py-1.5 rounded-full backdrop-blur-md text-[10px] uppercase tracking-wider">
                Specimen {selectedAgentId.substring(0, 4)} Selected
              </div>
            )}
          </div>
        </main>

        <aside className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1 order-3">
          <div className="glass-panel rounded-2xl p-4 flex-1 neon-glow border-r-4 border-r-purple-500">
            <AnalysisPanel
              stats={stats}
              fitnessHistory={fitnessHistory}
              selectedGenome={targetGenome}
              bestGenome={bestAgent?.genome}
            />
          </div>

          <div className="glass-panel rounded-2xl p-4 h-32 text-[10px] text-slate-400 font-mono leading-relaxed overflow-y-auto">
            <div className="mb-1 text-slate-500 font-bold uppercase border-b border-slate-700/50 pb-1">System Log</div>
            <p>Initializing neural evolution engine...</p>
            {stats.generation > 1 && <p>{'>'} Generation {stats.generation - 1} complete. Optimization routine finished.</p>}
            {stats.diversity < 10 && <p className="text-red-400">{'>'} WARNING: Genetic diversity low. Mass extinction event imminent to prevent local minima stagnation.</p>}
            {selectedAgentId && <p className="text-cyan-400">{'>'} Analysing neural weights for specimen {selectedAgentId.substring(0, 4)}...</p>}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SimulationPage;

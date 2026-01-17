import React from 'react';
import { LineageNode, SimulationStats } from '../types';
import { Network, GitMerge } from 'lucide-react';
import LineageTree from '../components/LineageTree';

interface LineagePageProps {
  lineage: LineageNode[][];
  stats: SimulationStats;
}

const LineagePage: React.FC<LineagePageProps> = ({ lineage, stats }) => {
  return (
    <div className="h-full w-full flex flex-col gap-4">
      <header className="glass-panel rounded-2xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Network size={20} className="text-cyan-300" />
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Lineage</div>
            <div className="text-lg font-bold text-white">Evolution Graph</div>
          </div>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <GitMerge size={14} />
          <span>Gen {stats.generation} • tracking {lineage.length}</span>
        </div>
      </header>

      <div className="flex-1 glass-panel rounded-2xl p-4 overflow-hidden">
        <LineageTree history={lineage} />
      </div>
    </div>
  );
};

export default LineagePage;

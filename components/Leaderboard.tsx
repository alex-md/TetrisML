
import React from 'react';
import { LeaderboardEntry } from '../types';
import { Trophy, Crown } from 'lucide-react';

interface Props {
  entries: LeaderboardEntry[];
}

const Leaderboard: React.FC<Props> = ({ entries }) => {
  // Only top 5 for compact view
  const topEntries = entries.slice(0, 5);

  return (
    <div className="flex flex-col h-full">
       <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <Trophy size={12} className="text-amber-500" />
          <span>Top Performers</span>
       </div>
       
       <div className="flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
           {topEntries.length === 0 ? (
               <div className="text-[10px] text-slate-600 italic p-2">Collecting data...</div>
           ) : (
               topEntries.map((entry, idx) => (
                   <div key={`${entry.id}-${entry.timestamp}`} className="group flex items-center justify-between p-2 rounded bg-slate-900/50 border border-slate-800/50 hover:border-slate-700 transition-all">
                       <div className="flex items-center gap-2">
                           <div className={`w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded ${idx === 0 ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
                               {idx + 1}
                           </div>
                           <div className="flex flex-col">
                               <span className="text-[10px] font-mono text-cyan-500">{entry.id.substring(0,6)}</span>
                               <span className="text-[9px] text-slate-500">Gen {entry.generation}</span>
                           </div>
                       </div>
                       <div className="text-right">
                           <div className="text-[10px] font-bold text-slate-200">{entry.score.toLocaleString()}</div>
                           <div className="text-[9px] text-slate-600">{entry.bornMethod}</div>
                       </div>
                   </div>
               ))
           )}
       </div>
    </div>
  );
};

export default Leaderboard;

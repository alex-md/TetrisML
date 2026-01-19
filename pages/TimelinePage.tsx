import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GenerationSnapshot, SimulationStats, TelemetryFrame } from '../types';
import { BOARD_HEIGHT, BOARD_WIDTH, getBlockColor } from '../constants';
import { CalendarRange, History, Clock, Sparkles } from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

interface TimelinePageProps {
  stats: SimulationStats;
  fitnessHistory: { gen: number; fitness: number }[];
  snapshots: GenerationSnapshot[];
  telemetryHistory: TelemetryFrame[];
}

const TimelinePage: React.FC<TimelinePageProps> = ({ stats, fitnessHistory, snapshots, telemetryHistory }) => {
  const recent = [...fitnessHistory].slice(-8).reverse();
  const [index, setIndex] = useState(Math.max(0, snapshots.length - 1));

  useEffect(() => {
    setIndex(Math.max(0, snapshots.length - 1));
  }, [snapshots.length]);

  const snapshot = snapshots[index];

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fitnessSeries = useMemo(() => {
    return fitnessHistory.map(entry => ({
      gen: entry.gen,
      fitness: Math.round(entry.fitness)
    }));
  }, [fitnessHistory]);

  const telemetrySeries = useMemo(() => {
    return telemetryHistory.map(entry => ({
      gen: entry.generation,
      avgScore: Math.round(Number.isFinite(entry.avgScore) ? entry.avgScore : 0),
      avgLines: Number((Number.isFinite(entry.avgLines) ? entry.avgLines : 0).toFixed(1))
    }));
  }, [telemetryHistory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CELL = 10;
    const width = BOARD_WIDTH * CELL;
    const height = BOARD_HEIGHT * CELL;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    snapshot.grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell !== 0) {
          ctx.fillStyle = getBlockColor(cell);
          ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      });
    });

    if (snapshot.currentPiece) {
      const { shape, x, y, color } = snapshot.currentPiece;
      ctx.fillStyle = getBlockColor(color);
      shape.forEach((r, dy) => {
        r.forEach((c, dx) => {
          if (c !== 0 && y + dy >= 0) {
            ctx.fillRect((x + dx) * CELL, (y + dy) * CELL, CELL - 1, CELL - 1);
          }
        });
      });
    }
  }, [snapshot]);

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <header className="glass-panel rounded-2xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History size={20} className="text-cyan-300" />
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Timeline</div>
            <div className="text-lg font-bold text-white">Evolution Playback</div>
          </div>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Clock size={14} />
          <span>Current Gen {stats.generation}</span>
        </div>
      </header>

      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Generation Scrub</div>
          <CalendarRange size={16} className="text-slate-400" />
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(0, snapshots.length - 1)}
          value={index}
          onChange={(e) => setIndex(parseInt(e.target.value, 10))}
          className="w-full accent-cyan-400"
          disabled={snapshots.length === 0}
        />
        <div className="text-xs text-slate-500 mt-2">
          {snapshot ? `Viewing generation ${snapshot.generation}` : 'No snapshots loaded.'}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <section className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Fitness Timeline</div>
            <Sparkles size={16} className="text-cyan-300" />
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fitnessSeries}>
                <XAxis dataKey="gen" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="fitness" stroke="#e2e8f0" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetrySeries}>
                <XAxis dataKey="gen" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="avgScore" stroke="#94a3b8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="avgLines" stroke="#64748b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {recent.length === 0 && (
              <div className="text-sm text-slate-500">No fitness history loaded.</div>
            )}
            {recent.map(entry => (
              <div key={entry.gen} className="flex items-center justify-between text-sm bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2">
                <span className="text-slate-300">Generation {entry.gen}</span>
                <span className="font-mono text-cyan-300">{Math.round(entry.fitness)}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Snapshot Preview</div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-center justify-center">
            {snapshot ? (
              <canvas ref={canvasRef} className="rounded-md shadow-[0_0_18px_rgba(56,189,248,0.25)]" />
            ) : (
              <div className="text-xs text-slate-500">No snapshot selected.</div>
            )}
          </div>
          {snapshot && (
            <div className="text-xs text-slate-400 space-y-2">
              <div>Specimen {snapshot.agentId.slice(0, 4)}</div>
              <div>Score {snapshot.score.toLocaleString()}</div>
              <div>Lines {snapshot.lines}</div>
            </div>
          )}
          <div className="divider-line" />
          <div className="text-xs text-slate-500">
            Scrub to replay the best-per-gen board state without interrupting the live simulation.
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TimelinePage;

import React, { useEffect, useMemo, useRef } from 'react';
import { Genome, LineageNode, SimulationStats } from '../types';
import { Brain, Sparkles } from 'lucide-react';

interface NeuralMapPageProps {
  selectedGenome: Genome | null;
  bestGenome: Genome | null;
  stats: SimulationStats;
  lineageHistory: LineageNode[][];
}

interface NeuralNode {
  label: string;
  value: number;
  x: number;
  y: number;
}

const NeuralMapPage: React.FC<NeuralMapPageProps> = ({ selectedGenome, bestGenome, stats, lineageHistory }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = selectedGenome || bestGenome;
  const latestLineage = lineageHistory[lineageHistory.length - 1] || [];
  const lineageNode = target ? latestLineage.find(node => node.id === target.id) : undefined;

  const nodes = useMemo<NeuralNode[]>(() => {
    if (!target) return [];
    const entries = Object.entries(target.weights);
    const radius = 180;
    return entries.map(([label, value], index) => {
      const angle = (index / entries.length) * Math.PI * 2;
      return {
        label,
        value,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      };
    });
  }, [target]);

  const influences = useMemo(() => {
    if (!target || !lineageNode) return [];
    const metrics = lineageNode.metrics;
    const weights = target.weights;
    const pairs = [
      { key: 'holes', weight: weights.holes, metric: metrics.holes },
      { key: 'bumpiness', weight: weights.bumpiness, metric: metrics.bumpiness },
      { key: 'maxHeight', weight: weights.maxHeight, metric: metrics.maxHeight },
      { key: 'rowTransitions', weight: weights.rowTransitions, metric: metrics.rowTransitions },
      { key: 'colTransitions', weight: weights.colTransitions, metric: metrics.colTransitions },
      { key: 'wells', weight: weights.wells, metric: metrics.wells },
      { key: 'holeDepth', weight: weights.holeDepth, metric: metrics.holeDepth },
      { key: 'blockades', weight: weights.blockades, metric: metrics.blockades },
      { key: 'landingHeight', weight: weights.landingHeight, metric: metrics.maxHeight },
      { key: 'erodedCells', weight: weights.erodedCells, metric: metrics.completeLines },
      { key: 'centerDev', weight: weights.centerDev, metric: metrics.bumpiness }
    ];
    return pairs
      .map(pair => ({
        key: pair.key,
        weight: pair.weight,
        metric: pair.metric,
        influence: pair.weight * pair.metric
      }))
      .sort((a, b) => Math.abs(b.influence) - Math.abs(a.influence));
  }, [target, lineageNode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const handleResize = () => resize();
    window.addEventListener('resize', handleResize);

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2, height / 2);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      nodes.forEach(node => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
      });

      nodes.forEach((node, index) => {
        const pulse = Math.sin(time / 600 + index) * 0.5 + 0.5;
        const magnitude = Math.min(1, Math.abs(node.value) / 10);
        const radius = 6 + magnitude * 10 + pulse * 3 + (stats.generation % 6);

        ctx.beginPath();
        ctx.fillStyle = node.value >= 0 ? `rgba(56, 189, 248, ${0.4 + magnitude})` : `rgba(248, 113, 113, ${0.4 + magnitude})`;
        ctx.shadowColor = node.value >= 0 ? 'rgba(56, 189, 248, 0.8)' : 'rgba(248, 113, 113, 0.7)';
        ctx.shadowBlur = 12 + pulse * 6;
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
        ctx.font = '10px "Geist Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.label.toUpperCase(), node.x, node.y - radius - 8);
      });

      ctx.beginPath();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
      ctx.shadowBlur = 20;
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    };

    frame = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frame);
    };
  }, [nodes, stats.generation]);

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <header className="glass-panel rounded-2xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain size={20} className="text-cyan-300" />
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Neural Map</div>
            <div className="text-lg font-bold text-white">Synaptic Weight Topology</div>
          </div>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Sparkles size={14} />
          <span>{selectedGenome ? `Specimen ${selectedGenome.id.slice(0, 4)}` : 'Best Current Genome'}</span>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <section className="glass-panel rounded-2xl relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none neural-grid" />
          <canvas ref={canvasRef} className="w-full h-full" />
        </section>

        <aside className="glass-panel rounded-2xl p-5 flex flex-col gap-4 text-sm text-slate-200">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Signal Summary</div>
            <p className="mt-2 text-slate-300 leading-relaxed">
              Pulses are driven by live genome weights. Positive heuristics glow cyan, negative heuristics burn red.
              Each node breathes on generation changes to visualize adaptation pressure.
            </p>
          </div>

          <div className="space-y-3">
            {(target ? Object.entries(target.weights) : []).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{key}</div>
                <div className={`text-sm font-mono ${(value as number) >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                </div>
              </div>
            ))}
          </div>

          {!target && (
            <div className="text-xs text-slate-500">
              No genome loaded.
            </div>
          )}

          {influences.length > 0 && (
            <>
              <div className="divider-line" />
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Dominant Pressures</div>
              <div className="space-y-2 text-xs text-slate-400">
                {influences.slice(0, 6).map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="uppercase tracking-widest text-[10px]">{item.key}</span>
                    <span className={`font-mono ${item.influence >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                      {item.influence.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default NeuralMapPage;

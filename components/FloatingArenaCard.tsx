import React, { useEffect, useRef, useState } from 'react';
import { AgentState } from '../types';
import { BOARD_HEIGHT, BOARD_WIDTH, getBlockColor } from '../constants';
import { Trophy, Grip, Minimize2, Maximize2 } from 'lucide-react';

interface FloatingArenaCardProps {
  agent: AgentState | null;
  hidden?: boolean;
}

const FloatingArenaCard: React.FC<FloatingArenaCardProps> = ({ agent, hidden }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [pinnedCorner, setPinnedCorner] = useState<'br' | 'bl' | 'tr' | 'tl'>('br');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !agent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CELL = 6;
    const width = BOARD_WIDTH * CELL;
    const height = BOARD_HEIGHT * CELL;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    agent.grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell !== 0) {
          ctx.fillStyle = getBlockColor(cell);
          ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      });
    });

    if (agent.currentPiece) {
      const { shape, x, y, color } = agent.currentPiece;
      ctx.fillStyle = getBlockColor(color);
      shape.forEach((r, dy) => {
        r.forEach((c, dx) => {
          if (c !== 0 && y + dy >= 0) {
            ctx.fillRect((x + dx) * CELL, (y + dy) * CELL, CELL - 1, CELL - 1);
          }
        });
      });
    }
  }, [agent]);

  useEffect(() => {
    if (!position) return;
    const handleResize = () => setPosition(null);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  if (hidden) return null;

  const startDrag = (event: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    dragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setIsDragging(true);
  };

  const onDrag = (event: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: event.clientX - dragOffsetRef.current.x,
      y: event.clientY - dragOffsetRef.current.y
    });
  };

  const stopDrag = () => {
    if (isDragging) setIsDragging(false);
  };

  const handlePin = () => {
    const next = pinnedCorner === 'br' ? 'bl' : pinnedCorner === 'bl' ? 'tr' : pinnedCorner === 'tr' ? 'tl' : 'br';
    setPinnedCorner(next);
    setPosition(null);
  };

  const positionStyle = position
    ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : {};

  return (
    <div
      ref={cardRef}
      className={`floating-card glass-panel rounded-2xl p-3 ${pinnedCorner}`}
      style={positionStyle}
      onMouseMove={onDrag}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Trophy size={14} className="text-amber-300" />
          Top Performer
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <button className="floating-icon" onClick={() => setIsCollapsed(prev => !prev)} type="button">
            {isCollapsed ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
          <button className="floating-icon" onClick={handlePin} type="button" title="Cycle corner pin">
            <Grip size={12} />
          </button>
        </div>
      </div>
      {!isCollapsed && (
        agent ? (
          <div className="flex gap-3 cursor-grab" onMouseDown={startDrag}>
            <canvas ref={canvasRef} className="rounded-md border border-slate-800 bg-slate-900/80" />
            <div className="flex flex-col justify-between text-xs text-slate-400">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Specimen</div>
                <div className="text-sm text-white font-semibold">{agent.id.slice(0, 4)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Score</div>
                <div className="text-sm text-cyan-300 font-mono">{agent.score.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Lines</div>
                <div className="text-sm text-slate-200">{agent.lines}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500">No live agent.</div>
        )
      )}
    </div>
  );
};

export default FloatingArenaCard;

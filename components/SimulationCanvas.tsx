
import React, { useRef, useEffect } from 'react';
import { AgentState, GhostSnapshot } from '../types';
import { BOARD_WIDTH, BOARD_HEIGHT, getBlockColor } from '../constants';

interface Props {
  agents: AgentState[];
  controlledAgentId: string | null;
  onAgentClick: (id: string) => void;
  ghostSnapshot?: GhostSnapshot | null;
  showGhost?: boolean;
  showHeatmap?: boolean;
  cols?: number;
}

const SimulationCanvas: React.FC<Props> = ({
  agents,
  controlledAgentId,
  onAgentClick,
  ghostSnapshot,
  showGhost = false,
  showHeatmap = false,
  cols = 4
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Find best agent ID
  const bestAgent = agents.reduce((prev, curr) => (prev.score > curr.score) ? prev : curr, agents[0]);
  const bestAgentId = bestAgent ? bestAgent.id : null;

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const CELL_SIZE = 8; // Must match draw size
    const GAP = 16;      // Increased gap for cleaner look
    const BOARD_PX_W = BOARD_WIDTH * CELL_SIZE;
    const BOARD_PX_H = BOARD_HEIGHT * CELL_SIZE;
    const cellWidth = BOARD_PX_W + GAP;
    const cellHeight = BOARD_PX_H + GAP;

    const col = Math.floor((x - GAP/2) / cellWidth);
    const row = Math.floor((y - GAP/2) / cellHeight);
    
    // Check approximate bounds
    const index = row * cols + col;
    if (index >= 0 && index < agents.length) {
        onAgentClick(agents[index].id);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CELL_SIZE = 8;
    const GAP = 16;
    const BOARD_PX_W = BOARD_WIDTH * CELL_SIZE;
    const BOARD_PX_H = BOARD_HEIGHT * CELL_SIZE;
    
    const rows = Math.ceil(agents.length / cols);
    const width = cols * (BOARD_PX_W + GAP) + GAP;
    const height = rows * (BOARD_PX_H + GAP) + GAP;

    canvas.width = width;
    canvas.height = height;

    // Clear with transparency
    ctx.clearRect(0, 0, width, height);

    agents.forEach((agent, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const offsetX = GAP + col * (BOARD_PX_W + GAP);
      const offsetY = GAP + row * (BOARD_PX_H + GAP);

      const isBest = agent.id === bestAgentId;
      const isControlled = agent.id === controlledAgentId;

      if (isBest) {
        ctx.save();
        ctx.shadowColor = 'rgba(251, 191, 36, 0.45)';
        ctx.shadowBlur = 16;
        ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
        ctx.fillRect(offsetX - 6, offsetY - 18, BOARD_PX_W + 12, BOARD_PX_H + 34);
        ctx.restore();
      }

      // --- Draw Container Background ---
      ctx.fillStyle = '#0f172a'; // Deep slate
      ctx.fillRect(offsetX - 2, offsetY - 14, BOARD_PX_W + 4, BOARD_PX_H + 26);
      
      // --- Selection Borders ---
      if (isControlled) {
        ctx.strokeStyle = '#22c55e'; // Green
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX - 3, offsetY - 15, BOARD_PX_W + 6, BOARD_PX_H + 28);
      } else if (isBest) {
        ctx.strokeStyle = '#f59e0b'; // Amber
        ctx.lineWidth = 1;
        ctx.strokeRect(offsetX - 3, offsetY - 15, BOARD_PX_W + 6, BOARD_PX_H + 28);
      } else {
        ctx.strokeStyle = '#334155'; // Slate border
        ctx.lineWidth = 1;
        ctx.strokeRect(offsetX - 2, offsetY - 14, BOARD_PX_W + 4, BOARD_PX_H + 26);
      }

      // --- Draw Board Field ---
      ctx.fillStyle = '#020617'; // Almost black
      ctx.fillRect(offsetX, offsetY, BOARD_PX_W, BOARD_PX_H);

      if (showGhost && ghostSnapshot) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ghostSnapshot.grid.forEach((r, y) => {
          r.forEach((c, x) => {
            if (c !== 0) {
              ctx.fillStyle = '#38bdf8';
              ctx.fillRect(
                offsetX + x * CELL_SIZE,
                offsetY + y * CELL_SIZE,
                CELL_SIZE - 1,
                CELL_SIZE - 1
              );
            }
          });
        });
        if (ghostSnapshot.currentPiece) {
          ctx.globalAlpha = 0.25;
          const { shape, x: px, y: py } = ghostSnapshot.currentPiece;
          ctx.fillStyle = '#a855f7';
          shape.forEach((r, y) => {
            r.forEach((c, x) => {
              if (c !== 0 && py + y >= 0) {
                ctx.fillRect(
                  offsetX + (px + x) * CELL_SIZE,
                  offsetY + (py + y) * CELL_SIZE,
                  CELL_SIZE - 1,
                  CELL_SIZE - 1
                );
              }
            });
          });
        }
        ctx.restore();
      }

      // Dead State Overlay
      if (!agent.isAlive) {
         ctx.globalAlpha = 0.3;
      }

      // --- Draw Static Blocks ---
      agent.grid.forEach((r, y) => {
        r.forEach((c, x) => {
          if (c !== 0) {
            ctx.fillStyle = getBlockColor(c);
            ctx.fillRect(
              offsetX + x * CELL_SIZE, 
              offsetY + y * CELL_SIZE, 
              CELL_SIZE - 1, 
              CELL_SIZE - 1
            );
          }
        });
      });

      // --- Draw Active Piece ---
      if (agent.isAlive && agent.currentPiece) {
        const { shape, x: px, y: py, color } = agent.currentPiece;
        ctx.fillStyle = getBlockColor(color);
        shape.forEach((r, y) => {
          r.forEach((c, x) => {
            if (c !== 0 && py + y >= 0) {
               ctx.fillRect(
                offsetX + (px + x) * CELL_SIZE,
                offsetY + (py + y) * CELL_SIZE,
                CELL_SIZE - 1,
                CELL_SIZE - 1
              );
            }
          });
        });
      }

      ctx.globalAlpha = 1.0;

      if (showHeatmap && agent.telemetry) {
        const expected = agent.telemetry.expectedHeatmap;
        const actual = agent.telemetry.actualHeatmap;
        let maxExpected = 0;
        let maxActual = 0;
        expected.forEach(row => row.forEach(val => { if (val > maxExpected) maxExpected = val; }));
        actual.forEach(row => row.forEach(val => { if (val > maxActual) maxActual = val; }));

        for (let y = 0; y < expected.length; y++) {
          for (let x = 0; x < expected[y].length; x++) {
            const expectedIntensity = maxExpected > 0 ? expected[y][x] / maxExpected : 0;
            const actualIntensity = maxActual > 0 ? actual[y][x] / maxActual : 0;
            if (expectedIntensity > 0) {
              ctx.fillStyle = `rgba(56, 189, 248, ${expectedIntensity * 0.35})`;
              ctx.fillRect(
                offsetX + x * CELL_SIZE,
                offsetY + y * CELL_SIZE,
                CELL_SIZE - 1,
                CELL_SIZE - 1
              );
            }
            if (actualIntensity > 0) {
              ctx.fillStyle = `rgba(248, 113, 113, ${actualIntensity * 0.35})`;
              ctx.fillRect(
                offsetX + x * CELL_SIZE,
                offsetY + y * CELL_SIZE,
                CELL_SIZE - 1,
                CELL_SIZE - 1
              );
            }
          }
        }
      }

      // --- Meta Data Text ---
      ctx.textAlign = 'left';
      ctx.font = 'bold 9px monospace';
      
      // ID Label
      if (isControlled) ctx.fillStyle = '#22c55e';
      else if (isBest) ctx.fillStyle = '#f59e0b';
      else ctx.fillStyle = '#64748b';
      
      ctx.fillText(agent.id.slice(0,4), offsetX, offsetY - 4);
      
      // Score Label
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(agent.score.toLocaleString(), offsetX + BOARD_PX_W, offsetY - 4);

      // Status Bar (Alive/Dead)
      if (!agent.isAlive) {
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(offsetX, offsetY + BOARD_PX_H + 4, BOARD_PX_W, 2);
      } else {
          // Progress bar based on level? Just generic active indicator
          ctx.fillStyle = isControlled ? '#22c55e' : (isBest ? '#f59e0b' : '#3b82f6');
          ctx.fillRect(offsetX, offsetY + BOARD_PX_H + 4, BOARD_PX_W * (Math.min(1, agent.lines / 50)), 2);
      }

    });

  }, [agents, cols, bestAgentId, controlledAgentId, ghostSnapshot, showGhost, showHeatmap]);

  return (
    <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
        <canvas ref={canvasRef} className="cursor-pointer" onClick={handleCanvasClick} />
    </div>
  );
};

export default SimulationCanvas;

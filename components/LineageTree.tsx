import React, { useEffect, useRef, useState } from 'react';
import { LineageNode } from '../types';
import { GitBranch, Crown, Zap, Dna, ArrowDown, HelpCircle, Star } from 'lucide-react';

interface Props {
    history: LineageNode[][];
}

const LineageTree: React.FC<Props> = ({ history }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [hoveredNode, setHoveredNode] = useState<LineageNode | null>(null);

    if (!history || history.length === 0) return (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 bg-slate-800/50 rounded-lg">
            <Dna size={48} className="mb-2 opacity-50" />
            <p>No lineage frames loaded.</p>
        </div>
    );

    // Layout Config
    const NODE_RADIUS = 12;
    const ROW_HEIGHT = 80;
    const X_GAP = 50;
    const PADDING = 40;

    // Since population is constant (12), we can just hardcode width
    const width = (12 * X_GAP) + (PADDING * 2);
    const height = (history.length * ROW_HEIGHT) + PADDING;

    // Determine positions
    // Map: [GenerationIndex][AgentIndex] -> {x, y, node}
    const nodes = history.map((gen, rowIdx) => {
        const sortedGen = [...gen].sort((a, b) => b.fitness - a.fitness);

        return sortedGen.map((node, colIdx) => ({
            x: PADDING + (colIdx * X_GAP),
            y: PADDING + (rowIdx * ROW_HEIGHT),
            node
        }));
    });

    // Generate Links
    const links: React.ReactNode[] = [];

    // We need a lookup for the previous generation to find parent positions
    const nodeLookup = new Map<string, { x: number, y: number }>();

    nodes.forEach(row => {
        row.forEach(n => {
            nodeLookup.set(n.node.id, { x: n.x, y: n.y });
        });
    });

    nodes.forEach((row, rowIdx) => {
        row.forEach(target => {
            if (target.node.parents) {
                target.node.parents.forEach(parentId => {
                    const sourcePos = nodeLookup.get(parentId);
                    // Only draw if parent is in the visible history window
                    if (sourcePos) {
                        // Curved line
                        const isElite = target.node.bornMethod === 'elite';
                        const isGodChild = target.node.bornMethod === 'god-child';

                        let color = '#475569';
                        let strokeWidth = 1;
                        let opacity = 0.4;

                        if (isElite) {
                            color = '#fbbf24';
                            strokeWidth = 2;
                            opacity = 0.8;
                        } else if (isGodChild) {
                            color = '#a855f7'; // Purple
                            strokeWidth = 2;
                            opacity = 0.8;
                        }

                        const path = `M ${sourcePos.x} ${sourcePos.y + NODE_RADIUS} 
                                    C ${sourcePos.x} ${sourcePos.y + ROW_HEIGHT / 2}, 
                                      ${target.x} ${target.y - ROW_HEIGHT / 2}, 
                                      ${target.x} ${target.y - NODE_RADIUS}`;

                        links.push(
                            <path
                                key={`${parentId}-${target.node.id}`}
                                d={path}
                                fill="none"
                                stroke={color}
                                strokeWidth={strokeWidth}
                                opacity={opacity}
                            />
                        );
                    }
                });
            }
        });
    });

    return (
        <div className="overflow-x-auto overflow-y-hidden bg-slate-900 rounded-xl border border-slate-700 relative">
            <svg
                ref={svgRef}
                width={width}
                height={height}
                className="block min-w-full"
            >
                {/* Draw Links First */}
                {links}

                {/* Draw Nodes */}
                {nodes.map((row, i) => (
                    <g key={i}>
                        {/* Gen Label */}
                        <text x={10} y={row[0].y + 5} fill="#64748b" fontSize="10" fontWeight="bold" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                            Gen {row[0].node.generation}
                        </text>

                        {row.map((n) => {
                            let fillColor = '#1e293b';
                            let strokeColor = '#475569';
                            let Icon = HelpCircle;

                            if (n.node.bornMethod === 'elite') {
                                strokeColor = '#fbbf24';
                                fillColor = '#451a03';
                                Icon = Crown;
                            } else if (n.node.bornMethod === 'es-sample') {
                                strokeColor = '#22d3ee'; // Cyan
                                Icon = Zap;
                            } else if (n.node.bornMethod === 'seed') {
                                strokeColor = '#94a3b8'; // Slate
                                Icon = Dna;
                            } else if (n.node.bornMethod === 'imported') {
                                strokeColor = '#a855f7'; // Purple
                                Icon = Star;
                            } else {
                                strokeColor = '#475569';
                                Icon = HelpCircle;
                            }

                            return (
                                <g
                                    key={n.node.id}
                                    onMouseEnter={() => setHoveredNode(n.node)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    className="cursor-pointer transition-transform hover:scale-110"
                                >
                                    <circle
                                        cx={n.x}
                                        cy={n.y}
                                        r={NODE_RADIUS}
                                        fill={fillColor}
                                        stroke={strokeColor}
                                        strokeWidth={2}
                                    />
                                    {n.node.bornMethod === 'elite' && (
                                        <circle cx={n.x} cy={n.y} r={3} fill="#fbbf24" />
                                    )}
                                </g>
                            );
                        })}
                    </g>
                ))}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredNode && (
                <div className="absolute top-4 right-4 bg-slate-800 p-4 rounded-lg border border-slate-600 shadow-xl z-20 w-52 pointer-events-none">
                    <div className="flex items-center gap-2 mb-2 border-b border-slate-700 pb-2">
                        <span className={`w-2 h-2 rounded-full ${hoveredNode.bornMethod === 'elite' ? 'bg-amber-400' :
                            hoveredNode.bornMethod === 'es-sample' ? 'bg-cyan-400' :
                                hoveredNode.bornMethod === 'seed' ? 'bg-slate-400' :
                                    'bg-purple-400'
                            }`} />
                        <span className="font-bold text-white uppercase text-[10px] tracking-wider">{hoveredNode.bornMethod}</span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-300">
                        <div className="flex justify-between">
                            <span>ID:</span>
                            <span className="font-mono text-slate-400">{hoveredNode.id.substring(0, 6)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Fitness:</span>
                            <span className="font-mono text-cyan-400">{hoveredNode.fitness.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Score:</span>
                            <span className="font-mono text-emerald-400">{Math.floor(hoveredNode.score)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
                            <span>Throughput:</span>
                            <span className="font-mono text-amber-400">{(hoveredNode.metrics.throughput ?? 0).toFixed(2)} p/s</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Efficiency:</span>
                            <span className="font-mono text-purple-400">{(hoveredNode.metrics.efficiency ?? 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
                            <span>Lineage:</span>
                            <span className="font-mono text-slate-500">{hoveredNode.parents.length > 0 ? 'Connected' : 'Origin'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-2 left-2 flex gap-3 text-[10px] bg-slate-900/80 p-2 rounded border border-slate-700">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-900 border border-amber-400"></span> Elite</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-900 border border-cyan-400"></span> ES Sample</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-800 border border-slate-400"></span> Seed</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-900 border border-purple-500"></span> Imported</div>
            </div>
        </div>
    );
};

export default LineageTree;

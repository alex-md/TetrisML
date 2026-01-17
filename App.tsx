
import React, { useEffect, useRef, useState } from 'react';
import { AgentState, SimulationStats, LeaderboardEntry, GhostSnapshot, TimelineEvent } from './types';
import SimulationCanvas from './components/SimulationCanvas';
import AnalysisPanel from './components/AnalysisPanel'; // Renamed from StatsPanel
import Leaderboard from './components/Leaderboard';
import LoadingScreen from './components/LoadingScreen';
import {
    Play, Pause, RefreshCw, Cpu, Gamepad2,
    Terminal, Activity, Users, Zap, Layers, LayoutGrid, LineChart, GitBranch, CpuIcon
} from 'lucide-react';
import { BOARD_HEIGHT, BOARD_WIDTH } from './constants';

const API_BASE = "https://tetrisml.vs.workers.dev";
const STORAGE_KEY = 'TetrisML-population-v1';


const App: React.FC = () => {
    // --- STATE ---
    const [agents, setAgents] = useState<AgentState[]>([]);
    const [stats, setStats] = useState<SimulationStats>({
        generation: 0,
        maxFitness: 0,
        avgFitness: 0,
        diversity: 0,
        mutationRate: 0.1,
        populationSize: 0,
        stage: 'Training'
    });
    const [fitnessHistory, setFitnessHistory] = useState<{ gen: number; fitness: number }[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

    const [isPlaying, setIsPlaying] = useState(true);
    const [speed, setSpeed] = useState(1);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [controlledAgentId, setControlledAgentId] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [gridCols, setGridCols] = useState(6);
    const [generationPulse, setGenerationPulse] = useState(false);
    const [bestEverGhost, setBestEverGhost] = useState<GhostSnapshot | null>(null);
    const [showGhost, setShowGhost] = useState(true);
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [activePage, setActivePage] = useState<'arena' | 'timeline' | 'analytics' | 'models'>('arena');
    const [analyticsOpen, setAnalyticsOpen] = useState(false);
    const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
    const [selectedGeneration, setSelectedGeneration] = useState<number | null>(null);
    const [selectedModel, setSelectedModel] = useState<'GA' | 'DQL'>('GA');

    const workerRef = useRef<Worker | null>(null);
    const agentsRef = useRef<AgentState[]>([]);
    const statsRef = useRef<SimulationStats>(stats);
    const historyRef = useRef<{ gen: number; fitness: number }[]>([]);
    const leaderboardRef = useRef<LeaderboardEntry[]>([]);
    const mutationRateRef = useRef(0.02);
    const stagnationCountRef = useRef(0);
    const isLoadedRef = useRef(false);
    const lastGenerationRef = useRef(0);
    const lineRateRef = useRef<{ time: number; lines: number }[]>([]);

    // Sync refs with state for stable access in intervals
    useEffect(() => { agentsRef.current = agents; }, [agents]);
    useEffect(() => { statsRef.current = stats; }, [stats]);
    useEffect(() => { historyRef.current = fitnessHistory; }, [fitnessHistory]);
    useEffect(() => { leaderboardRef.current = leaderboard; }, [leaderboard]);
    useEffect(() => {
        const updateCols = () => {
            const width = window.innerWidth;
            if (width < 900) setGridCols(3);
            else if (width < 1200) setGridCols(4);
            else if (width < 1600) setGridCols(5);
            else setGridCols(6);
        };
        updateCols();
        window.addEventListener('resize', updateCols);
        return () => window.removeEventListener('resize', updateCols);
    }, []);

    useEffect(() => {
        if (stats.generation > 0 && stats.generation !== lastGenerationRef.current) {
            setGenerationPulse(true);
            const timeout = window.setTimeout(() => setGenerationPulse(false), 600);
            lastGenerationRef.current = stats.generation;
            return () => window.clearTimeout(timeout);
        }
        lastGenerationRef.current = stats.generation;
        return undefined;
    }, [stats.generation]);

    // --- INITIALIZATION ---
    useEffect(() => {
        const worker = new Worker(new URL('./services/simulation/simulation.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<any>) => {
            const { type, payload } = event.data;
            if (type === 'UPDATE') {
                setAgents(payload.agents);
                setStats(payload.stats);
                if (payload.leaderboard) setLeaderboard(payload.leaderboard);
                if (payload.bestEverGhost !== undefined) setBestEverGhost(payload.bestEverGhost);
                if (payload.timeline) setTimelineEvents(payload.timeline);

                // Track deep metadata for persistence
                if (payload.mutationRate !== undefined) mutationRateRef.current = payload.mutationRate;
                if (payload.stagnationCount !== undefined) stagnationCountRef.current = payload.stagnationCount;

                // Fitness History Logic
                setFitnessHistory(prev => {
                    const last = prev[prev.length - 1];
                    if (!last || last.gen !== payload.stats.generation) {
                        return [...prev, { gen: payload.stats.generation, fitness: payload.stats.maxFitness }].slice(-50);
                    }
                    if (last && last.gen === payload.stats.generation && payload.stats.maxFitness > last.fitness) {
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1] = { ...newHistory[newHistory.length - 1], fitness: payload.stats.maxFitness };
                        return newHistory;
                    }
                    return prev;
                });
            }
        };

        // Initial state fetch from backend
        const loadState = async () => {
            const startTime = Date.now();
            let loaded = false;
            try {
                console.log("[Persistence] Fetching state from Cloudflare...");
                const response = await fetch(`${API_BASE}/api/state`);
                if (response.ok) {
                    const state = await response.json();
                    if (state && (state.population || state.agents)) {
                        // Legacy support check: if it's just an array, it's the old format
                        const genomes = Array.isArray(state) ? state : (state.population || state.agents);
                        const fullState: any = Array.isArray(state) ? { population: genomes, stats: { generation: Math.max(...genomes.map((g: any) => g.generation || 0)) } } : state;

                        console.log(`[Persistence] Success! Importing Deep State from Cloudflare (Gen: ${fullState.stats?.generation}).`);

                        // Seed React state if history exists
                        if (fullState.history) setFitnessHistory(fullState.history);

                        worker.postMessage({ type: 'IMPORT_STATE', payload: fullState });
                        loaded = true;
                    } else {
                        console.log("[Persistence] Cloudflare storage is empty.");
                    }
                }
            } catch (e) {
                console.error("[Persistence] Cloudflare fetch error:", e);
            }

            // Fallback to local storage if backend is empty or fails
            if (!loaded) {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    try {
                        const state = JSON.parse(saved);
                        const genomes = Array.isArray(state) ? state : (state.population || state.agents);
                        const fullState: any = Array.isArray(state) ? { population: genomes, stats: { generation: Math.max(...genomes.map((g: any) => g.generation || 0)) } } : state;

                        console.log(`[Persistence] Falling back to localStorage: Importing Deep State (Gen: ${fullState.stats?.generation}).`);
                        if (fullState.history) setFitnessHistory(fullState.history);

                        worker.postMessage({ type: 'IMPORT_STATE', payload: fullState });
                        loaded = true;
                    } catch (e) { console.error("[Persistence] Local load error", e); }
                }
            }

            isLoadedRef.current = true;

            // Enforce minimum splash screen time (2s) for polish and sync buffer
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 2000 - elapsed);

            setTimeout(() => {
                setIsInitializing(false);
                console.log("[Persistence] Initialization complete.");
            }, remaining);
        };

        loadState();

        return () => { worker.terminate(); };
    }, []);

    // --- AUTO SAVE ---
    useEffect(() => {
        const interval = setInterval(async () => {
            const currentAgents = agentsRef.current;
            const currentStats = statsRef.current;

            if (!isLoadedRef.current) {
                console.log("[Persistence] Save skipped: Waiting for initial load...");
                return;
            }

            if (currentAgents.length > 0 && currentStats.generation >= 1) {
                // Construct Full persistent state
                const fullState = {
                    population: currentAgents.map(a => ({
                        id: a.genome.id,
                        generation: a.genome.generation || currentStats.generation,
                        weights: a.genome.weights,
                        traits: a.genome.traits,
                        color: a.genome.color,
                        bornMethod: a.genome.bornMethod,
                        parents: a.genome.parents
                    })),
                    stats: currentStats,
                    leaderboard: leaderboardRef.current,
                    history: historyRef.current,
                    mutationRate: mutationRateRef.current,
                    stagnationCount: stagnationCountRef.current,
                    timestamp: Date.now()
                };

                const stateStr = JSON.stringify(fullState);

                // Save to local storage
                localStorage.setItem(STORAGE_KEY, stateStr);

                // Save to Backend
                try {
                    console.log(`[Persistence] Syncing deep state (Gen ${currentStats.generation}) to Cloudflare...`);
                    const res = await fetch(`${API_BASE}/api/state`, {
                        method: 'POST',
                        body: stateStr,
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (!res.ok) console.warn("[Persistence] Cloudflare sync failed:", res.status);
                    else console.log("[Persistence] Cloudflare sync successful.");
                } catch (e) {
                    console.error("[Persistence] Cloudflare sync error", e);
                }
            }
        }, 15000); // 15s interval for backend saves
        return () => clearInterval(interval);
    }, []); // Stable interval

    // --- CONTROLS ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!controlledAgentId || !workerRef.current) return;
            if (e.key === 'ArrowLeft') workerRef.current.postMessage({ type: 'CONTROL_INPUT', payload: 'LEFT' });
            if (e.key === 'ArrowRight') workerRef.current.postMessage({ type: 'CONTROL_INPUT', payload: 'RIGHT' });
            if (e.key === 'ArrowDown') workerRef.current.postMessage({ type: 'CONTROL_INPUT', payload: 'DOWN' });
            if (e.key === 'ArrowUp' || e.key === ' ') workerRef.current.postMessage({ type: 'CONTROL_INPUT', payload: 'ROTATE' });
            if (e.key === 'Enter') workerRef.current.postMessage({ type: 'CONTROL_INPUT', payload: 'DROP' });
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [controlledAgentId]);

    const togglePlay = () => {
        if (isPlaying) workerRef.current?.postMessage({ type: 'PAUSE' });
        else workerRef.current?.postMessage({ type: 'RESUME' });
        setIsPlaying(!isPlaying);
    };

    const reset = async () => {
        if (window.confirm("Initialize System Reset?")) {
            workerRef.current?.postMessage({ type: 'RESET' });
            setFitnessHistory([]);
            setLeaderboard([]);
            setControlledAgentId(null);
            setSelectedAgentId(null);
            localStorage.removeItem(STORAGE_KEY);

            // Backend reset
            try {
                await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
            } catch (e) {
                console.error("Backend reset error", e);
            }
        }
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        const speeds = [1, 5, 50, 200];
        const newSpeed = speeds[val - 1] || 1;
        setSpeed(newSpeed);
        workerRef.current?.postMessage({ type: 'SET_SPEED', payload: newSpeed });
    };

    // Dual purpose: Select for analysis OR Control if double-clicked/already selected
    const handleAgentClick = (id: string) => {
        if (selectedAgentId === id) {
            // Toggle control
            if (controlledAgentId === id) {
                setControlledAgentId(null);
                workerRef.current?.postMessage({ type: 'TAKE_CONTROL', payload: null });
            } else {
                setControlledAgentId(id);
                workerRef.current?.postMessage({ type: 'TAKE_CONTROL', payload: id });
            }
        } else {
            setSelectedAgentId(id);
        }
    };

    // --- DERIVED DATA ---
    const bestAgent = agents.reduce((prev, current) => (prev.score > current.score) ? prev : current, agents[0]);
    const selectedAgent = selectedAgentId ? agents.find(a => a.id === selectedAgentId) : null;
    const targetGenome = selectedAgent?.genome || null;
    const generations = fitnessHistory.map(entry => entry.gen);
    const minGeneration = generations[0] || 0;
    const maxGeneration = generations[generations.length - 1] || stats.generation;
    const timelineGeneration = selectedGeneration ?? maxGeneration;
    const timelineEntry = fitnessHistory.find(entry => entry.gen === timelineGeneration);
    const timelineEvent = timelineEvents.find(entry => entry.generation === timelineGeneration);
    const timelineDisplayGeneration = generations.includes(timelineGeneration) ? timelineGeneration : maxGeneration;
    const holeDensity = agents.length > 0
        ? (agents.reduce((sum, agent) => {
            let holes = 0;
            for (let x = 0; x < BOARD_WIDTH; x++) {
                let foundBlock = false;
                for (let y = 0; y < BOARD_HEIGHT; y++) {
                    if (agent.grid[y][x] !== 0) foundBlock = true;
                    else if (foundBlock) holes++;
                }
            }
            return sum + holes;
        }, 0) / (agents.length * BOARD_WIDTH * BOARD_HEIGHT)) * 100
        : 0;
    const averageLines = agents.reduce((sum, agent) => sum + agent.lines, 0) / Math.max(1, agents.length);
    const averagePieces = agents.reduce((sum, agent) => sum + (agent.piecesPlaced || 0), 0) / Math.max(1, agents.length);
    const wasteRate = averagePieces > 0 ? Math.max(0, 1 - (averageLines / averagePieces)) * 100 : 0;
    const lineRateWindow = lineRateRef.current;
    const lpm = lineRateWindow.length > 1
        ? (() => {
            const first = lineRateWindow[0];
            const last = lineRateWindow[lineRateWindow.length - 1];
            const deltaLines = last.lines - first.lines;
            const deltaMinutes = Math.max(1 / 60, (last.time - first.time) / 60000);
            return deltaLines / deltaMinutes;
        })()
        : 0;

    useEffect(() => {
        const now = Date.now();
        const totalLines = agents.reduce((sum, agent) => sum + agent.lines, 0);
        lineRateRef.current = [...lineRateRef.current, { time: now, lines: totalLines }]
            .filter(entry => now - entry.time <= 60000);
    }, [agents]);

    const handleKill = () => {
        if (!selectedAgentId) return;
        if (window.confirm(`Terminate specimen ${selectedAgentId.substring(0, 4)}?`)) {
            workerRef.current?.postMessage({ type: 'KILL_AGENT', payload: selectedAgentId });
        }
    };

    const handleForceMutate = () => {
        if (!selectedAgentId) return;
        if (window.confirm(`Force-mutate specimen ${selectedAgentId.substring(0, 4)}?`)) {
            workerRef.current?.postMessage({ type: 'FORCE_MUTATE', payload: selectedAgentId });
        }
    };

    return (
        <div className={`h-screen w-screen p-4 flex flex-col gap-4 overflow-hidden text-slate-200 ${generationPulse ? 'generation-pulse' : ''}`}>
            {isInitializing && <LoadingScreen />}

            <nav className="glass-panel rounded-lg px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Terminal size={18} className="text-cyan-400" />
                    <span className="text-sm font-bold uppercase tracking-wider text-white">EVO_TETRIS</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActivePage('arena')}
                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${activePage === 'arena' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <LayoutGrid size={14} /> Arena
                    </button>
                    <button
                        onClick={() => setActivePage('timeline')}
                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${activePage === 'timeline' ? 'bg-purple-500/20 text-purple-200' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <GitBranch size={14} /> Timeline
                    </button>
                    <button
                        onClick={() => setActivePage('analytics')}
                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${activePage === 'analytics' ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <LineChart size={14} /> Analytics
                    </button>
                    <button
                        onClick={() => setActivePage('models')}
                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${activePage === 'models' ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <CpuIcon size={14} /> Models
                    </button>
                </div>
            </nav>

            <div className="flex-1 flex gap-4 overflow-hidden">
            {/* --- COLUMN 1: COMMAND DECK (Left) --- */}
            <aside className="w-64 flex-shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">

                {/* Identity Block */}
                <div className="glass-panel rounded-lg p-4 neon-glow border-l-4 border-l-cyan-500">
                    <h1 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-2">
                        <Terminal size={20} className="text-cyan-400" />
                        EVO_TETRIS
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-[10px] font-mono text-cyan-300 tracking-widest uppercase">
                            System Online
                        </span>
                    </div>
                </div>

                {/* Global Stats Matrix */}
                <div className="glass-panel rounded-lg p-3 grid grid-cols-2 gap-2">
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
                            <span className={`text-xs font-mono ${stats.diversity < 10 ? 'text-red-500 animate-pulse' : 'text-purple-400'}`}>
                                {stats.diversity}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Live Leaderboard */}
                <div className="glass-panel rounded-lg p-3 flex-1 min-h-0 flex flex-col">
                    <Leaderboard entries={leaderboard} />
                </div>

                {/* Controls */}
                <div className="glass-panel rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Sim Speed</span>
                        <span className="text-[10px] font-mono text-cyan-400">{speed === 200 ? 'TURBO' : `${speed}x`}</span>
                    </div>
                    <input
                        type="range" min="1" max="4" step="1"
                        defaultValue={1}
                        onChange={handleSpeedChange}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={togglePlay}
                            className={`flex-1 py-2 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all ${isPlaying ? 'bg-amber-500/10 text-amber-500 border border-amber-500/50 hover:bg-amber-500/20' : 'bg-green-500 text-black hover:bg-green-400'}`}
                        >
                            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                            {isPlaying ? 'HALT' : 'RUN'}
                        </button>
                        <button
                            onClick={reset}
                            className="w-10 flex items-center justify-center rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-900"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                    <div className="pt-2 space-y-2">
                        <label className="flex items-center justify-between text-[10px] uppercase text-slate-500">
                            Ghost Playback
                            <input
                                type="checkbox"
                                checked={showGhost}
                                onChange={(e) => setShowGhost(e.target.checked)}
                                className="accent-cyan-500"
                            />
                        </label>
                        <label className="flex items-center justify-between text-[10px] uppercase text-slate-500">
                            Heatmap Overlay
                            <input
                                type="checkbox"
                                checked={showHeatmap}
                                onChange={(e) => setShowHeatmap(e.target.checked)}
                                className="accent-cyan-500"
                            />
                        </label>
                    </div>
                    <div className="pt-2 space-y-2">
                        <div className="text-[10px] uppercase text-slate-500 font-bold">God Mode</div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleKill}
                                disabled={!selectedAgentId}
                                className="flex-1 py-1.5 rounded text-[10px] font-bold border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Kill
                            </button>
                            <button
                                onClick={handleForceMutate}
                                disabled={!selectedAgentId}
                                className="flex-1 py-1.5 rounded text-[10px] font-bold border border-purple-500/50 text-purple-300 hover:bg-purple-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Mutate
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* --- COLUMN 2: MAIN CONTENT --- */}
            <main className="flex-1 flex flex-col gap-4 min-w-0 relative">
                {/* Status Bar */}
                <div className="h-10 glass-panel rounded-lg flex items-center px-4 justify-between">
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

                {activePage === 'arena' && (
                <div className="flex-1 glass-panel rounded-lg relative overflow-hidden flex flex-col p-1">
                    <div className="absolute inset-0 pointer-events-none z-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-transparent to-transparent"></div>
                    <div className="scanlines-overlay"></div>
                    <div className="scan-sweep"></div>
                    <SimulationCanvas
                        agents={agents}
                        cols={gridCols}
                        controlledAgentId={controlledAgentId}
                        ghostSnapshot={bestEverGhost}
                        showGhost={showGhost}
                        showHeatmap={showHeatmap}
                        onAgentClick={handleAgentClick}
                    />

                    {/* Control Overlay */}
                    {controlledAgentId && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 border border-green-500 text-green-400 px-6 py-2 rounded-full backdrop-blur-md flex items-center gap-3 shadow-[0_0_20px_rgba(34,197,94,0.3)] animate-pulse">
                            <Gamepad2 size={18} />
                            <span className="text-xs font-bold tracking-widest uppercase">Direct Control Active</span>
                        </div>
                    )}

                    {/* Selection Overlay */}
                    {selectedAgentId && !controlledAgentId && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 border border-slate-600 text-slate-300 px-4 py-1.5 rounded-full backdrop-blur-md text-[10px] uppercase tracking-wider">
                            Specimen {selectedAgentId.substring(0, 4)} Selected
                        </div>
                    )}
                </div>
                )}

                {activePage === 'timeline' && (
                    <div className="flex-1 glass-panel rounded-lg p-4 flex flex-col gap-4 overflow-hidden">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm uppercase tracking-wider font-bold text-purple-200">Evolution Timeline</h2>
                            <span className="text-[10px] text-slate-400 uppercase">Gen {timelineDisplayGeneration}</span>
                        </div>
                        <div className="bg-slate-900/60 rounded border border-slate-700/50 p-4">
                            <input
                                type="range"
                                min={minGeneration}
                                max={maxGeneration}
                                value={timelineDisplayGeneration}
                                onChange={(e) => setSelectedGeneration(parseInt(e.target.value, 10))}
                                className="w-full accent-purple-400"
                            />
                            <div className="mt-2 text-[10px] text-slate-400">
                                Scrub to review telemetry snapshots captured in recent generations.
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-4">
                                <div className="text-[10px] text-slate-500 uppercase">Max Fitness</div>
                                <div className="text-xl font-mono text-cyan-300 mt-2">
                                    {timelineEntry ? Math.floor(timelineEntry.fitness) : '—'}
                                </div>
                            </div>
                            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-4">
                                <div className="text-[10px] text-slate-500 uppercase">First Tetris Clear</div>
                                <div className="text-xs text-slate-200 mt-2">
                                    {timelineEvent?.firstTetrisBy
                                        ? `Specimen ${timelineEvent.firstTetrisBy.substring(0, 4)}`
                                        : 'Not observed'}
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900/60 rounded border border-slate-700/50 p-4">
                            <div className="text-[10px] text-slate-500 uppercase">Timeline Notes</div>
                            <div className="mt-2 text-xs text-slate-400">
                                Use this scrubber to identify when high-value traits (like 4-line clears) first appear.
                            </div>
                        </div>
                    </div>
                )}

                {activePage === 'analytics' && (
                    <div className="flex-1 glass-panel rounded-lg p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm uppercase tracking-wider font-bold text-emerald-200">Analytics Dashboard</h2>
                            <button
                                onClick={() => setAnalyticsOpen(!analyticsOpen)}
                                className="text-[10px] uppercase text-slate-400 hover:text-slate-200"
                            >
                                {analyticsOpen ? 'Hide Panel' : 'Show Panel'}
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-4">
                                <div className="text-[10px] text-slate-500 uppercase">LPM</div>
                                <div className="text-xl font-mono text-emerald-300 mt-2">{lpm.toFixed(1)}</div>
                            </div>
                            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-4">
                                <div className="text-[10px] text-slate-500 uppercase">Hole Density</div>
                                <div className="text-xl font-mono text-emerald-300 mt-2">{holeDensity.toFixed(2)}%</div>
                            </div>
                            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-4">
                                <div className="text-[10px] text-slate-500 uppercase">Waste Pieces</div>
                                <div className="text-xl font-mono text-emerald-300 mt-2">{wasteRate.toFixed(1)}%</div>
                            </div>
                        </div>
                        {analyticsOpen && (
                            <div className="bg-slate-900/60 rounded border border-slate-700/50 p-4 text-xs text-slate-400">
                                Sliding panel ready for deeper telemetry breakdowns and historical charts.
                            </div>
                        )}
                    </div>
                )}

                {activePage === 'models' && (
                    <div className="flex-1 glass-panel rounded-lg p-4 flex flex-col gap-4">
                        <h2 className="text-sm uppercase tracking-wider font-bold text-amber-200">Model Architectures</h2>
                        <div className="bg-slate-900/60 rounded border border-slate-700/50 p-4">
                            <div className="text-[10px] text-slate-500 uppercase">Active Model</div>
                            <div className="mt-2 flex gap-2">
                                <button
                                    onClick={() => setSelectedModel('GA')}
                                    className={`px-3 py-1.5 rounded text-xs font-bold ${selectedModel === 'GA' ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Genetic Algorithm
                                </button>
                                <button
                                    onClick={() => setSelectedModel('DQL')}
                                    className="px-3 py-1.5 rounded text-xs font-bold text-slate-500 cursor-not-allowed"
                                    disabled
                                >
                                    Deep Q-Learning (Soon)
                                </button>
                            </div>
                            <div className="mt-3 text-xs text-slate-400">
                                Toggle to compare learning strategies once additional model backends are enabled.
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* --- COLUMN 3: ANALYSIS MODULE (Right) --- */}
            <aside className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
                <div className="glass-panel rounded-lg p-4 flex-1 neon-glow border-r-4 border-r-purple-500">
                    <AnalysisPanel
                        stats={stats}
                        fitnessHistory={fitnessHistory}
                        selectedGenome={targetGenome}
                        bestGenome={bestAgent?.genome}
                    />
                </div>

                <div className="glass-panel rounded-lg p-4 h-32 text-[10px] text-slate-400 font-mono leading-relaxed overflow-y-auto">
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

export default App;

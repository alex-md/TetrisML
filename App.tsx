
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AgentState, SimulationStats, LineageNode, LeaderboardEntry, GhostPlayback, GhostFrame, GenerationSnapshot, TelemetryFrame } from './types';
import LoadingScreen from './components/LoadingScreen';
import NavBar, { NavRoute } from './components/NavBar';
import FloatingArenaCard from './components/FloatingArenaCard';
import SimulationPage from './pages/SimulationPage';
import NeuralMapPage from './pages/NeuralMapPage';
import TelemetryPage from './pages/TelemetryPage';
import TimelinePage from './pages/TimelinePage';
import ProfilesPage from './pages/ProfilesPage';
import LineagePage from './pages/LineagePage';
import HighScoresPage from './pages/HighScoresPage';
import { Grid3x3, Brain, Activity, History, Users, Network, Trophy } from 'lucide-react';

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
    const [lineageHistory, setLineageHistory] = useState<LineageNode[][]>([]);
    const [telemetryHistory, setTelemetryHistory] = useState<TelemetryFrame[]>([]);

    const [isPlaying, setIsPlaying] = useState(true);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [route, setRoute] = useState<string>('arena');
    const [ghostFrames, setGhostFrames] = useState<GhostFrame[]>([]);
    const [ghostMeta, setGhostMeta] = useState<GhostPlayback | null>(null);
    const [ghostFrameIndex, setGhostFrameIndex] = useState(0);
    const [timelineSnapshots, setTimelineSnapshots] = useState<GenerationSnapshot[]>([]);

    const workerRef = useRef<Worker | null>(null);
    const agentsRef = useRef<AgentState[]>([]);
    const statsRef = useRef<SimulationStats>(stats);
    const historyRef = useRef<{ gen: number; fitness: number }[]>([]);
    const leaderboardRef = useRef<LeaderboardEntry[]>([]);
    const lineageRef = useRef<LineageNode[][]>([]);
    const telemetryRef = useRef<TelemetryFrame[]>([]);
    const ghostMetaRef = useRef<GhostPlayback | null>(null);
    const timelineRef = useRef<GenerationSnapshot[]>([]);
    const mutationRateRef = useRef(0.02);
    const stagnationCountRef = useRef(0);
    const isLoadedRef = useRef(false);
    const lastGenerationRef = useRef(0);

    // Sync refs with state for stable access in intervals
    useEffect(() => { agentsRef.current = agents; }, [agents]);
    useEffect(() => { statsRef.current = stats; }, [stats]);
    useEffect(() => { historyRef.current = fitnessHistory; }, [fitnessHistory]);
    useEffect(() => { leaderboardRef.current = leaderboard; }, [leaderboard]);
    useEffect(() => { lineageRef.current = lineageHistory; }, [lineageHistory]);
    useEffect(() => { telemetryRef.current = telemetryHistory; }, [telemetryHistory]);
    useEffect(() => { ghostMetaRef.current = ghostMeta; }, [ghostMeta]);
    useEffect(() => { timelineRef.current = timelineSnapshots; }, [timelineSnapshots]);

    const routes: NavRoute[] = [
        { key: 'arena', label: 'Arena', Icon: Grid3x3 },
        { key: 'highscores', label: 'High Scores', Icon: Trophy },
        { key: 'neural', label: 'Neural Map', Icon: Brain },
        { key: 'telemetry', label: 'Telemetry', Icon: Activity },
        { key: 'timeline', label: 'Timeline', Icon: History },
        { key: 'lineage', label: 'Lineage', Icon: Network },
        { key: 'profiles', label: 'Profiles', Icon: Users }
    ];

    useEffect(() => {
        const parseHash = () => {
            const raw = window.location.hash.replace('#', '').replace('/', '');
            const known = routes.find(r => r.key === raw)?.key || 'arena';
            setRoute(known);

            // SEO: Dynamic Metadata Updates
            const routeConfig = routes.find(r => r.key === known);
            if (routeConfig) {
                document.title = `TetrisML // ${routeConfig.label} - Evolving AI`;
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc) {
                    const desc = `Explore the ${routeConfig.label} of TetrisML. Watch neural networks evolve through genetic algorithms in real-time.`;
                    metaDesc.setAttribute('content', desc);
                }
            }
        };

        if (!window.location.hash) {
            window.location.hash = '#/arena';
        } else {
            parseHash();
        }

        window.addEventListener('hashchange', parseHash);
        return () => window.removeEventListener('hashchange', parseHash);
    }, []);

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
                if (payload.lineage) setLineageHistory(payload.lineage);
                if (payload.telemetryHistory) setTelemetryHistory(payload.telemetryHistory);
                if (payload.ghost) {
                    setGhostFrames(payload.ghost.frames || []);
                    setGhostMeta(payload.ghost);
                    setGhostFrameIndex(0);
                }

                if (payload.endOfGenSnapshot) {
                    setTimelineSnapshots(prev => [...prev.slice(-39), payload.endOfGenSnapshot]);
                    // Trigger persistence at the end of the generation
                    triggerSync(payload);
                }

                // Track deep metadata for persistence
                if (payload.mutationRate !== undefined) mutationRateRef.current = payload.mutationRate;
                if (payload.stagnationCount !== undefined) stagnationCountRef.current = payload.stagnationCount;

                // Fitness History Logic
                setFitnessHistory(prev => {
                    const exists = prev.some(h => h.gen === payload.stats.generation);
                    if (exists) {
                        return prev.map(h => h.gen === payload.stats.generation
                            ? { ...h, fitness: Math.max(h.fitness, payload.stats.maxFitness) }
                            : h
                        ).sort((a, b) => a.gen - b.gen).slice(-50);
                    }
                    return [...prev, { gen: payload.stats.generation, fitness: payload.stats.maxFitness }]
                        .sort((a, b) => a.gen - b.gen)
                        .slice(-50);
                });
            }
        };

        const triggerSync = async (payload: any) => {
            if (!isLoadedRef.current) return;

            // Construct state primarily from the payload (latest end-of-gen data)
            const fullState = {
                population: payload.agents.map((a: any) => ({
                    id: a.genome.id,
                    generation: a.genome.generation,
                    policy: a.genome.policy,
                    summary: a.genome.summary,
                    color: a.genome.color,
                    bornMethod: a.genome.bornMethod,
                    parents: a.genome.parents
                })),
                stats: payload.stats,
                leaderboard: payload.leaderboard || leaderboardRef.current,
                lineage: payload.lineage || lineageRef.current,
                telemetryHistory: payload.telemetryHistory || telemetryRef.current,
                ghost: payload.ghost || ghostMetaRef.current || undefined,
                timeline: [...timelineRef.current.slice(-39), payload.endOfGenSnapshot],
                history: historyRef.current,
                mutationRate: mutationRateRef.current,
                stagnationCount: stagnationCountRef.current,
                timestamp: Date.now()
            };

            const stateStr = JSON.stringify(fullState);

            // 1. Local Save (Critical for offline, but risky on size)
            try {
                localStorage.setItem(STORAGE_KEY, stateStr);
            } catch (e) {
                if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                    console.warn("[Persistence] LocalStorage Quota Exceeded. Deep state too large. Relying on Cloudflare sync.");
                } else {
                    console.error("[Persistence] LocalStorage error:", e);
                }
            }

            // 2. Cloudflare Sync (Authoritative)
            try {
                console.log(`[Persistence] Syncing Gen ${payload.endOfGenSnapshot.generation} to Cloudflare...`);
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
                        if (fullState.lineage) setLineageHistory(fullState.lineage);
                        if (fullState.telemetryHistory) setTelemetryHistory(fullState.telemetryHistory);
                        if (fullState.ghost) {
                            setGhostMeta(fullState.ghost);
                            setGhostFrames(fullState.ghost.frames || []);
                        }
                        if (fullState.timeline) setTimelineSnapshots(fullState.timeline);

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
                        if (fullState.lineage) setLineageHistory(fullState.lineage);
                        if (fullState.telemetryHistory) setTelemetryHistory(fullState.telemetryHistory);
                        if (fullState.ghost) {
                            setGhostMeta(fullState.ghost);
                            setGhostFrames(fullState.ghost.frames || []);
                        }
                        if (fullState.timeline) setTimelineSnapshots(fullState.timeline);

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

    // Removal of 15s interval sync in favor of event-driven sync triggered when a generation completes.


    const togglePlay = () => {
        if (isPlaying) workerRef.current?.postMessage({ type: 'PAUSE' });
        else workerRef.current?.postMessage({ type: 'RESUME' });
        setIsPlaying(!isPlaying);
    };

    const exportState = () => {
        // Construct a lean, analysis-focused state object
        const leanState = {
            metadata: {
                app: "TetrisML",
                version: "v1.2-analysis-optimized",
                timestamp: new Date().toISOString(),
                note: "Verbose data (raw params for non-elites) has been omitted to optimize for token-efficient analysis."
            },
            stats: statsRef.current,
            history: historyRef.current,
            telemetry: (telemetryRef.current || []).slice(-30), // Include recent trends
            leaderboard: (leaderboardRef.current || []).slice(0, 5).map(entry => ({
                id: entry.id,
                score: entry.score,
                generation: entry.generation,
                // We keep the policy but exclude the raw params for general entries
                bornMethod: entry.bornMethod
            })),
            // The "Elite" representation - full data for the first agent (Hall of Fame)
            hallOfFame: agentsRef.current.length > 0 ? {
                id: agentsRef.current[0].genome.id,
                summary: agentsRef.current[0].genome.summary,
                policy: agentsRef.current[0].genome.policy // Keep params for the best one only
            } : null,
            // Summaries for the rest of the population
            populationSummary: (agentsRef.current || []).slice(1).map(a => {
                const genome = a?.genome;
                if (!genome) return null;
                return {
                    id: genome.id,
                    score: a.score,
                    bornMethod: genome.bornMethod,
                    sensitivities: genome.summary.sensitivities
                };
            }).filter(Boolean),
            timelineSummary: (timelineRef.current || []).map(s => ({
                generation: s.generation,
                score: s.score,
                lines: s.lines
            }))
        };

        const stateStr = JSON.stringify(leanState, null, 2);
        const lineCount = stateStr.split('\n').length;

        navigator.clipboard.writeText(stateStr).then(() => {
            console.log(`[Export] Optimized analysis state (${lineCount} lines) copied to clipboard.`);
            alert(`Simulation data exported! (${lineCount} lines). Focused on analysis metrics.`);
        }).catch(err => {
            console.error("[Export] Failed to copy state:", err);
            alert("Failed to copy state to clipboard.");
        });
    };

    const reset = async () => {
        if (window.confirm("Initialize System Reset?")) {
            workerRef.current?.postMessage({ type: 'RESET' });
            setFitnessHistory([]);
            setLeaderboard([]);
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

    const summonSuperBot = () => {
        workerRef.current?.postMessage({ type: 'SUMMON_SUPER_BOT' });
    };


    const handleAgentClick = (id: string) => {
        setSelectedAgentId(id);
    };

    const bestAgent = useMemo(() => {
        if (agents.length === 0) return null;
        return agents.reduce((prev, current) => (prev.score > current.score) ? prev : current, agents[0]);
    }, [agents]);

    const selectedAgent = selectedAgentId ? agents.find(a => a.id === selectedAgentId) : null;
    const targetGenome = selectedAgent?.genome || null;

    const navigate = (key: string) => {
        if (key === route) return;
        window.location.hash = `#/${key}`;
    };

    return (
        <div className="app-shell">
            <div className="app-bg">
                <div className="app-orb orb-one" />
                <div className="app-orb orb-two" />
                <div className="app-grid" />
            </div>

            {isInitializing && <LoadingScreen />}

            <div className="app-content">
                <header>
                    <NavBar routes={routes} currentRoute={route} onNavigate={navigate} />
                </header>

                <main className="page-shell">
                    {route === 'arena' && (
                        <SimulationPage
                            agents={agents}
                            stats={stats}
                            fitnessHistory={fitnessHistory}
                            leaderboard={leaderboard}
                            isPlaying={isPlaying}
                            selectedAgentId={selectedAgentId}
                            onTogglePlay={togglePlay}
                            onReset={reset}
                            onAgentClick={handleAgentClick}
                            onExportState={exportState}
                            onSummonSuperBot={summonSuperBot}
                        />
                    )}
                    {route === 'highscores' && (
                        <HighScoresPage
                            leaderboard={leaderboard}
                            stats={stats}
                        />
                    )}
                    {route === 'neural' && (
                        <NeuralMapPage
                            selectedGenome={targetGenome}
                            bestGenome={bestAgent?.genome || null}
                            stats={stats}
                            lineageHistory={lineageHistory}
                        />
                    )}
                    {route === 'telemetry' && (
                        <TelemetryPage
                            stats={stats}
                            agents={agents}
                            telemetryHistory={telemetryHistory}
                            lineageHistory={lineageHistory}
                        />
                    )}
                    {route === 'timeline' && (
                        <TimelinePage
                            stats={stats}
                            fitnessHistory={fitnessHistory}
                            snapshots={timelineSnapshots}
                            telemetryHistory={telemetryHistory}
                        />
                    )}
                    {route === 'lineage' && (
                        <LineagePage
                            lineage={lineageHistory}
                            stats={stats}
                        />
                    )}
                    {route === 'profiles' && (
                        <ProfilesPage
                            agents={agents}
                            leaderboard={leaderboard}
                        />
                    )}
                </main>

                <footer className="mt-4 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 glass-panel rounded-2xl text-[10px] text-slate-500 uppercase tracking-widest">
                    <div>© 2026 TetrisML // Evolutionary Intelligence Suite</div>
                    <div className="flex gap-6">
                        <a href="https://github.com/alex-md/TetrisML" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition-colors">Source Code</a>
                        <a href="https://github.com/alex-md/TetrisML/blob/main/README.md" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition-colors">Documentation</a>

                    </div>
                </footer>
            </div>

            <FloatingArenaCard agent={bestAgent} hidden={route === 'arena'} />
        </div>
    );
};

export default App;

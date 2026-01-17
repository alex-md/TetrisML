import { TetrisGame } from './TetrisGame';
import * as GA from './EvolutionEngine';
import { GAMES_PER_GEN, BOARD_WIDTH, POPULATION_SIZE } from './constants';
import { Genome, MainMessage, AgentState, LeaderboardEntry, LineageNode, FullSimulationState, GhostPlayback, GhostFrame, TelemetryFrame } from '../../types';

let population: TetrisGame[] = [];
let generation = 1;
let populationSize = POPULATION_SIZE;
let mutationRate = 0.02;
const speed = 1;
let isPaused = false;
let lastUpdateTime = 0;

let lineageHistory: LineageNode[][] = [];
let leaderboard: LeaderboardEntry[] = [];
let fitnessHistory: number[] = [];
let stagnationCount = 0;
let runSequences = GA.generateRunSequences();
let bestEverFitness = 0;
let bestEverGhost: GhostPlayback | null = null;
let ghostTargetId: string | null = null;
let bestEverGhostScore = 0;
let telemetryHistory: TelemetryFrame[] = [];

const MAX_LINEAGE_HISTORY = 30;
const MAX_TELEMETRY_HISTORY = 60;
const MAX_GHOST_FRAMES = 240;
let lastLineageGen = 0;

const cloneGrid = (grid: number[][]) => grid.map(row => [...row]);

const cloneCurrentPiece = (piece: any) => ({
    shape: piece.shape.map((row: number[]) => [...row]),
    x: piece.x,
    y: piece.y,
    color: piece.color
});

function captureGhostFrame(agent: TetrisGame) {
    if (!bestEverGhost || agent.genome.id !== ghostTargetId) return;
    if (bestEverGhost.frames.length >= MAX_GHOST_FRAMES) return;

    const frame: GhostFrame = {
        grid: cloneGrid(agent.grid)
    };

    if (agent.currentPiece) {
        frame.currentPiece = cloneCurrentPiece(agent.currentPiece);
    }

    bestEverGhost.frames.push(frame);
}

function sendUpdate() {
    if (lineageHistory.length === 0 || lastLineageGen !== generation) {
        recordLineage();
    }
    const fitnessScore = (agent: TetrisGame) => Math.log10(Math.max(1, agent.averageScore ?? agent.score));
    let sumHeightW = 0;
    population.forEach(p => sumHeightW += p.genome.weights.height);
    let avgHeightW = sumHeightW / populationSize;
    let variance = 0;
    population.forEach(p => variance += Math.pow(p.genome.weights.height - avgHeightW, 2));
    let diversity = Math.min(100, (variance * 1000));

    const agents: AgentState[] = population.map(p => ({
        id: p.genome.id,
        grid: p.grid,
        score: p.score,
        lines: p.lines,
        level: p.level,
        isAlive: p.isAlive,
        genome: p.genome,
        currentPiece: p.currentPiece,
        nextPiecePreview: p.nextPiece.shape
    }));

    const allFitness = population.map(p => fitnessScore(p));
    const maxFitness = Math.max(...allFitness);
    if (maxFitness > bestEverFitness) bestEverFitness = maxFitness;

    const stats = {
        generation,
        maxFitness,
        bestEverFitness,
        avgFitness: allFitness.reduce((a, b) => a + b, 0) / populationSize,
        medianFitness: GA.median(allFitness),
        diversity: Math.floor(diversity),
        mutationRate,
        populationSize,
        stage: (isPaused ? 'Paused' : (diversity < 5 ? 'Mass Extinction' : 'Stable Evolution')) as any
    };

    self.postMessage({
        type: 'UPDATE',
        payload: {
            agents,
            stats,
            lineage: lineageHistory,
            leaderboard,
            mutationRate,
            stagnationCount,
            ghost: bestEverGhost || undefined,
            telemetryHistory
        }
    });
}

function initPopulation() {
    population = [];
    lineageHistory = [];
    leaderboard = [];
    runSequences = GA.generateRunSequences();
    bestEverGhost = null;
    ghostTargetId = null;
    bestEverGhostScore = 0;
    telemetryHistory = [];
    populationSize = POPULATION_SIZE;

    for (let i = 0; i < populationSize; i++) {
        const genome = GA.createRandomGenome(1);
        population.push(new TetrisGame(genome, runSequences));
    }
    recordLineage();
}

function recordLineage() {
    const nodes: LineageNode[] = population.map(p => {
        const metrics = p.calculateMetrics(p.grid);
        return {
            id: p.genome.id,
            generation: p.genome.generation,
            parents: p.genome.parents,
            fitness: p.averageScore || p.score,
            score: p.score,
            lines: p.lines,
            level: p.level,
            avgScore: p.averageScore || p.score,
            stress: p.calculateStress(),
            metrics,
            traits: p.genome.traits,
            weights: p.genome.weights,
            color: p.genome.color,
            bornMethod: p.genome.bornMethod
        };
    });

    lineageHistory.push(nodes);
    if (lineageHistory.length > MAX_LINEAGE_HISTORY) lineageHistory.shift();
    lastLineageGen = generation;

    const totals = nodes.reduce((acc, node) => {
        acc.score += node.score;
        acc.lines += node.lines;
        acc.level += node.level;
        acc.holes += node.metrics.holes;
        acc.bumpiness += node.metrics.bumpiness;
        acc.maxHeight += node.metrics.maxHeight;
        acc.wells += node.metrics.wells;
        acc.rowTransitions += node.metrics.rowTransitions;
        acc.colTransitions += node.metrics.colTransitions;
        return acc;
    }, {
        score: 0,
        lines: 0,
        level: 0,
        holes: 0,
        bumpiness: 0,
        maxHeight: 0,
        wells: 0,
        rowTransitions: 0,
        colTransitions: 0
    });

    const populationCount = Math.max(1, nodes.length);
    const telemetry: TelemetryFrame = {
        generation,
        avgScore: totals.score / populationCount,
        avgLines: totals.lines / populationCount,
        avgLevel: totals.level / populationCount,
        maxScore: Math.max(...nodes.map(n => n.score)),
        maxLines: Math.max(...nodes.map(n => n.lines)),
        avgHoles: totals.holes / populationCount,
        avgBumpiness: totals.bumpiness / populationCount,
        avgMaxHeight: totals.maxHeight / populationCount,
        avgWells: totals.wells / populationCount,
        avgRowTransitions: totals.rowTransitions / populationCount,
        avgColTransitions: totals.colTransitions / populationCount,
        holeDensity: Math.min(1, totals.holes / (populationCount * BOARD_WIDTH * 0.8)),
        timestamp: Date.now()
    };

    telemetryHistory.push(telemetry);
    if (telemetryHistory.length > MAX_TELEMETRY_HISTORY) telemetryHistory.shift();
}

function updateLeaderboard() {
    population.forEach(agent => {
        const scoreToUse = agent.averageScore || agent.score;
        const existingEntryIndex = leaderboard.findIndex(e => e.id === agent.genome.id);
        if (existingEntryIndex !== -1) {
            if (scoreToUse > leaderboard[existingEntryIndex].score) {
                leaderboard[existingEntryIndex].score = scoreToUse;
                leaderboard[existingEntryIndex].level = agent.level;
                leaderboard[existingEntryIndex].lines = agent.lines;
            }
        } else {
            leaderboard.push({
                id: agent.genome.id,
                score: scoreToUse,
                level: agent.level,
                lines: agent.lines,
                generation: agent.genome.generation,
                bornMethod: agent.genome.bornMethod,
                timestamp: Date.now()
            });
        }
    });

    leaderboard.sort((a, b) => b.score - a.score);
    if (leaderboard.length > 15) leaderboard = leaderboard.slice(0, 15);
}

function evolve() {
    const fitnessScore = (agent: TetrisGame) => Math.log10(Math.max(1, agent.averageScore ?? agent.score));
    const rankSelect = (sortedPop: TetrisGame[]) => {
        const n = sortedPop.length;
        const total = (n * (n + 1)) / 2;
        let r = Math.random() * total;
        for (let i = 0; i < n; i++) {
            const weight = n - i;
            if (r < weight) return sortedPop[i];
            r -= weight;
        }
        return sortedPop[0];
    };

    updateLeaderboard();
    population.sort((a, b) => fitnessScore(b) - fitnessScore(a));

    const currentBest = fitnessScore(population[0]);
    if (currentBest > bestEverFitness) bestEverFitness = currentBest;

    const avgFitness = population.reduce((sum, p) => sum + fitnessScore(p), 0) / populationSize;
    fitnessHistory.push(avgFitness);
    if (fitnessHistory.length > 8) fitnessHistory.shift();

    // Adaptive mutation
    if (fitnessHistory.length >= 5) {
        const trend = fitnessHistory[fitnessHistory.length - 1] - fitnessHistory[0];
        if (trend <= 0) stagnationCount++;
        else stagnationCount = 0;
    }

    let sumHeightW = 0;
    population.forEach(p => sumHeightW += p.genome.weights.height);
    let avgHeightW = sumHeightW / populationSize;
    let variance = 0;
    population.forEach(p => variance += Math.pow(p.genome.weights.height - avgHeightW, 2));
    let diversity = Math.min(100, (variance * 1000));

    const isExtinctionEvent = diversity < 3;
    runSequences = GA.generateRunSequences();

    const newPop: TetrisGame[] = [];

    // 1. Elitism (Top 2-5%)
    const eliteCount = Math.max(1, Math.floor(populationSize * 0.05));
    const elites = population.slice(0, eliteCount);
    newPop.push(...elites.map(e => {
        // Create a DEEP COPY of the elite genome to ensure no accidental mutations
        const eliteGenome = JSON.parse(JSON.stringify(e.genome));
        return new TetrisGame({
            ...eliteGenome,
            generation: generation + 1,
            fitness: e.averageScore || e.score,
            parents: [e.genome.id],
            bornMethod: 'elite'
        }, runSequences);
    }));

    if (isExtinctionEvent) {
        console.log("!!! MASS EXTINCTION EVENT !!!");
        while (newPop.length < populationSize) {
            const fresh = GA.createRandomGenome(generation + 1);
            newPop.push(new TetrisGame(fresh, runSequences));
        }
        mutationRate = 0.1;
    } else {
        // 2. Breeding (Tournament Selection)
        const immigrantCount = Math.max(1, Math.floor(populationSize * 0.05));
        const breedTarget = populationSize - immigrantCount;

        while (newPop.length < breedTarget) {
            let p1 = rankSelect(population);
            let p2 = rankSelect(population);
            const childGenome = GA.crossover(p1.genome, p2.genome, generation + 1);
            GA.mutate(childGenome, mutationRate);
            newPop.push(new TetrisGame(childGenome, runSequences));
        }

        // 3. Immigrants
        while (newPop.length < populationSize) {
            const immigrant = GA.createRandomGenome(generation + 1);
            newPop.push(new TetrisGame(immigrant, runSequences));
        }

        // 4. Adaptive mutation rate adjustment
        if (stagnationCount > 3) {
            mutationRate = Math.min(0.2, mutationRate + 0.01);
        } else {
            mutationRate = Math.max(0.005, mutationRate - 0.002);
        }
    }

    population = newPop;
    generation++;
    recordLineage();
}

// Main Simulation Loop
setInterval(() => {
    if (isPaused) return;

    const now = Date.now();
    const iterations = speed;

    for (let k = 0; k < iterations; k++) {
        let allDead = true;
        for (let agent of population) {
            if (agent.isAlive) {
                allDead = false;
                agent.tick();
                if (Math.random() < 0.0001 * agent.level) {
                    agent.addGarbageLine();
                }

                if (agent.score > bestEverGhostScore) {
                    bestEverGhostScore = agent.score;
                    ghostTargetId = agent.genome.id;
                    bestEverGhost = {
                        id: agent.genome.id,
                        generation: agent.genome.generation,
                        score: agent.score,
                        frames: [],
                        createdAt: Date.now()
                    };
                }

                captureGhostFrame(agent);
            } else if (agent.runsCompleted < GAMES_PER_GEN) {
                // If a run finished but still have runs left in the gen
                allDead = false;
                agent.runScores.push(agent.score);
                agent.runsCompleted++;
                if (agent.runsCompleted < GAMES_PER_GEN) {
                    agent.resetGame(runSequences);
                } else {
                    agent.averageScore = GA.median(agent.runScores);
                }
            }

            if (!agent.isAlive && ghostTargetId === agent.genome.id) ghostTargetId = null;
        }

        if (allDead) {
            evolve();
            break;
        }
    }

    const reportInterval = speed > 1 ? 2000 : 0;
    if (now - lastUpdateTime >= reportInterval) {
        lastUpdateTime = now;
        sendUpdate();
    }
}, 20);

self.onmessage = (e: MessageEvent<MainMessage>) => {
    const { type } = e.data;
    const payload = (e.data as any).payload;

    if (type === 'PAUSE') { isPaused = true; sendUpdate(); }
    if (type === 'RESUME') isPaused = false;
    // Speed control intentionally disabled to preserve deterministic pacing.
    if (type === 'RESET') {
        generation = 1;
        initPopulation();
        sendUpdate();
    }
    if (type === 'IMPORT_STATE') {
        const state = payload as FullSimulationState;

        // Restore Population
        runSequences = GA.generateRunSequences();
        population = state.population.map(g => new TetrisGame(g, runSequences));

        // Restore Simulation Variables
        populationSize = Math.max(POPULATION_SIZE, population.length);
        if (population.length < POPULATION_SIZE) {
            for (let i = population.length; i < POPULATION_SIZE; i++) {
                const genome = GA.createRandomGenome(generation);
                population.push(new TetrisGame(genome, runSequences));
            }
        }
        generation = state.stats.generation;
        mutationRate = state.mutationRate || 0.02;
        stagnationCount = state.stagnationCount || 0;
        leaderboard = state.leaderboard || [];
        lineageHistory = state.lineage || [];
        telemetryHistory = state.telemetryHistory || [];
        if (state.ghost) bestEverGhost = state.ghost;

        if (lineageHistory.length === 0 && population.length > 0) {
            recordLineage();
        }

        console.log(`[Worker] Deep State Restored. Gen: ${generation}, Agents: ${populationSize}, Mutation: ${mutationRate.toFixed(3)}`);
        sendUpdate();
    }
};

// Initial Start
initPopulation();
sendUpdate();

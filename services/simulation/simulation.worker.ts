import { TetrisGame } from './TetrisGame';
import * as GA from './EvolutionEngine';
import { GAMES_PER_GEN, BOARD_WIDTH } from './constants';
import { Genome, MainMessage, SimWorkerMessage, AgentState, LeaderboardEntry, LineageNode, FullSimulationState, GhostSnapshot, TimelineEvent } from '../../types';

let population: TetrisGame[] = [];
let generation = 1;
let populationSize = 12;
let mutationRate = 0.02;
let speed = 1;
let isPaused = false;
let controlledAgentId: string | null = null;
let lastUpdateTime = 0;

let lineageHistory: LineageNode[][] = [];
let leaderboard: LeaderboardEntry[] = [];
let fitnessHistory: number[] = [];
let stagnationCount = 0;
let runSequences = GA.generateRunSequences();
let bestEverFitness = 0;
let bestEverGhost: GhostSnapshot | null = null;
let timeline: TimelineEvent[] = [];

const cloneGrid = (grid: number[][]) => grid.map(row => [...row]);
const clonePiece = (piece: GhostSnapshot['currentPiece']) => {
    if (!piece) return undefined;
    return {
        shape: piece.shape.map(row => [...row]),
        x: piece.x,
        y: piece.y,
        color: piece.color
    };
};

function sendUpdate() {
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
        piecesPlaced: p.piecesPlaced,
        genome: p.genome,
        currentPiece: p.currentPiece,
        nextPiecePreview: p.nextPiece.shape,
        telemetry: {
            expectedHeatmap: p.expectedHeatmap,
            actualHeatmap: p.actualHeatmap
        }
    }));

    const allFitness = population.map(p => p.averageScore || p.score);
    const maxFitness = Math.max(...allFitness);
    if (maxFitness > bestEverFitness) {
        bestEverFitness = maxFitness;
        const bestIndex = allFitness.indexOf(maxFitness);
        const bestAgent = population[bestIndex];
        if (bestAgent) {
            bestEverGhost = {
                id: bestAgent.genome.id,
                generation: bestAgent.genome.generation,
                score: bestAgent.score,
                grid: cloneGrid(bestAgent.grid),
                currentPiece: clonePiece(bestAgent.currentPiece)
            };
        }
    }

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
            bestEverGhost,
            timeline
        }
    });
}

function initPopulation() {
    population = [];
    lineageHistory = [];
    leaderboard = [];
    runSequences = GA.generateRunSequences();
    timeline = [];

    for (let i = 0; i < populationSize; i++) {
        const genome = GA.createRandomGenome(1);
        population.push(new TetrisGame(genome, runSequences));
    }
    recordLineage();
}

function recordLineage() {
    const nodes: LineageNode[] = population.map(p => ({
        id: p.genome.id,
        generation: p.genome.generation,
        parents: p.genome.parents,
        fitness: p.averageScore || p.score,
        bornMethod: p.genome.bornMethod
    }));

    lineageHistory.push(nodes);
    if (lineageHistory.length > 6) lineageHistory.shift();
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
    updateLeaderboard();
    population.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));

    const currentBest = population[0].averageScore || 0;
    if (currentBest > bestEverFitness) bestEverFitness = currentBest;

    const avgFitness = population.reduce((sum, p) => sum + (p.averageScore || 0), 0) / populationSize;
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
            let p1 = GA.tournamentSelect(population as any, 5);
            let p2 = GA.tournamentSelect(population as any, 5);
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
    population.forEach(agent => {
        agent.lastLinesCleared = 0;
    });
    recordLineage();
}

// Main Simulation Loop
setInterval(() => {
    if (isPaused) return;

    const now = Date.now();
    const iterations = speed;

    for (let k = 0; k < iterations; k++) {
        let allDead = true;
        let tetrisEvent: TimelineEvent | null = null;
        for (let agent of population) {
            if (agent.isAlive) {
                allDead = false;
                agent.tick();
                if (agent.genome.id !== controlledAgentId && Math.random() < 0.0001 * agent.level) {
                    agent.addGarbageLine();
                }
                if (agent.lastLinesCleared === 4 && !timeline.find(e => e.generation === generation && e.firstTetrisAt)) {
                    tetrisEvent = {
                        generation,
                        firstTetrisAt: Date.now(),
                        firstTetrisBy: agent.genome.id
                    };
                    agent.lastLinesCleared = 0;
                }
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
        }

        if (allDead) {
            evolve();
            break;
        }
        if (tetrisEvent) {
            timeline = [...timeline.filter(e => e.generation !== generation), tetrisEvent].sort((a, b) => a.generation - b.generation);
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
    if (type === 'SET_SPEED') speed = payload;
    if (type === 'RESET') {
        generation = 1;
        initPopulation();
        sendUpdate();
    }
    if (type === 'TAKE_CONTROL') controlledAgentId = payload;

    if (type === 'CONTROL_INPUT') {
        if (!controlledAgentId) return;
        const agent = population.find(p => p.genome.id === controlledAgentId);
        if (agent && agent.isAlive) {
            if (payload === 'LEFT') agent.manualMove(-1, 0);
            if (payload === 'RIGHT') agent.manualMove(1, 0);
            if (payload === 'DOWN') agent.manualMove(0, 1);
            if (payload === 'ROTATE') agent.manualRotate();
            if (payload === 'DROP') agent.manualDrop();
        }
    }

    if (type === 'IMPORT_STATE') {
        const state = payload as FullSimulationState;

        // Restore Population
        runSequences = GA.generateRunSequences();
        population = state.population.map(g => new TetrisGame(g, runSequences));

        // Restore Simulation Variables
        populationSize = population.length;
        generation = state.stats.generation;
        mutationRate = state.mutationRate || 0.02;
        stagnationCount = state.stagnationCount || 0;
        leaderboard = state.leaderboard || [];
        lineageHistory = state.lineage || [];
        timeline = [];

        console.log(`[Worker] Deep State Restored. Gen: ${generation}, Agents: ${populationSize}, Mutation: ${mutationRate.toFixed(3)}`);
        sendUpdate();
    }

    if (type === 'KILL_AGENT') {
        const agent = population.find(p => p.genome.id === payload);
        if (agent) {
            agent.isAlive = false;
        }
    }

    if (type === 'FORCE_MUTATE') {
        const agentIndex = population.findIndex(p => p.genome.id === payload);
        if (agentIndex !== -1) {
            const agent = population[agentIndex];
            const mutatedGenome = JSON.parse(JSON.stringify(agent.genome)) as Genome;
            mutatedGenome.id = GA.generateId();
            mutatedGenome.generation = generation;
            mutatedGenome.parents = [agent.genome.id];
            mutatedGenome.bornMethod = 'god-child';
            GA.mutate(mutatedGenome, Math.max(0.2, mutationRate * 2));
            population[agentIndex] = new TetrisGame(mutatedGenome, runSequences);
        }
    }
};

// Initial Start
initPopulation();
sendUpdate();

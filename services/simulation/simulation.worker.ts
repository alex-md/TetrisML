import { TetrisGame } from './TetrisGame';
import * as GA from './EvolutionEngine';
import { extractCollectiveInsights, applyCollectiveLearning } from './CollectiveLearning';
import { GAMES_PER_GEN, BOARD_WIDTH, BOARD_HEIGHT, POPULATION_SIZE } from './constants';
import {
    Genome,
    MainMessage,
    AgentState,
    LeaderboardEntry,
    LineageNode,
    FullSimulationState,
    GhostPlayback,
    GhostFrame,
    TelemetryFrame
} from '../../types';
import {
    POLICY_INPUT_SIZE,
    POLICY_HIDDEN_SIZE,
    POLICY_PARAM_COUNT,
    createSeedPolicyParams,
    createRandomPolicyParams,
    createSuperBotParams,
    summarizePolicy
} from './policy';

let population: TetrisGame[] = [];
let populationNoise: number[][] = [];
let generation = 1;
let populationSize = POPULATION_SIZE;
let sigma = 0.28;
let stepSize = 0.35;
const speed = 1; // 1:1 move visibility
let isPaused = false;
let lastUpdateTime = 0;
let lastHeavyUpdateTime = 0;
let lastGenSnapshot: any = null;

let lineageHistory: LineageNode[][] = [];
let leaderboard: LeaderboardEntry[] = [];
let fitnessHistory: number[] = [];
let stagnationCount = 0;
let runSequences = GA.generateRunSequences();
let bestEverFitness = 0;
let bestEverGenome: Genome | null = null;
let bestEverGhost: GhostPlayback | null = null;
let ghostTargetId: string | null = null;
let bestEverGhostScore = 0;
let telemetryHistory: TelemetryFrame[] = [];
let prevGenMaxFitness = 0; // Baseline for spike detection

const MAX_LINEAGE_HISTORY = 30;
const MAX_TELEMETRY_HISTORY = 60;
const MAX_GHOST_FRAMES = 240;
const NOVELTY_ARCHIVE_SIZE = 64;
const NOVELTY_WEIGHT = 0.15;

let lastLineageGen = 0;
let policyMeanParams = createSeedPolicyParams();
let noveltyArchive: number[][] = [];

const CURRICULUM_STAGES = [
    { score: 0, gravityScale: 1.35, maxPieces: 600, label: 'Warmup' },
    { score: 2500, gravityScale: 1.2, maxPieces: 1000, label: 'Bootcamp' },
    { score: 8000, gravityScale: 1.05, maxPieces: 1600, label: 'Arena' },
    { score: 18000, gravityScale: 0.95, maxPieces: 2400, label: 'Gauntlet' },
    { score: 32000, gravityScale: 0.85, maxPieces: 3400, label: 'Endgame' }
];

const randn = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const addScaled = (base: number[], noise: number[], scale: number) => base.map((v, i) => v + noise[i] * scale);

const averageParams = (paramsList: number[][]) => {
    if (paramsList.length === 0) return createSeedPolicyParams();
    const sum = new Array(paramsList[0].length).fill(0);
    paramsList.forEach(vec => {
        for (let i = 0; i < vec.length; i++) sum[i] += vec[i];
    });
    return sum.map(v => v / paramsList.length);
};

const getCurriculum = (bestScore: number) => {
    let stage = CURRICULUM_STAGES[0];
    for (const entry of CURRICULUM_STAGES) {
        if (bestScore >= entry.score) stage = entry;
    }
    return stage;
};

const normalizeGenome = (genome: any): Genome => {
    if (genome?.policy?.params && Array.isArray(genome.policy.params)) {
        const params = genome.policy.params.length === POLICY_PARAM_COUNT
            ? genome.policy.params
            : createRandomPolicyParams();
        const summary = summarizePolicy(params, sigma);
        return {
            id: genome.id,
            policy: {
                inputSize: genome.policy.inputSize ?? POLICY_INPUT_SIZE,
                hiddenSize: genome.policy.hiddenSize ?? POLICY_HIDDEN_SIZE,
                params
            },
            summary: { ...summary, exploration: sigma },
            generation: genome.generation ?? generation,
            fitness: genome.fitness ?? 0,
            color: genome.color ?? GA.randomColor(),
            parents: genome.parents ?? [],
            bornMethod: genome.bornMethod ?? 'imported'
        };
    }

    const params = createRandomPolicyParams();
    return {
        id: genome?.id ?? GA.generateId(),
        policy: { inputSize: POLICY_INPUT_SIZE, hiddenSize: POLICY_HIDDEN_SIZE, params },
        summary: summarizePolicy(params, sigma),
        generation: genome?.generation ?? generation,
        fitness: genome?.fitness ?? 0,
        color: genome?.color ?? GA.randomColor(),
        parents: genome?.parents ?? [],
        bornMethod: 'imported'
    };
};

const buildGenome = (params: number[], bornMethod: Genome['bornMethod'], parents: string[]) => {
    const summary = summarizePolicy(params, sigma);
    return {
        id: GA.generateId(),
        policy: { inputSize: POLICY_INPUT_SIZE, hiddenSize: POLICY_HIDDEN_SIZE, params },
        summary: { ...summary, exploration: sigma },
        generation,
        fitness: 0,
        color: GA.randomColor(),
        parents,
        bornMethod
    } as Genome;
};

const computeFitness = (agent: TetrisGame) => {
    const metrics = agent.calculateMetrics(agent.grid);
    const rawScore = agent.averageScore ?? agent.score;

    // Weighted components (aligned with balanced_fitness_plan.md)
    const lineClearBonus = agent.lines * 100;
    const tetrisBonus = agent.tetrisCount * 1000;
    const heightPenalty = metrics.maxHeight * 15; // Linear penalty

    // Final Fitness Shaping
    let fitness = rawScore;
    fitness -= heightPenalty;

    // 2. Non-Linear Synergy (Elite Logic)
    // Hole-Height Synergy: Holes become exponentially more dangerous as stack rises
    const stackFactor = (metrics.maxHeight / BOARD_HEIGHT);
    const holeSynergy = Math.pow(metrics.holes, 1.5) * (1 + stackFactor * 5);
    fitness -= holeSynergy * 50;

    // Line-Cleanliness Synergy: High clears (Tetris) are worth much more on clean boards
    const cleanliness = 1 - (metrics.holes / 20); // 1.0 is perfectly clean
    const tetrisSynergy = agent.tetrisCount * 2000 * Math.max(0, cleanliness);
    fitness += tetrisSynergy;

    // Burn-Rate Penalty: Favoring efficient clears over "burning" single lines
    const burnRate = agent.lines > 0 ? (agent.lines - (agent.tetrisCount * 4)) / agent.lines : 0;
    fitness -= burnRate * 500;

    if (!agent.isAlive) fitness -= 2000;

    // Normalization & Intelligence Metrics
    const pieces = Math.max(1, agent.piecesSpawned);
    const normalizedFitness = fitness / pieces;

    // Throughput Bonus: Reward pieces per second (60 ticks = 1s approx)
    const piecesPerSecond = (agent.piecesSpawned / (Math.max(1, agent.totalTicks) / 60));
    const throughputBonus = piecesPerSecond * 2.0;

    // Scoring Density: Reward lines per piece
    const scoringDensity = (agent.lines / pieces) * 100;

    const finalFitness = normalizedFitness + throughputBonus + scoringDensity;

    return {
        fitness: finalFitness,
        metrics: {
            ...metrics,
            score: agent.score,
            lines: agent.lines,
            pieces: agent.piecesSpawned,
            avgHeight: metrics.aggregateHeight / pieces,
            throughput: piecesPerSecond,
            efficiency: scoringDensity
        }
    };
};

const computeNovelty = (signature: number[]) => {
    if (noveltyArchive.length === 0) return 0;
    const distances = noveltyArchive.map(arch => {
        let sum = 0;
        for (let i = 0; i < signature.length; i++) {
            const diff = signature[i] - arch[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    });
    distances.sort((a, b) => a - b);
    const k = Math.min(5, distances.length);
    const avg = distances.slice(0, k).reduce((acc, v) => acc + v, 0) / k;
    return avg;
};

const rankNormalize = (values: number[]) => {
    const indices = values.map((_, i) => i).sort((a, b) => values[b] - values[a]);
    const utilities = new Array(values.length).fill(0);
    for (let rank = 0; rank < indices.length; rank++) {
        const idx = indices[rank];
        utilities[idx] = (indices.length - rank - 0.5) / indices.length - 0.5;
    }
    return utilities;
};

const computeDiversity = (paramsList: number[][]) => {
    if (paramsList.length < 2) return 0;
    let sum = 0;
    let pairs = 0;
    for (let i = 0; i < paramsList.length; i++) {
        for (let j = i + 1; j < paramsList.length; j++) {
            let dist = 0;
            const a = paramsList[i];
            const b = paramsList[j];
            for (let k = 0; k < a.length; k++) {
                const diff = a[k] - b[k];
                dist += diff * diff;
            }
            sum += Math.sqrt(dist / a.length);
            pairs++;
        }
    }
    const mean = pairs === 0 ? 0 : sum / pairs;
    return Math.min(100, Math.round(mean * 40));
};

const createPopulation = (curriculumOverride?: { gravityScale: number; maxPieces: number; }, parentIds: string[] = [], extinctionCount: number = 0, currentDiversity: number = 100, seeds: number[][] = []) => {
    population = [];
    populationNoise = [];
    runSequences = GA.generateRunSequences();

    const curriculum = curriculumOverride ?? getCurriculum(0);

    // 1. Hall of Fame injection
    if (bestEverGenome) {
        const genome = { ...bestEverGenome, generation: generation, bornMethod: 'hall-of-fame' as any };
        const agent = new TetrisGame(genome, runSequences, {
            gravityScale: curriculum.gravityScale,
            maxPieces: curriculum.maxPieces
        });
        population.push(agent);
        populationNoise.push(new Array(POLICY_PARAM_COUNT).fill(0));
    }

    // 2. Cultural Seed Injection (The full 51-gene "Wisdom" from previous successes)
    seeds.forEach((seedParams, idx) => {
        const genome = buildGenome(seedParams, 'elite', parentIds);
        const agent = new TetrisGame(genome, runSequences, {
            gravityScale: curriculum.gravityScale,
            maxPieces: curriculum.maxPieces
        });
        population.push(agent);
        populationNoise.push(new Array(POLICY_PARAM_COUNT).fill(0)); // Perfect seeds start without noise
    });


    const remainingSlots = populationSize - population.length;

    // Determine how many immigrants to inject. 
    // If it's a mass extinction, we use extinctionCount.
    const diversityLimit = 5; // 5%
    const shouldInjectSingleImmigrant = currentDiversity < diversityLimit && generation > 5 && extinctionCount === 0;

    for (let i = 0; i < remainingSlots; i++) {
        // Simple noise injection logic for ES
        // We use pairs for antithetic sampling in normal ES, but if we have an odd number of slots 
        // or we are injecting immigrants, we just fill one by one.

        let params: number[];
        let bornMethod: Genome['bornMethod'] = 'es-sample';
        let noise = new Array(POLICY_PARAM_COUNT).fill(0);

        if (i < extinctionCount) {
            params = createRandomPolicyParams();
            bornMethod = 'immigrant';
        } else if (shouldInjectSingleImmigrant && i === remainingSlots - 1) {
            params = createRandomPolicyParams();
            bornMethod = 'immigrant';
            console.log(`[ES] Injecting Random Immigrant to recover diversity (${currentDiversity}%).`);
        } else {
            // Standard ES sampling (antithetic)
            // If i is even, create new noise. If i is odd, use negative of previous noise.
            // Note: This simplified version just draws fresh noise if not paired perfectly
            noise = new Array(POLICY_PARAM_COUNT).fill(0).map(randn);
            const sign = (i % 2 === 0) ? 1 : -1;
            params = addScaled(policyMeanParams, noise, sigma * sign);
            noise = noise.map(v => v * sign);
        }

        const genome = buildGenome(params, bornMethod, parentIds);
        const agent = new TetrisGame(genome, runSequences, {
            gravityScale: curriculum.gravityScale,
            maxPieces: curriculum.maxPieces
        });
        population.push(agent);
        populationNoise.push(noise);
    }
};

function captureGhostFrame(agent: TetrisGame) {
    if (!bestEverGhost || agent.genome.id !== ghostTargetId) return;

    // Throttle frame capture so we don't spam memory with identical frames
    const lastFrame = bestEverGhost.frames[bestEverGhost.frames.length - 1];
    if (lastFrame && !agent.currentPiece) return;

    const frame: GhostFrame = {
        grid: agent.grid.map(row => [...row])
    };

    if (agent.currentPiece) {
        frame.currentPiece = {
            shape: agent.currentPiece.shape.map((row: number[]) => [...row]),
            x: agent.currentPiece.x,
            y: agent.currentPiece.y,
            color: agent.currentPiece.color
        };
    }

    bestEverGhost.frames.push(frame);
    if (bestEverGhost.frames.length > MAX_GHOST_FRAMES) bestEverGhost.frames.shift();
}

function sendUpdate(forceFull = false) {
    const isNewGen = lastLineageGen !== generation;

    if (lineageHistory.length === 0 || isNewGen) {
        recordLineage();
    }

    const now = Date.now();
    const isHeavyUpdate = forceFull || isNewGen || (now - lastHeavyUpdateTime > 2000);
    if (isHeavyUpdate) lastHeavyUpdateTime = now;

    const agents: AgentState[] = population.map(p => {
        p.genome.summary = summarizePolicy(p.genome.policy.params, sigma);
        return {
            id: p.genome.id,
            grid: p.grid,
            score: p.score,
            lines: p.lines,
            level: p.level,
            multiplier: p.getPointsMultiplier(),
            isAlive: p.isAlive,
            genome: p.genome,
            currentPiece: p.currentPiece,
            nextPiecePreview: p.nextPiece.shape
        };
    });

    const fitnessData = population.map(p => computeFitness(p));
    const fitnessValues = fitnessData.map(d => d.fitness);
    const maxFitness = Math.max(...fitnessValues);

    // Update Hall of Fame
    if (maxFitness > bestEverFitness) {
        bestEverFitness = maxFitness;
        const bestAgent = population[fitnessValues.indexOf(maxFitness)];
        if (bestAgent) {
            bestEverGenome = { ...bestAgent.genome, fitness: maxFitness };
        }
    }

    const avgFitness = fitnessValues.reduce((a, b) => a + b, 0) / Math.max(1, fitnessValues.length);
    const diversity = computeDiversity(population.map(p => p.genome.policy.params));

    const bestScore = Math.max(...population.map(p => p.score), 0);
    const curriculum = getCurriculum(bestScore);

    const stats = {
        generation,
        maxFitness,
        bestEverFitness,
        avgFitness,
        medianFitness: GA.median(fitnessValues),
        diversity,
        mutationRate: sigma,
        populationSize,
        stage: isPaused ? 'Paused' : (curriculum.label === 'Warmup' ? 'Training' : 'Stable Evolution') as any
    };

    self.postMessage({
        type: 'UPDATE',
        payload: {
            agents,
            stats,
            // Only send heavy arrays periodically or on gen change
            lineage: isHeavyUpdate ? lineageHistory : undefined,
            leaderboard: isHeavyUpdate ? leaderboard : undefined,
            mutationRate: sigma,
            stagnationCount,
            ghost: isHeavyUpdate ? (bestEverGhost || undefined) : undefined,
            telemetryHistory: isHeavyUpdate ? telemetryHistory : undefined,
            endOfGenSnapshot: lastGenSnapshot
        }
    });

    // Clear snapshot after sending to prevent redundant captures
    if (lastGenSnapshot) lastGenSnapshot = null;
}

function initPopulation() {
    lineageHistory = [];
    leaderboard = [];
    bestEverGenome = null;
    bestEverFitness = 0;
    bestEverGhost = null;
    bestEverGhostScore = 0;
    ghostTargetId = null;
    telemetryHistory = [];
    fitnessHistory = [];
    prevGenMaxFitness = 0;
    stagnationCount = 0;
    populationSize = POPULATION_SIZE;
    policyMeanParams = createSeedPolicyParams();
    noveltyArchive = [];
    sigma = 0.28; // Reset mutation rate
    createPopulation(getCurriculum(0));
    recordLineage();
}

function recordLineage() {
    const nodes: LineageNode[] = population.map(p => {
        const fitResult = computeFitness(p);
        p.genome.summary = summarizePolicy(p.genome.policy.params, sigma);
        return {
            id: p.genome.id,
            generation: p.genome.generation,
            parents: p.genome.parents,
            fitness: fitResult.fitness,
            score: p.score,
            lines: p.lines,
            level: p.level,
            avgScore: p.averageScore || p.score,
            stress: p.calculateStress(),
            metrics: fitResult.metrics,
            summary: p.genome.summary,
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
    const safeAverage = (sum: number) => {
        const value = sum / populationCount;
        return Number.isFinite(value) ? value : 0;
    };
    const safeMax = (values: number[]) => {
        const finite = values.filter(Number.isFinite);
        return finite.length ? Math.max(...finite) : 0;
    };
    const telemetry: TelemetryFrame = {
        generation,
        avgScore: safeAverage(totals.score),
        avgLines: safeAverage(totals.lines),
        avgLevel: safeAverage(totals.level),
        maxScore: safeMax(nodes.map(n => n.score)),
        maxLines: safeMax(nodes.map(n => n.lines)),
        avgHoles: safeAverage(totals.holes),
        avgBumpiness: safeAverage(totals.bumpiness),
        avgMaxHeight: safeAverage(totals.maxHeight),
        avgWells: safeAverage(totals.wells),
        avgRowTransitions: safeAverage(totals.rowTransitions),
        avgColTransitions: safeAverage(totals.colTransitions),
        holeDensity: Math.min(1, safeAverage(totals.holes) / (BOARD_WIDTH * 0.8)),
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
    updateLeaderboard();

    const fitnesses = population.map(agent => computeFitness(agent).fitness);
    const signatures = population.map(agent => agent.getBehaviorSignature());
    const novelties = signatures.map(sig => computeNovelty(sig));

    const fitnessRanks = rankNormalize(fitnesses);
    const noveltyRanks = rankNormalize(novelties);
    const combinedScores = fitnessRanks.map((fit, i) => fit * (1 - NOVELTY_WEIGHT) + noveltyRanks[i] * NOVELTY_WEIGHT);

    const grad = new Array(POLICY_PARAM_COUNT).fill(0);
    for (let i = 0; i < population.length; i++) {
        const weight = combinedScores[i];
        const noise = populationNoise[i];
        for (let p = 0; p < grad.length; p++) {
            grad[p] += weight * noise[p];
        }
    }

    for (let p = 0; p < policyMeanParams.length; p++) {
        policyMeanParams[p] += (stepSize / (population.length * sigma)) * grad[p];
    }

    // Collective Learning: Integrate shared knowledge
    const collectiveInsights = extractCollectiveInsights(population);
    // Dynamic learning rate: Higher early on to establish culture, lower later to fine tune
    const collectiveLearningRate = Math.max(0.02, 0.15 * Math.pow(0.98, generation));
    policyMeanParams = applyCollectiveLearning(policyMeanParams, collectiveInsights, collectiveLearningRate);


    if (generation % 5 === 0 && collectiveInsights.archetypes.length > 0) {
        // Log the dominant archetype's top traits
        const dominant = collectiveInsights.archetypes[0]; // "The Architect" usually first in list
        const topTraits = Object.entries(dominant.attributes)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .slice(0, 3)
            .map(([k, v]) => `${k} (${v.toFixed(2)})`)
            .join(', ');
        console.log(`[Collective Learning] Gen ${generation} Cultivating: ${dominant.name} | Full-Spectrum Nudge across all 51 genes (${POLICY_PARAM_COUNT} weights) | Primary Drivers: ${topTraits}`);
    }


    const avgFitness = fitnesses.reduce((sum, v) => sum + v, 0) / Math.max(1, fitnesses.length);
    fitnessHistory.push(avgFitness);
    if (fitnessHistory.length > 8) fitnessHistory.shift();

    // 1. Learning Rate Scheduler - Smaller steps as agents mature
    const minStepSize = 0.08;
    stepSize = Math.max(minStepSize, 0.35 * Math.pow(0.992, generation));

    // 2. Sigma Annealing (Noise floor lowers over time to allow fine-tuning)
    const annealingTarget = 0.05;
    const sigmaFloor = Math.max(annealingTarget, 0.25 * Math.pow(0.985, generation / 5));

    if (fitnessHistory.length >= 5) {
        const trend = fitnessHistory[fitnessHistory.length - 1] - fitnessHistory[0];
        if (trend <= 0) stagnationCount++;
        else stagnationCount = 0;
    }

    const currentMaxFitness = Math.max(...fitnesses);
    const currentDiversity = computeDiversity(population.map(p => p.genome.policy.params));

    // 3. Refined Stagnation & Spike Logic
    if (currentDiversity <= 10 && currentMaxFitness > prevGenMaxFitness * 1.2 && generation > 5) {
        // Priority: Diversity. If low, don't lock sigma even if spike detected. 
        // Heating up slightly to encourage exploration.
        sigma = Math.max(0.2, sigma);
        console.log(`[ES] Spike detected but diversity low (${currentDiversity}%). Prioritizing exploration. Sigma: ${sigma.toFixed(3)}`);
    } else if (currentMaxFitness > prevGenMaxFitness * 1.5 && generation > 5 && currentDiversity > 15) {
        // Healthy spike - Lock in discovery
        const lockSigma = 0.06;
        if (sigma !== lockSigma) {
            console.log(`[ES] Fitness Spike Detected! Locking discovery. Sigma: ${sigma.toFixed(3)} -> ${lockSigma}`);
            sigma = lockSigma;
        }
        stagnationCount = 0;
    } else if (stagnationCount > 8) {
        // Severe stagnation - escape local minima with high noise (Wandering)
        sigma = Math.min(0.6, sigma + 0.15);
        stagnationCount = 0;
    } else if (stagnationCount > 3) {
        // Persistent stagnation - try reducing noise to fine-tune (Cooling)
        sigma = Math.max(sigmaFloor, sigma - 0.05);
    } else {
        // Healthy growth or minor stagnation - gently anneal
        sigma = Math.max(sigmaFloor, sigma - 0.005);
    }

    // Prepare for next generation
    prevGenMaxFitness = currentMaxFitness;

    const noveltySorted = signatures
        .map((sig, i) => ({ sig, novelty: novelties[i] }))
        .sort((a, b) => b.novelty - a.novelty)
        .slice(0, 4);
    noveltySorted.forEach(item => noveltyArchive.push(item.sig));
    if (noveltyArchive.length > NOVELTY_ARCHIVE_SIZE) {
        noveltyArchive = noveltyArchive.slice(noveltyArchive.length - NOVELTY_ARCHIVE_SIZE);
    }

    const bestAgent = population.reduce((best, curr) => {
        const currFit = computeFitness(curr).fitness;
        const bestFit = best ? computeFitness(best).fitness : -Infinity;
        return currFit > bestFit ? curr : best;
    }, population[0]);

    const bestScore = Math.max(...population.map(p => p.score), 0);
    // currentDiversity is already calculated above in the sigma logic section

    let extinctionCount = 0;
    if (currentDiversity <= 5 && generation > 5) {
        // Mass Extinction triggered below 5%
        // Target 20% diversity. Each random immigrant adds significant diversity.
        // Assuming each immigrant contributes roughly (100 / populationSize) * factor
        // We'll replace 15-20% of the population to be safe and effective.
        extinctionCount = Math.ceil(populationSize * 0.20);
        console.log(`[ES] Mass Extinction Triggered! Diversity: ${currentDiversity}%. Replacing bottom ${extinctionCount} agents.`);
    }

    // Capture snapshot for telemetry BEFORE resetting population
    if (bestAgent) {
        lastGenSnapshot = {
            generation: generation,
            agentId: bestAgent.genome.id,
            score: bestAgent.score,
            lines: bestAgent.lines,
            grid: bestAgent.grid.map(row => [...row]),
            currentPiece: bestAgent.currentPiece ? {
                shape: bestAgent.currentPiece.shape.map(row => [...row]),
                x: bestAgent.currentPiece.x,
                y: bestAgent.currentPiece.y,
                color: bestAgent.currentPiece.color
            } : undefined,
            timestamp: Date.now()
        };
    }

    generation++;
    createPopulation(getCurriculum(bestScore), bestAgent ? [bestAgent.genome.id] : [], extinctionCount, currentDiversity, collectiveInsights.seeds);
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

    const reportInterval = 16; // Cap UI at ~60fps to prevent message saturation
    if (now - lastUpdateTime >= reportInterval) {
        lastUpdateTime = now;
        sendUpdate();
    }
}, 4); // High-speed internal simulation (250 ticks/s)

self.onmessage = (e: MessageEvent<MainMessage>) => {
    const { type } = e.data;
    const payload = (e.data as any).payload;

    if (type === 'PAUSE') { isPaused = true; sendUpdate(); }
    if (type === 'RESUME') isPaused = false;
    if (type === 'RESET') {
        generation = 1;
        initPopulation();
        sendUpdate();
    }
    if (type === 'IMPORT_STATE') {
        const state = payload as FullSimulationState;

        runSequences = GA.generateRunSequences();
        const restoredCurriculum = getCurriculum(Math.max(...(state.population || []).map((g: any) => g?.score ?? 0), 0));
        population = state.population.map(g => new TetrisGame(normalizeGenome(g), runSequences, restoredCurriculum));
        populationNoise = population.map(() => new Array(POLICY_PARAM_COUNT).fill(0));

        generation = state.stats.generation;
        populationSize = Math.max(POPULATION_SIZE, population.length);
        if (population.length < POPULATION_SIZE) {
            for (let i = population.length; i < POPULATION_SIZE; i++) {
                const genome = buildGenome(addScaled(policyMeanParams, new Array(POLICY_PARAM_COUNT).fill(0).map(randn), sigma), 'seed', []);
                population.push(new TetrisGame(genome, runSequences, restoredCurriculum));
                populationNoise.push(new Array(POLICY_PARAM_COUNT).fill(0));
            }
        }

        sigma = state.mutationRate || sigma;
        stagnationCount = state.stagnationCount || 0;
        leaderboard = state.leaderboard || [];
        lineageHistory = state.lineage || [];
        telemetryHistory = state.telemetryHistory || [];
        if (state.ghost) bestEverGhost = state.ghost;

        policyMeanParams = averageParams(population.map(p => p.genome.policy.params));

        if (lineageHistory.length === 0 && population.length > 0) {
            recordLineage();
        }

        console.log(`[Worker] Deep State Restored. Gen: ${generation}, Agents: ${populationSize}, Sigma: ${sigma.toFixed(3)}`);
        sendUpdate();
    }
    if (type === 'INJECT_GENOME') {
        const genome = payload as Genome;
        const index = Math.floor(Math.random() * population.length);
        const curriculum = getCurriculum(Math.max(...population.map(p => p.score)));

        population[index] = new TetrisGame(genome, runSequences, curriculum);
        populationNoise[index] = new Array(POLICY_PARAM_COUNT).fill(0);

        console.log(`[Worker] Super Bot Injected! Replacing specimen: ${index}`);
        sendUpdate();
    }
    if (type === 'SUMMON_SUPER_BOT' as any) {
        const params = createSuperBotParams();
        const genome = buildGenome(params, 'elite', []);
        genome.id = `SUPER-${GA.generateId()}`;
        genome.color = '#fbbf24'; // Goldenrod

        const index = Math.floor(Math.random() * population.length);
        const curriculum = getCurriculum(Math.max(...population.map(p => p.score)));

        population[index] = new TetrisGame(genome, runSequences, curriculum);
        populationNoise[index] = new Array(POLICY_PARAM_COUNT).fill(0);

        console.log(`[Worker] Super Bot Summoned! Replacing specimen: ${index}`);
        sendUpdate();
    }
};

// Initial Start
initPopulation();
sendUpdate();

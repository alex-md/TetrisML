import { TetrisGame } from './TetrisGame';
import { POLICY_PARAM_COUNT, summarizePolicy } from './policy';

export interface ArchetypeInsights {
    name: string;
    description: string;
    vector: number[];
    attributes: Record<string, number>;
}

export interface CollectiveInsights {
    archetypes: ArchetypeInsights[];
    failures: ArchetypeInsights[];
    dominance: Record<string, number>; // Which archetype is currently most influential
}

/**
 * Extract multi-faceted collective wisdom based on specific evolutionary goals.
 */
export function extractCollectiveInsights(population: TetrisGame[]): CollectiveInsights {
    const aliveAgents = population.filter(a => a.piecesSpawned > 10);
    if (aliveAgents.length < 5) {
        return { archetypes: [], failures: [], dominance: {} };
    }

    // 1. Define Archetypes for Success
    const archetypes: ArchetypeInsights[] = [
        // The Architect: Focused on Line Clears and efficient stacking
        createArchetype(
            'The Architect',
            'Focuses on vertical efficiency and high volume of line clears',
            aliveAgents.sort((a, b) => (b.lines / Math.max(1, b.piecesSpawned)) - (a.lines / Math.max(1, a.piecesSpawned))),
            0.15
        ),
        // The Scorer: Focused on raw point accrual and multiplier management
        createArchetype(
            'The Scorer',
            'Maximizes raw score through Tetris-heavy play and points multipliers',
            aliveAgents.sort((a, b) => b.score - a.score),
            0.15
        ),
        // The Intellect: Focused on survival, low holes, and clean board state
        createArchetype(
            'The Intellect',
            'Prioritizes board cleanliness, hole avoidance, and long-term survival',
            aliveAgents.sort((a, b) => {
                const aMetrics = a.calculateMetrics(a.grid);
                const bMetrics = b.calculateMetrics(b.grid);
                const aCleanliness = (aMetrics.holes + aMetrics.bumpiness / 5);
                const bCleanliness = (bMetrics.holes + bMetrics.bumpiness / 5);
                return aCleanliness - bCleanliness; // Ascending order of messiness
            }),
            0.15
        )
    ];

    // 2. Define Failure Modes for Avoidance
    const failures: ArchetypeInsights[] = [
        // The Clutterer: Dies due to excessive holes and trapped space
        createArchetype(
            'The Clutterer',
            'Agents that fail by creating non-clearing layers and excessive holes',
            aliveAgents.sort((a, b) => {
                const aMetrics = a.calculateMetrics(a.grid);
                const bMetrics = b.calculateMetrics(b.grid);
                return bMetrics.holes - aMetrics.holes;
            }),
            0.10
        ),
        // The Topper: Fails due to aggressive height management failures
        createArchetype(
            'The Topper',
            'Agents that grow too high too fast without adequate clearing',
            aliveAgents.sort((a, b) => {
                const aMetrics = a.calculateMetrics(a.grid);
                const bMetrics = b.calculateMetrics(b.grid);
                return bMetrics.maxHeight - aMetrics.maxHeight;
            }),
            0.10
        )
    ];


    // 3. Determine Dominance based on relative performance
    const dominance: Record<string, number> = {};
    const avgScore = population.reduce((acc, a) => acc + (a.averageScore || a.score), 0) / population.length;

    archetypes.forEach(arc => {
        // Simple heuristic: how much better are the members of this archetype than the average?
        // We look at the top 5 agents for this specific goal
        const arcScoreAvg = avgScore > 0 ? (avgScore * 1.2) : 1000; // Placeholder if no score yet
        dominance[arc.name] = Math.max(0.1, arcScoreAvg / (avgScore || 1));
    });

    return { archetypes, failures, dominance };
}


/**
 * Apply multi-objective collective learning.
 */
export function applyCollectiveLearning(
    currentMean: number[],
    insights: CollectiveInsights,
    learningRate: number = 0.05
): number[] {
    if (insights.archetypes.length === 0) return currentMean;

    const newMean = [...currentMean];
    const baseAlpha = learningRate;
    const baseBeta = learningRate * 0.4;

    // Apply Success Nudges
    insights.archetypes.forEach(arc => {
        const weight = (insights.dominance[arc.name] || 1.0) / insights.archetypes.length;
        const alpha = baseAlpha * weight;

        for (let i = 0; i < POLICY_PARAM_COUNT; i++) {
            const delta = arc.vector[i] - currentMean[i];
            newMean[i] += delta * alpha;
        }
    });

    // Apply Failure Repulsions
    insights.failures.forEach(arc => {
        const beta = baseBeta / insights.failures.length;
        for (let i = 0; i < POLICY_PARAM_COUNT; i++) {
            const delta = currentMean[i] - arc.vector[i];
            newMean[i] += delta * beta;
        }
    });

    return newMean;
}

function createArchetype(name: string, description: string, sortedAgents: TetrisGame[], topPercent: number): ArchetypeInsights {
    const count = Math.max(2, Math.floor(sortedAgents.length * topPercent));
    const topAgents = sortedAgents.slice(0, count);
    const vector = computeCentroid(topAgents);
    const summary = summarizePolicy(vector, 0.1);

    return {
        name,
        description,
        vector,
        attributes: summary.sensitivities
    };
}

function computeCentroid(agents: TetrisGame[]): number[] {
    if (agents.length === 0) return new Array(POLICY_PARAM_COUNT).fill(0);
    const sum = new Array(POLICY_PARAM_COUNT).fill(0);
    agents.forEach(agent => {
        const params = agent.genome.policy.params;
        for (let i = 0; i < params.length; i++) {
            sum[i] += params[i];
        }
    });
    return sum.map(v => v / agents.length);
}

import { Genome } from '../../types';
import { GAMES_PER_GEN } from './constants';

export function randomColor() {
    const colors = ['#f472b6', '#22d3ee', '#818cf8', '#a78bfa', '#34d399', '#fbbf24'];
    return colors[Math.floor(Math.random() * colors.length)];
}

export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

export function createRandomGenome(generation: number): Genome {
    return {
        id: generateId(),
        generation: generation,
        fitness: 0,
        color: randomColor(),
        weights: {
            height: -0.5 + (Math.random() * 0.5),
            lines: 0.5 + (Math.random() * 0.5),
            holes: -0.8 + (Math.random() * 0.4),
            bumpiness: -0.3 + (Math.random() * 0.3),
            maxHeight: -0.5 + (Math.random() * 0.5),
            rowTransitions: -0.5 + (Math.random() * 0.5),
            colTransitions: -0.5 + (Math.random() * 0.5),
            wells: -0.5 + (Math.random() * 0.5),
            holeDepth: -0.5 + (Math.random() * 0.5),
            blockades: -0.5 + (Math.random() * 0.5),
            landingHeight: -0.3 + (Math.random() * 0.3),
            erodedCells: 0.2 + (Math.random() * 0.8),
            centerDev: -0.1 + (Math.random() * 0.2)
        },
        traits: {
            reactionSpeed: 0.3 + (Math.random() * 0.7),
            foresight: Math.random(),
            anxiety: Math.random()
        },
        parents: [],
        bornMethod: 'random'
    };
}

export function crossover(g1: Genome, g2: Genome, generation: number): Genome {
    const w1 = g1.weights;
    const w2 = g2.weights;

    return {
        id: generateId(),
        generation: generation,
        fitness: 0,
        color: Math.random() > 0.5 ? g1.color : g2.color,
        weights: {
            height: (w1.height + w2.height) / 2,
            lines: (w1.lines + w2.lines) / 2,
            holes: (w1.holes + w2.holes) / 2,
            bumpiness: (w1.bumpiness + w2.bumpiness) / 2,
            maxHeight: (w1.maxHeight + w2.maxHeight) / 2,
            rowTransitions: (w1.rowTransitions + w2.rowTransitions) / 2,
            colTransitions: (w1.colTransitions + w2.colTransitions) / 2,
            wells: (w1.wells + w2.wells) / 2,
            holeDepth: (w1.holeDepth + w2.holeDepth) / 2,
            blockades: (w1.blockades + w2.blockades) / 2,
            landingHeight: (w1.landingHeight + w2.landingHeight) / 2,
            erodedCells: (w1.erodedCells + w2.erodedCells) / 2,
            centerDev: (w1.centerDev + w2.centerDev) / 2,
        },
        traits: {
            reactionSpeed: (g1.traits.reactionSpeed + g2.traits.reactionSpeed) / 2,
            foresight: (g1.traits.foresight + g2.traits.foresight) / 2,
            anxiety: (g1.traits.anxiety + g2.traits.anxiety) / 2,
        },
        parents: [g1.id, g2.id],
        bornMethod: 'crossover'
    };
}

export function mutate(genome: Genome, mutationRate: number, sigmaScale = 1) {
    const sigma = 0.05 * sigmaScale; // Gaussian noise standard deviation
    const sparseProbability = 0.5; // Only mutate 50% of weights at a time

    const gausRandom = () => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    let mutated = false;
    const w = genome.weights;
    const keys = Object.keys(w) as (keyof typeof w)[];

    keys.forEach(k => {
        if (Math.random() < mutationRate && Math.random() < sparseProbability) {
            w[k] += gausRandom() * sigma;
            mutated = true;
        }
    });

    if (Math.random() < mutationRate) {
        genome.traits.reactionSpeed = Math.max(0, Math.min(1, genome.traits.reactionSpeed + gausRandom() * sigma));
        mutated = true;
    }
    if (Math.random() < mutationRate) {
        genome.traits.foresight = Math.max(0, Math.min(1, genome.traits.foresight + gausRandom() * sigma));
        mutated = true;
    }

    if (mutated) genome.bornMethod = 'mutation';
}

export function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[half];
    return (sorted[half - 1] + sorted[half]) / 2.0;
}

export function tournamentSelect(population: { averageScore?: number; genome: Genome }[], k = 5) {
    let best = null;
    for (let i = 0; i < k; i++) {
        const ind = population[Math.floor(Math.random() * population.length)];
        const score = ind.averageScore || 0;
        const bestScore = best ? (best.averageScore || 0) : -1;
        if (!best || score > bestScore) best = ind;
    }
    return best;
}

export function generateRunSequences(): number[][] {
    const sequences = [];
    for (let r = 0; r < GAMES_PER_GEN; r++) {
        let seq = [];
        for (let k = 0; k < 1000; k++) {
            let bag = [1, 2, 3, 4, 5, 6, 7];
            for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
            seq.push(...bag);
        }
        sequences.push(seq);
    }
    return sequences;
}

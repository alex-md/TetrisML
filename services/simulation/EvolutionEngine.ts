import { Genome } from '@/types';
import { GAMES_PER_GEN } from './constants';

export function randomColor() {
    const colors = ['#f472b6', '#22d3ee', '#818cf8', '#a78bfa', '#34d399', '#fbbf24'];
    return colors[Math.floor(Math.random() * colors.length)];
}

export function generateId() {
    return Math.random().toString(36).substr(2, 9);
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

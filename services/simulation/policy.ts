import { PolicySummary } from '../../types';
import { BOARD_HEIGHT, BOARD_WIDTH } from './constants';

export const POLICY_FEATURES = [
    ...Array.from({ length: BOARD_WIDTH }, (_, i) => `height_${i}`),
    ...Array.from({ length: BOARD_WIDTH }, (_, i) => `holes_${i}`),
    'maxHeight',
    'aggregateHeight',
    'bumpiness',
    'holes',
    'wells',
    'rowTransitions',
    'colTransitions',
    'landingHeight',
    'linesCleared',
    'erodedCells',
    'centerDev',
    'next_I',
    'next_J',
    'next_L',
    'next_O',
    'next_S',
    'next_T',
    'next_Z',
    'greed',         // Reward Tetris
    'riskAversion',  // Danger zone penalty
    'thoughtful',    // Surface variance
    'aggression',    // Combo potential
    'conservatism',  // Buriedness
    'agility',       // Piece flexibility
    'efficiency',    // Erosion
    'parity',        // Column parity
    'tSpin',         // T-spin potential
    'wellHealth',    // Col 9/10 status
    'receptivity',   // Surface matching (next piece)
    'tuckPotential', // Overhang slide capacity
    'stress'         // Stack height pressure
];

export const POLICY_INPUT_SIZE = POLICY_FEATURES.length;
export const POLICY_HIDDEN_SIZE = 32;
export const POLICY_OUTPUT_SIZE = 2; // [Move Score, Execution Speed]
export const POLICY_PARAM_COUNT = (POLICY_INPUT_SIZE * POLICY_HIDDEN_SIZE) + POLICY_HIDDEN_SIZE + (POLICY_HIDDEN_SIZE * POLICY_OUTPUT_SIZE) + POLICY_OUTPUT_SIZE;

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));

const baselineWeights = () => {
    const weights: number[] = [];
    for (let i = 0; i < BOARD_WIDTH; i++) weights.push(-0.8); // heights
    for (let i = 0; i < BOARD_WIDTH; i++) weights.push(-1.0); // holes per column
    weights.push(-1.0); // maxHeight
    weights.push(-1.0); // aggregateHeight (increased from -0.7)
    weights.push(-0.5); // bumpiness
    weights.push(-1.5); // holes (increased from -1.1)
    weights.push(0.15); // wells (small reward for tetris well)
    weights.push(-0.35); // rowTransitions
    weights.push(-0.35); // colTransitions
    weights.push(-0.5); // landingHeight
    weights.push(1.0); // linesCleared
    weights.push(0.6); // erodedCells
    weights.push(-0.2); // centerDev
    for (let i = 0; i < 7; i++) weights.push(0); // next piece one-hot (neutralized)
    weights.push(0.5);  // greed
    weights.push(-0.5); // riskAversion
    weights.push(-0.2); // thoughtful
    weights.push(0.1);  // aggression
    weights.push(-0.5); // conservatism
    weights.push(0.3);  // agility
    weights.push(0.2);  // efficiency
    weights.push(-0.4); // parity
    weights.push(1.2);  // tSpin (High reward)
    weights.push(0.8);  // wellHealth
    weights.push(0.5);  // receptivity
    weights.push(0.6);  // tuckPotential
    weights.push(0);    // stress (Neutral seed)
    return weights;
};

export const createSeedPolicyParams = (rng = Math.random) => {
    const params = new Array(POLICY_PARAM_COUNT).fill(0);
    const base = baselineWeights();
    const inputSize = POLICY_INPUT_SIZE;
    const hiddenSize = POLICY_HIDDEN_SIZE;

    const w1Offset = 0;
    const b1Offset = w1Offset + inputSize * hiddenSize;
    const w2Offset = b1Offset + hiddenSize;
    const b2Offset = w2Offset + hiddenSize;

    for (let h = 0; h < hiddenSize; h++) {
        for (let i = 0; i < inputSize; i++) {
            params[w1Offset + h * inputSize + i] = (rng() - 0.5) * 0.2;
        }
        params[b1Offset + h] = (rng() - 0.5) * 0.1;
        // Hidden to Output 0 (Score)
        params[w2Offset + h] = (rng() - 0.5) * 0.2;
        // Hidden to Output 1 (Speed)
        params[w2Offset + hiddenSize + h] = (rng() - 0.5) * 0.2;
    }
    params[b2Offset] = 0; // Bias Score
    params[b2Offset + 1] = 0; // Bias Speed

    // Seed a stable baseline in hidden unit 0.
    for (let i = 0; i < inputSize; i++) {
        params[w1Offset + i] = base[i] ?? 0;
    }
    params[w2Offset + 0] = 1.0;

    return params;
};

export const createRandomPolicyParams = (rng = Math.random) => {
    const params = new Array(POLICY_PARAM_COUNT);
    for (let i = 0; i < POLICY_PARAM_COUNT; i++) {
        params[i] = (rng() - 0.5) * 0.5;
    }
    return params;
};

export const forwardPolicy = (params: number[], inputs: number[]): { score: number; speed: number } => {
    const inputSize = POLICY_INPUT_SIZE;
    const hiddenSize = POLICY_HIDDEN_SIZE;

    const w1Offset = 0;
    const b1Offset = w1Offset + inputSize * hiddenSize;
    const w2Offset = b1Offset + hiddenSize;
    const b2Offset = w2Offset + hiddenSize * 2;

    let score = params[b2Offset];
    let speed = params[b2Offset + 1];

    for (let h = 0; h < hiddenSize; h++) {
        let sum = params[b1Offset + h];
        const base = w1Offset + h * inputSize;
        for (let i = 0; i < inputSize; i++) {
            sum += params[base + i] * inputs[i];
        }
        const activation = Math.tanh(sum);
        score += params[w2Offset + h] * activation;
        speed += params[w2Offset + hiddenSize + h] * activation;
    }

    return {
        score,
        // Speed is squashed to [0, 1] range via sigmoid-like mapping or tanh
        speed: (Math.tanh(speed) + 1) / 2
    };
};

export const summarizePolicy = (params: number[], exploration: number): PolicySummary => {
    const inputSize = POLICY_INPUT_SIZE;
    const hiddenSize = POLICY_HIDDEN_SIZE;
    const w1Offset = 0;
    const b1Offset = w1Offset + inputSize * hiddenSize;
    const w2Offset = b1Offset + hiddenSize;

    const importances: number[] = new Array(inputSize).fill(0);
    for (let i = 0; i < inputSize; i++) {
        let score = 0;
        for (let h = 0; h < hiddenSize; h++) {
            score += params[w2Offset + h] * params[w1Offset + h * inputSize + i];
        }
        importances[i] = score;
    }

    const maxAbs = importances.reduce((acc, v) => Math.max(acc, Math.abs(v)), 1e-6);
    const sensitivities: Record<string, number> = {};
    POLICY_FEATURES.forEach((label, idx) => {
        sensitivities[label] = clamp(importances[idx] / maxAbs, -1, 1);
    });

    return { sensitivities, exploration };
};

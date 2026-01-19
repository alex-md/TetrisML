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
    'next_Z'
];

export const POLICY_INPUT_SIZE = POLICY_FEATURES.length;
export const POLICY_HIDDEN_SIZE = 16;
export const POLICY_PARAM_COUNT = (POLICY_INPUT_SIZE * POLICY_HIDDEN_SIZE) + POLICY_HIDDEN_SIZE + POLICY_HIDDEN_SIZE + 1;

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));

const baselineWeights = () => {
    const weights: number[] = [];
    for (let i = 0; i < BOARD_WIDTH; i++) weights.push(-0.8); // heights
    for (let i = 0; i < BOARD_WIDTH; i++) weights.push(-1.0); // holes per column
    weights.push(-1.0); // maxHeight
    weights.push(-0.7); // aggregateHeight
    weights.push(-0.5); // bumpiness
    weights.push(-1.1); // holes
    weights.push(0.15); // wells (small reward for tetris well)
    weights.push(-0.35); // rowTransitions
    weights.push(-0.35); // colTransitions
    weights.push(-0.5); // landingHeight
    weights.push(1.0); // linesCleared
    weights.push(0.6); // erodedCells
    weights.push(-0.2); // centerDev
    for (let i = 0; i < 7; i++) weights.push(0); // next piece one-hot
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
        params[w2Offset + h] = (rng() - 0.5) * 0.2;
    }
    params[b2Offset] = 0;

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

export const forwardPolicy = (params: number[], inputs: number[]) => {
    const inputSize = POLICY_INPUT_SIZE;
    const hiddenSize = POLICY_HIDDEN_SIZE;

    const w1Offset = 0;
    const b1Offset = w1Offset + inputSize * hiddenSize;
    const w2Offset = b1Offset + hiddenSize;
    const b2Offset = w2Offset + hiddenSize;

    let output = params[b2Offset];
    for (let h = 0; h < hiddenSize; h++) {
        let sum = params[b1Offset + h];
        const base = w1Offset + h * inputSize;
        for (let i = 0; i < inputSize; i++) {
            sum += params[base + i] * inputs[i];
        }
        const activation = Math.tanh(sum);
        output += params[w2Offset + h] * activation;
    }
    return output;
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


export interface PolicyNetwork {
  inputSize: number;
  hiddenSize: number;
  params: number[];
}

export interface PolicySummary {
  sensitivities: Record<string, number>;
  exploration: number;
}

export interface Genome {
  id: string;
  policy: PolicyNetwork;
  summary: PolicySummary;
  generation: number;
  fitness: number;
  color: string;
  parents: string[]; // IDs of parents
  bornMethod: 'seed' | 'es-sample' | 'elite' | 'imported' | 'immigrant' | 'hall-of-fame';
}

export interface AgentState {
  id: string;
  grid: number[][]; // 20x10 grid, 0 = empty, 1-7 = colors, 8 = garbage
  score: number;
  lines: number;
  level: number;
  multiplier: number;
  isAlive: boolean;
  genome: Genome;
  currentPiece?: {
    shape: number[][];
    x: number;
    y: number;
    color: number;
  };
  nextPiecePreview?: number[][]; // Visual for UI
}

export interface GhostFrame {
  grid: number[][];
  currentPiece?: {
    shape: number[][];
    x: number;
    y: number;
    color: number;
  };
}

export interface GhostPlayback {
  id: string;
  generation: number;
  score: number;
  frames: GhostFrame[];
  createdAt: number;
}

export interface GenerationSnapshot {
  generation: number;
  agentId: string;
  score: number;
  lines: number;
  grid: number[][];
  currentPiece?: {
    shape: number[][];
    x: number;
    y: number;
    color: number;
  };
  timestamp: number;
}

export interface LineageNode {
  id: string;
  generation: number;
  parents: string[];
  fitness: number;
  score: number;
  lines: number;
  level: number;
  avgScore: number;
  stress: number;
  metrics: {
    aggregateHeight: number;
    completeLines: number;
    holes: number;
    bumpiness: number;
    maxHeight: number;
    rowTransitions: number;
    colTransitions: number;
    wells: number;
    holeDepth: number;
    blockades: number;
    columnHeights: number[];
    holesByColumn: number[];
    throughput?: number;
    efficiency?: number;
  };
  summary: PolicySummary;
  color: string;
  bornMethod: Genome['bornMethod'];
}

export interface LeaderboardEntry {
  id: string;
  score: number;
  level: number;
  lines: number;
  generation: number;
  bornMethod: string;
  timestamp: number;
}

export interface SimulationStats {
  generation: number;
  maxFitness: number;
  avgFitness: number;
  medianFitness: number;
  bestEverFitness: number;
  diversity: number; // 0-100
  mutationRate: number;
  populationSize: number;
  stage: 'Training' | 'Evolving' | 'Paused' | 'Mass Extinction' | 'Stable Evolution';
}

export interface FullSimulationState {
  population: Genome[];
  stats: SimulationStats;
  leaderboard: LeaderboardEntry[];
  lineage: LineageNode[][];
  telemetryHistory?: TelemetryFrame[];
  ghost?: GhostPlayback;
  timeline?: GenerationSnapshot[];
  history: { gen: number; fitness: number }[];
  mutationRate: number;
  stagnationCount: number;
  timestamp: number;
}

export interface TelemetryFrame {
  generation: number;
  avgScore: number;
  avgLines: number;
  avgLevel: number;
  maxScore: number;
  maxLines: number;
  avgHoles: number;
  avgBumpiness: number;
  avgMaxHeight: number;
  avgWells: number;
  avgRowTransitions: number;
  avgColTransitions: number;
  holeDensity: number;
  timestamp: number;
}

export type SimWorkerMessage =
  | {
    type: 'UPDATE'; payload: {
      agents: AgentState[];
      stats: SimulationStats;
      lineage: LineageNode[][];
      leaderboard: LeaderboardEntry[];
      mutationRate?: number;
      stagnationCount?: number;
      ghost?: GhostPlayback;
      telemetryHistory?: TelemetryFrame[];
    }
  }
  | { type: 'GEN_COMPLETE'; payload: { generation: number; bestGenome: Genome } };

export type MainMessage =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'IMPORT_STATE'; payload: FullSimulationState }
  | { type: 'INJECT_GENOME'; payload: Genome };

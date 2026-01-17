
export interface Genome {
  id: string;
  weights: {
    height: number;
    lines: number;
    holes: number;
    bumpiness: number;
    // New Heuristics
    maxHeight: number;      // Penalize tall columns
    rowTransitions: number; // Penalize unconnected blocks horizontally
    colTransitions: number; // Penalize unconnected blocks vertically
    wells: number;          // Penalize deep 1-wide gaps
    holeDepth: number;      // Penalize blocks stacked on top of holes
    blockades: number;      // Penalize number of blocks covering holes
    landingHeight: number;  // Penalize placing pieces high up
    erodedCells: number;    // Reward clearing lines with the active piece
    centerDev: number;      // Penalize playing on edges (encourage center play)
  };
  traits: {
    reactionSpeed: number; // 0.0 to 1.0 (Higher is faster)
    foresight: number;     // 0.0 to 1.0 (Higher likelihood of 2-step lookahead)
    anxiety: number;       // 0.0 to 1.0 (Higher likelihood of random panic drops)
  };
  generation: number;
  fitness: number;
  color: string;
  parents: string[]; // IDs of parents
  bornMethod: 'elite' | 'crossover' | 'random' | 'mutation' | 'god-child';
}

export interface AgentState {
  id: string;
  grid: number[][]; // 20x10 grid, 0 = empty, 1-7 = colors, 8 = garbage
  score: number;
  lines: number;
  level: number;
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

export interface LineageNode {
  id: string;
  generation: number;
  parents: string[];
  fitness: number;
  bornMethod: 'elite' | 'crossover' | 'random' | 'mutation' | 'god-child';
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
  history: { gen: number; fitness: number }[];
  mutationRate: number;
  stagnationCount: number;
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
    }
  }
  | { type: 'GEN_COMPLETE'; payload: { generation: number; bestGenome: Genome } };

export type MainMessage =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'SET_SPEED'; payload: number } // 1 = normal, 10 = fast
  | { type: 'INJECT_CONFIG'; payload: Partial<SimulationStats> }
  | { type: 'TAKE_CONTROL'; payload: string | null } // agentId
  | { type: 'CONTROL_INPUT'; payload: 'LEFT' | 'RIGHT' | 'DOWN' | 'ROTATE' | 'DROP' }
  | { type: 'IMPORT_STATE'; payload: FullSimulationState };

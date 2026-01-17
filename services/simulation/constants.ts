export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const POPULATION_SIZE = 24;

export const TETROMINOES = [
    [],
    [ // I
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    [ // J
        [2, 0, 0],
        [2, 2, 2],
        [0, 0, 0]
    ],
    [ // L
        [0, 0, 3],
        [3, 3, 3],
        [0, 0, 0]
    ],
    [ // O
        [4, 4],
        [4, 4]
    ],
    [ // S
        [0, 5, 5],
        [5, 5, 0],
        [0, 0, 0]
    ],
    [ // T
        [0, 6, 0],
        [6, 6, 6],
        [0, 0, 0]
    ],
    [ // Z
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0]
    ],
];

export const GAMES_PER_GEN = 1; // Single run per generation for fast evolution
export const ELITE_COUNT = 6;      // Keep top 6 agents
export const IMMIGRANT_COUNT = 4;   // Add 4 random agents per gen
export const MAX_PIECES_PER_RUN = 100000; // Hard cap to force high-scoring play

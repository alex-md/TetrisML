export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

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

export const GAMES_PER_GEN = 15; // Increased for more stable evaluation
export const ELITE_COUNT = 4;      // Keep top 4 agents
export const IMMIGRANT_COUNT = 2;   // Add 2 random agents per gen


export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const POPULATION_SIZE = 12;

export const TETROMINO_COLORS = [
  'transparent', // 0
  '#06b6d4', // I - cyan-500
  '#3b82f6', // J - blue-500
  '#f97316', // L - orange-500
  '#eab308', // O - yellow-500
  '#22c55e', // S - green-500
  '#a855f7', // T - purple-500
  '#ef4444', // Z - red-500
  '#64748b', // Garbage - slate-500
];

export const TETROMINOES = [
  [], // Empty
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

// Helper to get hex color from index
export const getBlockColor = (index: number) => TETROMINO_COLORS[index] || 'transparent';

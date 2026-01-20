import { Genome } from '../../types';
import { BOARD_WIDTH, BOARD_HEIGHT, TETROMINOES, MAX_PIECES_PER_RUN } from './constants';
import { forwardPolicy, POLICY_INPUT_SIZE } from './policy';

function createGrid() {
    return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
}

function cloneGrid(grid: number[][]) {
    return grid.map(row => [...row]);
}

export class TetrisGame {
    genome: Genome;
    grid: number[][];
    score: number;
    lines: number;
    level: number;
    isAlive: boolean;

    runsCompleted: number;
    runScores: number[];
    averageScore?: number;
    tetrisCount: number;
    behaviorSamples: number;
    behaviorSums: { holes: number; bumpiness: number; maxHeight: number; wells: number; };

    pieceIndex: number;
    piecesSpawned: number;
    currentRunSequence: number[];

    currentPiece: any;
    nextPiece: any; // Keep this from original
    actionQueue: string[] = [];
    hasPlanned: boolean = false;
    lockTimer: number = 0;
    lockDelay: number = 20;
    lockResets: number = 0;
    maxLockResets: number = 10;
    gravityTimer: number = 0;
    gravityThreshold: number = 30;
    reactionTimer: number = 0;
    totalTicks: number = 0;
    currentSpeed: number = 0.5; // From policy

    gravityScale: number;
    maxPiecesPerRun: number;

    constructor(genome: Genome, runSequences: number[][], options?: { gravityScale?: number; maxPieces?: number; }) {
        this.genome = genome;
        this.grid = createGrid();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.isAlive = true;

        this.runsCompleted = 0;
        this.runScores = [];
        this.tetrisCount = 0;
        this.behaviorSamples = 0;
        this.behaviorSums = { holes: 0, bumpiness: 0, maxHeight: 0, wells: 0 };

        this.pieceIndex = 0;
        this.piecesSpawned = 0;
        this.currentRunSequence = runSequences[0] || [];

        this.actionQueue = [];
        this.hasPlanned = false;
        this.reactionTimer = 0;

        this.gravityTimer = 0;
        this.gravityThreshold = 50;
        this.gravityScale = options?.gravityScale ?? 1;
        this.maxPiecesPerRun = options?.maxPieces ?? MAX_PIECES_PER_RUN;

        this.lockDelay = 30;
        this.lockTimer = 0;
        this.lockResets = 0;
        this.maxLockResets = 15;

        this.nextPiece = this.getPieceFromSequence(0);
        this.pieceIndex++;
        this.spawnPiece();
    }

    resetGame(runSequences: number[][]) {
        this.grid = createGrid();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.isAlive = true;

        this.pieceIndex = 0;
        this.piecesSpawned = 0;
        this.currentRunSequence = runSequences[this.runsCompleted] || runSequences[0];

        this.actionQueue = [];
        this.hasPlanned = false;
        this.reactionTimer = 0;
        this.gravityTimer = 0;
        this.gravityThreshold = 50;
        this.lockTimer = 0;
        this.lockResets = 0;
        this.tetrisCount = 0;
        this.behaviorSamples = 0;
        this.behaviorSums = { holes: 0, bumpiness: 0, maxHeight: 0, wells: 0 };

        this.nextPiece = this.getPieceFromSequence(0);
        this.pieceIndex++;
        this.spawnPiece();
    }

    getPieceFromSequence(index: number) {
        const typeIdx = this.currentRunSequence[index % this.currentRunSequence.length];
        return {
            shape: TETROMINOES[typeIdx],
            color: typeIdx
        };
    }

    spawnPiece() {
        this.currentPiece = {
            shape: this.nextPiece.shape,
            color: this.nextPiece.color,
            x: Math.floor((BOARD_WIDTH - this.nextPiece.shape[0].length) / 2),
            y: 0,
        };

        this.nextPiece = this.getPieceFromSequence(this.pieceIndex);
        this.pieceIndex++;
        this.piecesSpawned++;

        if (this.piecesSpawned > this.maxPiecesPerRun) {
            this.handleDeath();
            return;
        }

        this.actionQueue = [];
        this.hasPlanned = false;
        this.lockTimer = 0;
        this.lockResets = 0;

        this.reactionTimer = 0;
        this.gravityThreshold = Math.max(1, Math.floor(50 * Math.pow(0.8, this.level - 1) * this.gravityScale));
        this.gravityTimer = 0;

        if (this.checkCollision(this.grid, this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
            this.handleDeath();
        }
    }

    handleDeath() {
        // Logic for multi-run fitness should be handled outside or via callback
        // For now we mark as dead and wait for EvolutionEngine
        this.isAlive = false;
    }

    tick() {
        if (!this.isAlive) return;
        this.totalTicks++;

        const onGround = this.checkCollision(this.grid, this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y + 1);

        if (onGround) {
            this.lockTimer++;
            if (this.lockTimer >= this.lockDelay) {
                this.lockPiece();
                return;
            }
        } else {
            this.gravityTimer++;
            if (this.gravityTimer >= this.gravityThreshold) {
                this.gravityTimer = 0;
                this.move(0, 1);
                this.lockTimer = 0;
            }
        }

        if (this.reactionTimer > 0) {
            this.reactionTimer--;
            return;
        }

        if (!this.hasPlanned) {
            this.planBestMove();
            this.hasPlanned = true;
        }

        if (this.actionQueue.length > 0) {
            const actionArr = this.actionQueue.shift();
            if (actionArr) this.executeAction(actionArr);
            // High-speed reaction: 0 delay for fast pieces, 1 tick delay for slow pieces
            this.reactionTimer = this.currentSpeed > 0.8 ? 0 : 1;
        }
    }

    executeAction(action: string) {
        if (!this.currentPiece) return;

        let success = false;
        switch (action) {
            case 'L': success = this.move(-1, 0); break;
            case 'R': success = this.move(1, 0); break;
            case 'D': success = this.move(0, 1); break;
            case 'ROT': success = this.rotateCW(); break;
            case 'DROP': this.hardDrop(); break;
        }

        if (success && this.lockResets < this.maxLockResets) {
            const onGround = this.checkCollision(this.grid, this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y + 1);
            if (onGround) {
                this.lockTimer = 0;
                this.lockResets++;
            }
        }
    }

    planBestMove() {
        // Find all physically reachable moves and their button-press paths
        const candidates = this.getPossibleMoves(this.currentPiece, this.grid);
        if (candidates.length === 0) return;

        // Evaluate top candidates using our policy (1-piece and filtered 2-piece)
        let evaluated = candidates.map(cand => {
            const simState = this.getSimulatedGrid(this.grid, cand);
            const metrics = this.calculateMetrics(simState.grid);
            const featureVector = this.buildFeatureVector(metrics, {
                linesCleared: simState.linesCleared,
                landingHeight: simState.landingHeight,
                erodedCells: simState.erodedCells,
                centerDev: Math.abs((cand.x + cand.shape[0].length / 2) - (BOARD_WIDTH / 2))
            });
            const evalResult = forwardPolicy(this.genome.policy.params, featureVector);
            const score = evalResult.score;

            return { ...cand, score, speed: evalResult.speed, landing: simState.landingHeight, simGrid: simState.grid };
        });

        // 2-Piece Lookahead for top 5 candidates
        evaluated.sort((a, b) => b.score - a.score);
        const topCandidates = evaluated.slice(0, 5);

        for (const cand of topCandidates) {
            const nextSpawnPiece = {
                shape: this.nextPiece.shape,
                color: this.nextPiece.color,
                x: Math.floor((BOARD_WIDTH - this.nextPiece.shape[0].length) / 2),
                y: 0
            };

            const nextMoves = this.getPossibleMoves(nextSpawnPiece, cand.simGrid);
            if (nextMoves.length > 0) {
                let bestNextScore = -Infinity;
                for (const nm of nextMoves) {
                    const nSim = this.getSimulatedGrid(cand.simGrid, nm);
                    const nMetrics = this.calculateMetrics(nSim.grid);
                    const nFeatures = this.buildFeatureVector(nMetrics, {
                        linesCleared: nSim.linesCleared,
                        landingHeight: nSim.landingHeight,
                        erodedCells: nSim.erodedCells,
                        centerDev: Math.abs((nm.x + nm.shape[0].length / 2) - (BOARD_WIDTH / 2))
                    });
                    const nEval = forwardPolicy(this.genome.policy.params, nFeatures);
                    if (nEval.score > bestNextScore) bestNextScore = nEval.score;
                }
                cand.score += bestNextScore * 0.85;
            } else {
                cand.score -= 500;
            }
        }

        // Final selection
        topCandidates.sort((a, b) => b.score - a.score);
        const best = topCandidates[0] || evaluated[0];

        if (best) {
            this.actionQueue = [...best.path, 'DROP'];
            this.currentSpeed = best.speed; // Adopt the speed decided for this move
        }
    }


    getSimulatedGrid(baseGrid: number[][], move: any) {
        const simGrid = cloneGrid(baseGrid);
        const { shape, x, y } = move;
        const color = move.color || 1;

        for (let py = 0; py < shape.length; py++) {
            for (let px = 0; px < shape[py].length; px++) {
                if (shape[py][px] !== 0) {
                    const boardY = py + y;
                    const boardX = px + x;
                    if (boardY >= 0 && boardY < BOARD_HEIGHT) {
                        simGrid[boardY][boardX] = color;
                    }
                }
            }
        }

        let linesCleared = 0;
        let erodedCells = 0;

        for (let r = BOARD_HEIGHT - 1; r >= 0; r--) {
            if (simGrid[r].every(c => c !== 0)) {
                linesCleared++;
                const relativeY = r - y;
                if (relativeY >= 0 && relativeY < shape.length) {
                    for (let px = 0; px < shape[relativeY].length; px++) {
                        if (shape[relativeY][px] !== 0) erodedCells++;
                    }
                }
                simGrid.splice(r, 1);
                simGrid.unshift(Array(BOARD_WIDTH).fill(0));
                r++;
            }
        }

        const landingHeight = BOARD_HEIGHT - (y + shape.length);

        return {
            grid: simGrid,
            linesCleared,
            erodedCells: linesCleared * erodedCells,
            landingHeight
        };
    }

    buildFeatureVector(metrics: any, moveStats: { linesCleared: number; landingHeight: number; erodedCells: number; centerDev: number; }) {
        const maxRowTransitions = BOARD_HEIGHT * (BOARD_WIDTH + 1);
        const maxColTransitions = BOARD_WIDTH * (BOARD_HEIGHT + 1);
        const maxBumpiness = BOARD_HEIGHT * (BOARD_WIDTH - 1);
        const maxWells = BOARD_HEIGHT * 4;

        const features: number[] = [];
        for (const h of metrics.columnHeights) features.push(h / BOARD_HEIGHT);
        for (const h of metrics.holesByColumn) features.push(h / BOARD_HEIGHT);
        features.push(metrics.maxHeight / BOARD_HEIGHT);
        features.push(metrics.aggregateHeight / (BOARD_HEIGHT * BOARD_WIDTH));
        features.push(metrics.bumpiness / maxBumpiness);
        features.push(metrics.holes / (BOARD_HEIGHT * BOARD_WIDTH));
        features.push(metrics.wells / maxWells);
        features.push(metrics.rowTransitions / maxRowTransitions);
        features.push(metrics.colTransitions / maxColTransitions);
        features.push(moveStats.landingHeight / BOARD_HEIGHT);
        features.push(moveStats.linesCleared / 4);
        features.push(moveStats.erodedCells / 16);
        features.push(moveStats.centerDev / (BOARD_WIDTH / 2));

        const nextIndex = Math.max(0, Math.min(6, (this.nextPiece?.color || 1) - 1));
        for (let i = 0; i < 7; i++) {
            features.push(i === nextIndex ? 1 : 0);
        }

        if (features.length !== POLICY_INPUT_SIZE) {
            const fill = new Array(POLICY_INPUT_SIZE - features.length).fill(0);
            return features.concat(fill);
        }
        return features;
    }

    calculateStress() {
        let minParamsY = BOARD_HEIGHT;
        for (let x = 0; x < BOARD_WIDTH; x++) {
            for (let y = 0; y < BOARD_HEIGHT; y++) {
                if (this.grid[y][x] !== 0) {
                    if (y < minParamsY) minParamsY = y;
                    break;
                }
            }
        }
        return 1 - (minParamsY / BOARD_HEIGHT);
    }

    getPossibleMoves(piece: any, grid: number[][]) {
        const reachable = [];
        const visited = new Set();
        const queue = [];

        // All 4 rotation shapes for this piece type
        const rotations = [];
        let r = piece.shape;
        for (let i = 0; i < 4; i++) {
            rotations.push(r);
            r = this.rotate(r);
        }

        const startNode = { x: piece.x, y: piece.y, rot: 0, path: [] as string[] };
        queue.push(startNode);
        visited.add(`${startNode.x},${startNode.y},${startNode.rot}`);

        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) continue;
            const { x, y, rot, path } = item;
            const shape = rotations[rot];

            // 1. Horizontal/Down Moves
            const actions = [
                { dx: -1, dy: 0, key: 'L' },
                { dx: 1, dy: 0, key: 'R' },
                { dx: 0, dy: 1, key: 'D' }
            ];

            let canMoveDown = false;
            for (let a of actions) {
                if (!this.checkCollision(grid, shape, x + a.dx, y + a.dy)) {
                    const key = `${x + a.dx},${y + a.dy},${rot}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        queue.push({ x: x + a.dx, y: y + a.dy, rot, path: [...path, a.key] });
                    }
                    if (a.dy === 1) canMoveDown = true;
                }
            }

            // 2. Rotation Moves (include basic wall kicks)
            const nextRot = (rot + 1) % 4;
            const nextShape = rotations[nextRot];

            // Try standard rotation, then 1-step wall kicks
            const kickOffsets = [[0, 0], [-1, 0], [1, 0], [0, -1]];
            for (const [kx, ky] of kickOffsets) {
                if (!this.checkCollision(grid, nextShape, x + kx, y + ky)) {
                    const key = `${x + kx},${y + ky},${nextRot}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        const kickPath = [...path];
                        if (kx !== 0 || ky !== 0) kickPath.push('ROT'); // Simplified as ROT for logic
                        else kickPath.push('ROT');
                        queue.push({ x: x + kx, y: y + ky, rot: nextRot, path: kickPath });
                    }
                    break; // Use the first successful kick
                }
            }

            // A move is "final" if the piece cannot move down anymore from this position
            if (!canMoveDown) {
                reachable.push({ x, y, shape: rotations[rot], rot, color: piece.color, path });
            }
        }
        return reachable;
    }

    checkCollision(grid: number[][], shape: number[][], offsetX: number, offsetY: number) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x] !== 0) {
                    const newX = x + offsetX;
                    const newY = y + offsetY;
                    if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT || (newY >= 0 && grid[newY][newX] !== 0)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    rotate(shape: number[][]) {
        const N = shape.length;
        const M = shape[0].length;
        const result = Array.from({ length: M }, () => Array(N).fill(0));
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < M; x++) {
                result[x][N - 1 - y] = shape[y][x];
            }
        }
        return result;
    }

    move(dx: number, dy: number) {
        if (!this.isAlive) return false;
        if (!this.checkCollision(this.grid, this.currentPiece.shape, this.currentPiece.x + dx, this.currentPiece.y + dy)) {
            this.currentPiece.x += dx;
            this.currentPiece.y += dy;
            return true;
        }
        return false;
    }

    rotateCW() {
        if (!this.isAlive) return false;
        const newShape = this.rotate(this.currentPiece.shape);

        // Basic SRS-style Wall Kicks: Try (0,0), then (-1,0), (1,0), (0,-1)
        const kicks = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];
        for (const [kx, ky] of kicks) {
            if (!this.checkCollision(this.grid, newShape, this.currentPiece.x + kx, this.currentPiece.y + ky)) {
                this.currentPiece.x += kx;
                this.currentPiece.y += ky;
                this.currentPiece.shape = newShape;
                return true;
            }
        }
        return false;
    }

    hardDrop() {
        if (!this.isAlive) return;
        while (!this.checkCollision(this.grid, this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y + 1)) {
            this.currentPiece.y++;
        }
        this.lockPiece();
    }

    addGarbageLine() {
        this.grid.shift();
        const holeIdx = Math.floor(Math.random() * BOARD_WIDTH);
        const line = new Array(BOARD_WIDTH).fill(8);
        line[holeIdx] = 0;
        this.grid.push(line);
        this.hasPlanned = false;
        this.actionQueue = [];
        if (this.currentPiece && this.checkCollision(this.grid, this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
            if (!this.checkCollision(this.grid, this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y - 1)) {
                this.currentPiece.y -= 1;
            } else {
                this.isAlive = false;
            }
        }
    }

    getPointsMultiplier(): number {
        // Mastery Bonus: Strong reward for skill (lines cleared). +1.0x every 10 lines.
        const lineBonus = this.lines / 10;
        // Performance Bonus: Polynomial growth (sqrt) based on points. Reaches +10.0x at 200k points.
        const scoreBonus = Math.sqrt(this.score / 2000);
        // Veteran Bonus (Minimal): Reduced reward for just surviving (+1.0x per 5 mins at default speed).
        const survivalBonus = this.totalTicks / 18000;

        // Final Multiplier (High cap for elites, but sub-exponential growth curve)
        return Math.min(200, 1.0 + lineBonus + scoreBonus + survivalBonus);
    }

    lockPiece() {
        const shape = this.currentPiece.shape;
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x] !== 0) {
                    const boardY = y + this.currentPiece.y;
                    const boardX = x + this.currentPiece.x;
                    if (boardY >= 0 && boardY < BOARD_HEIGHT) {
                        this.grid[boardY][boardX] = this.currentPiece.color;
                    }
                }
            }
        }

        let linesCleared = 0;
        for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.grid[y].every(cell => cell !== 0)) {
                this.grid.splice(y, 1);
                this.grid.unshift(Array(BOARD_WIDTH).fill(0));
                linesCleared++;
                y++;
            }
        }

        this.lines += linesCleared;
        if (linesCleared === 4) this.tetrisCount += 1;

        const multiplier = this.getPointsMultiplier();
        const levelMult = Math.max(1, this.level);
        let baseScore = 0;
        switch (linesCleared) {
            case 1: baseScore = 100 * levelMult; break;
            case 2: baseScore = 400 * levelMult; break;
            case 3: baseScore = 900 * levelMult; break;
            case 4: baseScore = 2500 * levelMult; break;
        }

        this.score += Math.floor(baseScore * multiplier);
        this.score += Math.max(1, Math.floor(1 * multiplier)); // Base piece lock score

        this.level = Math.floor(this.lines / 10) + 1;

        const metrics = this.calculateMetrics(this.grid);
        this.behaviorSamples += 1;
        this.behaviorSums.holes += metrics.holes;
        this.behaviorSums.bumpiness += metrics.bumpiness;
        this.behaviorSums.maxHeight += metrics.maxHeight;
        this.behaviorSums.wells += metrics.wells;

        this.spawnPiece();
    }

    calculateMetrics(grid: number[][]) {
        let aggregateHeight = 0;
        let completeLines = 0;
        let holes = 0;
        let bumpiness = 0;
        let maxHeight = 0;
        let rowTransitions = 0;
        let colTransitions = 0;
        let wells = 0;
        let holeDepth = 0;
        let blockades = 0;

        const columnHeights = new Array(BOARD_WIDTH).fill(0);
        const holesByColumn = new Array(BOARD_WIDTH).fill(0);

        for (let x = 0; x < BOARD_WIDTH; x++) {
            for (let y = 0; y < BOARD_HEIGHT; y++) {
                if (grid[y][x] !== 0) {
                    columnHeights[x] = BOARD_HEIGHT - y;
                    break;
                }
            }
            aggregateHeight += columnHeights[x];
            if (columnHeights[x] > maxHeight) maxHeight = columnHeights[x];
        }

        for (let y = 0; y < BOARD_HEIGHT; y++) {
            if (grid[y].every(c => c !== 0)) completeLines++;
        }

        for (let x = 0; x < BOARD_WIDTH; x++) {
            let blocksAbove = 0;
            for (let y = 0; y < BOARD_HEIGHT; y++) {
                if (grid[y][x] !== 0) {
                    blocksAbove++;
                } else if (blocksAbove > 0 && grid[y][x] === 0) {
                    holes++;
                    holesByColumn[x]++;
                    holeDepth += blocksAbove;
                    blockades++;
                }
            }
        }

        for (let x = 0; x < BOARD_WIDTH - 1; x++) {
            bumpiness += Math.abs(columnHeights[x] - columnHeights[x + 1]);
        }

        for (let y = 0; y < BOARD_HEIGHT; y++) {
            let last = 1;
            for (let x = 0; x < BOARD_WIDTH; x++) {
                const filled = grid[y][x] !== 0 ? 1 : 0;
                if (filled !== last) rowTransitions++;
                last = filled;
            }
            if (last === 0) rowTransitions++;
        }

        for (let x = 0; x < BOARD_WIDTH; x++) {
            for (let y = 0; y < BOARD_HEIGHT - 1; y++) {
                const curr = grid[y][x] !== 0 ? 1 : 0;
                const next = grid[y + 1][x] !== 0 ? 1 : 0;
                if (curr !== next) colTransitions++;
            }
            if (grid[0][x] !== 0) colTransitions++;
            if (grid[BOARD_HEIGHT - 1][x] === 0) colTransitions++;
        }

        for (let x = 0; x < BOARD_WIDTH; x++) {
            const hLeft = (x === 0) ? BOARD_HEIGHT : columnHeights[x - 1];
            const hRight = (x === BOARD_WIDTH - 1) ? BOARD_HEIGHT : columnHeights[x + 1];
            const h = columnHeights[x];

            if (h < hLeft && h < hRight) {
                const depth = Math.min(hLeft, hRight) - h;
                wells += (depth * (depth + 1)) / 2;
            }
        }

        return {
            aggregateHeight, completeLines, holes, bumpiness,
            maxHeight, rowTransitions, colTransitions, wells, holeDepth, blockades,
            columnHeights, holesByColumn
        };
    }

    getBehaviorSignature() {
        const samples = Math.max(1, this.behaviorSamples);
        const avgHoles = this.behaviorSums.holes / samples;
        const avgBumpiness = this.behaviorSums.bumpiness / samples;
        const avgMaxHeight = this.behaviorSums.maxHeight / samples;
        const avgWells = this.behaviorSums.wells / samples;
        const tetrisRate = this.piecesSpawned > 0 ? this.tetrisCount / this.piecesSpawned : 0;

        return [
            avgHoles / (BOARD_HEIGHT * BOARD_WIDTH),
            avgBumpiness / (BOARD_HEIGHT * (BOARD_WIDTH - 1)),
            avgMaxHeight / BOARD_HEIGHT,
            avgWells / (BOARD_HEIGHT * 4),
            tetrisRate
        ];
    }
}

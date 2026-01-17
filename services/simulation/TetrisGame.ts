import { Genome } from '../../types';
import { BOARD_WIDTH, BOARD_HEIGHT, TETROMINOES, GAMES_PER_GEN } from './constants';

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
    piecesPlaced: number;
    lastLinesCleared: number;

    pieceIndex: number;
    currentRunSequence: number[];

    currentPiece: any;
    nextPiece: any;

    actionQueue: string[];
    hasPlanned: boolean;
    reactionTimer: number;
    expectedHeatmap: number[][];
    actualHeatmap: number[][];
    expectedCells: { x: number; y: number }[];

    gravityTimer: number;
    gravityThreshold: number;

    lockDelay: number;
    lockTimer: number;
    lockResets: number;
    maxLockResets: number;

    constructor(genome: Genome, runSequences: number[][]) {
        this.genome = genome;
        this.grid = createGrid();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.isAlive = true;

        this.runsCompleted = 0;
        this.runScores = [];
        this.piecesPlaced = 0;
        this.lastLinesCleared = 0;

        this.pieceIndex = 0;
        this.currentRunSequence = runSequences[0] || [];

        this.actionQueue = [];
        this.hasPlanned = false;
        this.reactionTimer = 0;

        this.gravityTimer = 0;
        this.gravityThreshold = 50;

        this.lockDelay = 30;
        this.lockTimer = 0;
        this.lockResets = 0;
        this.maxLockResets = 15;

        this.expectedHeatmap = createGrid();
        this.actualHeatmap = createGrid();
        this.expectedCells = [];

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
        this.currentRunSequence = runSequences[this.runsCompleted] || runSequences[0];

        this.actionQueue = [];
        this.hasPlanned = false;
        this.reactionTimer = 0;
        this.gravityTimer = 0;
        this.gravityThreshold = 50;
        this.lockTimer = 0;
        this.lockResets = 0;
        this.piecesPlaced = 0;
        this.lastLinesCleared = 0;
        this.expectedHeatmap = createGrid();
        this.actualHeatmap = createGrid();
        this.expectedCells = [];

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

        this.actionQueue = [];
        this.hasPlanned = false;
        this.lockTimer = 0;
        this.lockResets = 0;

        const speedTrait = this.genome.traits ? this.genome.traits.reactionSpeed : 0.5;
        const baseReaction = 12;
        const adrenaline = Math.min(8, (this.level - 1) * 0.5);
        this.reactionTimer = Math.max(0, Math.floor((baseReaction - adrenaline) * (1 - speedTrait)));

        this.gravityThreshold = Math.max(1, Math.floor(50 * Math.pow(0.85, this.level - 1)));
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
        }
    }

    executeAction(action: string) {
        if (!this.currentPiece) return;

        let success = false;
        switch (action) {
            case 'L': success = this.move(-1, 0); break;
            case 'R': success = this.move(1, 0); break;
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
        const possibleMoves = this.getPossibleMoves(this.currentPiece, this.grid);
        if (possibleMoves.length === 0) return;

        const speedTrait = this.genome.traits ? this.genome.traits.reactionSpeed : 0.5;
        const rawBudget = this.gravityThreshold + (speedTrait * 30);
        const mobilityBudget = Math.max(5, rawBudget);

        const reachableMoves = possibleMoves.filter(m => {
            const rotCost = m.rot * 1.5;
            const moveCost = Math.abs(m.x - this.currentPiece.x);
            const totalCost = rotCost + moveCost;
            return totalCost <= mobilityBudget;
        });

        const candidatesToEval = reachableMoves.length > 0 ? reachableMoves : possibleMoves;

        const foresightTrait = this.genome.traits ? this.genome.traits.foresight : 0.5;
        const shouldUseForesight = foresightTrait > 0.5;

        let candidates = candidatesToEval.map(move => {
            const simState = this.getSimulatedGrid(this.grid, move);
            const metrics = this.calculateMetrics(simState.grid);
            const score = this.getScore(metrics, {
                linesCleared: simState.linesCleared,
                landingHeight: simState.landingHeight,
                erodedCells: simState.erodedCells,
                centerDev: Math.abs((move.x + move.shape[0].length / 2) - (BOARD_WIDTH / 2))
            });

            return { move, simGrid: simState.grid, score };
        });

        candidates.sort((a, b) => b.score - a.score);

        const topN = shouldUseForesight ? Math.min(3, candidates.length) : 1;

        let bestScore = -Infinity;
        let bestTarget = null;

        for (let i = 0; i < topN; i++) {
            const cand = candidates[i];
            let finalScore = cand.score;

            if (shouldUseForesight) {
                const nextPieceObj = {
                    shape: this.nextPiece.shape,
                    color: this.nextPiece.color,
                    x: Math.floor((BOARD_WIDTH - this.nextPiece.shape[0].length) / 2),
                    y: 0
                };

                const nextMoves = this.getPossibleMoves(nextPieceObj, cand.simGrid);
                let maxNextScore = -Infinity;
                const limitedNextMoves = nextMoves.slice(0, 6);

                for (const nm of limitedNextMoves) {
                    const nextSimState = this.getSimulatedGrid(cand.simGrid, nm);
                    const nextMetrics = this.calculateMetrics(nextSimState.grid);
                    const s = this.getScore(nextMetrics, {
                        linesCleared: nextSimState.linesCleared,
                        landingHeight: nextSimState.landingHeight,
                        erodedCells: nextSimState.erodedCells,
                        centerDev: Math.abs((nm.x + nm.shape[0].length / 2) - (BOARD_WIDTH / 2))
                    });
                    if (s > maxNextScore) maxNextScore = s;
                }

                if (maxNextScore > -Infinity) {
                    finalScore = (cand.score * 0.6) + (maxNextScore * 0.4);
                }
            }

            if (finalScore > bestScore) {
                bestScore = finalScore;
                bestTarget = cand.move;
            }
        }

        if (bestTarget) {
            this.expectedCells = this.getCellsForPlacement(bestTarget.shape, bestTarget.x, bestTarget.y);
            this.applyHeatmapDecay();
            this.expectedCells.forEach(cell => {
                if (cell.y >= 0 && cell.y < BOARD_HEIGHT && cell.x >= 0 && cell.x < BOARD_WIDTH) {
                    this.expectedHeatmap[cell.y][cell.x] = Math.min(1, this.expectedHeatmap[cell.y][cell.x] + 0.4);
                }
            });
            this.generatePath(bestTarget);
        }
    }

    generatePath(target: any) {
        const stress = this.calculateStress();
        const anxietyTrait = this.genome.traits ? this.genome.traits.anxiety : 0.5;

        if (stress + anxietyTrait > 1.8) {
            this.actionQueue.push('DROP');
            return;
        }

        const isClumsy = anxietyTrait > 0.9 && stress > 0.8;

        for (let i = 0; i < target.rot; i++) this.actionQueue.push('ROT');

        const dx = target.x - this.currentPiece.x;
        const steps = Math.abs(dx);
        const dir = dx < 0 ? 'L' : 'R';

        for (let i = 0; i < steps; i++) {
            if (isClumsy && i === steps - 1) {
                this.actionQueue.push(dir);
                this.actionQueue.push(dir);
            } else {
                this.actionQueue.push(dir);
            }
        }
        this.actionQueue.push('DROP');
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

    getScore(metrics: any, moveStats: any) {
        const w = this.genome.weights;
        let score =
            (metrics.aggregateHeight * (w.height || -0.5)) +
            (moveStats.linesCleared * (w.lines || 1.0)) * 1.5 + // Boost lines cleared importance
            (metrics.holes * (w.holes || -1.0)) * 2.0 +     // Heavy penalty for holes
            (metrics.bumpiness * (w.bumpiness || -0.2)) +
            (metrics.maxHeight * (w.maxHeight || -0.5)) +
            (metrics.rowTransitions * (w.rowTransitions || -0.2)) +
            (metrics.colTransitions * (w.colTransitions || -0.2)) +
            (metrics.wells * (w.wells || -0.1)) +
            (metrics.holeDepth * (w.holeDepth || -0.4)) +
            (metrics.blockades * (w.blockades || -0.5)) +
            (moveStats.landingHeight * (w.landingHeight || -0.3)) +
            (moveStats.erodedCells * (w.erodedCells || 0.5)) +
            (moveStats.centerDev * (w.centerDev || -0.1));

        return score;
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

        const rotations = [];
        let r = piece.shape;
        for (let i = 0; i < 4; i++) {
            rotations.push(r);
            r = this.rotate(r);
        }

        const startNode = { x: piece.x, y: piece.y, rot: 0 };
        queue.push(startNode);
        visited.add(`${startNode.x},${startNode.y},${startNode.rot}`);

        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) continue;
            const { x, y, rot } = item;
            const shape = rotations[rot];

            const moves = [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }];
            let canMoveDown = false;

            for (let m of moves) {
                if (!this.checkCollision(grid, shape, x + m.dx, y + m.dy)) {
                    const key = `${x + m.dx},${y + m.dy},${rot}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        queue.push({ x: x + m.dx, y: y + m.dy, rot });
                    }
                    if (m.dy === 1) canMoveDown = true;
                }
            }

            const nextRot = (rot + 1) % 4;
            const nextShape = rotations[nextRot];
            if (!this.checkCollision(grid, nextShape, x, y)) {
                const key = `${x},${y},${nextRot}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push({ x: x, y: y, rot: nextRot });
                }
            }

            if (!canMoveDown) {
                reachable.push({ x, y, shape: rotations[rot], rot, color: piece.color });
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
        if (!this.checkCollision(this.grid, newShape, this.currentPiece.x, this.currentPiece.y)) {
            this.currentPiece.shape = newShape;
            return true;
        } else {
            if (!this.checkCollision(this.grid, newShape, this.currentPiece.x - 1, this.currentPiece.y)) {
                this.currentPiece.x -= 1;
                this.currentPiece.shape = newShape;
                return true;
            } else if (!this.checkCollision(this.grid, newShape, this.currentPiece.x + 1, this.currentPiece.y)) {
                this.currentPiece.x += 1;
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

    lockPiece() {
        const shape = this.currentPiece.shape;
        const placedCells = this.getCellsForPlacement(shape, this.currentPiece.x, this.currentPiece.y);
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

        this.applyHeatmapDecay();
        placedCells.forEach(cell => {
            if (cell.y >= 0 && cell.y < BOARD_HEIGHT && cell.x >= 0 && cell.x < BOARD_WIDTH) {
                this.actualHeatmap[cell.y][cell.x] = Math.min(1, this.actualHeatmap[cell.y][cell.x] + 0.5);
            }
        });

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
        this.lastLinesCleared = linesCleared;
        this.piecesPlaced += 1;

        const levelMult = Math.max(1, this.level);
        switch (linesCleared) {
            case 1: this.score += 100 * levelMult; break;
            case 2: this.score += 400 * levelMult; break;
            case 3: this.score += 900 * levelMult; break;
            case 4: this.score += 2500 * levelMult; break;
        }
        this.score += 1;
        if (linesCleared > 0) {
            this.score += Math.floor(this.score * 0.005);
        }

        this.level = Math.floor(this.lines / 10) + 1;
        this.spawnPiece();
    }

    manualMove(dx: number, dy: number) { this.move(dx, dy); }
    manualRotate() { this.rotateCW(); }
    manualDrop() { this.hardDrop(); }

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
            maxHeight, rowTransitions, colTransitions, wells, holeDepth, blockades
        };
    }

    getCellsForPlacement(shape: number[][], offsetX: number, offsetY: number) {
        const cells: { x: number; y: number }[] = [];
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x] !== 0) {
                    cells.push({ x: offsetX + x, y: offsetY + y });
                }
            }
        }
        return cells;
    }

    applyHeatmapDecay() {
        const decay = 0.92;
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            for (let x = 0; x < BOARD_WIDTH; x++) {
                this.expectedHeatmap[y][x] *= decay;
                this.actualHeatmap[y][x] *= decay;
            }
        }
    }
}

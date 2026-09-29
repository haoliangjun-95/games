/** 2048 核心逻辑（纯函数，便于测试） */

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface GameState {
  size: number
  /** grid[row][col]，0 表示空格 */
  grid: number[][]
  score: number
  won: boolean
  over: boolean
  /** 继续挑战模式（达成 2048 后不弹结算） */
  keepGoing: boolean
}

export type Rng = () => number

function emptyGrid(size: number): number[][] {
  return Array.from({ length: size }, () => Array<number>(size).fill(0))
}

function emptyCells(grid: number[][]): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === 0) cells.push([r, c])
    }
  }
  return cells
}

export function spawnTile(grid: number[][], rng: Rng = Math.random): number[][] {
  const cells = emptyCells(grid)
  if (cells.length === 0) return grid
  const [r, c] = cells[Math.floor(rng() * cells.length)]!
  const next = grid.map((row) => row.slice())
  next[r]![c] = rng() < 0.9 ? 2 : 4
  return next
}

export function createGame(size = 4, rng: Rng = Math.random): GameState {
  let grid = emptyGrid(size)
  grid = spawnTile(grid, rng)
  grid = spawnTile(grid, rng)
  return { size, grid, score: 0, won: false, over: false, keepGoing: false }
}

/** 将一行向左折叠合并，返回 [新行, 得分, 是否有变化] */
function collapseRow(row: number[]): [number[], number, boolean] {
  const tiles = row.filter((v) => v !== 0)
  const result: number[] = []
  let gained = 0
  let i = 0
  while (i < tiles.length) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      const merged = tiles[i]! * 2
      result.push(merged)
      gained += merged
      i += 2
    } else {
      result.push(tiles[i]!)
      i += 1
    }
  }
  while (result.length < row.length) result.push(0)
  const moved = result.some((v, idx) => v !== row[idx])
  return [result, gained, moved]
}

function rotateGrid(grid: number[][], times: number): number[][] {
  let g = grid.map((row) => row.slice())
  for (let t = 0; t < times; t++) {
    const size = g.length
    const n = Array.from({ length: size }, () => Array<number>(size).fill(0))
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        n[c]![size - 1 - r] = g[r]![c]!
      }
    }
    g = n
  }
  return g
}

/** 方向 → 旋转次数（统一转为「向左」处理） */
function rotationsFor(dir: Direction): number {
  switch (dir) {
    case 'left':
      return 0
    case 'up':
      return 1
    case 'right':
      return 2
    case 'down':
      return 3
  }
}

export function canMove(state: GameState, dir: Direction): boolean {
  const [, , moved] = applyMoveToGrid(state.grid, dir)
  return moved
}

function applyMoveToGrid(grid: number[][], dir: Direction): [number[][], number, boolean] {
  const times = rotationsFor(dir)
  const rotated = rotateGrid(grid, times)
  let totalGained = 0
  let anyMoved = false
  const collapsed = rotated.map((row) => {
    const [newRow, gained, moved] = collapseRow(row)
    totalGained += gained
    if (moved) anyMoved = true
    return newRow
  })
  const restored = rotateGrid(collapsed, (4 - times) % 4)
  return [restored, totalGained, anyMoved]
}

export interface MoveResult {
  state: GameState
  moved: boolean
  /** 本次移动新增的格子坐标 [r, c] */
  spawned: Array<[number, number]>
  /** 本次合并产生的格子坐标（合并后的位置） */
  merged: Array<[number, number]>
}

/** 执行一步移动。若无法移动返回 moved=false 原状态 */
export function move(state: GameState, dir: Direction, rng: Rng = Math.random): MoveResult {
  if (state.over) return { state, moved: false, spawned: [], merged: [] }
  const before = state.grid
  const [nextGrid, gained, movedFlag] = applyMoveToGrid(state.grid, dir)
  if (!movedFlag) return { state, moved: false, spawned: [], merged: [] }

  // 计算合并位置：值变大概率增大的格子视为合并点（简化判定：新值 > 旧值且新值 >= 4）
  const merged: Array<[number, number]> = []
  for (let r = 0; r < nextGrid.length; r++) {
    for (let c = 0; c < nextGrid[r]!.length; c++) {
      if (nextGrid[r]![c]! > (before[r]![c] ?? 0) && nextGrid[r]![c]! >= 4) merged.push([r, c])
    }
  }

  const withSpawn = spawnTile(nextGrid, rng)
  const spawned: Array<[number, number]> = []
  for (let r = 0; r < withSpawn.length; r++) {
    for (let c = 0; c < withSpawn[r]!.length; c++) {
      if (withSpawn[r]![c]! !== 0 && nextGrid[r]![c]! === 0) spawned.push([r, c])
    }
  }

  const won = state.won || withSpawn.some((row) => row.some((v) => v >= 2048))
  const over = emptyCells(withSpawn).length === 0 && !hasAnyMove(withSpawn)
  return {
    state: {
      ...state,
      grid: withSpawn,
      score: state.score + gained,
      won,
      over,
    },
    moved: true,
    spawned,
    merged,
  }
}

function hasAnyMove(grid: number[][]): boolean {
  const size = grid.length
  const fake: GameState = { size, grid, score: 0, won: false, over: false, keepGoing: false }
  return (
    canMove(fake, 'left') || canMove(fake, 'right') || canMove(fake, 'up') || canMove(fake, 'down')
  )
}

export function isGameOver(state: GameState): boolean {
  return state.over || (!state.keepGoing && state.won && false) || (emptyCells(state.grid).length === 0 && !hasAnyMove(state.grid))
}

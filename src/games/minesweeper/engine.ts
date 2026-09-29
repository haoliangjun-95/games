/** 扫雷核心逻辑（纯函数） */

export interface Cell {
  mine: boolean
  revealed: boolean
  flagged: boolean
  /** 周围雷数 0-8，未布雷时为 0 */
  adjacent: number
}

export type Board = Cell[][]

export interface GameConfig {
  rows: number
  cols: number
  mines: number
}

export type GameStatus = 'ready' | 'playing' | 'won' | 'lost'

export interface Game {
  config: GameConfig
  board: Board
  status: GameStatus
  /** 是否已布雷（首次点击后） */
  mined: boolean
}

export const DIFFICULTIES: Record<string, GameConfig> = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
}

function blankBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })),
  )
}

export function createGame(config: GameConfig): Game {
  return { config, board: blankBoard(config.rows, config.cols), status: 'ready', mined: false }
}

export function neighbors(rows: number, cols: number, r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc])
    }
  }
  return out
}

/** 布雷：保证 (safeR, safeC) 及其邻居都不是雷（首击展开体验） */
export function placeMines(game: Game, safeR: number, safeC: number, rng: () => number = Math.random): Game {
  const { rows, cols, mines } = game.config
  const board = game.board.map((row) => row.map((cell) => ({ ...cell })))
  const forbidden = new Set<string>([`${safeR},${safeC}`, ...neighbors(rows, cols, safeR, safeC).map(([r, c]) => `${r},${c}`)])
  const candidates: Array<[number, number]> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!forbidden.has(`${r},${c}`)) candidates.push([r, c])
    }
  }
  // 洗牌取前 N 个
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!]
  }
  const chosen = candidates.slice(0, Math.min(mines, candidates.length))
  for (const [r, c] of chosen) board[r]![c]!.mine = true
  // 计算邻雷数
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r]![c]!.mine) {
        board[r]![c]!.adjacent = neighbors(rows, cols, r, c).filter(([nr, nc]) => board[nr]![nc]!.mine).length
      }
    }
  }
  return { ...game, board, mined: true, status: 'playing' }
}

/** 翻开格子（含洪水展开）。返回新状态 */
export function reveal(game: Game, r: number, c: number): Game {
  if (game.status === 'won' || game.status === 'lost') return game
  const cell = game.board[r]?.[c]
  if (!cell || cell.revealed || cell.flagged) return game

  let g = game
  if (!g.mined) g = placeMines(g, r, c)

  const board = g.board.map((row) => row.map((x) => ({ ...x })))
  floodReveal(board, g.config, r, c)
  const hitMine = board[r]![c]!.mine && board[r]![c]!.revealed

  let status: GameStatus = g.status
  if (hitMine) {
    status = 'lost'
    // 失败时翻开所有雷
    for (const row of board) {
      for (const x of row) {
        if (x.mine) x.revealed = true
      }
    }
  } else if (isWin(board)) {
    status = 'won'
    // 胜利时自动给所有雷插旗
    for (const row of board) {
      for (const x of row) {
        if (x.mine) x.flagged = true
      }
    }
  }
  return { ...g, board, status }
}

function floodReveal(board: Board, config: GameConfig, r: number, c: number) {
  const stack: Array<[number, number]> = [[r, c]]
  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!
    const cell = board[cr]?.[cc]
    if (!cell || cell.revealed || cell.flagged) continue
    cell.revealed = true
    if (!cell.mine && cell.adjacent === 0) {
      for (const [nr, nc] of neighbors(config.rows, config.cols, cr, cc)) {
        const n = board[nr]![nc]!
        if (!n.revealed && !n.flagged && !n.mine) stack.push([nr, nc])
      }
    }
  }
}

export function isWin(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell.mine || cell.revealed))
}

export function toggleFlag(game: Game, r: number, c: number): Game {
  if (game.status === 'won' || game.status === 'lost') return game
  const cell = game.board[r]?.[c]
  if (!cell || cell.revealed) return game
  const board = game.board.map((row) => row.map((x) => ({ ...x })))
  board[r]![c]!.flagged = !board[r]![c]!.flagged
  return { ...game, board }
}

/** 快速展开（双击已翻开数字）：若周围旗数等于数字，翻开其余邻居 */
export function chord(game: Game, r: number, c: number): Game {
  if (game.status === 'won' || game.status === 'lost') return game
  const cell = game.board[r]?.[c]
  if (!cell || !cell.revealed || cell.adjacent === 0) return game
  const nbs = neighbors(game.config.rows, game.config.cols, r, c)
  const flags = nbs.filter(([nr, nc]) => game.board[nr]![nc]!.flagged).length
  if (flags !== cell.adjacent) return game
  let g = game
  for (const [nr, nc] of nbs) {
    const n = g.board[nr]![nc]!
    if (!n.revealed && !n.flagged) g = reveal(g, nr, nc)
    if (g.status === 'lost') break
  }
  return g
}

export function countFlags(game: Game): number {
  return game.board.flat().filter((c) => c.flagged).length
}

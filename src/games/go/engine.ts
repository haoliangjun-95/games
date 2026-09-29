/** 围棋规则引擎：气/提子/禁自杀/打劫（全局同形禁着）/中国规则数子 */

export type Player = 1 | 2 // 1 黑 2 白
export type Board = number[][] // size×size，0 空

export interface GoState {
  size: number
  board: Board
  /** 当前行棋方 */
  player: Player
  /** 连续虚手次数（达到 2 终局） */
  passes: number
  /** 各方提子数（吃掉对方的子） */
  captures: Record<Player, number>
  /** 历史局面（全局同形禁着用） */
  history: string[]
  over: boolean
  /** 最后一手：null 表示虚手 */
  lastMove: [number, number] | null
}

export const KOMI = 7.5 // 中国规则贴目

export function other(p: Player): Player {
  return p === 1 ? 2 : 1
}

export function createBoard(size: number): Board {
  return Array.from({ length: size }, () => Array<number>(size).fill(0))
}

export function createGame(size = 9): GoState {
  const board = createBoard(size)
  return {
    size,
    board,
    player: 1,
    passes: 0,
    captures: { 1: 0, 2: 0 },
    history: [boardKey(board)],
    over: false,
    lastMove: null,
  }
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice())
}

export function boardKey(board: Board): string {
  return board.map((row) => row.join('')).join('/')
}

export function neighbors(size: number, r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  if (r > 0) out.push([r - 1, c])
  if (r < size - 1) out.push([r + 1, c])
  if (c > 0) out.push([r, c - 1])
  if (c < size - 1) out.push([r, c + 1])
  return out
}

export interface Group {
  stones: Array<[number, number]>
  /** 气的数量 */
  liberties: number
}

/** 以 (r,c) 为首的连通棋块及其气数 */
export function groupAt(board: Board, r: number, c: number): Group | null {
  const size = board.length
  const color = board[r]![c]!
  if (color === 0) return null
  const visited = new Set<string>([`${r},${c}`])
  const stones: Array<[number, number]> = [[r, c]]
  const libs = new Set<string>()
  const queue: Array<[number, number]> = [[r, c]]
  while (queue.length > 0) {
    const [cr, cc] = queue.pop()!
    for (const [nr, nc] of neighbors(size, cr, cc)) {
      const v = board[nr]![nc]!
      if (v === 0) libs.add(`${nr},${nc}`)
      else if (v === color && !visited.has(`${nr},${nc}`)) {
        visited.add(`${nr},${nc}`)
        stones.push([nr, nc])
        queue.push([nr, nc])
      }
    }
  }
  return { stones, liberties: libs.size }
}

export interface MoveResult {
  state: GoState
  /** 本手提掉的对方棋子数 */
  captured: number
}

/** 落子。非法（占位/自杀/打劫/已终局）返回 null */
export function playMove(state: GoState, r: number, c: number): MoveResult | null {
  if (state.over) return null
  if (state.board[r]![c] !== 0) return null
  const { size, player } = state
  const board = cloneBoard(state.board)
  board[r]![c] = player
  const opp = other(player)

  // 先提对方死子
  let captured = 0
  const removed = new Set<string>()
  for (const [nr, nc] of neighbors(size, r, c)) {
    if (board[nr]![nc] === opp && !removed.has(`${nr},${nc}`)) {
      const g = groupAt(board, nr, nc)!
      if (g.liberties === 0) {
        for (const [sr, sc] of g.stones) {
          board[sr]![sc] = 0
          removed.add(`${sr},${sc}`)
        }
        captured += g.stones.length
      }
    }
  }

  // 自杀判定（提子后自己仍无气 → 非法）
  const own = groupAt(board, r, c)!
  if (own.liberties === 0) return null

  // 打劫：全局同形禁着
  const key = boardKey(board)
  if (state.history.includes(key)) return null

  return {
    state: {
      ...state,
      board,
      player: opp,
      passes: 0,
      captures: { ...state.captures, [player]: state.captures[player] + captured } as Record<Player, number>,
      history: [...state.history, key],
      lastMove: [r, c],
    },
    captured,
  }
}

/** 虚手（停一手）。双方连续虚手则终局 */
export function passTurn(state: GoState): GoState {
  const passes = state.passes + 1
  return {
    ...state,
    player: other(state.player),
    passes,
    over: passes >= 2,
    lastMove: null,
  }
}

export function allLegalMoves(state: GoState): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (state.board[r]![c] === 0 && playMove(state, r, c) !== null) out.push([r, c])
    }
  }
  return out
}

// ===== 中国规则数子（子 + 围住的空点，白贴 KOMI） =====

export interface ScoreResult {
  /** 黑方总点数（子 + 地） */
  black: number
  /** 白方总点数（子 + 地 + 贴目） */
  white: number
  komi: number
  /** 领地标记：[r, c, 1|2] 空点归属；双方都接触（公气）不标 */
  territory: Array<[number, number, Player]>
  dame: number
  /** 如 "黑胜 6.5" */
  resultText: string
}

export function scoreGame(board: Board, komi = KOMI): ScoreResult {
  const size = board.length
  let blackStones = 0
  let whiteStones = 0
  const territory: Array<[number, number, Player]> = []
  let dame = 0
  const visited = new Set<string>()

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = board[r]![c]!
      if (v === 1) blackStones++
      else if (v === 2) whiteStones++
      else if (!visited.has(`${r},${c}`)) {
        // 空点区域洪泛，判断接触颜色
        const region: Array<[number, number]> = []
        const queue: Array<[number, number]> = [[r, c]]
        visited.add(`${r},${c}`)
        let touchBlack = false
        let touchWhite = false
        while (queue.length > 0) {
          const [cr, cc] = queue.pop()!
          region.push([cr, cc])
          for (const [nr, nc] of neighbors(size, cr, cc)) {
            const nv = board[nr]![nc]!
            if (nv === 1) touchBlack = true
            else if (nv === 2) touchWhite = true
            else if (!visited.has(`${nr},${nc}`)) {
              visited.add(`${nr},${nc}`)
              queue.push([nr, nc])
            }
          }
        }
        if (touchBlack && !touchWhite) {
          blackStones += region.length
          for (const p of region) territory.push([p[0], p[1], 1])
        } else if (touchWhite && !touchBlack) {
          whiteStones += region.length
          for (const p of region) territory.push([p[0], p[1], 2])
        } else {
          dame += region.length
        }
      }
    }
  }

  const black = blackStones
  const white = whiteStones + komi
  const diff = black - white
  const resultText = diff > 0 ? `黑胜 ${diff.toFixed(1)}` : diff < 0 ? `白胜 ${(-diff).toFixed(1)}` : '和棋'
  return { black, white, komi, territory, dame, resultText }
}

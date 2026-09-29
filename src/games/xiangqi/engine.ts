/** 中国象棋规则引擎（棋盘 10 行 × 9 列，row 0 为黑方底线在上，row 9 为红方底线在下，红先行） */

export type Side = 'red' | 'black'
export type PieceType = 'K' | 'A' | 'B' | 'N' | 'R' | 'C' | 'P' // 帅/仕/相/马/车/炮/兵

export interface Piece {
  side: Side
  type: PieceType
}

export type Board = (Piece | null)[][]

export interface Move {
  from: [number, number]
  to: [number, number]
}

export const PIECE_NAMES: Record<Side, Record<PieceType, string>> = {
  red: { K: '帥', A: '仕', B: '相', N: '馬', R: '車', C: '炮', P: '兵' },
  black: { K: '將', A: '士', B: '象', N: '馬', R: '車', C: '砲', P: '卒' },
}

export function other(side: Side): Side {
  return side === 'red' ? 'black' : 'red'
}

/** 初始局面 */
export function initialBoard(): Board {
  const back = (side: Side): PieceType[] => ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R']
  const board: Board = Array.from({ length: 10 }, () => Array<Piece | null>(9).fill(null))
  const blackBack = back('black')
  const redBack = back('red')
  for (let c = 0; c < 9; c++) {
    board[0]![c] = { side: 'black', type: blackBack[c]! }
    board[9]![c] = { side: 'red', type: redBack[c]! }
  }
  board[2]![1] = { side: 'black', type: 'C' }
  board[2]![7] = { side: 'black', type: 'C' }
  board[7]![1] = { side: 'red', type: 'C' }
  board[7]![7] = { side: 'red', type: 'C' }
  for (let c = 0; c < 9; c += 2) {
    board[3]![c] = { side: 'black', type: 'P' }
    board[6]![c] = { side: 'red', type: 'P' }
  }
  return board
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice())
}

export function inBoard(r: number, c: number): boolean {
  return r >= 0 && r < 10 && c >= 0 && c < 9
}

function inPalace(r: number, c: number, side: Side): boolean {
  if (c < 3 || c > 5) return false
  return side === 'red' ? r >= 7 : r <= 2
}

function ownHalf(r: number, side: Side): boolean {
  return side === 'red' ? r >= 5 : r <= 4
}

/** 生成一个子的伪合法走法（不考虑送将） */
function pieceMoves(board: Board, r: number, c: number): Move[] {
  const piece = board[r]![c]!
  const { side, type } = piece
  const moves: Move[] = []
  const push = (tr: number, tc: number) => {
    if (!inBoard(tr, tc)) return
    const target = board[tr]![tc]
    if (target && target.side === side) return
    moves.push({ from: [r, c], to: [tr, tc] })
  }

  switch (type) {
    case 'K': {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>) {
        const tr = r + dr
        const tc = c + dc
        if (inPalace(tr, tc, side)) push(tr, tc)
      }
      // 飞将：与对方帅将同列且中间无子时可直接吃将（用于照面判定与搜索终结）
      const dir = side === 'red' ? -1 : 1
      let tr = r + dir
      while (inBoard(tr, c) && board[tr]![c] === null) tr += dir
      if (inBoard(tr, c)) {
        const target = board[tr]![c]!
        if (target.type === 'K' && target.side !== side) push(tr, c)
      }
      break
    }
    case 'A': {
      for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as Array<[number, number]>) {
        const tr = r + dr
        const tc = c + dc
        if (inPalace(tr, tc, side)) push(tr, tc)
      }
      break
    }
    case 'B': {
      for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]] as Array<[number, number]>) {
        const tr = r + dr
        const tc = c + dc
        if (!inBoard(tr, tc) || !ownHalf(tr, side)) continue
        // 象眼被塞
        if (board[r + dr / 2]![c + dc / 2] !== null) continue
        push(tr, tc)
      }
      break
    }
    case 'N': {
      const deltas: Array<[number, number]> = [
        [2, 1],
        [2, -1],
        [-2, 1],
        [-2, -1],
        [1, 2],
        [1, -2],
        [-1, 2],
        [-1, -2],
      ]
      for (const [dr, dc] of deltas) {
        const tr = r + dr
        const tc = c + dc
        if (!inBoard(tr, tc)) continue
        // 马腿：2 步方向上紧邻的点位
        const legR = Math.abs(dr) === 2 ? r + dr / 2 : r
        const legC = Math.abs(dc) === 2 ? c + dc / 2 : c
        if (board[legR]![legC] !== null) continue
        push(tr, tc)
      }
      break
    }
    case 'R': {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>) {
        let tr = r + dr
        let tc = c + dc
        while (inBoard(tr, tc)) {
          const target = board[tr]![tc]
          if (target === null) {
            moves.push({ from: [r, c], to: [tr, tc] })
          } else {
            if (target.side !== side) moves.push({ from: [r, c], to: [tr, tc] })
            break
          }
          tr += dr
          tc += dc
        }
      }
      break
    }
    case 'C': {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>) {
        let tr = r + dr
        let tc = c + dc
        // 平移段
        while (inBoard(tr, tc) && board[tr]![tc] === null) {
          moves.push({ from: [r, c], to: [tr, tc] })
          tr += dr
          tc += dc
        }
        // 越过炮架找吃子
        if (inBoard(tr, tc)) {
          tr += dr
          tc += dc
          while (inBoard(tr, tc)) {
            const target = board[tr]![tc]
            if (target !== null) {
              if (target.side !== side) moves.push({ from: [r, c], to: [tr, tc] })
              break
            }
            tr += dr
            tc += dc
          }
        }
      }
      break
    }
    case 'P': {
      const forward = side === 'red' ? -1 : 1
      push(r + forward, c)
      // 过河后可横走
      const crossed = side === 'red' ? r <= 4 : r >= 5
      if (crossed) {
        push(r, c + 1)
        push(r, c - 1)
      }
      break
    }
  }
  return moves
}

export function findKing(board: Board, side: Side): [number, number] | null {
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r]![c]
      if (p && p.side === side && p.type === 'K') return [r, c]
    }
  }
  return null
}

/** side 的将/帅是否被攻击（含将帅照面） */
export function isInCheck(board: Board, side: Side): boolean {
  const king = findKing(board, side)
  if (!king) return true // 无将视为被将（异常保护）
  const [kr, kc] = king

  // 车 / 照面的将 / 炮：沿四个正方向扫描
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>) {
    let r = kr + dr
    let c = kc + dc
    let screen = false
    while (inBoard(r, c)) {
      const p = board[r]![c]
      if (p !== null) {
        if (!screen) {
          if (p.side !== side && (p.type === 'R' || p.type === 'K')) return true
          screen = true
        } else {
          if (p.side !== side && p.type === 'C') return true
          break
        }
      }
      r += dr
      c += dc
    }
  }

  // 马
  const knightJumps: Array<[number, number]> = [
    [2, 1],
    [2, -1],
    [-2, 1],
    [-2, -1],
    [1, 2],
    [1, -2],
    [-1, 2],
    [-1, -2],
  ]
  for (const [dr, dc] of knightJumps) {
    const nr = kr + dr
    const nc = kc + dc
    if (!inBoard(nr, nc)) continue
    const p = board[nr]![nc]
    if (!p || p.side === side || p.type !== 'N') continue
    // 马从 (nr,nc) 跳向王，马腿位置
    const legR = Math.abs(dr) === 2 ? nr - dr / 2 : nr
    const legC = Math.abs(dc) === 2 ? nc - dc / 2 : nc
    if (board[legR]![legC] === null) return true
  }

  // 兵 / 卒
  const enemy = other(side)
  // 正面（对方兵向我方前进的方向）
  const frontR = side === 'red' ? kr - 1 : kr + 1
  if (inBoard(frontR, kc)) {
    const p = board[frontR]![kc]
    if (p && p.side === enemy && p.type === 'P') return true
  }
  // 侧面（对方兵须已过河）
  for (const dc of [-1, 1]) {
    const nc = kc + dc
    if (!inBoard(kr, nc)) continue
    const p = board[kr]![nc]
    if (!p || p.side !== enemy || p.type !== 'P') continue
    const crossed = enemy === 'red' ? kr <= 4 : kr >= 5
    if (crossed) return true
  }

  return false
}

/** 执行走法，返回新棋盘（不改变原棋盘） */
export function applyMove(board: Board, move: Move): Board {
  const next = cloneBoard(board)
  const [fr, fc] = move.from
  const [tr, tc] = move.to
  next[tr]![tc] = next[fr]![fc]
  next[fr]![fc] = null
  return next
}

export function capturedPiece(board: Board, move: Move): Piece | null {
  return board[move.to[0]]![move.to[1]]
}

/** 某方全部伪合法走法 */
export function pseudoMoves(board: Board, side: Side): Move[] {
  const moves: Move[] = []
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r]![c]
      if (p && p.side === side) moves.push(...pieceMoves(board, r, c))
    }
  }
  return moves
}

/** 某方全部合法走法（过滤送将/照面） */
export function legalMoves(board: Board, side: Side): Move[] {
  return pseudoMoves(board, side).filter((m) => {
    const next = applyMove(board, m)
    return !isInCheck(next, side)
  })
}

export type GameStatus = 'playing' | 'red-win' | 'black-win'

/** side 行棋后的局面状态（判断对方是否无合法着法） */
export function gameStatus(board: Board, sideToMove: Side): GameStatus {
  if (legalMoves(board, sideToMove).length === 0) {
    // 无棋可走：被将死或困毙，行棋方输
    return sideToMove === 'red' ? 'black-win' : 'red-win'
  }
  return 'playing'
}

export function moveToNotation(board: Board, move: Move): string {
  const piece = board[move.from[0]]![move.from[1]]!
  if (!piece) return ''
  const name = PIECE_NAMES[piece.side][piece.type]
  const CH = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
  // 红方视角从右向左一~九（col 8=一）；黑方视角从左向右 1~9（col 0=1）
  const colName = (c: number) => (piece.side === 'red' ? CH[8 - c]! : String(c + 1))
  const [fromR, fromC] = move.from
  const [toR, toC] = move.to
  let action: string
  let dest: string
  if (toR === fromR) {
    action = '平'
    dest = colName(toC)
  } else {
    const forward = piece.side === 'red' ? toR < fromR : toR > fromR
    action = forward ? '进' : '退'
    if (toC === fromC) {
      const steps = Math.abs(toR - fromR)
      dest = piece.side === 'red' ? CH[steps - 1]! : String(steps)
    } else {
      dest = colName(toC)
    }
  }
  return `${name}${colName(fromC)}${action}${dest}`
}

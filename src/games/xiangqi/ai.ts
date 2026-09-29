/**
 * 中国象棋 AI：Alpha-Beta + 吃子排序 + 静态延伸（quiescence）
 * 参考 MIT 开源 itlwei/chess 的极小极大结构，TS 重写。
 */
import {
  applyMove,
  capturedPiece,
  findKing,
  isInCheck,
  legalMoves,
  other,
  pseudoMoves,
  type Board,
  type Move,
  type PieceType,
  type Side,
} from './engine'

export type Difficulty = 'easy' | 'medium' | 'hard'

const MATERIAL: Record<PieceType, number> = {
  K: 100000,
  R: 900,
  C: 450,
  N: 400,
  B: 200,
  A: 200,
  P: 100,
}

/** 红方视角的位置加成（黑方镜像行号） */
function pstBonus(type: PieceType, r: number, c: number, side: Side): number {
  const rr = side === 'red' ? r : 9 - r
  switch (type) {
    case 'P': {
      // 兵：过河后价值大增，越深入越值钱，中路更佳
      let bonus = 0
      if (rr <= 4) {
        bonus = 30 + (4 - rr) * 12
        if (c >= 3 && c <= 5) bonus += 10
      } else if (rr === 5) {
        bonus = 10
      }
      return bonus
    }
    case 'N': {
      // 马：中心好，边角差
      const centerC = 4 - Math.abs(c - 4)
      const centerR = rr >= 2 && rr <= 7 ? 4 : 0
      return centerC * 3 + centerR
    }
    case 'C': {
      // 炮：中路稍好
      return c === 4 ? 14 : 4
    }
    case 'R': {
      return rr <= 6 ? 6 : 0 // 车出动有加成
    }
    default:
      return 0
  }
}

export function evaluate(board: Board, side: Side): number {
  let score = 0
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r]![c]
      if (!p) continue
      const v = MATERIAL[p.type] + pstBonus(p.type, r, c, p.side)
      score += p.side === side ? v : -v
    }
  }
  return score
}

const MATE = 1_000_000

interface SearchLimits {
  depth: number
  /** 顶级随机性（简单档） */
  randomness: number
  nodeLimit: number
}

const CONFIGS: Record<Difficulty, SearchLimits> = {
  easy: { depth: 1, randomness: 90, nodeLimit: 50_000 },
  medium: { depth: 2, randomness: 15, nodeLimit: 400_000 },
  hard: { depth: 3, randomness: 0, nodeLimit: 1_500_000 },
}

let nodeCount = 0

/** 主入口：为 side 计算一步棋 */
export function computeMove(board: Board, side: Side, difficulty: Difficulty = 'medium'): Move | null {
  const moves = legalMoves(board, side)
  if (moves.length === 0) return null
  const cfg = CONFIGS[difficulty]
  nodeCount = 0

  // 排序：吃子优先（victim 价值大者在前）
  const ordered = orderMoves(board, moves)

  let best: Move = ordered[0]!
  let bestScore = -Infinity
  const scored: Array<{ move: Move; score: number }> = []

  for (const move of ordered) {
    const next = applyMove(board, move)
    const score = -alphaBeta(next, other(side), cfg.depth - 1, -Infinity, Infinity, -MATE)
    scored.push({ move, score })
    if (score > bestScore) {
      bestScore = score
      best = move
    }
  }

  // 简单/中等档：从前几名随机挑，避免每盘一模一样
  if (cfg.randomness > 0 && scored.length > 1) {
    const candidates = scored.filter((s) => bestScore - s.score <= cfg.randomness)
    if (candidates.length > 1) {
      best = candidates[Math.floor(Math.random() * candidates.length)]!.move
    }
  }
  return best
}

function orderMoves(board: Board, moves: Move[]): Move[] {
  return moves
    .map((move) => {
      const victim = capturedPiece(board, move)
      const attacker = board[move.from[0]]![move.from[1]]!
      // MVV-LVA：吃大子优先，用小子吃优先
      const score =
        victim != null ? MATERIAL[victim.type] * 10 - MATERIAL[attacker!.type] : pstDelta(board, move)
      return { move, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.move)
}

function pstDelta(board: Board, move: Move): number {
  const p = board[move.from[0]]![move.from[1]]!
  if (!p) return 0
  return pstBonus(p.type, move.to[0], move.to[1], p.side) - pstBonus(p.type, move.from[0], move.from[1], p.side)
}

/** Negamax + Alpha-Beta。返回 sideToMove 视角分值 */
function alphaBeta(board: Board, sideToMove: Side, depth: number, alpha: number, beta: number, mateIn: number): number {
  nodeCount++
  if (nodeCount > CONFIGS.hard.nodeLimit * 3) return evaluate(board, sideToMove)

  const king = findKing(board, sideToMove)
  if (!king) return -MATE // 被吃将（搜索中允许）

  const moves = pseudoMoves(board, sideToMove)
  // 立即吃将判定
  for (const m of moves) {
    const victim = board[m.to[0]]![m.to[1]]
    if (victim && victim.type === 'K') return MATE + depth
  }

  if (depth <= 0) {
    return quiescence(board, sideToMove, alpha, beta, 0)
  }

  // 只保留不送将的走法（慢路径兜底：直接在 apply 后检查）
  const legal: Move[] = []
  for (const m of moves) {
    const next = applyMove(board, m)
    if (!isInCheck(next, sideToMove)) legal.push(m)
  }
  // 无合法走法：被将死或困毙
  if (legal.length === 0) return -MATE - depth

  const ordered = orderMoves(board, legal)
  let best = -Infinity
  for (const m of ordered) {
    const next = applyMove(board, m)
    const score = -alphaBeta(next, other(sideToMove), depth - 1, -beta, -alpha, mateIn)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

/** 静态延伸：只搜吃子，避免水平线效应 */
function quiescence(board: Board, sideToMove: Side, alpha: number, beta: number, qdepth: number): number {
  nodeCount++
  let stand = evaluate(board, sideToMove)
  if (qdepth >= 4) return stand
  if (stand >= beta) return stand
  if (stand > alpha) alpha = stand

  const captures = pseudoMoves(board, sideToMove).filter((m) => board[m.to[0]]![m.to[1]] !== null)
  const ordered = orderMoves(board, captures)
  for (const m of ordered) {
    const next = applyMove(board, m)
    if (isInCheck(next, sideToMove)) continue
    const score = -quiescence(next, other(sideToMove), -beta, -alpha, qdepth + 1)
    if (score >= beta) return score
    if (score > alpha) alpha = score
  }
  return alpha
}

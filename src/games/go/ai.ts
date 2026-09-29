/** 围棋启发式 AI：吃子/救子/打吃/防自杀与填眼/位置感觉/终局虚手。适合入门对弈（非 AlphaGo 😄） */
import {
  allLegalMoves,
  groupAt,
  neighbors,
  other,
  playMove,
  scoreGame,
  type GoState,
  type Player,
} from './engine'

export type Difficulty = 'easy' | 'medium' | 'hard'

interface Candidate {
  r: number
  c: number
  s: number
}

const NOISE: Record<Difficulty, number> = { easy: 14, medium: 5, hard: 0 }

/** 计算 AI 的一手。返回 null 表示虚手（停一手） */
export function computeGoMove(
  state: GoState,
  ai: Player,
  difficulty: Difficulty = 'medium',
  rng: () => number = Math.random,
): [number, number] | null {
  const legal = allLegalMoves(state)
  if (legal.length === 0) return null

  // 对方刚虚手且我方领先 → 跟着虚手终局
  if (state.passes === 1) {
    const score = scoreGame(state.board)
    const leading = ai === 1 ? score.black > score.white : score.white > score.black
    if (leading) return null
  }

  const noise = NOISE[difficulty]
  const cands: Candidate[] = []
  for (const [r, c] of legal) {
    const base = evaluateMove(state, r, c, ai)
    if (base === -Infinity) continue
    cands.push({ r, c, s: base + (noise > 0 ? (rng() * 2 - 1) * noise : 0) })
  }
  if (cands.length === 0) return null
  cands.sort((a, b) => b.s - a.s)

  // 简单档：偶尔从前几名里挑一手（更"人性化"也更弱）
  if (difficulty === 'easy' && cands.length > 2 && rng() < 0.3) {
    const pick = cands[Math.floor(rng() * Math.min(3, cands.length))]!
    return [pick.r, pick.c]
  }

  const best = cands[0]!
  if (best.s < 0) return null // 没有值得下的点（避免无意义填子）
  return [best.r, best.c]
}

/** 单点启发式评分（越大越好） */
function evaluateMove(state: GoState, r: number, c: number, ai: Player): number {
  const mr = playMove(state, r, c)
  if (!mr) return -Infinity
  const { size } = state
  const opp = other(ai)
  const before = state.board
  const after = mr.state.board

  let s = 0
  // 1. 提子是硬道理
  s += mr.captured * 30

  // 2. 自己棋块的气
  const g = groupAt(after, r, c)!
  if (g.liberties === 1 && mr.captured === 0) {
    s -= 28 // 送吃（自撞气）
  } else {
    s += Math.min(g.liberties, 4) * 2
  }

  // 3. 打吃对方（让对方棋块只剩一口气）
  const seenOpp = new Set<string>()
  for (const [nr, nc] of neighbors(size, r, c)) {
    if (after[nr]![nc] === opp && !seenOpp.has(`${nr},${nc}`)) {
      const og = groupAt(after, nr, nc)!
      for (const [sr, sc] of og.stones) seenOpp.add(`${sr},${sc}`)
      if (og.liberties === 1) s += 10 + og.stones.length * 2
    }
  }

  // 4. 救自己被打吃的棋（原局面相邻己方块仅 1 气，本手后气 ≥ 2）
  const seenOwn = new Set<string>()
  for (const [nr, nc] of neighbors(size, r, c)) {
    if (before[nr]![nc] === ai && !seenOwn.has(`${nr},${nc}`)) {
      const og = groupAt(before, nr, nc)!
      for (const [sr, sc] of og.stones) seenOwn.add(`${sr},${sc}`)
      if (og.liberties === 1 && g.liberties >= 2) s += 8 + og.stones.length * 6
    }
  }

  // 5. 别填自己的眼/自家地盘
  const nbs = neighbors(size, r, c)
  const allOwn = nbs.length > 0 && nbs.every(([nr, nc]) => before[nr]![nc] === ai)
  if (allOwn && mr.captured === 0) s -= 60

  // 6. 位置感觉：贴近战场；开局占角部要点
  const d = nearestStoneDist(before, r, c)
  if (d === 1) s += 4
  else if (d === 2) s += 3
  else if (d === 3) s += 2
  if (d === Infinity) {
    // 空盘开局：距边 2~3 线的要点（三三/星位附近）
    const edge = Math.min(r, size - 1 - r, c, size - 1 - c)
    if (edge === 2 || edge === 3) s += 8
  }

  return s
}

/** 到最近棋子的切比雪夫距离 */
function nearestStoneDist(board: number[][], r: number, c: number): number {
  const size = board.length
  let best = Infinity
  for (let i = 0; i < size && best > 1; i++) {
    for (let j = 0; j < size; j++) {
      if (board[i]![j] !== 0) {
        const d = Math.max(Math.abs(i - r), Math.abs(j - c))
        if (d < best) best = d
        if (best === 1) break
      }
    }
  }
  return best
}

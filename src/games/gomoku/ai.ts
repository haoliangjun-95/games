/**
 * 五子棋 AI：启发式候选 + Alpha-Beta 剪枝（参考 MIT 开源 lihongxun945/gobang 思路，TS 重写）
 * 评分采用棋型打分（活四/冲四/活三/眠三…），搜索前先做「一步取胜/一步防杀」短路。
 */
import { checkWinAt, DIRS, opponentOf, SIZE, type Board, type Player } from './engine'

export type Difficulty = 'easy' | 'medium' | 'hard'

const WIN_SCORE = 10_000_000

/** 棋型分值 */
const SCORES = {
  five: 1_000_000,
  liveFour: 100_000,
  rushFour: 10_000,
  liveThree: 8_000,
  jumpThree: 7_000,
  sleepThree: 500,
  liveTwo: 400,
  sleepTwo: 50,
  liveOne: 20,
}

/** 把一行棋转成字符串（'1'/'2'/'0'），仅用于棋型匹配 */
function lineToString(board: Board, startR: number, startC: number, dr: number, dc: number, me: Player): string {
  let s = ''
  let r = startR
  let c = startC
  const opp = opponentOf(me)
  while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
    const v = board[r]![c]!
    s += v === me ? '1' : v === opp ? '2' : '0'
    r += dr
    c += dc
  }
  return s
}

/** 统计子串出现次数 */
function countSub(s: string, sub: string): number {
  let n = 0
  let i = s.indexOf(sub)
  while (i !== -1) {
    n++
    i = s.indexOf(sub, i + 1)
  }
  return n
}

/** 某条线的棋型得分 */
function scoreLine(s: string): number {
  let score = 0
  // 连五
  score += countSub(s, '11111') * SCORES.five
  // 活四
  score += countSub(s, '011110') * SCORES.liveFour
  // 冲四（一头被堵）
  score +=
    (countSub(s, '21111') + countSub(s, '11112') + countSub(s, '10111') + countSub(s, '11011') + countSub(s, '11101')) *
    SCORES.rushFour
  // 活三
  score += countSub(s, '01110') * SCORES.liveThree
  // 跳活三
  score += (countSub(s, '010110') + countSub(s, '011010')) * SCORES.jumpThree
  // 眠三
  score +=
    (countSub(s, '211100') + countSub(s, '001112') + countSub(s, '211010') + countSub(s, '010112') + countSub(s, '210110') + countSub(s, '011012') + countSub(s, '10011') + countSub(s, '11001') + countSub(s, '10101') + countSub(s, '2011102')) *
    SCORES.sleepThree
  // 活二
  score += (countSub(s, '001100') + countSub(s, '01010') + countSub(s, '010010')) * SCORES.liveTwo
  // 眠二
  score += (countSub(s, '211000') + countSub(s, '000112') + countSub(s, '210100') + countSub(s, '001012') + countSub(s, '210010') + countSub(s, '010012')) * SCORES.sleepTwo
  // 活一
  score += countSub(s, '01000') * SCORES.liveOne
  return score
}

/** 收集所有长度 ≥5 的线 */
function allLines(): Array<[number, number, number, number]> {
  const lines: Array<[number, number, number, number]> = []
  for (let r = 0; r < SIZE; r++) lines.push([r, 0, 0, 1]) // 行
  for (let c = 0; c < SIZE; c++) lines.push([0, c, 1, 0]) // 列
  for (let r = 0; r < SIZE; r++) {
    lines.push([r, 0, 1, 1]) // 右下方向
    lines.push([r, SIZE - 1, 1, -1]) // 左下方向
  }
  for (let c = 1; c < SIZE; c++) {
    lines.push([0, c, 1, 1])
    if (c < SIZE - 1) lines.push([0, c, 1, -1])
  }
  return lines
}

const LINES = allLines()

/** 交换字符串中双方棋子视角（'1'↔'2'） */
function swapPlayers(s: string): string {
  return s.replace(/1/g, 'x').replace(/2/g, '1').replace(/x/g, '2')
}

/** 全盘评估：me 视角得分 - 对手得分×1.1（防守略优先） */
export function evaluate(board: Board, me: Player): number {
  let myScore = 0
  let oppScore = 0
  for (const [r, c, dr, dc] of LINES) {
    const s = lineToString(board, r, c, dr, dc, me) // '1'=me '2'=opp '0'=空
    const hasMine = s.includes('1')
    const hasOpp = s.includes('2')
    if (hasMine) myScore += scoreLine(s)
    if (hasOpp) oppScore += scoreLine(swapPlayers(s))
  }
  return myScore - oppScore * 1.1
}

/** 候选点：距离任意棋子切比雪夫距离 ≤2 的空点 */
export function genCandidates(board: Board): Array<[number, number]> {
  const has = board.some((row) => row.some((v) => v !== 0))
  if (!has) return [[7, 7]]
  const cands: Array<[number, number]> = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r]![c] !== 0) continue
      let near = false
      for (let dr = -2; dr <= 2 && !near; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr]![nc] !== 0) {
            near = true
            break
          }
        }
      }
      if (near) cands.push([r, c])
    }
  }
  return cands
}

/** 单点即时价值：在此落子对 me 的进攻分 + 对对手的防守分 */
function pointScore(board: Board, r: number, c: number, me: Player): number {
  let attack = 0
  let defend = 0
  for (const [dr, dc] of DIRS) {
    attack += dirScore(board, r, c, dr, dc, me)
    defend += dirScore(board, r, c, dr, dc, opponentOf(me))
  }
  return attack + defend * 0.9
}

function dirScore(board: Board, r: number, c: number, dr: number, dc: number, player: Player): number {
  // 双向数连子与空端
  let count = 1
  let openEnds = 0
  // 正向
  let nr = r + dr
  let nc = c + dc
  while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr]![nc] === player) {
    count++
    nr += dr
    nc += dc
  }
  if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr]![nc] === 0) openEnds++
  // 反向
  nr = r - dr
  nc = c - dc
  while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr]![nc] === player) {
    count++
    nr -= dr
    nc -= dc
  }
  if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr]![nc] === 0) openEnds++
  return patternScore(count, openEnds)
}

function patternScore(count: number, openEnds: number): number {
  if (count >= 5) return SCORES.five
  if (openEnds === 0) return 0
  if (count === 4) return openEnds === 2 ? SCORES.liveFour : SCORES.rushFour
  if (count === 3) return openEnds === 2 ? SCORES.liveThree : SCORES.sleepThree
  if (count === 2) return openEnds === 2 ? SCORES.liveTwo : SCORES.sleepTwo
  return openEnds === 2 ? SCORES.liveOne : 4
}

interface SearchConfig {
  depth: number
  candidateLimit: number
  noise: number
}

const CONFIGS: Record<Difficulty, SearchConfig> = {
  easy: { depth: 1, candidateLimit: 6, noise: 0.35 },
  medium: { depth: 2, candidateLimit: 10, noise: 0.05 },
  hard: { depth: 4, candidateLimit: 8, noise: 0 },
}

/** 主入口：计算 AI 落子。无棋可下返回 null */
export function computeMove(board: Board, aiPlayer: Player, difficulty: Difficulty = 'medium'): [number, number] | null {
  const candidates = genCandidates(board)
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]!

  // 1. 一步取胜
  for (const [r, c] of candidates) {
    board[r]![c] = aiPlayer
    const win = checkWinAt(board, r, c)
    board[r]![c] = 0
    if (win) return [r, c]
  }
  // 2. 一步防杀（对手下一手五连的位置）
  const opp = opponentOf(aiPlayer)
  const mustBlock: Array<[number, number]> = []
  for (const [r, c] of candidates) {
    board[r]![c] = opp
    const win = checkWinAt(board, r, c)
    board[r]![c] = 0
    if (win) mustBlock.push([r, c])
  }
  if (mustBlock.length === 1) return mustBlock[0]!
  if (mustBlock.length > 1) {
    // 双杀点无解，仍堵评分最高的
    return mustBlock.reduce((best, cur) => (pointScore(board, cur[0], cur[1], aiPlayer) > pointScore(board, best[0], best[1], aiPlayer) ? cur : best))
  }

  const cfg = CONFIGS[difficulty]
  // 候选排序
  const scored = candidates
    .map(([r, c]) => ({ r, c, s: pointScore(board, r, c, aiPlayer) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, cfg.candidateLimit)

  // easy 档：加噪声的贪心
  if (difficulty === 'easy') {
    const top = scored[0]!
    if (Math.random() < cfg.noise && scored.length > 1) {
      const pick = scored[Math.floor(Math.random() * Math.min(3, scored.length))]!
      return [pick.r, pick.c]
    }
    return [top.r, top.c]
  }

  let bestMove: [number, number] = [scored[0]!.r, scored[0]!.c]
  let bestScore = -Infinity

  for (const cand of scored) {
    board[cand.r]![cand.c] = aiPlayer
    const score = -negamax(board, opp, cfg.depth - 1, -Infinity, Infinity, cfg.candidateLimit)
    board[cand.r]![cand.c] = 0
    if (score > bestScore) {
      bestScore = score
      bestMove = [cand.r, cand.c]
    }
  }
  return bestMove
}

function negamax(board: Board, player: Player, depth: number, alpha: number, beta: number, candidateLimit: number): number {
  const candidates = genCandidates(board)
  if (candidates.length === 0) return 0
  // 终局检测：player 若能一步五连
  for (const [r, c] of candidates) {
    board[r]![c] = player
    const win = checkWinAt(board, r, c)
    board[r]![c] = 0
    if (win) return WIN_SCORE + depth
  }
  if (depth <= 0) return evaluate(board, player)

  const scored = candidates
    .map(([r, c]) => ({ r, c, s: pointScore(board, r, c, player) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, candidateLimit)

  let best = -Infinity
  for (const cand of scored) {
    board[cand.r]![cand.c] = player
    const score = -negamax(board, opponentOf(player), depth - 1, -beta, -alpha, candidateLimit)
    board[cand.r]![cand.c] = 0
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

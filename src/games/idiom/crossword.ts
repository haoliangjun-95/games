/** 成语填字闯关：关卡生成器（成语纵横交错，交叉处共享首尾字） */
import type { IdiomChain, IdiomEntry } from './chain'

export interface CrossIdiom {
  entry: IdiomEntry
  dir: 'H' | 'V'
  /** 4 个格子坐标，第 0 个 = 首字位置（与上一条的尾字格交叉） */
  cells: Array<[number, number]>
}

export interface CrossCell {
  r: number
  c: number
  char: string
  revealed: boolean
  /** 属于哪些成语（下标） */
  idiomIdx: number[]
}

export interface CrosswordLevel {
  level: number
  rows: number
  cols: number
  idioms: CrossIdiom[]
  cells: CrossCell[]
  /** 候选字块（含干扰字，已打乱） */
  candidates: string[]
}

const WORK_LIMIT = 16 // 布局工作区上限（防无限延伸）

/** 关卡成语条数：3 条起步，每 2 关 +1，最多 9 条（阶梯布局的工作区上限） */
export function idiomCountForLevel(level: number): number {
  return Math.min(2 + Math.floor((level + 1) / 2), 9)
}

/** 每条成语揭示格数：前 5 关 2 格，之后 1 格 */
export function revealCountForLevel(level: number): number {
  return level <= 5 ? 2 : 1
}

/** 干扰字数量：5 个起步，随关卡增至 8 */
export function distractorCountForLevel(level: number): number {
  return Math.min(5 + Math.floor((level - 1) / 5), 8)
}

export function key(r: number, c: number): string {
  return `${r},${c}`
}

/** 生成一关。内部大量重试，理论上必然成功；极端情况抛错 */
export function generateLevel(chain: IdiomChain, level: number, rng: () => number = Math.random): CrosswordLevel {
  const maxCount = idiomCountForLevel(level)
  for (let count = maxCount; count >= 3; count--) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const seq = chain.chainSequence(count, rng)
      if (!seq) continue
      const laid = tryLayout(seq)
      if (laid) return finalize(laid, level, chain, rng)
    }
  }
  throw new Error('关卡生成失败（词典接龙链不足）')
}

interface LaidOut {
  idioms: CrossIdiom[]
  grid: Map<string, { char: string; idiomIdx: number[] }>
}

/** 交错布局：第 0 条横向，之后纵横交替，起点为上一条尾字格 */
function tryLayout(seq: IdiomEntry[]): LaidOut | null {
  const idioms: CrossIdiom[] = []
  const grid = new Map<string, { char: string; idiomIdx: number[] }>()

  const cellsOf = (r: number, c: number, dir: 'H' | 'V'): Array<[number, number]> => {
    const cells: Array<[number, number]> = []
    for (let i = 0; i < 4; i++) {
      cells.push(dir === 'H' ? [r, c + i] : [r + i, c])
    }
    return cells
  }

  for (let k = 0; k < seq.length; k++) {
    const entry = seq[k]!
    let dir: 'H' | 'V'
    let cells: Array<[number, number]>
    if (k === 0) {
      dir = 'H'
      cells = cellsOf(0, 0, dir)
    } else {
      const prev = idioms[k - 1]!
      const [cr, cc] = prev.cells[3]!
      dir = prev.dir === 'H' ? 'V' : 'H'
      cells = cellsOf(cr, cc, dir)
      // 越界检查
      if (cells.some(([r, c]) => r < 0 || r >= WORK_LIMIT || c < 0 || c >= WORK_LIMIT)) return null
      // 交叉点之外的格子必须为空
      for (let i = 1; i < 4; i++) {
        if (grid.has(key(cells[i]![0], cells[i]![1]))) return null
      }
      // 交叉点字符应一致（链生成保证，双保险）
      const cross = grid.get(key(cr, cc))
      if (!cross || cross.char !== entry.word[0]) return null
    }
    for (let i = 0; i < 4; i++) {
      const [r, c] = cells[i]!
      const kk = key(r, c)
      const cur = grid.get(kk)
      if (cur) cur.idiomIdx.push(k)
      else grid.set(kk, { char: entry.word[i]!, idiomIdx: [k] })
    }
    idioms.push({ entry, dir, cells })
  }
  return { idioms, grid }
}

/** 揭示/干扰字/归一化，产出最终关卡 */
function finalize(laid: LaidOut, level: number, chain: IdiomChain, rng: () => number): CrosswordLevel {
  const { idioms, grid } = laid

  // 坐标归一化
  let minR = Infinity
  let minC = Infinity
  let maxR = -Infinity
  let maxC = -Infinity
  for (const k of grid.keys()) {
    const [rr, cc] = k.split(',').map(Number) as [number, number]
    minR = Math.min(minR, rr)
    minC = Math.min(minC, cc)
    maxR = Math.max(maxR, rr)
    maxC = Math.max(maxC, cc)
  }
  const shift = (p: [number, number]): [number, number] => [p[0] - minR, p[1] - minC]
  for (const idiom of idioms) {
    idiom.cells = idiom.cells.map(shift)
  }
  const cells: CrossCell[] = []
  for (const [k, v] of grid.entries()) {
    const [rr, cc] = k.split(',').map(Number) as [number, number]
    cells.push({ r: rr - minR, c: cc - minC, char: v.char, revealed: false, idiomIdx: v.idiomIdx })
  }
  cells.sort((a, b) => a.r - b.r || a.c - b.c)
  const rows = maxR - minR + 1
  const cols = maxC - minC + 1

  // 揭示：每条成语随机揭示若干格（格级取并集）；
  // 保证任何成语都不会被"顺手"揭示到全亮（出生即完成）
  const revealedN = idioms.map(() => 0)
  const revealPick = revealCountForLevel(level)
  for (let k = 0; k < idioms.length; k++) {
    const order = [0, 1, 2, 3].sort(() => rng() - 0.5)
    for (const i of order) {
      if (revealedN[k]! >= revealPick) break
      const [r, c] = idioms[k]!.cells[i]!
      const cell = cells.find((x) => x.r === r && x.c === c)!
      if (cell.revealed) continue
      // 该格的所有归属成语揭示数都不得达到 4
      if (cell.idiomIdx.some((j) => revealedN[j]! + 1 >= 4)) continue
      cell.revealed = true
      for (const j of cell.idiomIdx) revealedN[j]!++
    }
  }

  // 候选字 = 未揭示格字符 + 干扰字（与正确字不重复、互不重复）
  const needed = cells.filter((x) => !x.revealed).map((x) => x.char)
  const neededSet = new Set(needed)
  const distractors: string[] = []
  const target = distractorCountForLevel(level)
  for (let i = 0; i < 400 && distractors.length < target; i++) {
    const ch = chain.randomEntry(rng).word[Math.floor(rng() * 4)]!
    if (!neededSet.has(ch) && !distractors.includes(ch)) distractors.push(ch)
  }
  const candidates = [...needed, ...distractors]
  // 洗牌
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!]
  }

  return { level, rows, cols, idioms, cells, candidates }
}

/** 校验：某格填入的字是否正确 */
export function isCorrect(level: CrosswordLevel, r: number, c: number, ch: string): boolean {
  const cell = level.cells.find((x) => x.r === r && x.c === c)
  return cell != null && cell.char === ch
}

/** 各成语完成状态与整体是否过关 */
export function solvedState(level: CrosswordLevel, fills: Map<string, string>): { allDone: boolean; idiomDone: boolean[] } {
  const idiomDone = level.idioms.map((idiom) =>
    idiom.cells.every(([r, c]) => {
      const cell = level.cells.find((x) => x.r === r && x.c === c)!
      return cell.revealed || fills.get(key(r, c)) === cell.char
    }),
  )
  return { allDone: idiomDone.every(Boolean), idiomDone }
}

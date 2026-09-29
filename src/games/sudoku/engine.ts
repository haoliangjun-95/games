/** 数独核心：位掩码回溯求解器 + 唯一解生成器（思路参考 MIT 开源 robatron/sudoku.js，TS 重写） */

export type Grid = number[][] // 9×9，0 表示空

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; givens: [number, number] }> = {
  easy: { label: '简单', givens: [38, 45] },
  medium: { label: '中等', givens: [30, 36] },
  hard: { label: '困难', givens: [26, 29] },
  expert: { label: '专家', givens: [22, 25] },
}

function boxIndex(r: number, c: number): number {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3)
}

/** 统计解的数量（最多统计到 limit），同时返回找到的第一个解 */
export function solveGrid(grid: Grid, limit = 1, rng?: () => number): { count: number; solution: Grid | null } {
  const rows = new Array<number>(9).fill(0)
  const cols = new Array<number>(9).fill(0)
  const boxes = new Array<number>(9).fill(0)
  const empties: Array<[number, number]> = []
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = grid[r]![c]!
      if (v === 0) {
        empties.push([r, c])
      } else {
        const bit = 1 << v
        if (rows[r]! & bit || cols[c]! & bit || boxes[boxIndex(r, c)]! & bit) {
          return { count: 0, solution: null } // 给定盘面本身冲突
        }
        rows[r]! |= bit
        cols[c]! |= bit
        boxes[boxIndex(r, c)]! |= bit
      }
    }
  }

  let count = 0
  let solution: Grid | null = null
  const full = 0b1111111110 // 数字 1-9 的位

  // 随机化搜索顺序（用于生成完整终盘）
  const valueOrder = () => {
    const order = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    if (rng) for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[order[i], order[j]] = [order[j]!, order[i]!]
    }
    return order
  }

  const g = grid.map((row) => row.slice())

  function dfs(): boolean {
    if (count >= limit) return true
    // MRV：找候选最少的空格
    let bestIdx = -1
    let bestMask = 0
    let bestCount = 10
    for (let i = 0; i < empties.length; i++) {
      const [r, c] = empties[i]!
      if (g[r]![c] !== 0) continue
      const used = rows[r]! | cols[c]! | boxes[boxIndex(r, c)]!
      const mask = full & ~used
      const n = popcount(mask)
      if (n === 0) return false // 死局
      if (n < bestCount) {
        bestCount = n
        bestIdx = i
        bestMask = mask
        if (n === 1) break
      }
    }
    if (bestIdx === -1) {
      // 全部填满 → 找到一个解
      count++
      if (!solution) solution = g.map((row) => row.slice())
      return count >= limit
    }
    const [r, c] = empties[bestIdx]!
    const b = boxIndex(r, c)
    for (const v of valueOrder()) {
      const bit = 1 << v
      if (!(bestMask & bit)) continue
      g[r]![c] = v
      rows[r]! |= bit
      cols[c]! |= bit
      boxes[b]! |= bit
      const stop = dfs()
      g[r]![c] = 0
      rows[r]! &= ~bit
      cols[c]! &= ~bit
      boxes[b]! &= ~bit
      if (stop) return true
    }
    return false
  }

  dfs()
  return { count, solution }
}

function popcount(mask: number): number {
  let n = 0
  while (mask) {
    mask &= mask - 1
    n++
  }
  return n
}

/** 生成随机完整终盘 */
function generateSolution(rng: () => number): Grid {
  const empty: Grid = Array.from({ length: 9 }, () => Array<number>(9).fill(0))
  const { solution } = solveGrid(empty, 1, rng)
  // 随机回溯一定能生成完整解
  return solution ?? empty
}

/** 挖洞生成唯一解谜题 */
export function generatePuzzle(difficulty: Difficulty, rng: () => number = Math.random): { puzzle: Grid; solution: Grid } {
  const solution = generateSolution(rng)
  const puzzle = solution.map((row) => row.slice())
  const [minGivens, maxGivens] = DIFFICULTY_INFO[difficulty].givens
  let givens = 81

  // 随机顺序尝试挖洞
  const positions = Array.from({ length: 81 }, (_, i) => i)
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[positions[i], positions[j]] = [positions[j]!, positions[i]!]
  }

  for (const pos of positions) {
    if (givens <= maxGivens) break
    const r = Math.floor(pos / 9)
    const c = pos % 9
    const backup = puzzle[r]![c]!
    if (backup === 0) continue
    puzzle[r]![c] = 0
    const { count } = solveGrid(puzzle, 2)
    if (count !== 1) {
      puzzle[r]![c] = backup // 挖掉会导致多解，恢复
    } else {
      givens--
    }
  }
  // 兜底：如果难度没挖到目标区间（如 expert 难以完全达成），接受当前结果
  void minGivens
  return { puzzle, solution }
}

/** 计算某格的候选数（供铅笔标记） */
export function candidatesOf(grid: Grid, r: number, c: number): number[] {
  if (grid[r]![c] !== 0) return []
  const used = new Set<number>()
  for (let i = 0; i < 9; i++) {
    used.add(grid[r]![i]!)
    used.add(grid[i]![c]!)
  }
  const br = Math.floor(r / 3) * 3
  const bc = Math.floor(c / 3) * 3
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      used.add(grid[br + i]![bc + j]!)
    }
  }
  const out: number[] = []
  for (let v = 1; v <= 9; v++) {
    if (!used.has(v)) out.push(v)
  }
  return out
}

export function isGridComplete(grid: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r]![c] === 0) return false
    }
  }
  return true
}

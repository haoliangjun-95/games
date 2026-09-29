import { describe, expect, it } from 'vitest'
import { candidatesOf, generatePuzzle, solveGrid, type Grid } from './engine'

const EMPTY: Grid = Array.from({ length: 9 }, () => Array<number>(9).fill(0))

/** Norvig 论文中著名的难题 */
const HARD: Grid = [
  [0, 0, 0, 6, 0, 4, 7, 0, 0],
  [7, 0, 6, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 7, 0, 5, 0],
  [0, 0, 9, 0, 3, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 8, 6, 4, 0],
  [0, 0, 0, 0, 0, 0, 0, 7, 0],
  [6, 0, 0, 0, 0, 0, 0, 0, 5],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [8, 2, 0, 9, 7, 0, 0, 0, 0],
]

function isValidSolution(g: Grid): boolean {
  const rows = new Array(9).fill(0)
  const cols = new Array(9).fill(0)
  const boxes = new Array(9).fill(0)
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = g[r]![c]!
      if (v < 1 || v > 9) return false
      const bit = 1 << v
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3)
      if (rows[r]! & bit || cols[c]! & bit || boxes[b]! & bit) return false
      rows[r]! |= bit
      cols[c]! |= bit
      boxes[b]! |= bit
    }
  }
  return true
}

describe('数独求解器', () => {
  it('空盘可生成完整解（81 格全填）', () => {
    const { count, solution } = solveGrid(EMPTY, 1, Math.random)
    expect(count).toBeGreaterThanOrEqual(1)
    expect(solution).not.toBeNull()
    expect(isValidSolution(solution!)).toBe(true)
  })

  it('冲突盘面无解', () => {
    const bad: Grid = EMPTY.map((row) => row.slice())
    bad[0]![0] = 5
    bad[0]![1] = 5
    const { count } = solveGrid(bad, 2)
    expect(count).toBe(0)
  })

  it('能解经典难题', () => {
    const { solution } = solveGrid(HARD, 1)
    expect(solution).not.toBeNull()
    expect(isValidSolution(solution!)).toBe(true)
    // 给定数字保持不变
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (HARD[r]![c] !== 0) expect(solution![r]![c]).toBe(HARD[r]![c])
      }
    }
  })
})

describe('数独生成器', () => {
  it('各难度生成唯一解谜题', () => {
    for (const diff of ['easy', 'medium', 'hard', 'expert'] as const) {
      const { puzzle, solution } = generatePuzzle(diff, Math.random)
      // 唯一解
      const { count } = solveGrid(puzzle, 2)
      expect(count).toBe(1)
      // 谜题是终盘的子集
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (puzzle[r]![c] !== 0) expect(puzzle[r]![c]).toBe(solution[r]![c])
        }
      }
      expect(isValidSolution(solution)).toBe(true)
      // 提示数大致符合难度区间（允许 expert 偶尔偏高）
      const givens = puzzle.flat().filter((v) => v !== 0).length
      expect(givens).toBeGreaterThanOrEqual(20)
      expect(givens).toBeLessThanOrEqual(50)
    }
  })

  it('简单难度提示数明显多于专家难度', () => {
    const easyGivens = generatePuzzle('easy').puzzle.flat().filter((v) => v !== 0).length
    const expertGivens = generatePuzzle('expert').puzzle.flat().filter((v) => v !== 0).length
    expect(easyGivens).toBeGreaterThan(expertGivens)
  })
})

describe('候选数计算', () => {
  it('空格候选数排除同行列宫', () => {
    const g: Grid = EMPTY.map((row) => row.slice())
    g[0] = [1, 2, 3, 4, 5, 6, 7, 8, 0]
    // (0,8) 的候选只有 9
    expect(candidatesOf(g, 0, 8)).toEqual([9])
    // 第 0 行全占，(1,0) 候选排除列上的 1 和宫里的 2、3 → 剩 4-9
    expect(candidatesOf(g, 1, 0)).toEqual([4, 5, 6, 7, 8, 9])
  })

  it('已填格子无候选', () => {
    const g: Grid = EMPTY.map((row) => row.slice())
    g[4]![4] = 5
    expect(candidatesOf(g, 4, 4)).toEqual([])
  })
})

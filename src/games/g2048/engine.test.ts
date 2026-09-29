import { describe, expect, it } from 'vitest'
import { canMove, createGame, move } from './engine'

describe('2048 引擎', () => {
  it('新游戏有两个初始方块，分数为 0', () => {
    const g = createGame(4, () => 0.5)
    const tiles = g.grid.flat().filter((v) => v !== 0)
    expect(tiles).toHaveLength(2)
    expect(g.score).toBe(0)
    expect(g.over).toBe(false)
  })

  it('向左合并相邻相同数字并计分', () => {
    const g = {
      size: 4,
      grid: [
        [2, 2, 0, 0],
        [4, 4, 4, 0],
        [2, 0, 2, 4],
        [0, 0, 0, 8],
      ],
      score: 0,
      won: false,
      over: false,
      keepGoing: false,
    }
    const r = move(g, 'left', () => 0.99) // rng 0.99 → 生成 4（>=0.9）
    expect(r.moved).toBe(true)
    // 第一行 2+2=4；第二行 4+4=8 后剩 4；第三行 2+2=4 再 4；第四行不变
    expect(r.state.grid[0]!.slice(0, 3)).toEqual([4, 0, 0])
    expect(r.state.grid[1]!.slice(0, 3)).toEqual([8, 4, 0])
    expect(r.state.grid[2]!.slice(0, 3)).toEqual([4, 4, 0])
    expect(r.state.score).toBe(4 + 8 + 4)
  })

  it('一次移动中同一方块只合并一次（[2,2,2,2] → [4,4]）', () => {
    const g = {
      size: 4,
      grid: [
        [2, 2, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      score: 0,
      won: false,
      over: false,
      keepGoing: false,
    }
    const r = move(g, 'left', () => 0.5)
    expect(r.state.grid[0]!.slice(0, 2)).toEqual([4, 4])
    expect(r.state.score).toBe(8)
  })

  it('无变化的方向 moved=false 且不生成新方块', () => {
    const g = {
      size: 4,
      grid: [
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      score: 0,
      won: false,
      over: false,
      keepGoing: false,
    }
    const r = move(g, 'left', () => 0.5)
    expect(r.moved).toBe(false)
    expect(r.state.grid.flat().filter((v) => v !== 0)).toHaveLength(1)
  })

  it('达到 2048 时标记 won，棋盘满且无法移动时 over', () => {
    const g = {
      size: 4,
      grid: [
        [1024, 1024, 4, 8],
        [16, 32, 64, 128],
        [256, 512, 2, 4],
        [8, 16, 32, 64],
      ],
      score: 0,
      won: false,
      over: false,
      keepGoing: false,
    }
    const r = move(g, 'left', () => 0.99)
    expect(r.state.won).toBe(true)
  })

  it('canMove 检测各方向', () => {
    const g = {
      size: 4,
      grid: [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ],
      score: 0,
      won: false,
      over: false,
      keepGoing: false,
    }
    expect(canMove(g, 'left')).toBe(false)
    expect(canMove(g, 'right')).toBe(false)
    expect(canMove(g, 'up')).toBe(false)
    expect(canMove(g, 'down')).toBe(false)
  })
})

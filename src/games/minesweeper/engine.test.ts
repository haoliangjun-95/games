import { describe, expect, it } from 'vitest'
import { chord, countFlags, createGame, DIFFICULTIES, placeMines, reveal, toggleFlag, type Game } from './engine'

function findMine(g: Game): [number, number] {
  for (let r = 0; r < g.board.length; r++) {
    for (let c = 0; c < g.board[r]!.length; c++) {
      if (g.board[r]![c]!.mine) return [r, c]
    }
  }
  throw new Error('no mine on board')
}

describe('扫雷引擎', () => {
  it('布雷数量正确且首击安全区无雷', () => {
    const g = createGame(DIFFICULTIES.beginner)
    const g2 = placeMines(g, 4, 4, () => 0.5)
    const mines = g2.board.flat().filter((c) => c.mine)
    expect(mines).toHaveLength(10)
    // (4,4) 及其 8 邻居无雷
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const cell = g2.board[4 + dr]?.[4 + dc]
        if (cell) expect(cell.mine).toBe(false)
      }
    }
  })

  it('邻雷数计算正确', () => {
    const g = createGame(DIFFICULTIES.beginner)
    const g2 = placeMines(g, 4, 4, () => 0.5)
    for (let r = 0; r < g2.config.rows; r++) {
      for (let c = 0; c < g2.config.cols; c++) {
        const cell = g2.board[r]![c]!
        if (!cell.mine) {
          let count = 0
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (g2.board[r + dr]?.[c + dc]?.mine) count++
            }
          }
          expect(cell.adjacent).toBe(count)
        }
      }
    }
  })

  it('翻开空白格触发洪水展开', () => {
    // 3x3 一颗雷，安全点 (2,2)，雷一定在 (0,0)/(0,1)/(0,2)/(1,0)/(2,0) 之一
    const g = createGame({ rows: 3, cols: 3, mines: 1 })
    const g2 = placeMines(g, 2, 2, () => 0)
    const [mr, mc] = findMine(g2)
    const g3 = reveal(g2, 2, 2)
    expect(g3.board[2]![2]!.revealed).toBe(true)
    // 至少展开一片区域，且雷未被翻开
    expect(g3.board[mr]![mc]!.revealed).toBe(false)
    const revealedCount = g3.board.flat().filter((c) => c.revealed).length
    expect(revealedCount).toBeGreaterThan(1)
  })

  it('踩雷判负并翻开全部雷', () => {
    const g = createGame({ rows: 3, cols: 3, mines: 1 })
    const g2 = placeMines(g, 2, 2, () => 0)
    const [mr, mc] = findMine(g2)
    const g3 = reveal(g2, mr, mc)
    expect(g3.status).toBe('lost')
    expect(g3.board[mr]![mc]!.revealed).toBe(true)
  })

  it('翻开全部非雷格判胜并自动插旗', () => {
    const g = createGame({ rows: 3, cols: 3, mines: 1 })
    const g2 = placeMines(g, 2, 2, () => 0)
    const [mr, mc] = findMine(g2)
    let cur = g2
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cell = cur.board[r]![c]!
        if (!cell.revealed && !cell.mine) cur = reveal(cur, r, c)
      }
    }
    expect(cur.status).toBe('won')
    expect(countFlags(cur)).toBe(1)
    expect(cur.board[mr]![mc]!.revealed).toBe(false)
  })

  it('插旗格子不能被翻开；旗数统计正确', () => {
    const g = createGame({ rows: 3, cols: 3, mines: 1 })
    const g2 = placeMines(g, 2, 2, () => 0)
    const [mr, mc] = findMine(g2)
    const g3 = toggleFlag(g2, mr, mc)
    expect(countFlags(g3)).toBe(1)
    const g4 = reveal(g3, mr, mc)
    expect(g4.board[mr]![mc]!.revealed).toBe(false)
    expect(g4.status).not.toBe('lost')
  })

  it('chord：旗数匹配时快速展开周围', () => {
    // 手工构造 2×2、雷在 (0,0)：三个非雷格邻数均为 1
    const g = createGame({ rows: 2, cols: 2, mines: 1 })
    const b = g.board.map((row) => row.map((cell) => ({ ...cell })))
    b[0]![0]!.mine = true
    b[0]![1]!.adjacent = 1
    b[1]![0]!.adjacent = 1
    b[1]![1]!.adjacent = 1
    let cur: Game = { ...g, board: b, mined: true, status: 'playing' }
    // 翻开 (1,1)（邻数 1 不触发洪水展开）
    cur = reveal(cur, 1, 1)
    expect(cur.status).toBe('playing')
    // 给雷插旗后双击 (1,1)：旗数 1 == 邻数 1 → 展开其余邻居 → 胜利
    cur = toggleFlag(cur, 0, 0)
    cur = chord(cur, 1, 1)
    expect(cur.status).toBe('won')
  })
})

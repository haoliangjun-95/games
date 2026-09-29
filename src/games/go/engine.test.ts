import { describe, expect, it } from 'vitest'
import { boardKey, createGame, groupAt, passTurn, playMove, scoreGame, type GoState, type Board } from './engine'
import { computeGoMove } from './ai'

function setBoard(size: number, black: Array<[number, number]>, white: Array<[number, number]>): GoState {
  const s = createGame(size)
  for (const [r, c] of black) s.board[r]![c] = 1
  for (const [r, c] of white) s.board[r]![c] = 2
  // 手工摆的初始局面需登记进历史，打劫（全局同形）判定才有效
  s.history = [boardKey(s.board)]
  return s
}

describe('围棋规则：气与提子', () => {
  it('单子被围即被提走', () => {
    const s = setBoard(9, [[3, 4], [5, 4], [4, 3]], [[4, 4]])
    const mr = playMove(s, 4, 5)
    expect(mr).not.toBeNull()
    expect(mr!.captured).toBe(1)
    expect(mr!.state.board[4]![4]).toBe(0)
    expect(mr!.state.captures[1]).toBe(1)
  })

  it('连通棋块共享气，整块提走', () => {
    // 白 (4,4)(4,5) 两子只剩 (4,6) 一口气
    const s = setBoard(
      9,
      [[3, 4], [3, 5], [5, 4], [5, 5], [4, 3]],
      [[4, 4], [4, 5]],
    )
    const g = groupAt(s.board, 4, 4)!
    expect(g.stones).toHaveLength(2)
    expect(g.liberties).toBe(1)
    const mr = playMove(s, 4, 6)
    expect(mr!.captured).toBe(2)
    expect(mr!.state.board[4]![4]).toBe(0)
    expect(mr!.state.board[4]![5]).toBe(0)
    expect(mr!.state.captures[1]).toBe(2)
  })

  it('禁自杀：落子后自己无气且提不到对方 → 非法', () => {
    const s = setBoard(9, [], [[0, 1], [1, 0]])
    expect(playMove(s, 0, 0)).toBeNull()
  })

  it('先提对方则合法（提子后获得新气）', () => {
    // 白 (0,0) 只剩 (1,0) 一口气；黑下 (1,0) 提子，自身得到 (0,0) 处的气
    const s = setBoard(9, [[0, 1]], [[0, 0]])
    const mr = playMove(s, 1, 0)
    expect(mr).not.toBeNull()
    expect(mr!.captured).toBe(1)
    expect(mr!.state.board[0]![0]).toBe(0)
  })

  it('打劫：提劫后对方不能立即提回，隔一手后可以', () => {
    // 标准劫形：黑 (0,1)(1,0)(2,1)；白 (0,2)(2,2)(1,3)(1,1)
    const s = setBoard(
      9,
      [[0, 1], [1, 0], [2, 1]],
      [[0, 2], [2, 2], [1, 3], [1, 1]],
    )
    // 黑下 (1,2) 提白 (1,1)
    const mr = playMove(s, 1, 2)
    expect(mr).not.toBeNull()
    expect(mr!.captured).toBe(1)
    // 白立即回提 (1,1) 恢复同形 → 全局同形禁着
    expect(playMove(mr!.state, 1, 1)).toBeNull()
    // 白先在别处下一手，之后劫争可以继续
    const elsewhere = playMove(mr!.state, 8, 8)!
    expect(elsewhere).not.toBeNull()
    expect(playMove(elsewhere.state, 1, 1)).not.toBeNull()
  })

  it('占位不可落子', () => {
    const s = setBoard(9, [[4, 4]], [])
    expect(playMove(s, 4, 4)).toBeNull()
  })
})

describe('围棋规则：虚手与终局', () => {
  it('双方连续虚手终局，终局后不可落子', () => {
    let s = passTurn(createGame(9))
    expect(s.over).toBe(false)
    s = passTurn(s)
    expect(s.over).toBe(true)
    expect(playMove(s, 4, 4)).toBeNull()
  })

  it('落子会重置虚手计数', () => {
    const s = passTurn(createGame(9))
    const mr = playMove(s, 4, 4)!
    expect(mr.state.passes).toBe(0)
  })
})

describe('围棋数子（中国规则）', () => {
  it('空盘：白贴 7.5 后白胜', () => {
    const s = createGame(9)
    const sc = scoreGame(s.board)
    expect(sc.black).toBe(0)
    expect(sc.white).toBe(7.5)
    expect(sc.resultText).toBe('白胜 7.5')
  })

  it('被单色包围的空点计入该方领地', () => {
    // 5×5：黑占第 0 行与第 0 列，(1..4,1..4) 16 个空点只接触黑
    const board: Board = Array.from({ length: 5 }, () => Array(5).fill(0))
    for (let i = 0; i < 5; i++) {
      board[0]![i] = 1
      board[i]![0] = 1
    }
    const sc = scoreGame(board)
    expect(sc.black).toBe(25) // 9 子 + 16 领地
    expect(sc.white).toBe(7.5)
    expect(sc.resultText).toBe('黑胜 17.5')
    expect(sc.territory).toHaveLength(16)
  })

  it('双方都接触的空点为公气不计分', () => {
    const board: Board = Array.from({ length: 5 }, () => Array(5).fill(0))
    for (let i = 0; i < 5; i++) {
      board[0]![i] = 1
      board[4]![i] = 2
    }
    const sc = scoreGame(board)
    expect(sc.black).toBe(5)
    expect(sc.white).toBe(5 + 7.5)
    expect(sc.dame).toBe(15)
  })
})

describe('围棋 AI', () => {
  it('能提吃只剩一口气的子', () => {
    const s = setBoard(9, [[3, 4], [5, 4], [4, 3]], [[4, 4]])
    const mv = computeGoMove(s, 1, 'hard', () => 0)
    expect(mv).toEqual([4, 5])
  })

  it('能救自己被打吃的棋块', () => {
    // 黑块 (4,4)(4,5) 只剩 (4,3) 一口气；下 (4,3) 可出逃获得多口气
    const s = setBoard(
      9,
      [[4, 4], [4, 5]],
      [[3, 4], [3, 5], [5, 4], [5, 5], [4, 6]],
    )
    const g = groupAt(s.board, 4, 4)!
    expect(g.liberties).toBe(1)
    const mv = computeGoMove(s, 1, 'hard', () => 0)
    expect(mv).toEqual([4, 3])
  })

  it('对方虚手且我方领先时跟着虚手', () => {
    // 黑围出角部 4 目领地：黑 12 vs 白 7.5，领先
    const s = createGame(9)
    const wall: Array<[number, number]> = [
      [0, 1], [0, 2], [1, 0], [2, 0], [1, 3], [2, 3], [3, 1], [3, 2],
    ]
    for (const [r, c] of wall) s.board[r]![c] = 1
    s.passes = 1 // 对方刚虚手
    s.player = 1
    expect(computeGoMove(s, 1, 'hard', () => 0)).toBeNull()
  })

  it('返回的着点总是合法', () => {
    const s = setBoard(9, [[4, 4]], [[4, 5]])
    for (let i = 0; i < 5; i++) {
      const mv = computeGoMove(s, 2, 'medium', () => 0.5)
      if (mv == null) continue
      expect(playMove(s, mv[0], mv[1])).not.toBeNull()
    }
  })
})

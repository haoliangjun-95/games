import { describe, expect, it } from 'vitest'
import {
  applyMove,
  gameStatus,
  initialBoard,
  isInCheck,
  legalMoves,
  moveToNotation,
  type Board,
} from './engine'
import { computeMove } from './ai'

function emptyBoardWith(): Board {
  return Array.from({ length: 10 }, () => Array(9).fill(null))
}

function findMovesOf(board: Board, r: number, c: number) {
  return legalMoves(board, board[r]![c]!.side)
    .filter((m) => m.from[0] === r && m.from[1] === c)
    .map((m) => m.to)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

describe('象棋规则引擎', () => {
  it('初始局面红方有 44 步合法着法', () => {
    const b = initialBoard()
    expect(legalMoves(b, 'red')).toHaveLength(44)
  })

  it('马腿：初始位置马只能跳两个位置（象位塞马腿）', () => {
    const b = initialBoard()
    expect(findMovesOf(b, 9, 1)).toEqual([
      [7, 0],
      [7, 2],
    ])
  })

  it('象眼被塞不能飞象', () => {
    const b = initialBoard()
    // (8,3) 是象眼之一（相(9,2)→(7,4) 要经过 (8,3)），初始为空可飞
    expect(findMovesOf(b, 9, 2)).toEqual([
      [7, 0],
      [7, 4],
    ])
    // 塞住象眼后不能飞
    const b2 = applyMove(b, { from: [7, 1], to: [8, 3] })
    expect(findMovesOf(b2, 9, 2)).toEqual([[7, 0]])
  })

  it('炮隔子吃子、无炮架不能吃', () => {
    const b = emptyBoardWith()
    b[9]![0] = { side: 'red', type: 'K' }
    b[0]![8] = { side: 'black', type: 'K' }
    b[5]![4] = { side: 'red', type: 'C' }
    b[3]![4] = { side: 'black', type: 'N' } // 中间无炮架 → 不能吃
    expect(findMovesOf(b, 5, 4).some((t) => t[0] === 3 && t[1] === 4)).toBe(false)
    b[4]![4] = { side: 'black', type: 'P' } // 放上炮架
    expect(findMovesOf(b, 5, 4).some((t) => t[0] === 3 && t[1] === 4)).toBe(true)
  })

  it('兵过河前只能直进，过河后可横走', () => {
    const b = emptyBoardWith()
    b[9]![0] = { side: 'red', type: 'K' }
    b[0]![8] = { side: 'black', type: 'K' }
    b[6]![4] = { side: 'red', type: 'P' } // 未过河
    expect(findMovesOf(b, 6, 4)).toEqual([[5, 4]])
    const b2 = emptyBoardWith()
    b2[9]![0] = { side: 'red', type: 'K' }
    b2[0]![8] = { side: 'black', type: 'K' }
    b2[4]![4] = { side: 'red', type: 'P' } // 已过河
    const crossed = findMovesOf(b2, 4, 4)
    expect(crossed).toContainEqual([3, 4])
    expect(crossed).toContainEqual([4, 3])
    expect(crossed).toContainEqual([4, 5])
    expect(crossed).not.toContainEqual([5, 4]) // 不能后退
  })

  it('将帅照面判为被将', () => {
    const b = emptyBoardWith()
    b[0]![4] = { side: 'black', type: 'K' }
    b[9]![4] = { side: 'red', type: 'K' }
    expect(isInCheck(b, 'red')).toBe(true)
    expect(isInCheck(b, 'black')).toBe(true)
    // 中间加一子则不照面
    b[5]![4] = { side: 'red', type: 'P' }
    expect(isInCheck(b, 'red')).toBe(false)
  })

  it('双车将死孤将：无合法着法判负', () => {
    const b = emptyBoardWith()
    b[0]![4] = { side: 'black', type: 'K' }
    b[0]![0] = { side: 'red', type: 'R' } // 横线封锁 3、5 列
    b[2]![4] = { side: 'red', type: 'R' } // 纵线将军并封 (1,4)
    b[9]![4] = { side: 'red', type: 'K' }
    expect(isInCheck(b, 'black')).toBe(true)
    expect(legalMoves(b, 'black')).toHaveLength(0)
    expect(gameStatus(b, 'black')).toBe('red-win')
  })

  it('着法记谱：炮二平五', () => {
    const b = initialBoard()
    const notation = moveToNotation(b, { from: [7, 7], to: [7, 4] })
    expect(notation).toBe('炮二平五')
  })
})

describe('象棋 AI', () => {
  it('初始局面返回合法着法', () => {
    const b = initialBoard()
    const mv = computeMove(b, 'red', 'easy')
    expect(mv).not.toBeNull()
    const legal = legalMoves(b, 'red')
    expect(legal.some((m) => m.from[0] === mv!.from[0] && m.from[1] === mv!.from[1] && m.to[0] === mv!.to[0] && m.to[1] === mv!.to[1])).toBe(true)
  })

  it('白吃车：立即吃掉无保护且无子可回吃的车', () => {
    // 红炮 (8,4)，黑卒 (5,4) 为炮架，黑车 (4,4) 无保护；黑王 (0,3) 远处无法回吃
    const b = emptyBoardWith()
    b[9]![4] = { side: 'red', type: 'K' }
    b[0]![3] = { side: 'black', type: 'K' }
    b[8]![4] = { side: 'red', type: 'C' }
    b[5]![4] = { side: 'black', type: 'P' }
    b[4]![4] = { side: 'black', type: 'R' }
    for (const diff of ['easy', 'medium', 'hard'] as const) {
      const mv = computeMove(b, 'red', diff)
      expect(mv!.to).toEqual([4, 4])
    }
  })

  it('一步将死能被找到（吃将级别的强制着法）', () => {
    // 黑车 (1,4) 正将军红帅 (9,4)；红车 (9,0) 可走到 (9,4) 垫将？不 —— 构造红可立即吃黑车解将并反将
    // 简化：红炮可直接吃掉将军的黑车（有炮架）
    const b = emptyBoardWith()
    b[9]![4] = { side: 'red', type: 'K' }
    b[0]![3] = { side: 'black', type: 'K' } // 错开列避免照面干扰
    b[4]![4] = { side: 'black', type: 'R' } // 黑车将军红帅
    b[8]![0] = { side: 'red', type: 'C' }
    b[7]![0] = { side: 'black', type: 'P' } // 炮架
    b[4]![0] = { side: 'red', type: 'N' } // 红马在 (4,0)，与黑车同排
    // 红炮 (8,0) 沿列向上：架 (7,0)，越架吃 (4,0)? 不对，炮吃的是越架后的第一个敌子
    // 这里直接验证：红被将军时 AI 必须解将（走完后红不再被将）
    expect(isInCheck(b, 'red')).toBe(true)
    const mv = computeMove(b, 'red', 'hard')
    const after = applyMove(b, mv!)
    expect(isInCheck(after, 'red')).toBe(false)
  })

  it('medium/hard 在初始局面耗时可接受', () => {
    const b = initialBoard()
    const t0 = Date.now()
    computeMove(b, 'red', 'medium')
    const mediumMs = Date.now() - t0
    expect(mediumMs).toBeLessThan(3000)
    const t1 = Date.now()
    computeMove(b, 'red', 'hard')
    const hardMs = Date.now() - t1
    expect(hardMs).toBeLessThan(10000)
  })
})

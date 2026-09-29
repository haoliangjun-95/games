import { describe, expect, it } from 'vitest'
import { checkWinAt, createBoard, isBoardFull, opponentOf } from './engine'
import { computeMove } from './ai'

function setStones(board: ReturnType<typeof createBoard>, stones: Array<[number, number, number]>) {
  for (const [r, c, v] of stones) board[r]![c] = v
  return board
}

describe('五子棋规则', () => {
  it('横向五连获胜', () => {
    const b = createBoard()
    setStones(b, [
      [7, 3, 1],
      [7, 4, 1],
      [7, 5, 1],
      [7, 6, 1],
      [7, 7, 1],
    ])
    expect(checkWinAt(b, 7, 5)).toEqual([
      [7, 3],
      [7, 4],
      [7, 5],
      [7, 6],
      [7, 7],
    ])
  })

  it('斜向五连获胜', () => {
    const b = createBoard()
    setStones(b, [
      [3, 3, 2],
      [4, 4, 2],
      [5, 5, 2],
      [6, 6, 2],
      [7, 7, 2],
    ])
    expect(checkWinAt(b, 7, 7)).not.toBeNull()
  })

  it('四连不获胜', () => {
    const b = createBoard()
    setStones(b, [
      [0, 0, 1],
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
    ])
    expect(checkWinAt(b, 0, 2)).toBeNull()
  })

  it('棋盘满检测与对手判定', () => {
    const b = createBoard()
    expect(isBoardFull(b)).toBe(false)
    expect(opponentOf(1)).toBe(2)
    expect(opponentOf(2)).toBe(1)
  })
})

describe('五子棋 AI', () => {
  it('空盘开局走天元 (7,7)', () => {
    const b = createBoard()
    expect(computeMove(b, 1, 'easy')).toEqual([7, 7])
  })

  it('能一步取胜：四连补第五子', () => {
    const b = createBoard()
    setStones(b, [
      [7, 4, 1],
      [7, 5, 1],
      [7, 6, 1],
      [7, 7, 1],
      [8, 4, 2],
      [8, 5, 2],
      [8, 6, 2],
    ])
    // 黑（AI）应在 (7,3) 或 (7,8) 落子成五
    const mv = computeMove(b, 1, 'medium')
    expect([[7, 3], [7, 8]]).toContainEqual(mv)
  })

  it('必堵对手冲四（唯一成五点）', () => {
    const b = createBoard()
    // 白棋 211110 形态：黑在 (7,3..6) 四连，左端 (7,2) 被白堵，唯一成五点是 (7,7)
    setStones(b, [
      [7, 2, 2],
      [7, 3, 1],
      [7, 4, 1],
      [7, 5, 1],
      [7, 6, 1],
      [8, 8, 2],
      [9, 9, 2],
    ])
    const mv = computeMove(b, 2, 'medium')
    expect(mv).toEqual([7, 7])
  })

  it('返回的落点总是空位', () => {
    const b = createBoard()
    setStones(b, [
      [7, 7, 1],
      [8, 8, 2],
      [7, 8, 1],
      [8, 7, 2],
    ])
    for (let i = 0; i < 5; i++) {
      const mv = computeMove(b, 1, 'medium')
      expect(mv).not.toBeNull()
      expect(b[mv![0]]![mv![1]]).toBe(0)
    }
  })

  it('medium 搜索耗时在可接受范围内（<3s）', () => {
    const b = createBoard()
    setStones(b, [
      [7, 6, 1],
      [7, 7, 2],
      [7, 8, 1],
      [8, 8, 2],
      [6, 7, 1],
      [9, 9, 2],
      [6, 8, 1],
    ])
    const t0 = Date.now()
    const mv = computeMove(b, 2, 'medium')
    const dt = Date.now() - t0
    expect(mv).not.toBeNull()
    expect(dt).toBeLessThan(3000)
  })
})

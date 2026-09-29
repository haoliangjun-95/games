import { describe, expect, it } from 'vitest'
import { generatePuzzle, isSolvable, isSolved, slide, slideByDirection } from './engine'

describe('数字华容道引擎', () => {
  it('已复原盘面判定', () => {
    expect(isSolved([1, 2, 3, 4, 5, 6, 7, 8, 0])).toBe(true)
    expect(isSolved([1, 2, 3, 4, 5, 6, 0, 7, 8])).toBe(false)
  })

  it('经典可解/不可解判定（3×3）', () => {
    // 复原态逆序数 0 → 可解
    expect(isSolvable([1, 2, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(true)
    // 交换 7、8 → 逆序数 1 → 不可解
    expect(isSolvable([1, 2, 3, 4, 5, 6, 8, 7, 0], 3)).toBe(false)
  })

  it('4×4 可解性判定', () => {
    // 复原态：空格在第 4 行（从底数 1，奇数行），逆序 0 偶 → 可解
    expect(isSolvable([...Array.from({ length: 15 }, (_, i) => i + 1), 0], 4)).toBe(true)
    // 复原态基础上交换 14、15（逆序 1），空格仍在奇数行 → 不可解
    const t = Array.from({ length: 15 }, (_, i) => i + 1)
    ;[t[13], t[14]] = [t[14]!, t[13]!]
    expect(isSolvable([...t, 0], 4)).toBe(false)
  })

  it('generatePuzzle 总是可解且未复原', () => {
    for (const size of [3, 4, 5]) {
      for (let i = 0; i < 30; i++) {
        const p = generatePuzzle(size)
        expect(isSolved(p)).toBe(false)
        expect(isSolvable(p, size)).toBe(true)
      }
    }
  })

  it('slide：与空格相邻的滑块可移动，不相邻不可', () => {
    // [1,2,3 / 4,5,6 / 7,0,8]：空格在 (2,1)，8 与它相邻
    const tiles = [1, 2, 3, 4, 5, 6, 7, 0, 8]
    const [next, moved] = slide(tiles, 3, 8)
    expect(moved).toBe(true)
    expect(next).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0])
    // (0,0) 与空格不相邻
    const [next2, moved2] = slide(tiles, 3, 0)
    expect(moved2).toBe(false)
    expect(next2).toEqual(tiles)
  })

  it('slideByDirection：方向键语义正确', () => {
    // [1,2,3 / 4,5,6 / 7,0,8]：按"left" → 空格右侧的 8 滑入（即 index 8）
    const tiles = [1, 2, 3, 4, 5, 6, 7, 0, 8]
    const [next, moved, idx] = slideByDirection(tiles, 3, 'left')
    expect(moved).toBe(true)
    expect(idx).toBe(8)
    expect(next).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0])
    // 空格在右下角，按 "right" → 需要空格左侧滑块（index 7）→ 可移动
    const [next2, moved2, idx2] = slideByDirection(next, 3, 'right')
    expect(moved2).toBe(true)
    expect(idx2).toBe(7)
    expect(next2).toEqual(tiles)
    // 空格在底行右下角，按 "up"（需要空格下方滑块）→ 越界不可动
    const [, moved3] = slideByDirection(next, 3, 'up')
    expect(moved3).toBe(false)
  })
})

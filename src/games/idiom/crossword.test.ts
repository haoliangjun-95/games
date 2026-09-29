import { describe, expect, it } from 'vitest'
import { IdiomChain, type RawIdiom } from './chain'
import {
  distractorCountForLevel,
  generateLevel,
  idiomCountForLevel,
  isCorrect,
  key,
  revealCountForLevel,
  solvedState,
} from './crossword'
import raw from './data.json'

const chain = new IdiomChain(raw as RawIdiom[])

describe('接龙序列生成', () => {
  it('能生成 3~6 条的精确同字接龙序列', () => {
    for (const count of [3, 4, 5, 6]) {
      let ok = false
      for (let i = 0; i < 10 && !ok; i++) {
        const seq = chain.chainSequence(count, Math.random)
        if (!seq) continue
        expect(seq).toHaveLength(count)
        const words = new Set(seq.map((e) => e.word))
        expect(words.size).toBe(count) // 不重复
        for (let k = 1; k < seq.length; k++) {
          expect(seq[k]!.word[0]).toBe(seq[k - 1]!.word[3]) // 首尾同字相接
        }
        ok = true
      }
      expect(ok).toBe(true)
    }
  })
})

describe('填字关卡生成', () => {
  const LEVELS = [1, 2, 5, 6, 10, 13, 20, 30]

  it('各难度关卡均能生成且结构合法', () => {
    for (const level of LEVELS) {
      for (let i = 0; i < 5; i++) {
        const lv = generateLevel(chain, level, Math.random)
        validateLevel(lv, level)
      }
    }
  })

  function validateLevel(lv: ReturnType<typeof generateLevel>, level: number) {
    // 条数正确
    expect(lv.idioms).toHaveLength(idiomCountForLevel(level))
    // 每条成语 4 格且字符对应
    for (const idiom of lv.idioms) {
      expect(idiom.cells).toHaveLength(4)
      idiom.cells.forEach(([r, c], i) => {
        const cell = lv.cells.find((x) => x.r === r && x.c === c)!
        expect(cell.char).toBe(idiom.entry.word[i])
      })
    }
    // 交叉：第 k 条首格 = 第 k-1 条尾格
    for (let k = 1; k < lv.idioms.length; k++) {
      const cur = lv.idioms[k]!
      const prev = lv.idioms[k - 1]!
      expect(cur.cells[0]).toEqual(prev.cells[3])
      expect(cur.dir).not.toBe(prev.dir) // 方向交替
    }
    // 无位置冲突（不同字符不能占同格）：格子数 = 去重坐标数
    const posSet = new Set(lv.cells.map((x) => key(x.r, x.c)))
    expect(posSet.size).toBe(lv.cells.length)
    // 尺寸合理
    expect(lv.rows).toBeLessThanOrEqual(16)
    expect(lv.cols).toBeLessThanOrEqual(16)
    // 候选字覆盖所有未揭示格（多重集）
    const needed = lv.cells.filter((x) => !x.revealed).map((x) => x.char)
    const pool = [...lv.candidates]
    for (const ch of needed) {
      const idx = pool.indexOf(ch)
      expect(idx, `候选字缺少 ${ch}`).toBeGreaterThanOrEqual(0)
      pool.splice(idx, 1)
    }
    // 干扰字数量正确
    expect(lv.candidates.length - needed.length).toBe(distractorCountForLevel(level))
    // 每条成语不会被揭示到全亮（出生即完成），且盘面确有揭示锚点
    let totalRevealed = 0
    for (const cell of lv.cells) if (cell.revealed) totalRevealed++
    expect(totalRevealed).toBeGreaterThanOrEqual(1)
    for (const idiom of lv.idioms) {
      const revealedN = idiom.cells.filter(([r, c]) => lv.cells.find((x) => x.r === r && x.c === c)!.revealed).length
      expect(revealedN).toBeLessThanOrEqual(3)
    }
  }

  it('isCorrect / solvedState 行为正确', () => {
    const lv = generateLevel(chain, 1, Math.random)
    const fills = new Map<string, string>()
    const { allDone: before } = solvedState(lv, fills)
    expect(before).toBe(false)
    // 填入所有未揭示格
    for (const cell of lv.cells) {
      if (!cell.revealed) fills.set(key(cell.r, cell.c), cell.char)
    }
    expect(isCorrect(lv, lv.cells[0]!.r, lv.cells[0]!.c, lv.cells[0]!.char)).toBe(true)
    expect(isCorrect(lv, lv.cells[0]!.r, lv.cells[0]!.c, '无')).toBe(false)
    const { allDone, idiomDone } = solvedState(lv, fills)
    expect(allDone).toBe(true)
    expect(idiomDone.every(Boolean)).toBe(true)
    // 错填导致不完成
    const wrong = new Map(fills)
    const firstEmpty = lv.cells.find((x) => !x.revealed)!
    wrong.set(key(firstEmpty.r, firstEmpty.c), '错')
    expect(solvedState(lv, wrong).allDone).toBe(false)
  })
})

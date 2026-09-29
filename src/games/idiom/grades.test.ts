import { describe, expect, it } from 'vitest'
import { IdiomChain, type RawIdiom } from './chain'
import { generateLevel } from './crossword'
import { GRADE_OPTIONS, gradeWords, type GradeId } from './grades'
import raw from './data.json'

const full = new IdiomChain(raw as RawIdiom[])

function gradeChain(grade: GradeId): IdiomChain {
  const words = gradeWords(grade)
  if (!words) return full
  const set = new Set(words)
  return new IdiomChain((raw as RawIdiom[]).filter(([w]) => set.has(w)))
}

describe('年级词库数据', () => {
  it('所有词条都存在于主词典且为四字、无重复', () => {
    const problems: string[] = []
    for (const opt of GRADE_OPTIONS) {
      const words = gradeWords(opt.id)
      if (!words) continue
      if (new Set(words).size !== words.length) problems.push(`${opt.label} 有重复词条`)
      for (const w of words) {
        if (w.length !== 4) problems.push(`${opt.label}「${w}」不是四字`)
        if (!full.lookup(w)) problems.push(`${opt.label}「${w}」不在主词典`)
      }
    }
    expect(problems.join('；')).toBe('')
  })

  it('各年级词库规模合理（≥120 条）', () => {
    for (const opt of GRADE_OPTIONS) {
      const words = gradeWords(opt.id)
      if (!words) continue
      expect(words.length, `${opt.label} 词库过小`).toBeGreaterThanOrEqual(120)
    }
  })
})

describe('各年级关卡生成', () => {
  const GRADES: Exclude<GradeId, 0>[] = [4, 5, 6, 7, 8, 9]

  it('各年级都能生成 3~6 条的接龙序列', () => {
    for (const g of GRADES) {
      const c = gradeChain(g)
      for (const count of [3, 4, 5, 6]) {
        let ok = false
        for (let i = 0; i < 40 && !ok; i++) {
          const seq = c.chainSequence(count, Math.random)
          if (!seq) continue
          expect(seq).toHaveLength(count)
          for (let k = 1; k < seq.length; k++) {
            expect(seq[k]!.word[0], `${g}年级 ${count} 条链断裂`).toBe(seq[k - 1]!.word[3])
          }
          ok = true
        }
        expect(ok, `${g}年级无法生成 ${count} 条接龙链`).toBe(true)
      }
    }
  })

  it('各年级都能生成各难度关卡（高关卡最多允许降 1 条）', () => {
    for (const g of GRADES) {
      const c = gradeChain(g)
      for (const level of [1, 6, 13, 30]) {
        for (let i = 0; i < 2; i++) {
          const lv = generateLevel(c, level, Math.random)
          const target = Math.min(2 + Math.floor((level + 1) / 2), 9)
          expect(lv.idioms.length).toBeGreaterThanOrEqual(Math.max(3, target - 1))
          expect(lv.idioms.length).toBeLessThanOrEqual(target)
          for (const idiom of lv.idioms) {
            expect(idiom.cells).toHaveLength(4)
          }
        }
      }
    }
  })
})

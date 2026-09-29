import { describe, expect, it } from 'vitest'
import { IdiomChain, searchIdioms, type RawIdiom } from './chain'

/** 构造小型测试词典（真实数据由 data.json 提供，结构与 [word, pinyin, plain, explanation] 一致） */
const RAW: RawIdiom[] = [
  ['一心一意', ['yi', 'xin', 'yi', 'yi'], ['yi', 'xin', 'yi', 'yi'], '心思专一。'],
  ['意气风发', ['yi', 'qi', 'feng', 'fa'], ['yi', 'qi', 'feng', 'fa'], '形容精神振奋。'],
  ['发扬光大', ['fa', 'yang', 'guang', 'da'], ['fa', 'yang', 'guang', 'da'], '使好的作风、传统得到发展。'],
  ['大快人心', ['da', 'kuai', 'ren', 'xin'], ['da', 'kuai', 'ren', 'xin'], '坏人坏事受到惩罚，人们非常痛快。'],
  ['心安理得', ['xin', 'an', 'li', 'de'], ['xin', 'an', 'li', 'de'], '自认为做的事情合乎道理，心里很坦然。'],
  ['得过且过', ['de', 'guo', 'qie', 'guo'], ['de', 'guo', 'qie', 'guo'], '过一天算一天。'],
  ['画蛇添足', ['hua', 'she', 'tian', 'zu'], ['hua', 'she', 'tian', 'zu'], '多此一举。'],
  ['足智多谋', ['zu', 'zhi', 'duo', 'mou'], ['zu', 'zhi', 'duo', 'mou'], '智谋很多。'],
  ['一衣带水', ['yi', 'yi', 'dai', 'shui'], ['yi', 'yi', 'dai', 'shui'], '像一条衣带那样窄的水面。'],
]

function makeChain() {
  return new IdiomChain(RAW)
}

describe('成语接龙逻辑', () => {
  it('词典索引与查询', () => {
    const c = makeChain()
    expect(c.size).toBe(9)
    expect(c.lookup('画蛇添足')?.explanation).toBe('多此一举。')
    expect(c.lookup('不存在')).toBeUndefined()
  })

  it('同字接龙判定', () => {
    const c = makeChain()
    expect(c.canChain('一心一意', '意气风发', false)).toBe(true)
    expect(c.canChain('一心一意', '发扬光大', false)).toBe(false)
  })

  it('同音接龙判定', () => {
    const c = makeChain()
    // 意(yi) → 一(yi) 同音可接
    expect(c.canChain('一心一意', '一衣带水', true)).toBe(true)
    // 严格模式下同音不可接
    expect(c.canChain('一心一意', '一衣带水', false)).toBe(false)
  })

  it('电脑接龙：优先同字', () => {
    const c = makeChain()
    const mv = c.computerMove('心安理得', new Set(), () => 0)
    expect(mv?.word).toBe('得过且过')
  })

  it('电脑接龙：避开已用词，用完同字后用同音', () => {
    const c = makeChain()
    const used = new Set(['得过且过'])
    const mv = c.computerMove('心安理得', used, () => 0)
    expect(mv).toBeNull() // 测试词典中"得"同音且未用的成语没有其他
    // 意 → 同字(意气风发) 用掉后应轮到同音(一衣带水)；「一心一意」是刚用过的出题词
    const used2 = new Set(['一心一意', '意气风发'])
    const mv2 = c.computerMove('一心一意', used2, () => 0)
    expect(mv2?.word).toBe('一衣带水')
  })

  it('电脑接不出时返回 null（玩家胜利条件）', () => {
    const c = makeChain()
    const mv = c.computerMove('画蛇添足', new Set(['足智多谋']), () => 0, false)
    expect(mv).toBeNull()
  })

  it('提示候选字包含尾字本身与同音字', () => {
    const c = makeChain()
    const hints = c.hintChars('一心一意')
    expect(hints).toContain('意')
    expect(hints).toContain('一')
  })

  it('关键词搜索', () => {
    const c = makeChain()
    expect(searchIdioms(c, '蛇')).toHaveLength(1)
    expect(searchIdioms(c, 'xyz')).toHaveLength(0)
  })
})

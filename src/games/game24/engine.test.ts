import { describe, expect, it } from 'vitest'
import { checkExpression, evaluate, randomHand, solve24 } from './engine'

describe('24 点求解器', () => {
  it('常规有解题', () => {
    expect(solve24([2, 3, 4, 1])).toBeTruthy()
    expect(solve24([3, 3, 8, 8])).toBeTruthy() // 经典分数解
    expect(solve24([12, 5, 7, 9])).toBeTruthy()
  })

  it('无解题返回 null', () => {
    expect(solve24([1, 1, 1, 1])).toBeNull()
    expect(solve24([13, 13, 13, 13])).toBeNull()
  })

  it('解代入求值确实等于 24', () => {
    for (const hand of [[2, 3, 4, 1], [3, 3, 8, 8], [12, 5, 7, 9], [1, 5, 5, 5]]) {
      const sol = solve24(hand)
      expect(sol).toBeTruthy()
      const v = evaluate(
        sol!
          .replace(/×/g, '*')
          .replace(/÷/g, '/'),
      )
      expect(Math.abs(v! - 24)).toBeLessThan(1e-6)
    }
  })

  it('randomHand 生成的一定有解', () => {
    for (let i = 0; i < 20; i++) {
      const hand = randomHand()
      expect(hand).toHaveLength(4)
      expect(solve24(hand)).toBeTruthy()
    }
  })
})

describe('表达式解析与校验', () => {
  it('运算优先级正确', () => {
    expect(evaluate('2+3*4')).toBe(14)
    expect(evaluate('(2+3)*4')).toBe(20)
    expect(evaluate('10/4')).toBe(2.5)
    expect(evaluate('-3+5')).toBe(2)
  })

  it('语法错误返回 null', () => {
    expect(evaluate('2+')).toBeNull()
    expect(evaluate('(1+2')).toBeNull()
    expect(evaluate('1+2)')).toBeNull()
    expect(evaluate('')).toBeNull()
    expect(evaluate('3/0')).toBeNull()
  })

  it('checkExpression：正确算式通过', () => {
    const r = checkExpression('（1+2）×（3+5）', [1, 2, 3, 5])
    expect(r.ok).toBe(true)
    const r2 = checkExpression('8÷(3-8÷3)', [3, 3, 8, 8])
    expect(r2.ok).toBe(true)
  })

  it('checkExpression：未用全 4 张牌被拒绝', () => {
    const r = checkExpression('(1+2)*8', [1, 2, 8, 6])
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('4 张牌')
  })

  it('checkExpression：结果不是 24 被拒绝', () => {
    const r = checkExpression('1+2+3+5', [1, 2, 3, 5])
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('不是 24')
  })

  it('checkExpression：重复用牌被拒绝', () => {
    const r = checkExpression('6*6/(6-6+1)*4', [1, 4, 6, 9])
    // 表达式用了 3 个 6，但牌里只有一个
    expect(r.ok).toBe(false)
  })
})

/** 24 点核心逻辑：穷举求解器 + 安全表达式解析（不用 eval） */

export interface SolveItem {
  v: number
  s: string
}

const EPS = 1e-6

/** 穷举所有运算组合，找到一种凑出 24 的表达式（加括号保证正确性） */
export function solve24(nums: number[]): string | null {
  const items: SolveItem[] = nums.map((n) => ({ v: n, s: String(n) }))
  const result = search(items)
  return result
}

function search(items: SolveItem[]): string | null {
  if (items.length === 1) {
    return Math.abs(items[0]!.v - 24) < EPS ? items[0]!.s : null
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue
      const a = items[i]!
      const b = items[j]!
      // 只取 i<j 的无序对，枚举 a∘b 与 b∘a 的有意义组合
      if (i > j) continue
      const rest = items.filter((_, k) => k !== i && k !== j)
      const candidates: SolveItem[] = [
        { v: a.v + b.v, s: `(${a.s}+${b.s})` },
        { v: a.v * b.v, s: `(${a.s}×${b.s})` },
        { v: a.v - b.v, s: `(${a.s}-${b.s})` },
        { v: b.v - a.v, s: `(${b.s}-${a.s})` },
      ]
      if (Math.abs(b.v) > EPS) candidates.push({ v: a.v / b.v, s: `(${a.s}÷${b.s})` })
      if (Math.abs(a.v) > EPS) candidates.push({ v: b.v / a.v, s: `(${b.s}÷${a.s})` })
      for (const cand of candidates) {
        const found = search([...rest, cand])
        if (found) return found
      }
    }
  }
  return null
}

/** 生成保证有解的一组牌 */
export function randomHand(rng: () => number = Math.random): number[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const hand = Array.from({ length: 4 }, () => 1 + Math.floor(rng() * 13))
    if (solve24(hand)) return hand
  }
  return [3, 3, 8, 8] // 理论上到不了这里：兜底经典难题（有解）
}

export function cardLabel(v: number): string {
  return { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[v] ?? String(v)
}

/** 全角/常见符号归一化 */
export function normalizeExpr(input: string): string {
  return input
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/×|✕|x|X/g, '*')
    .replace(/÷/g, '/')
    .replace(/＋/g, '+')
    .replace(/－/g, '-')
    .replace(/\s+/g, '')
}

/** 校验并计算表达式：要求恰好用上给定的 4 张牌各一次 */
export interface CheckResult {
  ok: boolean
  value?: number
  reason?: string
}

export function checkExpression(input: string, cards: number[]): CheckResult {
  const expr = normalizeExpr(input)
  if (expr.length === 0) return { ok: false, reason: '请输入算式' }
  if (!/^[0-9+\-*/().]+$/.test(expr)) return { ok: false, reason: '包含不支持的字符' }

  // 抽取表达式中的所有数字
  const literals = expr.match(/\d+(\.\d+)?/g) ?? []
  const exprNums = literals.map(Number)
  const expected = cards.slice().sort((a, b) => a - b)
  const actual = exprNums.slice().sort((a, b) => a - b)
  if (exprNums.length !== cards.length || actual.some((v, i) => v !== expected[i])) {
    return { ok: false, reason: '必须恰好用上这 4 张牌，每张一次' }
  }

  const value = evaluate(expr)
  if (value == null) return { ok: false, reason: '算式格式有误或除数为 0' }
  if (Math.abs(value - 24) > EPS) return { ok: false, reason: `算出的是 ${formatNum(value)}，不是 24` }
  return { ok: true, value: 24 }
}

function formatNum(n: number): string {
  return Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : n.toFixed(2)
}

/** 递归下降求值；语法错误或除以 0 返回 null */
export function evaluate(expr: string): number | null {
  let pos = 0
  function peek(): string {
    return expr[pos] ?? ''
  }
  function parseExpr(): number | null {
    let left = parseTerm()
    if (left == null) return null
    while (peek() === '+' || peek() === '-') {
      const op = expr[pos++]!
      const right = parseTerm()
      if (right == null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }
  function parseTerm(): number | null {
    let left = parseFactor()
    if (left == null) return null
    while (peek() === '*' || peek() === '/') {
      const op = expr[pos++]!
      const right = parseFactor()
      if (right == null) return null
      if (op === '/') {
        if (Math.abs(right) < EPS) return null
        left = left / right
      } else {
        left = left * right
      }
    }
    return left
  }
  function parseFactor(): number | null {
    const ch = peek()
    if (ch === '(') {
      pos++
      const v = parseExpr()
      if (v == null || peek() !== ')') return null
      pos++
      return v
    }
    if (ch === '-') {
      pos++
      const v = parseFactor()
      return v == null ? null : -v
    }
    if (/[0-9]/.test(ch)) {
      let num = ''
      while (pos < expr.length && /[0-9.]/.test(expr[pos]!)) num += expr[pos++]
      const v = Number(num)
      return Number.isFinite(v) ? v : null
    }
    return null
  }
  const v = parseExpr()
  if (v == null || pos !== expr.length) return null
  return v
}

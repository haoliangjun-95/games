import { describe, expect, it } from 'vitest'
import { games } from './registry'
import { TUTORIALS, tutorialForGameName } from './tutorials'

describe('新手教程覆盖', () => {
  it('每款游戏都有教程且名称可反查', () => {
    for (const g of games) {
      const steps = TUTORIALS[g.id]
      expect(steps, `游戏 ${g.name}(${g.id}) 缺少教程`).toBeDefined()
      expect(steps!.length).toBeGreaterThanOrEqual(3)
      for (const step of steps!) {
        expect(step.icon.length).toBeGreaterThan(0)
        expect(step.title.length).toBeGreaterThan(0)
        expect(step.lines.length).toBeGreaterThanOrEqual(2)
        for (const line of step.lines) {
          expect(line.length).toBeGreaterThan(3)
        }
      }
      // GameShell 按游戏名称匹配教程，名称必须能命中
      expect(tutorialForGameName(g.name)).toBeDefined()
    }
  })

  it('教程步骤无重复标题（同一游戏内）', () => {
    for (const g of games) {
      const titles = TUTORIALS[g.id]!.map((s) => s.title)
      expect(new Set(titles).size).toBe(titles.length)
    }
  })
})

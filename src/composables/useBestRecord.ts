/**
 * 成绩持久化：每个「游戏 + 难度/规格」一条记录，localStorage 存储。
 * mode 'min' 用于时间/步数（越小越好），'max' 用于分数（越大越好）。
 */
export type RecordMode = 'min' | 'max'

export interface BestRecord {
  value: number
  /** 记录时间 ISO 字符串 */
  at: string
}

const PREFIX = 'pg.best.'

export function getRecord(key: string): BestRecord | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as BestRecord) : null
  } catch {
    return null
  }
}

/** 尝试刷新纪录；若刷新成功返回新纪录，否则返回 null */
export function submitRecord(key: string, value: number, mode: RecordMode = 'min'): BestRecord | null {
  const cur = getRecord(key)
  const better =
    cur == null || (mode === 'min' ? value < cur.value : value > cur.value)
  if (!better) return null
  const rec: BestRecord = { value, at: new Date().toISOString() }
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(rec))
  } catch {
    /* 存储不可用时静默降级 */
  }
  return rec
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

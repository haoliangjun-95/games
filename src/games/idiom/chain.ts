/** 成语接龙核心逻辑（数据：pwxcoo/chinese-xinhua idiom.json 精简版，MIT） */

export interface IdiomEntry {
  word: string
  /** 4 个音节（带声调符号） */
  pinyin: string[]
  /** 4 个无声调音节（同音判断用） */
  plain: string[]
  explanation: string
}

export type RawIdiom = [string, string[], string[], string]

export class IdiomChain {
  readonly entries: IdiomEntry[]
  private byWord = new Map<string, IdiomEntry>()
  private byFirstChar = new Map<string, IdiomEntry[]>()
  private byFirstPlain = new Map<string, IdiomEntry[]>()
  private charPlain = new Map<string, string>()

  constructor(raw: RawIdiom[]) {
    this.entries = raw.map(([word, pinyin, plain, explanation]) => ({ word, pinyin, plain, explanation }))
    for (const e of this.entries) {
      this.byWord.set(e.word, e)
      push(this.byFirstChar, e.word[0]!, e)
      push(this.byFirstPlain, e.plain[0]!, e)
      for (let i = 0; i < 4; i++) {
        this.charPlain.set(e.word[i]!, e.plain[i]!)
      }
    }
  }

  get size(): number {
    return this.entries.length
  }

  lookup(word: string): IdiomEntry | undefined {
    return this.byWord.get(word)
  }

  randomEntry(rng: () => number = Math.random, exclude?: Set<string>): IdiomEntry {
    for (let i = 0; i < 100; i++) {
      const e = this.entries[Math.floor(rng() * this.entries.length)]!
      if (!exclude?.has(e.word)) return e
    }
    return this.entries[0]!
  }

  /** 某字的无声调拼音 */
  plainOf(ch: string): string | undefined {
    return this.charPlain.get(ch)
  }

  /** word 能否接在 lastWord 之后 */
  canChain(lastWord: string, word: string, homophone: boolean): boolean {
    const lastChar = lastWord[lastWord.length - 1]!
    const firstChar = word[0]!
    if (homophone) {
      const a = this.plainOf(lastChar)
      const b = this.plainOf(firstChar)
      return a != null && b != null && a === b
    }
    return lastChar === firstChar
  }

  /** 电脑接龙：优先同字，其次同音；避开已用词 */
  computerMove(lastWord: string, used: Set<string>, rng: () => number = Math.random, homophone = true): IdiomEntry | null {
    const lastChar = lastWord[lastWord.length - 1]!
    const exact = (this.byFirstChar.get(lastChar) ?? []).filter((e) => !used.has(e.word))
    if (exact.length > 0) return exact[Math.floor(rng() * exact.length)]!
    if (homophone) {
      const plain = this.plainOf(lastChar)
      if (plain) {
        const homo = (this.byFirstPlain.get(plain) ?? []).filter((e) => !used.has(e.word) && e.word[0] !== lastChar)
        if (homo.length > 0) return homo[Math.floor(rng() * homo.length)]!
      }
    }
    return null
  }

  /** 提示：可以接龙的候选字（含同音），返回字符列表 */
  hintChars(lastWord: string, limit = 8): string[] {
    const lastChar = lastWord[lastWord.length - 1]!
    const plain = this.plainOf(lastChar)
    const chars = new Set<string>([lastChar])
    if (plain) {
      for (const e of this.byFirstPlain.get(plain) ?? []) chars.add(e.word[0]!)
    }
    return [...chars].slice(0, limit)
  }

  /** 找一个能被玩家接上的开局成语（存在至少一个可接的后续） */
  randomStart(rng: () => number = Math.random): IdiomEntry {
    for (let i = 0; i < 200; i++) {
      const e = this.randomEntry(rng)
      const plain = this.plainOf(e.word[3]!)
      if (plain && this.byFirstPlain.has(plain)) return e
    }
    return this.lookup('一马当先') ?? this.entries[0]!
  }
}

function push(map: Map<string, IdiomEntry[]>, key: string, value: IdiomEntry) {
  const arr = map.get(key)
  if (arr) arr.push(value)
  else map.set(key, [value])
}

/** 搜索成语（查询功能） */
export function searchIdioms(chain: IdiomChain, keyword: string, limit = 30): IdiomEntry[] {
  const kw = keyword.trim()
  if (!kw) return []
  const out: IdiomEntry[] = []
  for (const e of chain.entries) {
    if (e.word.includes(kw) || e.explanation.includes(kw)) {
      out.push(e)
      if (out.length >= limit) break
    }
  }
  return out
}

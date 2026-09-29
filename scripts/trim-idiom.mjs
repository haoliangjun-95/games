#!/usr/bin/env node
/**
 * 精简成语数据集：data-raw/idiom.json → src/games/idiom/data.json
 * 数据来源：pwxcoo/chinese-xinhua (MIT License)
 * 仅保留四字成语、拼音规整（4 个音节）、非空释义；释义截断控制体积。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const input = resolve(root, 'data-raw/idiom.json')
const output = resolve(root, 'src/games/idiom/data.json')

if (!existsSync(input)) {
  console.error('未找到 data-raw/idiom.json，请先下载数据集（见 README）')
  process.exit(1)
}

/** 去除声调符号（é→e, ǜ→v→u），用于同音判断 */
function stripTone(syllable) {
  return syllable
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ü/g, 'v')
}

const raw = JSON.parse(readFileSync(input, 'utf8'))
const seen = new Set()
const out = []

for (const item of raw) {
  const word = (item.word ?? '').trim()
  const pinyin = (item.pinyin ?? '').trim()
  const explanation = (item.explanation ?? '').trim()
  if (word.length !== 4) continue
  if (!/^[\u4e00-\u9fff]{4}$/.test(word)) continue
  const syllables = pinyin.split(/\s+/)
  if (syllables.length !== 4) continue
  // 数据集拼音为声调符号格式（如 ē dǎng bǐ zhōu）
  if (!syllables.every((s) => /^[a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹ]+$/.test(s))) continue
  if (!explanation) continue
  if (seen.has(word)) continue
  seen.add(word)
  const plain = syllables.map((s) => s.replace(/\d/g, '')) // 带声调去数字
  out.push([
    word,
    plain, // 4 个音节（带声调符号、无声调数字）
    plain.map(stripTone), // 4 个无声调音节（同音判断用）
    explanation.length > 90 ? explanation.slice(0, 90) + '……' : explanation,
  ])
}

writeFileSync(output, JSON.stringify(out))
console.log(`原始 ${raw.length} 条 → 精简后 ${out.length} 条`)
console.log(`输出: ${output} (${(out.length ? JSON.stringify(out).length / 1024 / 1024 : 0).toFixed(1)} MB)`)

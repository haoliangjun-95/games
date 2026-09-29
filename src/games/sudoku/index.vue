<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import GameShell from '../../components/GameShell.vue'
import DifficultySelect from '../../components/DifficultySelect.vue'
import ResultDialog from '../../components/ResultDialog.vue'
import { DIFFICULTY_INFO, generatePuzzle, type Difficulty, type Grid } from './engine'
import { sounds } from '../../composables/useSound'
import { formatDuration, getRecord, submitRecord } from '../../composables/useBestRecord'

type Diff = Difficulty

const diffNames: Record<Diff, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
  expert: '专家',
}

const showDiff = ref(true)
const diff = ref<Diff>('easy')
const emptyGrid = (): Grid => Array.from({ length: 9 }, () => Array<number>(9).fill(0))
const puzzle = ref<Grid>(emptyGrid())
const solution = ref<Grid>(emptyGrid())
const current = ref<Grid>(emptyGrid())
const pencilMap = ref<Map<string, Set<number>>>(new Map())
const selected = ref<[number, number] | null>(null)
const pencilMode = ref(false)
const checkErrors = ref(true)
const showWin = ref(false)
const newBest = ref(false)
const paused = ref(false)

const startTime = ref<number | null>(null)
const elapsed = ref(0)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

interface HistoryEntry {
  r: number
  c: number
  prev: number
  next: number
  prevPencil: Set<number> | null
}
const history = ref<HistoryEntry[]>([])

const bestKey = computed(() => `sudoku.${diff.value}`)
const bestTime = computed(() => getRecord(bestKey.value))

const timeDisplay = computed(() => formatDuration(paused.value ? elapsed.value : startTime.value == null ? 0 : elapsed.value + (now.value - startTime.value)))

function start(d: Diff) {
  diff.value = d
  const { puzzle: p, solution: s } = generatePuzzle(d)
  puzzle.value = p
  solution.value = s
  current.value = p.map((row) => row.slice())
  pencilMap.value = new Map()
  selected.value = null
  pencilMode.value = false
  history.value = []
  showDiff.value = false
  showWin.value = false
  newBest.value = false
  paused.value = false
  startTime.value = Date.now()
  elapsed.value = 0
  stopTimer()
  timer = setInterval(() => (now.value = Date.now()), 500)
  sounds.click()
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

function togglePause() {
  if (paused.value) {
    startTime.value = Date.now()
    now.value = Date.now()
    timer = setInterval(() => (now.value = Date.now()), 500)
  } else {
    if (startTime.value != null) {
      elapsed.value += Date.now() - startTime.value
      startTime.value = null
    }
    stopTimer()
  }
  paused.value = !paused.value
  sounds.click()
}

function isGiven(r: number, c: number): boolean {
  return puzzle.value[r]?.[c] !== 0 && puzzle.value[r]?.[c] !== undefined
}

function hasConflict(r: number, c: number): boolean {
  if (!checkErrors.value) return false
  const v = current.value[r]?.[c] ?? 0
  if (v === 0) return false
  return v !== (solution.value[r]?.[c] ?? 0)
}

const conflictCount = computed(() => {
  let n = 0
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (hasConflict(r, c)) n++
    }
  }
  return n
})

function select(r: number, c: number) {
  selected.value = [r, c]
  sounds.click()
}

function inputNumber(v: number) {
  const sel = selected.value
  if (!sel || paused.value) return
  const [r, c] = sel
  if (isGiven(r, c)) return
  const key = `${r},${c}`
  const prev = current.value[r]![c]!
  const prevPencil = pencilMap.value.get(key) ?? null
  if (pencilMode.value) {
    // 铅笔模式：切换候选标记
    const set = new Set(prevPencil ?? [])
    if (set.has(v)) set.delete(v)
    else set.add(v)
    const map = new Map(pencilMap.value)
    if (set.size > 0) map.set(key, set)
    else map.delete(key)
    pencilMap.value = map
    if (prev !== 0) {
      history.value.push({ r, c, prev, next: 0, prevPencil })
      current.value[r]![c] = 0
    }
    sounds.click()
    return
  }
  if (prev === v) return // 再点同数字 = 擦除
  const entry: HistoryEntry = { r, c, prev, next: v, prevPencil }
  history.value.push(entry)
  current.value[r]![c] = v
  // 填实数后清除该格铅笔标记
  if (v !== 0) {
    const map = new Map(pencilMap.value)
    map.delete(key)
    pencilMap.value = map
  }
  sounds.move()
  checkWin()
}

function erase() {
  const sel = selected.value
  if (!sel || paused.value) return
  const [r, c] = sel
  if (isGiven(r, c)) return
  if (current.value[r]![c] === 0 && !pencilMap.value.has(`${r},${c}`)) return
  history.value.push({ r, c, prev: current.value[r]![c]!, next: 0, prevPencil: pencilMap.value.get(`${r},${c}`) ?? null })
  current.value[r]![c] = 0
  const map = new Map(pencilMap.value)
  map.delete(`${r},${c}`)
  pencilMap.value = map
  sounds.click()
}

function undo() {
  const entry = history.value.pop()
  if (!entry) return
  current.value[entry.r]![entry.c] = entry.prev
  const map = new Map(pencilMap.value)
  const key = `${entry.r},${entry.c}`
  if (entry.prevPencil) map.set(key, entry.prevPencil)
  else map.delete(key)
  pencilMap.value = map
  sounds.click()
}

function checkWin() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (current.value[r]![c] !== solution.value[r]![c]) return
    }
  }
  // 胜利：结算用时
  const total = elapsed.value + (startTime.value != null ? Date.now() - startTime.value : 0)
  stopTimer()
  const rec = submitRecord(bestKey.value, total, 'min')
  newBest.value = rec != null
  showWin.value = true
  sounds.win()
}

function sameGroup(r: number, c: number): boolean {
  const sel = selected.value
  if (!sel) return false
  const [sr, sc] = sel
  return r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3))
}

function sameValue(r: number, c: number): boolean {
  const sel = selected.value
  if (!sel) return false
  const v = current.value[sel[0]]![sel[1]]!
  return v !== 0 && current.value[r]![c] === v
}

function pencilOf(r: number, c: number): number[] {
  const s = pencilMap.value.get(`${r},${c}`)
  return s ? [...s].sort((a, b) => a - b) : []
}

function onKey(e: KeyboardEvent) {
  if (showDiff.value || showWin.value) return
  if (e.key >= '1' && e.key <= '9') {
    e.preventDefault()
    inputNumber(Number(e.key))
  } else if (['Backspace', 'Delete', '0'].includes(e.key)) {
    e.preventDefault()
    erase()
  } else if (e.key === 'p' || e.key === 'P') {
    e.preventDefault()
    pencilMode.value = !pencilMode.value
  } else if (e.key.startsWith('Arrow') && selected.value) {
    e.preventDefault()
    const [r, c] = selected.value
    const map: Record<string, [number, number]> = {
      ArrowUp: [Math.max(0, r - 1), c],
      ArrowDown: [Math.min(8, r + 1), c],
      ArrowLeft: [r, Math.max(0, c - 1)],
      ArrowRight: [r, Math.min(8, c + 1)],
    }
    const next = map[e.key]!
    selected.value = next
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  stopTimer()
})
</script>

<template>
  <GameShell title="数独" :subtitle="`${diffNames[diff]}${checkErrors && conflictCount > 0 ? ` · ${conflictCount} 处待改正` : ''}`">
    <template #actions>
      <button class="btn btn-ghost btn-sm" @click="showDiff = true; stopTimer()">换难度</button>
      <button class="btn btn-primary btn-sm" @click="start(diff)">新一局</button>
    </template>

    <div class="sdk">
      <div class="sdk__hud panel">
        <div class="sdk__stat">
          <span class="sdk__label">用时</span>
          <span class="sdk__value">{{ paused ? '已暂停' : timeDisplay }}</span>
        </div>
        <div class="sdk__stat">
          <span class="sdk__label">最佳（{{ diffNames[diff] }}）</span>
          <span class="sdk__value">{{ bestTime ? formatDuration(bestTime.value) : '—' }}</span>
        </div>
        <button class="btn btn-ghost btn-sm" @click="togglePause">{{ paused ? '继续' : '暂停' }}</button>
        <button class="btn btn-ghost btn-sm" :class="{ 'sdk__check--off': !checkErrors }" @click="checkErrors = !checkErrors" :title="checkErrors ? '错误即时高亮（点击关闭，练习模式）' : '练习模式（点击开启错误提示）'">
          {{ checkErrors ? '✔ 即时纠错：开' : '练习模式' }}
        </button>
      </div>

      <div class="sdk__board-wrap" :class="{ 'sdk__board-wrap--paused': paused }">
        <div class="sdk__board">
          <template v-for="(row, r) in current" :key="`row-${r}`">
            <button
              v-for="(v, c) in row"
              :key="`${r}-${c}`"
              class="sdk__cell"
              :class="{
                'sdk__cell--given': isGiven(r, c),
                'sdk__cell--selected': selected && selected[0] === r && selected[1] === c,
                'sdk__cell--group': sameGroup(r, c) && !(selected && selected[0] === r && selected[1] === c),
                'sdk__cell--same': sameValue(r, c),
                'sdk__cell--error': hasConflict(r, c),
                'sdk__cell--b-right': c % 3 === 2 && c !== 8,
                'sdk__cell--b-bottom': r % 3 === 2 && r !== 8,
              }"
              @click="select(r, c)"
            >
              <span v-if="v !== 0" class="sdk__value">{{ v }}</span>
              <span v-else-if="pencilOf(r, c).length" class="sdk__pencil">{{ pencilOf(r, c).join(' ') }}</span>
            </button>
          </template>
        </div>
        <div v-if="paused" class="sdk__pause-cover">⏸ 已暂停</div>
      </div>

      <div class="sdk__tools">
        <button class="btn btn-sm" :class="pencilMode ? 'btn-primary' : 'btn-ghost'" @click="pencilMode = !pencilMode">
          ✏️ 铅笔标记{{ pencilMode ? '（开）' : '' }}
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="!history.length" @click="undo">↩ 撤销</button>
        <button class="btn btn-ghost btn-sm" @click="erase">⌫ 擦除</button>
      </div>

      <div class="sdk__numpad">
        <button v-for="n in 9" :key="n" class="sdk__num" @click="inputNumber(n)">{{ n }}</button>
      </div>
      <p class="sdk__hint">键盘数字填入 · 方向键移动 · P 切换铅笔 · 退格擦除 · 再按同数字也可擦除</p>
    </div>

    <DifficultySelect
      v-if="showDiff"
      title="选择难度"
      :options="[
        { value: 'easy', label: '简单', desc: '提示多，适合入门' },
        { value: 'medium', label: '中等', desc: '需要一些推理' },
        { value: 'hard', label: '困难', desc: '挑战逻辑极限' },
        { value: 'expert', label: '专家', desc: '最少提示，高手专属' },
      ]"
      @select="(v) => start(v as Diff)"
    />

    <ResultDialog
      :visible="showWin"
      title="🎉 全部填对！"
      :message="`用时 ${timeDisplay}${newBest ? ' · 新纪录！' : ''}`"
      @close="showWin = false"
    >
      <template #actions>
        <button class="btn btn-primary" @click="start(diff)">再来一局</button>
      </template>
    </ResultDialog>
  </GameShell>
</template>

<style scoped>
.sdk {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.sdk__hud {
  display: flex;
  gap: 18px;
  align-items: center;
  padding: 10px 20px;
}

.sdk__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sdk__label {
  font-size: 12px;
  color: var(--muted);
}

.sdk__value {
  font-size: 19px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.sdk__check--off {
  border-color: #fcd34d;
}

.sdk__board-wrap {
  position: relative;
}

.sdk__board {
  display: grid;
  grid-template-columns: repeat(9, 50px);
  grid-template-rows: repeat(9, 50px);
  border: 3px solid #334155;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.sdk__pause-cover {
  position: absolute;
  inset: 0;
  background: rgba(248, 250, 252, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: var(--muted);
  border-radius: 8px;
}

.sdk__cell {
  border: 1px solid #e2e8f0;
  background: #fff;
  font-size: 26px;
  font-weight: 600;
  color: #1e293b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  position: relative;
}

.sdk__cell--b-right {
  border-right: 2px solid #94a3b8;
}

.sdk__cell--b-bottom {
  border-bottom: 2px solid #94a3b8;
}

.sdk__cell--given {
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 700;
  cursor: default;
}

.sdk__cell--group {
  background: #e0e7ff;
}

.sdk__cell--same {
  background: #c7d2fe;
  font-weight: 800;
}

.sdk__cell--selected {
  background: #818cf8 !important;
  color: #fff;
  outline: 2px solid #4f46e5;
  outline-offset: -2px;
  z-index: 2;
}

.sdk__cell--error .sdk__value {
  color: var(--danger);
}

.sdk__cell--error {
  background: #fee2e2 !important;
}

.sdk__pencil {
  font-size: 11px;
  color: #64748b;
  letter-spacing: 1px;
  line-height: 1.2;
  max-width: 46px;
  word-break: break-all;
  text-align: center;
}

.sdk__tools {
  display: flex;
  gap: 10px;
}

.sdk__numpad {
  display: flex;
  gap: 8px;
}

.sdk__num {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: #fff;
  font-size: 24px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
}

.sdk__num:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.sdk__num:active {
  transform: scale(0.94);
}

.sdk__hint {
  color: var(--muted);
  font-size: 13px;
  margin: 0;
}
</style>

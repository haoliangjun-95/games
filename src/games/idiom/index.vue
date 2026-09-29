<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import GameShell from '../../components/GameShell.vue'
import ResultDialog from '../../components/ResultDialog.vue'
import { IdiomChain, searchIdioms, type IdiomEntry, type RawIdiom } from './chain'
import {
  distractorCountForLevel,
  generateLevel,
  isCorrect,
  key,
  solvedState,
  type CrossCell,
  type CrosswordLevel,
} from './crossword'
import { GRADE_OPTIONS, gradeLabel, gradeWords, type GradeId } from './grades'
import { sounds } from '../../composables/useSound'
import { getRecord, submitRecord } from '../../composables/useBestRecord'

type Mode = 'cross' | 'battle' | 'search'
const mode = ref<Mode>('cross')

const GRADE_KEY = 'idiom.grade'
const storedRaw = localStorage.getItem(GRADE_KEY)
const storedGrade = storedRaw == null ? 4 : Number(storedRaw)
const VALID_GRADES: GradeId[] = [0, 4, 5, 6, 7, 8, 9]
const grade = ref<GradeId>(VALID_GRADES.includes(storedGrade as GradeId) ? (storedGrade as GradeId) : 4)

const loading = ref(true)
let rawAll: RawIdiom[] = []
const fullChain = shallowRef<IdiomChain | null>(null)
const gradeChains = new Map<GradeId, IdiomChain>()

/** 当前生效词库：全词库或年级词库 */
const chain = computed<IdiomChain | null>(() => {
  const full = fullChain.value
  if (!full) return null
  if (grade.value === 0) return full
  let c = gradeChains.get(grade.value)
  if (!c) {
    const set = new Set(gradeWords(grade.value)!)
    c = new IdiomChain(rawAll.filter(([w]) => set.has(w)))
    gradeChains.set(grade.value, c)
  }
  return c
})

onMounted(async () => {
  rawAll = (await import('./data.json')).default as RawIdiom[]
  fullChain.value = new IdiomChain(rawAll)
  loading.value = false
  startLevel()
})

const subtitle = computed(() => {
  if (loading.value) return '词典加载中…'
  if (mode.value === 'cross') return `填字闯关 · ${gradeLabel(grade.value)} · 第 ${level.value} 关`
  if (mode.value === 'battle') {
    const c = chain.value!
    return grade.value === 0 ? `接龙对战 · 全词库 ${c.size.toLocaleString()} 条` : `接龙对战 · ${gradeLabel(grade.value)}词库 ${c.size} 条`
  }
  return `成语查询 · 词典 ${fullChain.value!.size.toLocaleString()} 条`
})

// ================= 填字闯关 =================
/** 进度按年级隔离存储 */
const levelKey = computed(() => (grade.value === 0 ? 'idiom.crossword.level' : `idiom.crossword.level.g${grade.value}`))
const maxKey = computed(() => (grade.value === 0 ? 'idiom.maxLevel' : `idiom.maxLevel.g${grade.value}`))

const level = ref<number>(Number(localStorage.getItem(levelKey.value) ?? '1') || 1)
const maxLevel = ref<number>(getRecord(maxKey.value)?.value ?? 1)
const levelData = shallowRef<CrosswordLevel | null>(null)
const fills = ref<Map<string, string>>(new Map())
const usedTiles = ref<Set<number>>(new Set())
const removedTiles = ref<Set<number>>(new Set())
const cursor = ref<string | null>(null)
const hintsLeft = ref(3)
const removesLeft = ref(2)
const showExpl = ref(false)
const showWin = ref(false)
const shakeCell = ref<string | null>(null)
const flashIdioms = ref<number[]>([])

const posMap = computed(() => {
  const m = new Map<string, CrossCell>()
  if (levelData.value) for (const cell of levelData.value.cells) m.set(key(cell.r, cell.c), cell)
  return m
})

const solve = computed(() =>
  levelData.value ? solvedState(levelData.value, fills.value) : { allDone: false, idiomDone: [] as boolean[] },
)

const cellPx = computed(() => {
  const cols = levelData.value?.cols ?? 8
  const rows = levelData.value?.rows ?? 8
  // 同时按宽度与高度自适应：高关卡 9 条成语时整盘 + 字块区尽量一屏可见
  return `max(32px, min(64px, (min(92vw, 720px)) / ${cols}, (100vh - 400px) / ${rows}))`
})

function startLevel() {
  if (!chain.value) return
  levelData.value = generateLevel(chain.value, level.value, Math.random)
  fills.value = new Map()
  usedTiles.value = new Set()
  removedTiles.value = new Set()
  hintsLeft.value = 3
  removesLeft.value = 2
  showWin.value = false
  flashIdioms.value = []
  showExpl.value = false
  const firstEmpty = levelData.value.cells.find((x) => !x.revealed)
  cursor.value = firstEmpty ? key(firstEmpty.r, firstEmpty.c) : null
  sounds.click()
}

/** 切换年级：换词库、恢复该年级进度、重开局面 */
function setGrade(g: GradeId) {
  if (g === grade.value || loading.value) return
  grade.value = g
  localStorage.setItem(GRADE_KEY, String(g))
  level.value = Number(localStorage.getItem(levelKey.value) ?? '1') || 1
  maxLevel.value = getRecord(maxKey.value)?.value ?? 1
  startLevel()
  if (history.value.length > 0) startRound()
  sounds.click()
}

function cellDisplay(cell: CrossCell): string {
  if (cell.revealed) return cell.char
  return fills.value.get(key(cell.r, cell.c)) ?? ''
}

/** 该格是否可编辑：未揭示且（未填或填错） */
function editableCell(cell: CrossCell): boolean {
  if (cell.revealed) return false
  const v = fills.value.get(key(cell.r, cell.c))
  return v == null || v !== cell.char
}

function firstEditableKey(): string | null {
  const lv = levelData.value
  if (!lv) return null
  const cell = lv.cells.find((x) => editableCell(x))
  return cell ? key(cell.r, cell.c) : null
}

function onCellClick(cell: CrossCell) {
  if (cell.revealed || solve.value.allDone) return
  const k = key(cell.r, cell.c)
  // 再次点击已选中的错字格：取回字块
  if (cursor.value === k) {
    const v = fills.value.get(k)
    if (v != null && v !== cell.char) {
      returnWrongTile(k)
      const next = new Map(fills.value)
      next.delete(k)
      fills.value = next
      sounds.click()
      return
    }
  }
  cursor.value = k
  sounds.click()
}

function onTileClick(idx: number) {
  const lv = levelData.value
  if (!lv || solve.value.allDone) return
  if (usedTiles.value.has(idx) || removedTiles.value.has(idx)) return
  // 目标格：当前选中格（若不可编辑则跳到第一个可编辑格）
  let targetKey = cursor.value
  if (targetKey) {
    const cell = posMap.value.get(targetKey)
    if (!cell || !editableCell(cell)) targetKey = firstEditableKey()
  } else {
    targetKey = firstEditableKey()
  }
  if (!targetKey) return
  const [r, c] = targetKey.split(',').map(Number)
  const ch = lv.candidates[idx]!
  if (isCorrect(lv, r!, c!, ch)) {
    // 正确：替换掉格内错字（旧字块回池）
    returnWrongTile(targetKey)
    applyFill(targetKey, ch, idx)
  } else {
    // 错误：字留在格中红色高亮，可选中替换
    returnWrongTile(targetKey)
    const next = new Map(fills.value)
    next.set(targetKey, ch)
    fills.value = next
    usedTiles.value = new Set(usedTiles.value).add(idx)
    shakeCell.value = targetKey
    setTimeout(() => (shakeCell.value = null), 450)
    sounds.error()
  }
}

/** 把错字格里的字块退回候选池 */
function returnWrongTile(cellKey: string) {
  const lv = levelData.value
  if (!lv) return
  const cell = posMap.value.get(cellKey)
  const old = fills.value.get(cellKey)
  if (!cell || old == null || old === cell.char) return
  const idx = lv.candidates.findIndex((ch, i) => ch === old && usedTiles.value.has(i))
  if (idx >= 0) {
    const s = new Set(usedTiles.value)
    s.delete(idx)
    usedTiles.value = s
  }
}

function applyFill(cellKey: string, ch: string, tileIdx: number | null) {
  const lv = levelData.value!
  const before = solvedState(lv, fills.value).idiomDone
  fills.value = new Map(fills.value)
  fills.value.set(cellKey, ch)
  if (tileIdx != null) usedTiles.value = new Set(usedTiles.value).add(tileIdx)
  sounds.move()
  finishChecks(before)
  if (solve.value.allDone) {
    sounds.win()
    showWin.value = true
    // 进度持久化：进入下一关
    const next = level.value + 1
    level.value = next
    localStorage.setItem(levelKey.value, String(next))
    const rec = submitRecord(maxKey.value, next, 'max')
    if (rec) maxLevel.value = rec.value
    return
  }
  // 光标跳到下一个可编辑格
  const order = lv.cells.filter((x) => !x.revealed)
  const curIdx = order.findIndex((x) => key(x.r, x.c) === cellKey)
  const nextCell = order.slice(curIdx + 1).find((x) => editableCell(x)) ?? order.find((x) => editableCell(x))
  cursor.value = nextCell ? key(nextCell.r, nextCell.c) : null
}

/** 新完成成语的闪光反馈 */
function finishChecks(before: boolean[]) {
  const lv = levelData.value!
  const after = solvedState(lv, fills.value)
  const newlyDone = after.idiomDone
    .map((d, i) => (d && !before[i] ? i : -1))
    .filter((i) => i >= 0)
  if (newlyDone.length > 0) {
    flashIdioms.value = newlyDone
    sounds.capture()
    setTimeout(() => (flashIdioms.value = []), 800)
  }
}

function useHint() {
  const lv = levelData.value
  if (!lv || hintsLeft.value <= 0 || solve.value.allDone) return
  let target: string | null = null
  if (cursor.value) {
    const cell = posMap.value.get(cursor.value)
    if (cell && editableCell(cell)) target = cursor.value
  }
  if (!target) target = firstEditableKey()
  if (!target) return
  const cell = posMap.value.get(target)!
  // 从未用且未消除的字块中找一个正确字
  const idx = lv.candidates.findIndex((ch, i) => ch === cell.char && !usedTiles.value.has(i) && !removedTiles.value.has(i))
  hintsLeft.value--
  sounds.click()
  returnWrongTile(target)
  applyFill(target, cell.char, idx >= 0 ? idx : null)
}

function useRemove() {
  const lv = levelData.value
  if (!lv || removesLeft.value <= 0 || solve.value.allDone) return
  const need = new Set(
    lv.cells.filter((x) => !x.revealed && !fills.value.has(key(x.r, x.c))).map((x) => x.char),
  )
  const removable: number[] = []
  for (let i = 0; i < lv.candidates.length && removable.length < 3; i++) {
    const ch = lv.candidates[i]!
    if (!usedTiles.value.has(i) && !removedTiles.value.has(i) && !need.has(ch)) removable.push(i)
  }
  if (removable.length === 0) return
  removedTiles.value = new Set(removedTiles.value)
  for (const i of removable) removedTiles.value.add(i)
  removesLeft.value--
  sounds.click()
}

function cellClasses(cell: CrossCell): Record<string, boolean> {
  const k = key(cell.r, cell.c)
  const v = fills.value.get(k)
  const filled = v != null
  const correct = filled && !cell.revealed && v === cell.char
  const wrong = filled && !cell.revealed && v !== cell.char
  const inFlash = flashIdioms.value.some((i) => levelData.value!.idioms[i]!.cells.some(([r, c]) => r === cell.r && c === cell.c))
  return {
    'cw__cell--revealed': cell.revealed,
    'cw__cell--filled': correct,
    'cw__cell--wrong': wrong,
    'cw__cell--cursor': cursor.value === k && !cell.revealed && !solve.value.allDone,
    'cw__cell--shake': shakeCell.value === k,
    'cw__cell--flash': inFlash,
  }
}

// ================= 接龙对战（保留原玩法） =================
const BEST_KEY = 'idiom.streak'
const history = ref<Array<{ who: 'me' | 'pc'; entry: IdiomEntry }>>([])
const usedWords = ref<Set<string>>(new Set())
const input = ref('')
const feedback = ref<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
const streak = ref(0)
const bestStreak = ref<number>(getRecord(BEST_KEY)?.value ?? 0)
const homophone = ref(true)
const hintsUsed = ref(0)
const showHints = ref(false)
const pcThinking = ref(false)
const showVictory = ref(false)
const victoryInfo = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const chainListRef = ref<HTMLDivElement | null>(null)

const currentEntry = computed(() => history.value[history.value.length - 1]?.entry ?? null)
const awaitingPlayer = computed(() => history.value[history.value.length - 1]?.who === 'pc')

function startRound() {
  if (!chain.value) return
  const start = chain.value.randomStart()
  history.value = [{ who: 'pc', entry: start }]
  usedWords.value = new Set([start.word])
  input.value = ''
  feedback.value = null
  streak.value = 0
  hintsUsed.value = 0
  showHints.value = false
  showVictory.value = false
  sounds.click()
  nextTick(() => inputRef.value?.focus())
}

function submitWord() {
  const c = chain.value
  const word = input.value.trim()
  if (!c || !word || !awaitingPlayer.value) return
  if (word.length !== 4) return fail('请输入四字成语')
  if (usedWords.value.has(word)) return fail('这个成语已经用过啦')
  const entry = c.lookup(word)
  if (!entry) {
    if (fullChain.value?.lookup(word)) return fail(`「${word}」不在${gradeLabel(grade.value)}词库里，换一个学过的吧`)
    return fail('词典里没有这个成语，检查一下错别字？')
  }
  const lastWord = currentEntry.value!.word
  if (!c.canChain(lastWord, word, homophone.value)) {
    const lastChar = lastWord[3]!
    return fail(homophone.value ? `要接「${lastChar}」（或同音字）开头` : `要接「${lastChar}」字开头`)
  }
  history.value.push({ who: 'me', entry })
  usedWords.value.add(word)
  streak.value++
  feedback.value = { type: 'ok', text: `✔ 接上了！当前连击 ${streak.value}` }
  input.value = ''
  showHints.value = false
  sounds.move()
  const rec = submitRecord(BEST_KEY, streak.value, 'max')
  if (rec) bestStreak.value = rec.value
  pcThinking.value = true
  setTimeout(() => {
    pcThinking.value = false
    const mv = c.computerMove(word, usedWords.value, Math.random, homophone.value)
    if (mv) {
      history.value.push({ who: 'pc', entry: mv })
      usedWords.value.add(mv.word)
      sounds.click()
    } else {
      victoryInfo.value = `电脑被「${word}」难住了！本局连击 ${streak.value} 次${hintsUsed.value > 0 ? `（用了 ${hintsUsed.value} 次提示）` : ''}`
      showVictory.value = true
      sounds.win()
    }
    scrollChain()
  }, 900)
  scrollChain()
}

function fail(text: string) {
  feedback.value = { type: 'err', text: `✘ ${text}` }
  sounds.error()
}

function giveHints() {
  if (!chain.value || !currentEntry.value || !awaitingPlayer.value) return
  hintsUsed.value++
  showHints.value = true
  sounds.click()
}

const tailChar = computed(() => currentEntry.value?.word[3] ?? '')
const tailPlain = computed(() => (chain.value && tailChar.value ? chain.value.plainOf(tailChar.value) : ''))
const hintChars = computed(() => (chain.value && showHints.value && currentEntry.value ? chain.value.hintChars(currentEntry.value.word) : []))

function scrollChain() {
  nextTick(() => chainListRef.value?.scrollTo({ top: chainListRef.value.scrollHeight, behavior: 'smooth' }))
}

// ================= 查询 =================
const searchKeyword = ref('')
const searchResults = ref<IdiomEntry[]>([])

function doSearch() {
  if (!fullChain.value) return
  searchResults.value = searchIdioms(fullChain.value, searchKeyword.value)
  sounds.click()
}

// 切到对战时开局一次
watch(mode, (m) => {
  if (m === 'battle' && history.value.length === 0) startRound()
})
</script>

<template>
  <GameShell title="成语接龙" :subtitle="subtitle">
    <template #actions>
      <button class="btn btn-sm" :class="mode === 'cross' ? 'btn-primary' : 'btn-ghost'" @click="mode = 'cross'">填字闯关</button>
      <button class="btn btn-sm" :class="mode === 'battle' ? 'btn-primary' : 'btn-ghost'" @click="mode = 'battle'">接龙对战</button>
      <button class="btn btn-sm" :class="mode === 'search' ? 'btn-primary' : 'btn-ghost'" @click="mode = 'search'">查成语</button>
    </template>

    <!-- 加载中 -->
    <div v-if="loading" class="idm__loading">
      <div class="idm__spinner" />
      <p>正在加载成语词典（约 3 万条）…</p>
    </div>

    <!-- ===== 填字闯关 ===== -->
    <div v-else-if="mode === 'cross'" class="cw">
      <div class="cw__top">
        <div class="cw__level">第 {{ levelData?.level ?? level }} 关</div>
        <button class="cw__restart" @click="startLevel">↻ 重新本关</button>
      </div>

      <div class="cw__grades">
        <span class="cw__grades-label">📚 年级词库</span>
        <div class="cw__grades-list">
          <button
            v-for="g in GRADE_OPTIONS"
            :key="g.id"
            class="cw__grade"
            :class="{ 'cw__grade--on': grade === g.id }"
            @click="setGrade(g.id)"
          >{{ g.label }}</button>
        </div>
      </div>

      <div
        class="cw__board"
        :style="{
          gridTemplateColumns: `repeat(${levelData?.cols ?? 1}, ${cellPx})`,
          gridTemplateRows: `repeat(${levelData?.rows ?? 1}, ${cellPx})`,
          '--cell-size': cellPx,
        }"
      >
        <template v-for="(r, ri) in levelData?.rows ?? 0" :key="`row-${ri}`">
          <template v-for="(c, ci) in levelData?.cols ?? 0" :key="`cell-${ri}-${ci}`">
            <div
              v-if="posMap.get(`${ri},${ci}`)"
              class="cw__cell"
              :class="cellClasses(posMap.get(`${ri},${ci}`)!)"
              @click="onCellClick(posMap.get(`${ri},${ci}`)!)"
            >
              <span>{{ cellDisplay(posMap.get(`${ri},${ci}`)!) }}</span>
            </div>
            <div v-else class="cw__void" />
          </template>
        </template>
      </div>

      <div class="cw__props">
        <button class="cw__prop" :class="{ 'cw__prop--on': showExpl }" @click="showExpl = !showExpl">
          <span class="cw__prop-icon">📖</span>
          <span class="cw__prop-name">释义</span>
        </button>
        <button class="cw__prop" :disabled="hintsLeft <= 0 || solve.allDone" @click="useHint">
          <span class="cw__prop-icon">🎯</span>
          <span class="cw__prop-name">提示</span>
          <span class="cw__badge">{{ hintsLeft }}</span>
        </button>
        <button class="cw__prop" :disabled="removesLeft <= 0 || solve.allDone" @click="useRemove">
          <span class="cw__prop-icon">🧹</span>
          <span class="cw__prop-name">消除</span>
          <span class="cw__badge">{{ removesLeft }}</span>
        </button>
      </div>

      <div v-if="showExpl" class="cw__expl">
        <div v-for="(idiom, i) in levelData?.idioms ?? []" :key="i" class="cw__expl-item">
          <template v-if="solve.idiomDone[i]">
            <span class="cw__expl-word">{{ idiom.entry.word }}</span>
            <span class="cw__expl-py">{{ idiom.entry.pinyin.join(' ') }}</span>
            <p class="cw__expl-text">{{ idiom.entry.explanation }}</p>
          </template>
          <template v-else>
            <span class="cw__expl-word cw__expl-word--hidden">{{ '❓'.repeat(1) }}？？？？</span>
            <p class="cw__expl-text">完成这条成语后显示释义</p>
          </template>
        </div>
      </div>

      <div class="cw__tiles" :class="{ 'cw__tiles--many': (levelData?.candidates.length ?? 0) > 18 }">
        <button
          v-for="(ch, idx) in levelData?.candidates ?? []"
          v-show="!usedTiles.has(idx) && !removedTiles.has(idx)"
          :key="`tile-${idx}`"
          class="cw__tile"
          @click="onTileClick(idx)"
        >
          {{ ch }}
        </button>
      </div>
    </div>

    <!-- ===== 接龙对战 ===== -->
    <div v-else-if="mode === 'battle'" class="idm">
      <div class="idm__hud panel">
        <div class="idm__stat">
          <span class="idm__label">当前连击</span>
          <span class="idm__value">🔥 {{ streak }}</span>
        </div>
        <div class="idm__stat">
          <span class="idm__label">最长连击</span>
          <span class="idm__value">{{ bestStreak }}</span>
        </div>
        <div class="idm__stat">
          <span class="idm__label">接龙数</span>
          <span class="idm__value">{{ history.filter((h) => h.who === 'me').length }}</span>
        </div>
        <button class="btn btn-ghost btn-sm" :class="{ 'idm__homo--off': !homophone }" @click="homophone = !homophone">
          {{ homophone ? '同音接龙：开' : '同音接龙：关' }}
        </button>
      </div>

      <div class="cw__grades">
        <span class="cw__grades-label">📚 年级词库</span>
        <div class="cw__grades-list">
          <button
            v-for="g in GRADE_OPTIONS"
            :key="g.id"
            class="cw__grade"
            :class="{ 'cw__grade--on': grade === g.id }"
            @click="setGrade(g.id)"
          >{{ g.label }}</button>
        </div>
      </div>

      <div ref="chainListRef" class="idm__chain panel">
        <div v-for="(item, i) in history" :key="`${i}-${item.entry.word}`" class="idm__item" :class="`idm__item--${item.who}`">
          <span class="idm__who">{{ item.who === 'pc' ? '电脑' : '我' }}</span>
          <div class="idm__body">
            <div class="idm__word">
              <span class="idm__char" :class="{ 'idm__char--tail': i === history.length - 1 && item.who === 'pc' }">{{ item.entry.word[0] }}</span>{{ item.entry.word.slice(1, 3) }}<span class="idm__char" :class="{ 'idm__char--head': i > 0 }">{{ item.entry.word[3] }}</span>
            </div>
            <div class="idm__pinyin">{{ item.entry.pinyin.join(' ') }}</div>
            <div class="idm__expl">{{ item.entry.explanation }}</div>
          </div>
        </div>
        <div v-if="pcThinking" class="idm__thinking">🤔 电脑思考中…</div>
      </div>

      <div class="idm__input-row">
        <template v-if="awaitingPlayer">
          <div class="idm__target panel">
            请接：<b class="idm__target-char">{{ tailChar }}</b>
            <span v-if="homophone && tailPlain" class="idm__target-pinyin">（{{ tailPlain }} 开头或同音）</span>
          </div>
          <div class="idm__input-wrap" @click="inputRef?.focus()">
            <input ref="inputRef" v-model="input" class="idm__input" maxlength="4" placeholder="输入四字成语" @keydown.enter="submitWord" />
            <button class="btn btn-primary idm__submit" @click="submitWord">接龙</button>
          </div>
          <div v-if="feedback" class="idm__feedback" :class="`idm__feedback--${feedback.type}`">{{ feedback.text }}</div>
          <div class="idm__tools">
            <button class="btn btn-ghost btn-sm" @click="giveHints">💡 提示候选字</button>
            <button class="btn btn-ghost btn-sm" @click="startRound">🔄 换一题（连击清零）</button>
            <div v-if="showHints" class="idm__hint-chars anim-fade">
              可以接：<span v-for="ch in hintChars" :key="ch" class="idm__hint-char">{{ ch }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ===== 查询 ===== -->
    <div v-else class="idm idm--search">
      <div class="idm__search-bar">
        <input
          v-model="searchKeyword"
          class="idm__input idm__input--search"
          placeholder="输入关键字搜索成语（如：画蛇 / 心意）"
          @keydown.enter="doSearch"
        />
        <button class="btn btn-primary" @click="doSearch">搜索</button>
      </div>
      <div class="idm__results panel">
        <div v-if="searchResults.length === 0" class="idm__empty">输入关键字开始查询，释义来自开源成语词典</div>
        <div v-for="e in searchResults" :key="e.word" class="idm__result">
          <div class="idm__result-word">{{ e.word }} <span class="idm__pinyin">{{ e.pinyin.join(' ') }}</span></div>
          <div class="idm__expl">{{ e.explanation }}</div>
        </div>
      </div>
    </div>

    <!-- 过关弹窗 -->
    <ResultDialog :visible="showWin" :title="`🎉 第 ${levelData?.level} 关通过！`" message="本关成语都学会了吗？看看释义：" @close="showWin = false">
      <div class="cw__win-list">
        <div v-for="idiom in levelData?.idioms ?? []" :key="idiom.entry.word" class="cw__win-item">
          <b>{{ idiom.entry.word }}</b>
          <span class="idm__pinyin">{{ idiom.entry.pinyin.join(' ') }}</span>
          <p>{{ idiom.entry.explanation }}</p>
        </div>
      </div>
      <template #actions>
        <button class="btn btn-primary" @click="startLevel">下一关 →</button>
      </template>
    </ResultDialog>

    <ResultDialog :visible="showVictory" title="🏆 电脑被你难住了！" :message="victoryInfo" @close="showVictory = false">
      <template #actions>
        <button class="btn btn-primary" @click="startRound">再来一局</button>
      </template>
    </ResultDialog>
  </GameShell>
</template>

<style scoped src="./idiom-battle.css"></style>
<style scoped src="./idiom-crossword.css"></style>

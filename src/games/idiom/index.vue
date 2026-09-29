<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef } from 'vue'
import GameShell from '../../components/GameShell.vue'
import ResultDialog from '../../components/ResultDialog.vue'
import { IdiomChain, searchIdioms, type IdiomEntry, type RawIdiom } from './chain'
import { sounds } from '../../composables/useSound'
import { getRecord, submitRecord } from '../../composables/useBestRecord'

const BEST_KEY = 'idiom.streak'

const loading = ref(true)
const chain = shallowRef<IdiomChain | null>(null)
const tab = ref<'play' | 'search'>('play')

// 对战状态
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

// 查询状态
const searchKeyword = ref('')
const searchResults = ref<IdiomEntry[]>([])

const currentEntry = computed(() => history.value[history.value.length - 1]?.entry ?? null)
/** 电脑出的最新一条（等待玩家接） */
const awaitingPlayer = computed(() => history.value[history.value.length - 1]?.who === 'pc')

onMounted(async () => {
  const raw = (await import('./data.json')).default as RawIdiom[]
  chain.value = new IdiomChain(raw)
  loading.value = false
  startRound()
})

function startRound() {
  if (!chain.value) return
  const c = chain.value
  // 电脑先出
  const start = c.randomStart()
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

  if (word.length !== 4) {
    fail('请输入四字成语')
    return
  }
  if (usedWords.value.has(word)) {
    fail('这个成语已经用过啦')
    return
  }
  const entry = c.lookup(word)
  if (!entry) {
    fail('词典里没有这个成语，检查一下错别字？')
    return
  }
  const lastWord = currentEntry.value!.word
  if (!c.canChain(lastWord, word, homophone.value)) {
    const lastChar = lastWord[3]!
    fail(homophone.value ? `要接「${lastChar}」（或同音字）开头` : `要接「${lastChar}」字开头`)
    return
  }

  // 接龙成功
  history.value.push({ who: 'me', entry })
  usedWords.value.add(word)
  streak.value++
  feedback.value = { type: 'ok', text: `✔ 接上了！当前连击 ${streak.value}` }
  input.value = ''
  showHints.value = false
  sounds.move()
  const rec = submitRecord(BEST_KEY, streak.value, 'max')
  if (rec) bestStreak.value = rec.value

  // 电脑接龙
  pcThinking.value = true
  setTimeout(() => {
    pcThinking.value = false
    const mv = c.computerMove(word, usedWords.value, Math.random, homophone.value)
    if (mv) {
      history.value.push({ who: 'pc', entry: mv })
      usedWords.value.add(mv.word)
      sounds.click()
    } else {
      // 电脑接不上 → 玩家获胜
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

function skipRound() {
  // 换题：连击清零
  startRound()
}

function toggleHomophone() {
  homophone.value = !homophone.value
  sounds.click()
}

function scrollChain() {
  nextTick(() => {
    chainListRef.value?.scrollTo({ top: chainListRef.value.scrollHeight, behavior: 'smooth' })
  })
}

function doSearch() {
  if (!chain.value) return
  searchResults.value = searchIdioms(chain.value, searchKeyword.value)
  sounds.click()
}

/** 尾字展示（提示玩家要接的字） */
const tailChar = computed(() => currentEntry.value?.word[3] ?? '')
const tailPlain = computed(() => (chain.value && tailChar.value ? chain.value.plainOf(tailChar.value) : ''))
const hintChars = computed(() => (chain.value && showHints.value && currentEntry.value ? chain.value.hintChars(currentEntry.value.word) : []))
</script>

<template>
  <GameShell title="成语接龙" :subtitle="chain ? `词典 ${chain.size.toLocaleString()} 条` : '词典加载中…'">
    <template #actions>
      <button class="btn btn-ghost btn-sm" :class="{ 'idm__homo--off': !homophone }" @click="toggleHomophone">
        {{ homophone ? '同音接龙：开' : '同音接龙：关' }}
      </button>
      <button class="btn btn-ghost btn-sm" @click="tab = tab === 'play' ? 'search' : 'play'">
        {{ tab === 'play' ? '📖 成语查询' : '🔙 返回对战' }}
      </button>
    </template>

    <!-- 加载中 -->
    <div v-if="loading" class="idm__loading">
      <div class="idm__spinner" />
      <p>正在加载成语词典（约 3 万条）…</p>
    </div>

    <!-- 对战 -->
    <div v-else-if="tab === 'play'" class="idm">
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
      </div>

      <div ref="chainListRef" class="idm__chain panel">
        <div
          v-for="(item, i) in history"
          :key="`${i}-${item.entry.word}`"
          class="idm__item"
          :class="`idm__item--${item.who}`"
        >
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
            <span v-if="homophone && tailPlain" class="idm__target-pinyin">（{{ tailPlain }} 开头{{ homophone ? '或同音' : '' }}）</span>
          </div>
          <div class="idm__input-wrap" @click="inputRef?.focus()">
            <input
              ref="inputRef"
              v-model="input"
              class="idm__input"
              maxlength="4"
              placeholder="输入四字成语"
              @keydown.enter="submitWord"
            />
            <button class="btn btn-primary idm__submit" @click="submitWord">接龙</button>
          </div>
          <div v-if="feedback" class="idm__feedback" :class="`idm__feedback--${feedback.type}`">{{ feedback.text }}</div>
          <div class="idm__tools">
            <button class="btn btn-ghost btn-sm" @click="giveHints">💡 提示候选字</button>
            <button class="btn btn-ghost btn-sm" @click="skipRound">🔄 换一题（连击清零）</button>
            <div v-if="showHints" class="idm__hint-chars anim-fade">
              可以接：<span v-for="ch in hintChars" :key="ch" class="idm__hint-char">{{ ch }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 查询 -->
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

    <ResultDialog :visible="showVictory" title="🏆 电脑被你难住了！" :message="victoryInfo" @close="showVictory = false">
      <template #actions>
        <button class="btn btn-primary" @click="startRound">再来一局</button>
      </template>
    </ResultDialog>
  </GameShell>
</template>

<style scoped>
.idm {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: min(680px, 94vw);
}

.idm__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 80px 0;
  color: var(--muted);
}

.idm__spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #c7d2fe;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.idm__hud {
  display: flex;
  gap: 30px;
  padding: 10px 28px;
}

.idm__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.idm__label {
  font-size: 12px;
  color: var(--muted);
}

.idm__value {
  font-size: 20px;
  font-weight: 700;
}

.idm__chain {
  width: 100%;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}

.idm__item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.idm__who {
  flex-shrink: 0;
  width: 38px;
  font-size: 12px;
  color: var(--muted);
  text-align: center;
  padding-top: 8px;
}

.idm__item--me {
  flex-direction: row-reverse;
}

.idm__item--me .idm__who {
  color: #4f46e5;
}

.idm__item--me .idm__body {
  background: #eef2ff;
}

.idm__item--pc .idm__body {
  background: #f0fdf4;
}

.idm__body {
  border-radius: 10px;
  padding: 8px 14px;
  max-width: 78%;
}

.idm__word {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 4px;
}

.idm__char--tail {
  color: var(--danger);
}

.idm__char--head {
  color: var(--primary);
}

.idm__pinyin {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.idm__expl {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
  line-height: 1.6;
}

.idm__thinking {
  color: var(--muted);
  font-size: 14px;
  padding: 4px 12px;
}

.idm__input-row {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.idm__target {
  padding: 8px 20px;
  font-size: 15px;
}

.idm__target-char {
  color: var(--danger);
  font-size: 22px;
  margin: 0 2px;
}

.idm__target-pinyin {
  color: var(--muted);
  font-size: 13px;
}

.idm__input-wrap {
  display: flex;
  gap: 8px;
  width: 100%;
  justify-content: center;
}

.idm__input {
  flex: 0 1 300px;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 6px;
  padding: 10px 14px;
  border: 2px solid var(--border);
  border-radius: 12px;
  outline: none;
  font-family: inherit;
}

.idm__input:focus {
  border-color: var(--primary);
}

.idm__input--search {
  flex: 1;
  text-align: left;
  letter-spacing: 1px;
  font-size: 16px;
  font-weight: 400;
}

.idm__feedback {
  min-height: 22px;
  font-size: 15px;
}

.idm__feedback--ok {
  color: var(--success);
}

.idm__feedback--err {
  color: var(--danger);
}

.idm__tools {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}

.idm__homo--off {
  border-color: #fcd34d;
}

.idm__hint-chars {
  font-size: 14px;
  color: var(--muted);
}

.idm__hint-char {
  display: inline-block;
  margin: 0 3px;
  padding: 2px 8px;
  background: #fef9c3;
  border-radius: 6px;
  color: #92400e;
  font-weight: 700;
}

.idm--search {
  gap: 12px;
}

.idm__search-bar {
  display: flex;
  gap: 8px;
  width: 100%;
}

.idm__results {
  width: 100%;
  max-height: 460px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.idm__empty {
  color: #94a3b8;
  text-align: center;
  padding: 30px 0;
}

.idm__result-word {
  font-size: 20px;
  font-weight: 800;
}

.idm__result .idm__pinyin {
  display: inline-block;
  margin-left: 8px;
}
</style>

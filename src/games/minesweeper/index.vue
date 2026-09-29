<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import GameShell from '../../components/GameShell.vue'
import DifficultySelect from '../../components/DifficultySelect.vue'
import ResultDialog from '../../components/ResultDialog.vue'
import { chord, countFlags, createGame, DIFFICULTIES, reveal, toggleFlag, type Game, type GameConfig } from './engine'
import { sounds } from '../../composables/useSound'
import { formatDuration, getRecord, submitRecord } from '../../composables/useBestRecord'

type Diff = 'beginner' | 'intermediate' | 'expert'

const diffNames: Record<Diff, string> = {
  beginner: '初级 9×9',
  intermediate: '中级 16×16',
  expert: '高级 16×30',
}

const diff = ref<Diff>('beginner')
const showDiff = ref(true)
const game = ref<Game>(createGame(DIFFICULTIES.beginner))
const startTime = ref<number | null>(null)
const now = ref(Date.now())
const showWin = ref(false)
const showLose = ref(false)
const elapsedMs = ref(0)
const newBest = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const bestKey = computed(() => `minesweeper.${diff.value}`)
const bestTime = computed(() => getRecord(bestKey.value))
const flagsLeft = computed(() => game.value.config.mines - countFlags(game.value))

const numColors = ['', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#b45309', '#0891b2', '#334155', '#6b7280']

function start(d: Diff) {
  diff.value = d
  game.value = createGame(DIFFICULTIES[d])
  showDiff.value = false
  startTime.value = null
  elapsedMs.value = 0
  showWin.value = false
  showLose.value = false
  newBest.value = false
  stopTimer()
}

function ensureTimer() {
  if (startTime.value == null) {
    startTime.value = Date.now()
    timer = setInterval(() => (now.value = Date.now()), 500)
  }
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

function onReveal(r: number, c: number) {
  if (game.value.status === 'won' || game.value.status === 'lost') return
  ensureTimer()
  const prev = game.value
  game.value = reveal(prev, r, c)
  if (game.value.status === 'lost') {
    stopTimer()
    elapsedMs.value = now.value - (startTime.value ?? now.value)
    sounds.lose()
    showLose.value = true
  } else if (game.value.status === 'won') {
    stopTimer()
    elapsedMs.value = Date.now() - (startTime.value ?? Date.now())
    const rec = submitRecord(bestKey.value, elapsedMs.value, 'min')
    newBest.value = rec != null
    sounds.win()
    showWin.value = true
  } else if (game.value !== prev) {
    sounds.click()
  }
}

function onFlag(r: number, c: number) {
  if (game.value.status === 'won' || game.value.status === 'lost') return
  game.value = toggleFlag(game.value, r, c)
  sounds.click()
}

function onChord(r: number, c: number) {
  if (game.value.status === 'won' || game.value.status === 'lost') return
  const before = game.value
  game.value = chord(before, r, c)
  if (game.value.status === 'lost') {
    stopTimer()
    elapsedMs.value = now.value - (startTime.value ?? now.value)
    sounds.lose()
    showLose.value = true
  } else if (game.value.status === 'won') {
    stopTimer()
    elapsedMs.value = Date.now() - (startTime.value ?? Date.now())
    const rec = submitRecord(bestKey.value, elapsedMs.value, 'min')
    newBest.value = rec != null
    sounds.win()
    showWin.value = true
  }
}

const timeDisplay = computed(() =>
  formatDuration(startTime.value == null ? 0 : Math.max(0, (game.value.status === 'playing' ? now.value : startTime.value + elapsedMs.value) - startTime.value)),
)

onUnmounted(stopTimer)

function changeDifficulty() {
  stopTimer()
  showDiff.value = true
}
</script>

<template>
  <GameShell title="扫雷" :subtitle="diffNames[diff]">
    <template #actions>
      <button class="btn btn-ghost btn-sm" @click="changeDifficulty">换难度</button>
      <button class="btn btn-primary btn-sm" @click="start(diff)">重新开始</button>
    </template>

    <div class="ms">
      <div class="ms__hud panel">
        <div class="ms__stat">
          <span class="ms__stat-label">剩余雷数</span>
          <span class="ms__stat-value">💣 {{ flagsLeft }}</span>
        </div>
        <div class="ms__stat">
          <span class="ms__stat-label">用时</span>
          <span class="ms__stat-value">⏱ {{ timeDisplay }}</span>
        </div>
        <div class="ms__stat">
          <span class="ms__stat-label">最佳</span>
          <span class="ms__stat-value">{{ bestTime ? formatDuration(bestTime.value) : '—' }}</span>
        </div>
      </div>
      <p class="ms__hint">左键翻开 · 右键插旗 🚩 · 双击数字快速展开周围</p>

      <div class="ms__board-wrap">
        <div
          class="ms__board"
          :style="{ gridTemplateColumns: `repeat(${game.config.cols}, var(--cell))`, '--cell': game.config.cols > 20 ? '28px' : game.config.cols > 10 ? '34px' : '44px' }"
        >
          <template v-for="(row, r) in game.board" :key="`row-${r}`">
            <button
              v-for="(cell, c) in row"
              :key="`${r}-${c}`"
              class="ms__cell"
              :class="{
                'ms__cell--revealed': cell.revealed,
                'ms__cell--mine': cell.revealed && cell.mine,
                'ms__cell--boom': cell.revealed && cell.mine && game.status === 'lost',
              }"
              @click="onReveal(r, c)"
              @contextmenu.prevent="onFlag(r, c)"
              @dblclick.prevent="onChord(r, c)"
            >
              <template v-if="cell.revealed">
                <span v-if="cell.mine">💥</span>
                <span v-else-if="cell.adjacent > 0" :style="{ color: numColors[cell.adjacent] }">{{ cell.adjacent }}</span>
              </template>
              <template v-else-if="cell.flagged">🚩</template>
            </button>
          </template>
        </div>
      </div>
    </div>

    <DifficultySelect
      v-if="showDiff"
      title="选择难度"
      :options="[
        { value: 'beginner', label: '初级 9×9 · 10 雷', desc: '新手友好' },
        { value: 'intermediate', label: '中级 16×16 · 40 雷', desc: '小有挑战' },
        { value: 'expert', label: '高级 16×30 · 99 雷', desc: '高手之路' },
      ]"
      @select="(v) => start(v as Diff)"
    />

    <ResultDialog
      :visible="showWin"
      title="🎉 排雷成功！"
      :message="`用时 ${formatDuration(elapsedMs)}${newBest ? ' · 新纪录！' : ''}`"
      @close="showWin = false"
    >
      <template #actions>
        <button class="btn btn-primary" @click="start(diff)">再来一局</button>
      </template>
    </ResultDialog>

    <ResultDialog
      :visible="showLose"
      title="💥 踩到雷了"
      message="看看雷区复盘一下，再来！"
      @close="showLose = false"
    >
      <template #actions>
        <button class="btn btn-primary" @click="start(diff)">再来一局</button>
      </template>
    </ResultDialog>
  </GameShell>
</template>

<style scoped>
.ms {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.ms__hud {
  display: flex;
  gap: 26px;
  padding: 10px 24px;
}

.ms__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.ms__stat-label {
  font-size: 12px;
  color: var(--muted);
}

.ms__stat-value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ms__hint {
  color: var(--muted);
  font-size: 14px;
  margin: 0;
}

.ms__board-wrap {
  max-width: 100%;
  overflow: auto;
  padding: 4px;
}

.ms__board {
  display: grid;
  gap: 3px;
  background: #cbd5e1;
  padding: 6px;
  border-radius: 10px;
}

.ms__cell {
  width: var(--cell);
  height: var(--cell);
  border: none;
  border-radius: 5px;
  background: linear-gradient(160deg, #f8fafc, #e2e8f0);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.08);
  font-size: calc(var(--cell) * 0.52);
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.1s ease;
}

.ms__cell:hover {
  background: linear-gradient(160deg, #ffffff, #cbd5e1);
}

.ms__cell--revealed {
  background: #f1f5f9;
  box-shadow: none;
  cursor: default;
}

.ms__cell--mine {
  background: #fee2e2;
}

.ms__cell--boom {
  background: #dc2626;
}
</style>

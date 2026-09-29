<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import GameShell from '../../components/GameShell.vue'
import ResultDialog from '../../components/ResultDialog.vue'
import { createGame, move, type Direction, type GameState } from './engine'
import { sounds } from '../../composables/useSound'
import { getRecord, submitRecord } from '../../composables/useBestRecord'

const BEST_KEY = 'g2048'

const state = ref<GameState>(createGame())
const best = ref<number | null>(getRecord(BEST_KEY)?.value ?? null)
const spawnCells = ref<Set<string>>(new Set())
const mergeCells = ref<Set<string>>(new Set())
const showWin = ref(false)
const showLose = ref(false)
const winDismissed = ref(false)

const scoreDisplay = computed(() => state.value.score)

const tileColors: Record<number, { bg: string; color: string }> = {
  2: { bg: '#eee4da', color: '#776e65' },
  4: { bg: '#ede0c8', color: '#776e65' },
  8: { bg: '#f2b179', color: '#fff' },
  16: { bg: '#f59563', color: '#fff' },
  32: { bg: '#f67c5f', color: '#fff' },
  64: { bg: '#f65e3b', color: '#fff' },
  128: { bg: '#edcf72', color: '#fff' },
  256: { bg: '#edcc61', color: '#fff' },
  512: { bg: '#edc850', color: '#fff' },
  1024: { bg: '#edc53f', color: '#fff' },
  2048: { bg: '#edc22e', color: '#fff' },
}

function tileStyle(v: number) {
  const c = tileColors[v] ?? { bg: '#3c3a32', color: '#fff' }
  return { background: c.bg, color: c.color }
}

function fontSize(v: number): string {
  if (v >= 1024) return '26px'
  if (v >= 128) return '32px'
  if (v >= 64) return '36px'
  return '42px'
}

function doMove(dir: Direction) {
  if (showWin.value || showLose.value) return
  const r = move(state.value, dir)
  if (!r.moved) return
  state.value = r.state
  spawnCells.value = new Set(r.spawned.map(([a, b]) => `${a}-${b}`))
  mergeCells.value = new Set(r.merged.map(([a, b]) => `${a}-${b}`))
  sounds.move()
  if (state.value.score > (best.value ?? 0)) {
    const rec = submitRecord(BEST_KEY, state.value.score, 'max')
    if (rec) best.value = rec.value
  }
  if (state.value.won && !winDismissed.value) {
    showWin.value = true
    sounds.win()
  } else if (state.value.over) {
    showLose.value = true
    sounds.lose()
  }
}

function newGame() {
  state.value = createGame()
  spawnCells.value = new Set()
  mergeCells.value = new Set()
  showWin.value = false
  showLose.value = false
  winDismissed.value = false
  sounds.click()
}

function keepGoing() {
  state.value = { ...state.value, keepGoing: true }
  winDismissed.value = true
  showWin.value = false
  sounds.click()
}

function keyHandler(e: KeyboardEvent) {
  const map: Record<string, Direction> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right',
    W: 'up',
    S: 'down',
    A: 'left',
    D: 'right',
  }
  const dir = map[e.key]
  if (dir) {
    e.preventDefault()
    doMove(dir)
  }
}

onMounted(() => window.addEventListener('keydown', keyHandler))
onUnmounted(() => window.removeEventListener('keydown', keyHandler))
</script>

<template>
  <GameShell title="2048" subtitle="合并数字，冲击 2048">
    <template #actions>
      <button class="btn btn-primary btn-sm" @click="newGame">新游戏</button>
    </template>

    <div class="board-wrap">
      <div class="hud">
        <div class="hud__score panel">
          <div class="hud__label">分数</div>
          <div class="hud__value">{{ scoreDisplay }}</div>
        </div>
        <div class="hud__score panel">
          <div class="hud__label">最高分</div>
          <div class="hud__value">{{ best ?? '—' }}</div>
        </div>
      </div>
      <p class="hint">方向键或 WASD 移动，相同数字会合并。达成 2048 获胜！</p>

      <div class="board">
        <div v-for="(row, r) in state.grid" :key="r" class="board__row">
          <div
            v-for="(v, c) in row"
            :key="c"
            class="cell"
            :class="{
              'cell--spawn': v !== 0 && spawnCells.has(`${r}-${c}`),
              'cell--merge': v !== 0 && mergeCells.has(`${r}-${c}`) && !spawnCells.has(`${r}-${c}`),
            }"
            :style="v !== 0 ? tileStyle(v) : undefined"
          >
            <span v-if="v !== 0" :style="{ fontSize: fontSize(v) }">{{ v }}</span>
          </div>
        </div>
      </div>
    </div>

    <ResultDialog :visible="showWin" title="🎉 恭喜达成 2048！" message="太厉害了！可以继续挑战更大的数字。">
      <template #actions>
        <button class="btn btn-ghost" @click="newGame">重新开始</button>
        <button class="btn btn-primary" @click="keepGoing">继续挑战</button>
      </template>
    </ResultDialog>

    <ResultDialog :visible="showLose" title="😵 无法移动了" :message="`本局分数：${state.score}`">
      <template #actions>
        <button class="btn btn-primary" @click="newGame">再来一局</button>
      </template>
    </ResultDialog>
  </GameShell>
</template>

<style scoped>
.board-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.hud {
  display: flex;
  gap: 14px;
}

.hud__score {
  min-width: 120px;
  text-align: center;
  padding: 10px 20px;
}

.hud__label {
  font-size: 13px;
  color: var(--muted);
}

.hud__value {
  font-size: 26px;
  font-weight: 800;
}

.hint {
  color: var(--muted);
  font-size: 14px;
  margin: 0;
}

.board {
  background: #bbada0;
  border-radius: 14px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 8px 24px rgba(120, 90, 60, 0.25);
}

.board__row {
  display: flex;
  gap: 10px;
}

.cell {
  width: 92px;
  height: 92px;
  border-radius: 8px;
  background: rgba(238, 228, 218, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
}

.cell--spawn {
  animation: g-pop 0.2s ease both;
}

.cell--merge {
  animation: g-merge 0.22s ease both;
}

@keyframes g-pop {
  0% {
    transform: scale(0);
  }
  70% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes g-merge {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}
</style>

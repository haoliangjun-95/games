<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import GameShell from '../../components/GameShell.vue'
import DifficultySelect from '../../components/DifficultySelect.vue'
import ResultDialog from '../../components/ResultDialog.vue'
import { generatePuzzle, isSolved, slide, slideByDirection } from './engine'
import { sounds } from '../../composables/useSound'
import { getRecord, submitRecord } from '../../composables/useBestRecord'

type Size = 3 | 4 | 5

const sizeNames: Record<Size, string> = { 3: '3×3', 4: '4×4', 5: '5×5' }

const showDiff = ref(true)
const size = ref<Size>(4)
const tiles = ref<number[]>([])
const steps = ref(0)
const showWin = ref(false)
const newBest = ref(false)

const CELL = 84
const GAP = 8
const PAD = 14

const bestKey = computed(() => `klotski.${size.value}`)
const best = computed(() => getRecord(bestKey.value))

function start(s: Size) {
  size.value = s
  tiles.value = generatePuzzle(s)
  steps.value = 0
  showDiff.value = false
  showWin.value = false
  newBest.value = false
  sounds.click()
}

/** 每个滑块当前所在坐标（相对 padding box，需加上 PAD 偏移） */
function pos(index: number) {
  return {
    left: `${PAD + (index % size.value) * (CELL + GAP)}px`,
    top: `${PAD + Math.floor(index / size.value) * (CELL + GAP)}px`,
  }
}

function onTile(index: number) {
  if (showWin.value) return
  const [next, moved] = slide(tiles.value, size.value, index)
  if (!moved) return
  tiles.value = next
  steps.value++
  sounds.move()
  checkWin()
}

function onKey(e: KeyboardEvent) {
  const map: Record<string, 'up' | 'down' | 'left' | 'right'> = {
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
  if (!dir || showWin.value) return
  e.preventDefault()
  const [next, moved] = slideByDirection(tiles.value, size.value, dir)
  if (!moved) return
  tiles.value = next
  steps.value++
  sounds.move()
  checkWin()
}

function checkWin() {
  if (isSolved(tiles.value)) {
    const rec = submitRecord(bestKey.value, steps.value, 'min')
    newBest.value = rec != null
    showWin.value = true
    sounds.win()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <GameShell title="数字华容道" :subtitle="`${sizeNames[size]} · ${steps} 步`">
    <template #actions>
      <button class="btn btn-ghost btn-sm" @click="showDiff = true">换规格</button>
      <button class="btn btn-primary btn-sm" @click="start(size)">重新打乱</button>
    </template>

    <div class="kl">
      <div class="kl__hud panel">
        <div class="kl__stat">
          <span class="kl__label">步数</span>
          <span class="kl__value">{{ steps }}</span>
        </div>
        <div class="kl__stat">
          <span class="kl__label">最佳（{{ sizeNames[size] }}）</span>
          <span class="kl__value">{{ best ? `${best.value} 步` : '—' }}</span>
        </div>
      </div>
      <p class="kl__hint">点击空格旁边的数字块滑动，也可用方向键 / WASD。把数字按 1、2、3… 顺序复原！</p>

      <div class="kl__board">
        <button
          v-for="(v, i) in tiles"
          v-show="v !== 0"
          :key="v"
          class="kl__tile"
          :class="{ 'kl__tile--home': v === i + 1 }"
          :style="pos(i)"
          @click="onTile(i)"
        >
          {{ v }}
        </button>
      </div>
    </div>

    <DifficultySelect
      v-if="showDiff"
      title="选择规格"
      :options="[
        { value: 3, label: '3×3（8 块）', desc: '入门热身' },
        { value: 4, label: '4×4（15 块）', desc: '经典规格' },
        { value: 5, label: '5×5（24 块）', desc: '高手挑战' },
      ]"
      @select="(v) => start(Number(v) as Size)"
    />

    <ResultDialog
      :visible="showWin"
      title="🎉 复原成功！"
      :message="`${sizeNames[size]} 盘面，共用了 ${steps} 步${newBest ? ' · 新纪录！' : ''}`"
      @close="showWin = false"
    >
      <template #actions>
        <button class="btn btn-primary" @click="start(size)">再来一局</button>
      </template>
    </ResultDialog>
  </GameShell>
</template>

<style scoped>
.kl {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.kl__hud {
  display: flex;
  gap: 30px;
  padding: 10px 26px;
}

.kl__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.kl__label {
  font-size: 12px;
  color: var(--muted);
}

.kl__value {
  font-size: 20px;
  font-weight: 700;
}

.kl__hint {
  color: var(--muted);
  font-size: 14px;
  margin: 0;
}

.kl__board {
  position: relative;
  background: linear-gradient(150deg, #78350f, #92400e);
  border-radius: 16px;
  padding: 14px;
  margin: 4px;
  box-shadow:
    inset 0 0 24px rgba(0, 0, 0, 0.35),
    0 10px 26px rgba(146, 64, 14, 0.35);
  width: v-bind('`${size * CELL + (size - 1) * GAP + 28}px`');
  height: v-bind('`${size * CELL + (size - 1) * GAP + 28}px`');
}

.kl__tile {
  position: absolute;
  width: 84px;
  height: 84px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(160deg, #fef3c7, #fde68a);
  color: #92400e;
  font-size: 34px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 -4px 0 rgba(146, 64, 14, 0.18),
    0 3px 8px rgba(0, 0, 0, 0.25);
  transition:
    left 0.14s ease,
    top 0.14s ease;
}

.kl__tile:hover {
  filter: brightness(1.04);
}

.kl__tile--home {
  background: linear-gradient(160deg, #fca5a5, #f87171);
  color: #fff;
}

.kl__tile:active {
  transform: scale(0.97);
}
</style>

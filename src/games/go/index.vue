<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import GameShell from '../../components/GameShell.vue'
import DifficultySelect from '../../components/DifficultySelect.vue'
import ResultDialog from '../../components/ResultDialog.vue'
import { createGame, other, passTurn, playMove, scoreGame, type GoState, type Player } from './engine'
import { computeGoMove, type Difficulty } from './ai'
import { sounds } from '../../composables/useSound'

type Mode = 'pvp' | 'pve-black' | 'pve-white'
type Size = 9 | 13 | 19

const modeNames: Record<Mode, string> = {
  pvp: '双人对战',
  'pve-black': '人机 · 我执黑',
  'pve-white': '人机 · 我执白',
}
const diffNames: Record<Difficulty, string> = { easy: '简单', medium: '中等', hard: '较强' }

const showMode = ref(true)
const showSize = ref(false)
const showDiff = ref(false)
const mode = ref<Mode>('pve-black')
const boardSize = ref<Size>(9)
const difficulty = ref<Difficulty>('easy')

const states = ref<GoState[]>([createGame(9)])
const showResult = ref(false)
const aiThinking = ref(false)
const hover = ref<[number, number] | null>(null)
const resignedBy = ref<Player | null>(null)

const state = computed(() => states.value[states.value.length - 1]!)
const aiPlayer = computed<Player | null>(() => (mode.value === 'pvp' ? null : mode.value === 'pve-black' ? 2 : 1))
const humanTurn = computed(() => !state.value.over && !aiThinking.value && (aiPlayer.value == null || state.value.player !== aiPlayer.value))
const score = computed(() => (state.value.over && resignedBy.value == null ? scoreGame(state.value.board) : null))
const moveCount = computed(() => states.value.length - 1)

const subtitle = computed(() => {
  const base = `${modeNames[mode.value]} · ${boardSize.value} 路${aiPlayer.value ? ` · ${diffNames[difficulty.value]}` : ''}`
  const status = state.value.over
    ? '对局结束'
    : `${state.value.player === 1 ? '黑棋' : '白棋'}行棋${aiThinking.value ? '（电脑思考中…）' : ''} · 第 ${moveCount.value + 1} 手`
  return `${base} · ${status}`
})

const resultTitle = computed(() => {
  if (resignedBy.value != null) {
    const winner = resignedBy.value === 1 ? '白棋' : '黑棋'
    return `${winner}中盘胜`
  }
  if (!score.value) return ''
  const winner = score.value.black > score.value.white ? '⚫ 黑胜' : '⚪ 白胜'
  return `${winner} ${Math.abs(score.value.black - score.value.white).toFixed(1)} 目`
})

const resultMessage = computed(() => {
  if (resignedBy.value != null) return '对方认输，胜不骄败不馁！'
  if (!score.value) return ''
  return `黑 ${score.value.black} 目 · 白 ${score.value.white} 目（含贴目 7.5）`
})

// ===== Canvas =====
const CELL_MAP: Record<Size, number> = { 9: 52, 13: 40, 19: 30 }
const PAD_MAP: Record<Size, number> = { 9: 34, 13: 30, 19: 26 }
const CELL = computed(() => CELL_MAP[boardSize.value])
const PAD = computed(() => PAD_MAP[boardSize.value])
const BOARD_PX = computed(() => PAD.value * 2 + CELL.value * (boardSize.value - 1))
const canvasRef = ref<HTMLCanvasElement | null>(null)

function starPoints(size: Size): Array<[number, number]> {
  if (size === 9) return [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]]
  if (size === 13) return [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]]
  const out: Array<[number, number]> = []
  for (const r of [3, 9, 15]) for (const c of [3, 9, 15]) out.push([r, c])
  return out
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const W = BOARD_PX.value
  if (canvas.width !== W * dpr) {
    canvas.width = W * dpr
    canvas.height = W * dpr
  }
  const ctx = canvas.getContext('2d')!
  const s = state.value
  const cell = CELL.value
  const pad = PAD.value
  const px = (c: number) => pad + c * cell
  const py = (r: number) => pad + r * cell

  ctx.save()
  ctx.scale(dpr, dpr)
  // 木底
  const bg = ctx.createLinearGradient(0, 0, W, W)
  bg.addColorStop(0, '#f5dfae')
  bg.addColorStop(0.5, '#eed295')
  bg.addColorStop(1, '#e4c37e')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, W)
  // 网格
  ctx.strokeStyle = '#8a6a3a'
  ctx.lineWidth = 1
  for (let i = 0; i < s.size; i++) {
    line(ctx, pad, py(i), W - pad, py(i))
    line(ctx, px(i), pad, px(i), W - pad)
  }
  ctx.lineWidth = 2.4
  ctx.strokeRect(pad - 3, pad - 3, W - (pad - 3) * 2, W - (pad - 3) * 2)
  // 星位
  ctx.fillStyle = '#8a6a3a'
  for (const [r, c] of starPoints(boardSize.value)) {
    ctx.beginPath()
    ctx.arc(px(c), py(r), Math.max(2.5, cell * 0.09), 0, Math.PI * 2)
    ctx.fill()
  }
  // 棋子
  for (let r = 0; r < s.size; r++) {
    for (let c = 0; c < s.size; c++) {
      const v = s.board[r]![c]!
      if (v === 0) continue
      drawStone(ctx, px(c), py(r), v as Player)
    }
  }
  // 悬停虚影
  if (hover.value && humanTurn.value && s.board[hover.value[0]]![hover.value[1]] === 0) {
    drawStone(ctx, px(hover.value[1]), py(hover.value[0]), s.player, true)
  }
  // 最后一手标记
  if (s.lastMove) {
    const [lr, lc] = s.lastMove
    ctx.strokeStyle = s.board[lr]![lc] === 1 ? '#fff' : '#111'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(px(lc), py(lr), cell * 0.16, 0, Math.PI * 2)
    ctx.stroke()
  }
  // 终局领地标记
  if (score.value) {
    for (const [r, c, p] of score.value.territory) {
      const m = cell * 0.18
      ctx.fillStyle = p === 1 ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)'
      ctx.strokeStyle = p === 1 ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.rect(px(c) - m, py(r) - m, m * 2, m * 2)
      ctx.fill()
      ctx.stroke()
    }
  }
  ctx.restore()
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, player: Player, ghost = false) {
  const radius = CELL.value / 2 - 2
  ctx.save()
  ctx.globalAlpha = ghost ? 0.4 : 1
  if (!ghost) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath()
    ctx.arc(x + 1.5, y + 2, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  const g = ctx.createRadialGradient(x - radius / 3, y - radius / 3, radius / 8, x, y, radius)
  if (player === 1) {
    g.addColorStop(0, '#565656')
    g.addColorStop(1, '#0b0b0b')
  } else {
    g.addColorStop(0, '#ffffff')
    g.addColorStop(1, '#d8d8d8')
  }
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = player === 1 ? '#000' : '#b5b5b5'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function eventToCell(e: MouseEvent): [number, number] | null {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const scale = BOARD_PX.value / rect.width
  const x = (e.clientX - rect.left) * scale
  const y = (e.clientY - rect.top) * scale
  const c = Math.round((x - PAD.value) / CELL.value)
  const r = Math.round((y - PAD.value) / CELL.value)
  if (r < 0 || r >= boardSize.value || c < 0 || c >= boardSize.value) return null
  return [r, c]
}

function onCanvasClick(e: MouseEvent) {
  const cell = eventToCell(e)
  if (!cell || !humanTurn.value) return
  tryMove(cell[0], cell[1])
}

function tryMove(r: number, c: number) {
  const mr = playMove(state.value, r, c)
  if (!mr) {
    sounds.error()
    return
  }
  states.value.push(mr.state)
  if (mr.captured > 0) sounds.capture()
  else sounds.move()
  if (mr.state.over) {
    sounds.win()
    showResult.value = true
    return
  }
  maybeAiMove()
}

function onPass() {
  if (state.value.over || aiThinking.value) return
  if (aiPlayer.value != null && state.value.player !== aiPlayer.value) return
  applyPass()
}

function applyPass() {
  const next = passTurn(state.value)
  states.value.push(next)
  sounds.click()
  if (next.over) {
    sounds.win()
    showResult.value = true
    return
  }
  maybeAiMove()
}

function resign() {
  if (state.value.over || aiThinking.value) return
  // 当前行棋方认输
  resignedBy.value = state.value.player
  states.value.push({ ...state.value, over: true })
  sounds.lose()
  showResult.value = true
}

function maybeAiMove() {
  if (state.value.over || aiPlayer.value == null || state.value.player !== aiPlayer.value) return
  aiThinking.value = true
  const snapshot = state.value
  const ai = aiPlayer.value
  const diff = difficulty.value
  setTimeout(() => {
    // 局面可能已被悔棋改变
    if (states.value[states.value.length - 1] !== snapshot) {
      aiThinking.value = false
      return
    }
    const mv = computeGoMove(snapshot, ai, diff)
    aiThinking.value = false
    if (snapshot.over) return
    if (mv == null) {
      applyPass()
    } else {
      tryMove(mv[0], mv[1])
    }
  }, 120)
}

// ===== 流程 =====
function pickMode(m: Mode) {
  mode.value = m
  showSize.value = true
}

function pickSize(s: string | number) {
  boardSize.value = Number(s) as Size
  if (mode.value === 'pvp') startGame()
  else showDiff.value = true
}

function startGame() {
  states.value = [createGame(boardSize.value)]
  showResult.value = false
  aiThinking.value = false
  resignedBy.value = null
  showMode.value = false
  showSize.value = false
  showDiff.value = false
  sounds.click()
}

function undo() {
  if (aiThinking.value || states.value.length <= 1) return
  const steps = aiPlayer.value == null ? 1 : 2
  states.value.splice(Math.max(1, states.value.length - steps), steps)
  // 保证轮到人类
  if (aiPlayer.value != null && states.value[states.value.length - 1]!.player === aiPlayer.value && states.value.length > 1) {
    states.value.pop()
  }
  resignedBy.value = null
  showResult.value = false
  sounds.click()
}

watch(
  () => [states.value, hover.value, boardSize.value],
  () => draw(),
  { deep: true },
)

onMounted(() => requestAnimationFrame(draw))
</script>

<template>
  <GameShell title="围棋" :subtitle="subtitle">
    <template #actions>
      <button class="btn btn-ghost btn-sm" @click="showMode = true">换设置</button>
      <button class="btn btn-ghost btn-sm" :disabled="states.length <= 1 || aiThinking" @click="undo">↩ 悔棋</button>
      <button class="btn btn-ghost btn-sm" :disabled="state.over || !humanTurn" @click="onPass">⏭ 虚手</button>
      <button class="btn btn-danger btn-sm" :disabled="state.over || aiThinking" @click="resign">🏳 认输</button>
      <button class="btn btn-primary btn-sm" @click="startGame">重新开始</button>
    </template>

    <div class="go">
      <div class="go__side panel">
        <div class="go__turn">
          <span class="go__stone" :class="state.player === 1 ? 'go__stone--b' : 'go__stone--w'" />
          <span>{{
            state.over
              ? '对局结束'
              : aiThinking
                ? '电脑思考中…'
                : `${state.player === 1 ? '黑棋' : '白棋'}行棋`
          }}</span>
        </div>
        <div class="go__caps">
          <div>⚫ 黑提子 <b>{{ state.captures[1] }}</b></div>
          <div>⚪ 白提子 <b>{{ state.captures[2] }}</b></div>
          <div class="go__moves">手数 {{ moveCount }}</div>
        </div>
        <p class="go__tip">小提示：金角银边草肚皮——先占角，再守边。终局后自动按中国规则数子（白贴 7.5 目）。</p>
      </div>

      <canvas
        ref="canvasRef"
        class="go__board"
        :style="{ width: `${BOARD_PX}px`, height: `${BOARD_PX}px` }"
        @click="onCanvasClick"
        @mousemove="hover = eventToCell($event)"
        @mouseleave="hover = null"
      />
    </div>

    <DifficultySelect
      v-if="showMode"
      title="选择对战模式"
      :options="[
        { value: 'pve-black', label: '人机对战 · 我执黑先行', desc: '电脑陪你练棋' },
        { value: 'pve-white', label: '人机对战 · 我执白后行', desc: '让电脑先走' },
        { value: 'pvp', label: '双人对战', desc: '和朋友面对面切磋' },
      ]"
      @select="(v) => pickMode(v as Mode)"
    />

    <DifficultySelect
      v-if="showSize"
      title="选择棋盘"
      :options="[
        { value: 9, label: '9 路小棋盘', desc: '最适合入门，几手就能围地' },
        { value: 13, label: '13 路中棋盘', desc: '进阶练习' },
        { value: 19, label: '19 路标准棋盘', desc: '正式比赛规格' },
      ]"
      @select="pickSize"
      @cancel="showSize = false"
    />

    <DifficultySelect
      v-if="showDiff"
      title="选择电脑难度"
      :options="[
        { value: 'easy', label: '简单', desc: '适合刚学会规则' },
        { value: 'medium', label: '中等', desc: '会吃子逃子' },
        { value: 'hard', label: '较强', desc: '攻防更有章法' },
      ]"
      @select="(v) => { difficulty = v as Difficulty; startGame() }"
      @cancel="showDiff = false"
    />

    <ResultDialog :visible="showResult" :title="resultTitle" :message="resultMessage" @close="showResult = false">
      <template #actions>
        <button class="btn btn-primary" @click="startGame">再来一局</button>
        <button class="btn btn-ghost" @click="showResult = false; showMode = true">换设置</button>
      </template>
    </ResultDialog>
  </GameShell>
</template>

<style scoped>
.go {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
  justify-content: center;
}

.go__side {
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.go__turn {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 700;
}

.go__stone {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-block;
}

.go__stone--b {
  background: radial-gradient(circle at 35% 35%, #565656, #0b0b0b);
}

.go__stone--w {
  background: radial-gradient(circle at 35% 35%, #fff, #d8d8d8);
  border: 1px solid #bbb;
}

.go__caps {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 15px;
  color: var(--muted);
}

.go__caps b {
  color: var(--text);
  font-size: 17px;
}

.go__moves {
  font-size: 13px;
}

.go__tip {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.7;
}

.go__board {
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(120, 80, 30, 0.3);
  cursor: pointer;
  max-width: 92vw;
  height: auto !important;
}
</style>

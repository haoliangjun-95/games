<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GameShell from '../../components/GameShell.vue'
import DifficultySelect from '../../components/DifficultySelect.vue'
import ResultDialog from '../../components/ResultDialog.vue'
import { checkWinAt, createBoard, isBoardFull, opponentOf, SIZE, type Board, type Player } from './engine'
import { computeMove, type Difficulty } from './ai'
import { sounds } from '../../composables/useSound'

type Mode = 'pvp' | 'pve-black' | 'pve-white'

const modeNames: Record<Mode, string> = {
  'pvp': '双人对战',
  'pve-black': `人机 · 我执黑`,
  'pve-white': '人机 · 我执白',
}
const diffNames: Record<Difficulty, string> = { easy: '简单', medium: '中等', hard: '困难' }

const showMode = ref(true)
const showDiff = ref(false)
const mode = ref<Mode>('pve-black')
const difficulty = ref<Difficulty>('medium')

const board = ref<Board>(createBoard())
const history = ref<Array<{ r: number; c: number; p: Player }>>([])
const currentPlayer = ref<Player>(1)
const winner = ref<Player | 'draw' | null>(null)
const winLine = ref<Array<[number, number]> | null>(null)
const aiThinking = ref(false)
const hover = ref<[number, number] | null>(null)
const showResult = ref(false)

// 战绩（人机模式）：{wins, losses, draws}
const statsKey = computed(() => `gomoku.${mode.value === 'pvp' ? 'pvp' : mode.value + '.' + difficulty.value}`)
const stats = ref<Record<string, number>>(loadStats())

function loadStats(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(statsKey.value) ?? '{}')
  } catch {
    return {}
  }
}
function bumpStats(kind: 'wins' | 'losses' | 'draws') {
  const s = { ...stats.value, [kind]: (stats.value[kind] ?? 0) + 1 }
  stats.value = s
  localStorage.setItem(statsKey.value, JSON.stringify(s))
}

const aiPlayer = computed<Player | null>(() => {
  if (mode.value === 'pvp') return null
  return mode.value === 'pve-black' ? 2 : 1
})
const subtitle = computed(() =>
  `${modeNames[mode.value]}${mode.value !== 'pvp' ? ` · ${diffNames[difficulty.value]}` : ''} · 第 ${history.value.length + 1} 手`,
)

// ===== Canvas =====
const CELL = 36
const PAD = 30
const BOARD_PX = PAD * 2 + CELL * (SIZE - 1)
const canvasRef = ref<HTMLCanvasElement | null>(null)

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== BOARD_PX * dpr) {
    canvas.width = BOARD_PX * dpr
    canvas.height = BOARD_PX * dpr
  }
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.scale(dpr, dpr)
  // 木纹底色
  const grad = ctx.createLinearGradient(0, 0, BOARD_PX, BOARD_PX)
  grad.addColorStop(0, '#f3d9a4')
  grad.addColorStop(0.5, '#eccb87')
  grad.addColorStop(1, '#e3bd72')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, BOARD_PX, BOARD_PX)
  // 网格
  ctx.strokeStyle = '#8a6a3a'
  ctx.lineWidth = 1
  for (let i = 0; i < SIZE; i++) {
    const p = PAD + i * CELL
    ctx.beginPath()
    ctx.moveTo(PAD, p)
    ctx.lineTo(BOARD_PX - PAD, p)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(p, PAD)
    ctx.lineTo(p, BOARD_PX - PAD)
    ctx.stroke()
  }
  // 星位
  ctx.fillStyle = '#8a6a3a'
  for (const [r, c] of [
    [3, 3],
    [3, 11],
    [11, 3],
    [11, 11],
    [7, 7],
  ]) {
    ctx.beginPath()
    ctx.arc(PAD + c * CELL, PAD + r * CELL, 3.2, 0, Math.PI * 2)
    ctx.fill()
  }
  // 棋子
  const last = history.value[history.value.length - 1]
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board.value[r]![c]!
      if (v === 0) continue
      drawStone(ctx, PAD + c * CELL, PAD + r * CELL, v as Player)
    }
  }
  // 悬停虚影
  if (hover.value && !winner.value && board.value[hover.value[0]]![hover.value[1]] === 0 && isHumanTurn()) {
    drawStone(ctx, PAD + hover.value[1]! * CELL, PAD + hover.value[0]! * CELL, currentPlayer.value, true)
  }
  // 最后一手标记
  if (last) {
    ctx.strokeStyle = currentPlayerColorInverse(last.p)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(PAD + last.c * CELL, PAD + last.r * CELL, 5, 0, Math.PI * 2)
    ctx.stroke()
  }
  // 获胜连线
  if (winLine.value) {
    const pts = winLine.value
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.85)'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(PAD + pts[0]![1] * CELL, PAD + pts[0]![0] * CELL)
    ctx.lineTo(PAD + pts[pts.length - 1]![1] * CELL, PAD + pts[pts.length - 1]![0] * CELL)
    ctx.stroke()
  }
  ctx.restore()
}

function currentPlayerColorInverse(p: Player): string {
  return p === 1 ? '#fff' : '#111'
}

function drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, player: Player, ghost = false) {
  ctx.save()
  ctx.globalAlpha = ghost ? 0.4 : 1
  const radius = CELL / 2 - 2
  const g = ctx.createRadialGradient(x - radius / 3, y - radius / 3, radius / 8, x, y, radius)
  if (player === 1) {
    g.addColorStop(0, '#5a5a5a')
    g.addColorStop(1, '#0a0a0a')
  } else {
    g.addColorStop(0, '#ffffff')
    g.addColorStop(1, '#d6d6d6')
  }
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = player === 1 ? '#000' : '#b8b8b8'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function eventToCell(e: MouseEvent): [number, number] | null {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const scale = BOARD_PX / rect.width
  const x = (e.clientX - rect.left) * scale
  const y = (e.clientY - rect.top) * scale
  const c = Math.round((x - PAD) / CELL)
  const r = Math.round((y - PAD) / CELL)
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null
  return [r, c]
}

function isHumanTurn(): boolean {
  if (winner.value) return false
  if (aiPlayer.value == null) return true
  return currentPlayer.value !== aiPlayer.value
}

function onCanvasClick(e: MouseEvent) {
  const cell = eventToCell(e)
  if (!cell) return
  tryPlace(cell[0], cell[1])
}

function onCanvasMove(e: MouseEvent) {
  const cell = eventToCell(e)
  hover.value = cell
}

function tryPlace(r: number, c: number) {
  if (!isHumanTurn() || aiThinking.value) return
  if (board.value[r]![c] !== 0) return
  applyMove(r, c, currentPlayer.value)
}

function applyMove(r: number, c: number, p: Player) {
  board.value[r]![c] = p
  history.value.push({ r, c, p })
  const line = checkWinAt(board.value, r, c)
  if (line) {
    winner.value = p
    winLine.value = line
    sounds.win()
    if (aiPlayer.value != null) bumpStats(p === aiPlayer.value ? 'losses' : 'wins')
    showResult.value = true
  } else if (isBoardFull(board.value)) {
    winner.value = 'draw'
    sounds.click()
    if (aiPlayer.value != null) bumpStats('draws')
    showResult.value = true
  } else {
    sounds.move()
    currentPlayer.value = opponentOf(p)
    maybeAiMove()
  }
}

// ===== AI 调用（Worker 优先，file:// 场景回退主线程）=====
let worker: Worker | null = null
let workerFailed = false

function ensureWorker(): Worker | null {
  if (workerFailed || __OFFLINE__) return null // 单文件离线模式下直接走主线程
  if (worker) return worker
  try {
    worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })
    return worker
  } catch {
    workerFailed = true
    return null
  }
}

function maybeAiMove() {
  if (winner.value || aiPlayer.value == null || currentPlayer.value !== aiPlayer.value) return
  aiThinking.value = true
  const boardCopy = board.value.map((row) => row.slice())
  const player = aiPlayer.value
  const diff = difficulty.value
  const w = ensureWorker()
  if (w) {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg)
      aiThinking.value = false
      const { move } = ev.data as { move: [number, number] | null }
      if (move && !winner.value) applyMove(move[0], move[1], player)
    }
    const onErr = () => {
      w.removeEventListener('message', onMsg)
      workerFailed = true
      worker = null
      runMainThread()
    }
    w.addEventListener('message', onMsg)
    w.addEventListener('error', onErr, { once: true })
    w.postMessage({ board: boardCopy, player, difficulty: diff })
  } else {
    runMainThread()
  }

  function runMainThread() {
    // 让「思考中」先渲染出来
    setTimeout(() => {
      const move = computeMove(boardCopy, player, diff)
      aiThinking.value = false
      if (move && !winner.value) applyMove(move[0], move[1], player)
    }, 60)
  }
}

// ===== 流程控制 =====
function pickMode(m: Mode) {
  mode.value = m
  if (m === 'pvp') {
    startGame()
  } else {
    showDiff.value = true
  }
}

function startGame() {
  board.value = createBoard()
  history.value = []
  currentPlayer.value = 1
  winner.value = null
  winLine.value = null
  aiThinking.value = false
  showResult.value = false
  stats.value = loadStats()
  showMode.value = false
  showDiff.value = false
  // AI 执黑先走
  if (aiPlayer.value === 1) {
    setTimeout(() => maybeAiMove(), 100)
  }
}

function undo() {
  if (aiThinking.value || history.value.length === 0) return
  const steps = aiPlayer.value == null ? 1 : Math.min(2, history.value.length)
  for (let i = 0; i < steps; i++) {
    const mv = history.value.pop()!
    board.value[mv.r]![mv.c] = 0
  }
  winner.value = null
  winLine.value = null
  showResult.value = false
  currentPlayer.value = history.value.length % 2 === 0 ? 1 : 2
  sounds.click()
}

const resultTitle = computed(() => {
  if (winner.value === 'draw') return '🤝 平局！'
  if (winner.value == null) return ''
  if (aiPlayer.value == null) return winner.value === 1 ? '⚫ 黑棋获胜！' : '⚪ 白棋获胜！'
  return winner.value === aiPlayer.value ? '😮 电脑赢了' : '🎉 你赢了！'
})

watch(
  () => [board.value, hover.value, winLine.value, history.value.length],
  () => draw(),
  { deep: true },
)

onMounted(() => startWatch())
function startWatch() {
  // 首帧绘制
  requestAnimationFrame(draw)
}
onBeforeUnmount(() => {
  worker?.terminate()
})
</script>

<template>
  <GameShell title="五子棋" :subtitle="subtitle">
    <template #actions>
      <button class="btn btn-ghost btn-sm" @click="showMode = true">换模式</button>
      <button class="btn btn-ghost btn-sm" :disabled="!history.length || aiThinking" @click="undo">↩ 悔棋</button>
      <button class="btn btn-primary btn-sm" @click="startGame">重新开始</button>
    </template>

    <div class="gmk">
      <div class="gmk__side panel">
        <div class="gmk__turn">
          <span class="gmk__stone" :class="currentPlayer === 1 ? 'gmk__stone--b' : 'gmk__stone--w'" />
          <span>{{ winner ? '对局结束' : aiThinking ? '电脑思考中…' : currentPlayer === 1 ? '黑棋行棋' : '白棋行棋' }}</span>
        </div>
        <div v-if="aiPlayer" class="gmk__stats">
          <span>战绩（{{ modeNames[mode] }}·{{ diffNames[difficulty] }}）</span>
          <span><b class="gmk__win">{{ stats.wins ?? 0 }}</b> 胜 <b class="gmk__loss">{{ stats.losses ?? 0 }}</b> 负 {{ stats.draws ?? 0 }} 平</span>
        </div>
        <p class="gmk__tip">小提示：先手活三、双三进攻最凶，防守要堵住对手的「两头空」。</p>
      </div>

      <canvas
        ref="canvasRef"
        class="gmk__board"
        :style="{ width: `${BOARD_PX}px`, height: `${BOARD_PX}px` }"
        @click="onCanvasClick"
        @mousemove="onCanvasMove"
        @mouseleave="hover = null"
      />
    </div>

    <DifficultySelect
      v-if="showMode"
      title="选择对战模式"
      :options="[
        { value: 'pve-black', label: '人机对战 · 我执黑先行', desc: '电脑陪你练棋' },
        { value: 'pve-white', label: '人机对战 · 我执白后行', desc: '让电脑先走' },
        { value: 'pvp', label: '双人对战', desc: '和好朋友面对面切磋' },
      ]"
      @select="(v) => pickMode(v as Mode)"
    />

    <DifficultySelect
      v-if="showDiff"
      title="选择电脑难度"
      :options="[
        { value: 'easy', label: '简单', desc: '适合刚学会规则' },
        { value: 'medium', label: '中等', desc: '会攻会守，有点厉害' },
        { value: 'hard', label: '困难', desc: '深算四步，高手挑战' },
      ]"
      @select="(v) => { difficulty = v as Difficulty; startGame() }"
      @cancel="showDiff = false"
    />

    <ResultDialog :visible="showResult" :title="resultTitle" @close="showResult = false">
      <template #actions>
        <button class="btn btn-primary" @click="startGame">再来一局</button>
        <button class="btn btn-ghost" @click="showResult = false; showMode = true">换模式</button>
      </template>
    </ResultDialog>
  </GameShell>
</template>

<style scoped>
.gmk {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
  justify-content: center;
}

.gmk__side {
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gmk__turn {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 700;
}

.gmk__stone {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-block;
}

.gmk__stone--b {
  background: radial-gradient(circle at 35% 35%, #5a5a5a, #0a0a0a);
}

.gmk__stone--w {
  background: radial-gradient(circle at 35% 35%, #fff, #d6d6d6);
  border: 1px solid #bbb;
}

.gmk__stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  color: var(--muted);
}

.gmk__win {
  color: var(--success);
  font-size: 16px;
}

.gmk__loss {
  color: var(--danger);
  font-size: 16px;
}

.gmk__tip {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.6;
}

.gmk__board {
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(120, 80, 30, 0.3);
  cursor: pointer;
  max-width: 92vw;
  height: auto !important;
}
</style>

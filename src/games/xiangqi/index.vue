<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GameShell from '../../components/GameShell.vue'
import DifficultySelect from '../../components/DifficultySelect.vue'
import ResultDialog from '../../components/ResultDialog.vue'
import {
  applyMove,
  capturedPiece,
  gameStatus,
  initialBoard,
  isInCheck,
  legalMoves,
  moveToNotation,
  other,
  PIECE_NAMES,
  type Board,
  type Move,
  type Side,
} from './engine'
import { computeMove, type Difficulty } from './ai'
import { sounds } from '../../composables/useSound'

type Mode = 'pvp' | 'pve-red' | 'pve-black'

const modeNames: Record<Mode, string> = {
  pvp: '双人对战',
  'pve-red': '人机 · 我执红',
  'pve-black': '人机 · 我执黑',
}
const diffNames: Record<Difficulty, string> = { easy: '简单', medium: '中等', hard: '困难' }

const showMode = ref(true)
const showDiff = ref(false)
const mode = ref<Mode>('pve-red')
const difficulty = ref<Difficulty>('medium')

const board = ref<Board>(initialBoard())
const turn = ref<Side>('red')
const selected = ref<[number, number] | null>(null)
const lastMove = ref<Move | null>(null)
const history = ref<Array<{ move: Move; notation: string; captured: string | null }>>([])
const gameOver = ref<{ winner: Side; reason: string } | null>(null)
const showResult = ref(false)
const aiThinking = ref(false)
const inCheckNow = ref<Side | null>(null)

const aiSide = computed<Side | null>(() => {
  if (mode.value === 'pvp') return null
  return mode.value === 'pve-red' ? 'black' : 'red'
})
const humanSide = computed<Side | null>(() => (aiSide.value ? other(aiSide.value) : null))
const subtitle = computed(() => {
  const base = `${modeNames[mode.value]}${aiSide.value ? ` · ${diffNames[difficulty.value]}` : ''}`
  const turnText = gameOver.value ? '对局结束' : `${turn.value === 'red' ? '红方' : '黑方'}行棋${aiThinking.value ? '（电脑思考中…）' : ''}`
  return `${base} · ${turnText}`
})

const legalTargets = computed<Array<[number, number]>>(() => {
  if (!selected.value) return []
  const [r, c] = selected.value
  return legalMoves(board.value, turn.value)
    .filter((m) => m.from[0] === r && m.from[1] === c)
    .map((m) => m.to)
})

// ===== Canvas =====
const CELL = 58
const PAD = 42
const W = PAD * 2 + CELL * 8
const H = PAD * 2 + CELL * 9
const canvasRef = ref<HTMLCanvasElement | null>(null)

const px = (c: number) => PAD + c * CELL
const py = (r: number) => PAD + r * CELL

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== W * dpr) {
    canvas.width = W * dpr
    canvas.height = H * dpr
  }
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.scale(dpr, dpr)

  // 木底
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#f7e3b5')
  bg.addColorStop(0.5, '#f0d494')
  bg.addColorStop(1, '#e6c37e')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 外框
  ctx.strokeStyle = '#7a5a2e'
  ctx.lineWidth = 3
  ctx.strokeRect(PAD - 6, PAD - 6, W - (PAD - 6) * 2, H - (PAD - 6) * 2)

  // 网格
  ctx.strokeStyle = '#8a6a3a'
  ctx.lineWidth = 1.2
  for (let r = 0; r < 10; r++) {
    line(ctx, px(0), py(r), px(8), py(r))
  }
  for (let c = 0; c < 9; c++) {
    if (c === 0 || c === 8) {
      line(ctx, px(c), py(0), px(c), py(9))
    } else {
      // 中间断开：楚河汉界
      line(ctx, px(c), py(0), px(c), py(4))
      line(ctx, px(c), py(5), px(c), py(9))
    }
  }
  // 九宫斜线
  line(ctx, px(3), py(0), px(5), py(2))
  line(ctx, px(5), py(0), px(3), py(2))
  line(ctx, px(3), py(7), px(5), py(9))
  line(ctx, px(5), py(7), px(3), py(9))

  // 楚河汉界
  ctx.fillStyle = '#8a6a3a'
  ctx.font = '600 30px "Kaiti SC", "STKaiti", "KaiTi", serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.save()
  ctx.globalAlpha = 0.8
  ctx.fillText('楚  河', px(2), py(4.5))
  ctx.fillText('汉  界', px(6), py(4.5))
  ctx.restore()

  // 最后一手标记
  if (lastMove.value) {
    const [fr, fc] = lastMove.value.from
    const [tr, tc] = lastMove.value.to
    ctx.strokeStyle = 'rgba(220,38,38,0.6)'
    ctx.lineWidth = 2.5
    corner(ctx, px(fc), py(fr))
    corner(ctx, px(tc), py(tr))
  }

  // 选中高亮
  if (selected.value) {
    const [r, c] = selected.value
    ctx.fillStyle = 'rgba(255, 200, 0, 0.35)'
    ctx.beginPath()
    ctx.arc(px(c), py(r), CELL * 0.52, 0, Math.PI * 2)
    ctx.fill()
  }

  // 可走点
  for (const [r, c] of legalTargets.value) {
    const target = board.value[r]![c]
    if (target) {
      // 吃子提示圈
      ctx.strokeStyle = 'rgba(22,163,74,0.9)'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(px(c), py(r), CELL * 0.5, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.fillStyle = 'rgba(22,163,74,0.85)'
      ctx.beginPath()
      ctx.arc(px(c), py(r), 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 棋子
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board.value[r]![c]
      if (!p) continue
      drawPiece(ctx, px(c), py(r), p.side, PIECE_NAMES[p.side][p.type], inCheckNow.value === p.side && p.type === 'K')
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

function corner(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const s = 9
  ctx.beginPath()
  ctx.moveTo(x - s - 4, y - s)
  ctx.lineTo(x - s - 4, y - s - 4)
  ctx.lineTo(x - s, y - s - 4)
  ctx.moveTo(x + s, y - s - 4)
  ctx.lineTo(x + s + 4, y - s - 4)
  ctx.lineTo(x + s + 4, y - s)
  ctx.moveTo(x + s + 4, y + s)
  ctx.lineTo(x + s + 4, y + s + 4)
  ctx.lineTo(x + s, y + s + 4)
  ctx.moveTo(x - s, y + s + 4)
  ctx.lineTo(x - s - 4, y + s + 4)
  ctx.lineTo(x - s - 4, y + s)
  ctx.stroke()
}

function drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, side: Side, name: string, checked: boolean) {
  const radius = CELL * 0.46
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.arc(x + 2, y + 3, radius, 0, Math.PI * 2)
  ctx.fill()
  // 底
  const g = ctx.createRadialGradient(x - radius / 3, y - radius / 3, radius / 6, x, y, radius)
  g.addColorStop(0, '#fff8ea')
  g.addColorStop(1, '#e8d5ad')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = side === 'red' ? '#c0392b' : '#222'
  ctx.lineWidth = 2.4
  ctx.stroke()
  // 内圈
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, radius - 4, 0, Math.PI * 2)
  ctx.stroke()
  // 字
  ctx.fillStyle = side === 'red' ? '#c0392b' : '#1a1a1a'
  ctx.font = `700 ${CELL * 0.48}px "Kaiti SC", "STKaiti", "KaiTi", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, x, y + 1)
  // 被将军提示
  if (checked) {
    ctx.strokeStyle = 'rgba(220,38,38,0.9)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function onCanvasClick(e: MouseEvent) {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const scaleX = W / rect.width
  const scaleY = H / rect.height
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY
  const c = Math.round((x - PAD) / CELL)
  const r = Math.round((y - PAD) / CELL)
  if (r < 0 || r > 9 || c < 0 || c > 8) return

  if (gameOver.value || aiThinking.value) return
  if (humanSide.value && turn.value !== humanSide.value) return

  const target = board.value[r]![c]
  if (selected.value) {
    const [sr, sc] = selected.value
    if (r === sr && c === sc) {
      selected.value = null
      return
    }
    const canMove = legalTargets.value.some(([tr, tc]) => tr === r && tc === c)
    if (canMove) {
      doMove({ from: [sr, sc], to: [r, c] })
      return
    }
  }
  if (target && target.side === turn.value) {
    selected.value = [r, c]
    sounds.click()
  } else {
    selected.value = null
  }
}

function doMove(move: Move) {
  const victim = capturedPiece(board.value, move)
  const notation = moveToNotation(board.value, move)
  board.value = applyMove(board.value, move)
  history.value.push({ move, notation, captured: victim ? PIECE_NAMES[victim.side][victim.type] : null })
  lastMove.value = move
  selected.value = null

  if (victim) sounds.capture()
  else sounds.move()

  const nextSide = other(turn.value)
  // 检测终局
  const status = gameStatus(board.value, nextSide)
  const checked = isInCheck(board.value, nextSide)
  inCheckNow.value = checked ? nextSide : null
  if (checked && status === 'playing') {
    // 将军提示音
    setTimeout(() => sounds.error(), 120)
  }

  if (status !== 'playing') {
    gameOver.value = { winner: other(nextSide), reason: checked ? '绝杀！' : '困毙（无棋可走）' }
    if (aiSide.value) {
      sounds[gameOver.value.winner === aiSide.value ? 'lose' : 'win']()
    } else {
      sounds.win()
    }
    showResult.value = true
    return
  }
  turn.value = nextSide
  maybeAiMove()
}

// ===== AI =====
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
  if (gameOver.value || aiSide.value == null || turn.value !== aiSide.value) return
  aiThinking.value = true
  const boardCopy = board.value.map((row) => row.map((p) => (p ? { ...p } : null)))
  const side = aiSide.value
  const diff = difficulty.value
  const w = ensureWorker()
  if (w) {
    const onMsg = (ev: MessageEvent) => {
      w.removeEventListener('message', onMsg)
      aiThinking.value = false
      const { move } = ev.data as { move: Move | null }
      if (move && !gameOver.value) doMove(move)
    }
    const onErr = () => {
      w.removeEventListener('message', onMsg)
      workerFailed = true
      worker = null
      runMainThread()
    }
    w.addEventListener('message', onMsg)
    w.addEventListener('error', onErr, { once: true })
    w.postMessage({ board: boardCopy, side, difficulty: diff })
  } else {
    runMainThread()
  }

  function runMainThread() {
    setTimeout(() => {
      const move = computeMove(boardCopy as Board, side, diff)
      aiThinking.value = false
      if (move && !gameOver.value) doMove(move)
    }, 60)
  }
}

// ===== 流程 =====
function pickMode(m: Mode) {
  mode.value = m
  if (m === 'pvp') startGame()
  else showDiff.value = true
}

function startGame() {
  board.value = initialBoard()
  turn.value = 'red'
  selected.value = null
  lastMove.value = null
  history.value = []
  gameOver.value = null
  showResult.value = false
  aiThinking.value = false
  inCheckNow.value = null
  showMode.value = false
  showDiff.value = false
  if (aiSide.value === 'red') setTimeout(() => maybeAiMove(), 150)
}

function undo() {
  if (aiThinking.value || history.value.length === 0) return
  const steps = aiSide.value == null ? 1 : Math.min(2, history.value.length)
  history.value.splice(history.value.length - steps, steps)
  replayFromHistory()
  selected.value = null
  gameOver.value = null
  showResult.value = false
  sounds.click()
}

/** 用当前 history 重放得到棋盘（用于悔棋，避免手工反向恢复被吃子） */
function replayFromHistory() {
  let b = initialBoard()
  for (const entry of history.value) {
    b = applyMove(b, entry.move)
  }
  board.value = b
  turn.value = history.value.length % 2 === 0 ? 'red' : 'black'
  lastMove.value = history.value.length > 0 ? history.value[history.value.length - 1]!.move : null
  inCheckNow.value = isInCheck(b, turn.value) ? turn.value : null
}

const resultTitle = computed(() => {
  if (!gameOver.value) return ''
  const winnerName = gameOver.value.winner === 'red' ? '红方' : '黑方'
  if (aiSide.value) {
    const youWin = gameOver.value.winner === humanSide.value
    return youWin ? '🎉 你赢了！' : `😮 ${winnerName}（电脑）获胜`
  }
  return `🎉 ${winnerName}获胜！`
})

const recentMoves = computed(() =>
  history.value
    .map((h, i) => `${i % 2 === 0 ? i / 2 + 1 + '.' : ''}${h.notation}`)
    .slice(-12)
    .join('  '),
)

watch(
  () => [board.value, selected.value, lastMove.value, legalTargets.value, inCheckNow.value],
  () => draw(),
  { deep: true },
)

onMounted(() => requestAnimationFrame(draw))
onBeforeUnmount(() => worker?.terminate())
</script>

<template>
  <GameShell title="中国象棋" :subtitle="subtitle">
    <template #actions>
      <button class="btn btn-ghost btn-sm" @click="showMode = true">换模式</button>
      <button class="btn btn-ghost btn-sm" :disabled="!history.length || aiThinking" @click="undo">↩ 悔棋</button>
      <button class="btn btn-primary btn-sm" @click="startGame">重新开始</button>
    </template>

    <div class="xq">
      <div class="xq__side">
        <div class="panel xq__status">
          <span v-if="gameOver">🏁 {{ gameOver.reason }}</span>
          <span v-else-if="inCheckNow">⚠️ {{ inCheckNow === 'red' ? '红方被将军！' : '黑方被将军！' }}</span>
          <span v-else-if="aiThinking">🤔 电脑思考中…</span>
          <span v-else>♟️ 轮到{{ turn === 'red' ? '红方' : '黑方' }}</span>
        </div>
        <div class="panel xq__moves">
          <div class="xq__moves-title">着法记录</div>
          <div class="xq__moves-list">{{ recentMoves || '—' }}</div>
        </div>
        <div class="panel xq__legend">
          <div class="xq__moves-title">小提示</div>
          <p>点击自己的棋子，绿点是可以走的位置；圆圈表示可以吃子。马走日、象走田、车炮走直线、炮打隔山子！</p>
        </div>
      </div>
      <canvas
        ref="canvasRef"
        class="xq__board"
        :style="{ width: `${W}px`, height: `${H}px` }"
        @click="onCanvasClick"
      />
    </div>

    <DifficultySelect
      v-if="showMode"
      title="选择对战模式"
      :options="[
        { value: 'pve-red', label: '人机对战 · 我执红先行', desc: '电脑陪你练棋' },
        { value: 'pve-black', label: '人机对战 · 我执黑后行', desc: '让电脑先走' },
        { value: 'pvp', label: '双人对战', desc: '红黑轮流点击棋盘' },
      ]"
      @select="(v) => pickMode(v as Mode)"
    />

    <DifficultySelect
      v-if="showDiff"
      title="选择电脑难度"
      :options="[
        { value: 'easy', label: '简单', desc: '浅算一步，新手友好' },
        { value: 'medium', label: '中等', desc: '算两步，会吃子防守' },
        { value: 'hard', label: '困难', desc: '深算三步＋吃子延伸' },
      ]"
      @select="(v) => { difficulty = v as Difficulty; startGame() }"
      @cancel="showDiff = false"
    />

    <ResultDialog :visible="showResult" :title="resultTitle" :message="gameOver?.reason" @close="showResult = false">
      <template #actions>
        <button class="btn btn-primary" @click="startGame">再来一局</button>
        <button class="btn btn-ghost" @click="showResult = false; showMode = true">换模式</button>
      </template>
    </ResultDialog>
  </GameShell>
</template>

<style scoped>
.xq {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
  justify-content: center;
}

.xq__side {
  width: 250px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.xq__status {
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  padding: 12px;
}

.xq__moves-title {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 6px;
}

.xq__moves-list {
  font-size: 15px;
  line-height: 1.8;
  word-break: break-all;
  max-height: 140px;
  overflow-y: auto;
}

.xq__legend p {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.7;
}

.xq__board {
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(120, 80, 30, 0.35);
  cursor: pointer;
  max-width: 92vw;
  height: auto !important;
}
</style>

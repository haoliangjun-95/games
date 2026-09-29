<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import GameShell from '../../components/GameShell.vue'
import ResultDialog from '../../components/ResultDialog.vue'
import { cardLabel, checkExpression, randomHand, solve24 } from './engine'
import { sounds } from '../../composables/useSound'
import { getRecord, submitRecord } from '../../composables/useBestRecord'

const BEST_KEY = 'game24.streak'

const cards = ref<number[]>([])
const input = ref('')
const feedback = ref<{ type: 'ok' | 'err'; text: string } | null>(null)
const streak = ref(0)
const solvedTotal = ref(0)
const bestStreak = ref<number>(getRecord(BEST_KEY)?.value ?? 0)
const showSolution = ref(false)
const solution = ref<string | null>(null)
const shake = ref(false)
const solvedCurrent = ref(false)

function newHand() {
  cards.value = randomHand()
  input.value = ''
  feedback.value = null
  showSolution.value = false
  solution.value = null
  solvedCurrent.value = false
}

function start() {
  streak.value = 0
  solvedTotal.value = 0
  newHand()
  sounds.click()
}

/** 点牌或符号往算式里追加 */
function append(s: string) {
  if (solvedCurrent.value) return
  input.value += s
  sounds.click()
}

function backspace() {
  input.value = input.value.slice(0, -1)
  sounds.click()
}

function clearInput() {
  input.value = ''
  sounds.click()
}

function submit() {
  if (solvedCurrent.value) return
  const r = checkExpression(input.value, cards.value)
  if (r.ok) {
    solvedCurrent.value = true
    streak.value++
    solvedTotal.value++
    feedback.value = { type: 'ok', text: `✔ 正确！连胜 ${streak.value} 题` }
    sounds.win()
    const rec = submitRecord(BEST_KEY, streak.value, 'max')
    if (rec) bestStreak.value = rec.value
    setTimeout(() => {
      if (solvedCurrent.value) newHand()
    }, 1400)
  } else {
    feedback.value = { type: 'err', text: `✘ ${r.reason ?? '再想想'}` }
    sounds.error()
    shake.value = true
    setTimeout(() => (shake.value = false), 400)
  }
}

function revealSolution() {
  if (solution.value == null) solution.value = solve24(cards.value)
  showSolution.value = true
  streak.value = 0
  sounds.click()
}

function skip() {
  streak.value = 0
  newHand()
  sounds.click()
}

function keyHandler(e: KeyboardEvent) {
  if (showSolution.value) return
  if (e.key === 'Enter') {
    e.preventDefault()
    submit()
    return
  }
  if (e.key === 'Backspace') {
    e.preventDefault()
    backspace()
    return
  }
  const allowed = /^[0-9+\-*/().]$/
  if (e.key.length === 1 && allowed.test(e.key)) {
    e.preventDefault()
    append(e.key)
  } else if (e.key.length === 1 && 'xX×÷'.includes(e.key)) {
    e.preventDefault()
    append(e.key)
  }
}

onMounted(() => {
  window.addEventListener('keydown', keyHandler)
  if (cards.value.length === 0) newHand()
})
onUnmounted(() => window.removeEventListener('keydown', keyHandler))
</script>

<template>
  <GameShell title="24 点" :subtitle="`连胜 ${streak}`">
    <template #actions>
      <button class="btn btn-primary btn-sm" @click="start">重新开始</button>
    </template>

    <div class="g24">
      <div class="g24__hud panel">
        <div class="g24__stat">
          <span class="g24__label">当前连胜</span>
          <span class="g24__value">🔥 {{ streak }}</span>
        </div>
        <div class="g24__stat">
          <span class="g24__label">历史最长连胜</span>
          <span class="g24__value">{{ bestStreak }}</span>
        </div>
        <div class="g24__stat">
          <span class="g24__label">本局已解</span>
          <span class="g24__value">{{ solvedTotal }}</span>
        </div>
      </div>

      <div class="g24__cards" :class="{ 'g24__cards--shake': shake }">
        <div v-for="(c, i) in cards" :key="`${i}-${c}-${cards.join()}`" class="card24 anim-pop">
          <span class="card24__corner">{{ cardLabel(c) }}</span>
          <span class="card24__rank">{{ cardLabel(c) }}</span>
          <span class="card24__corner card24__corner--bottom">{{ cardLabel(c) }}</span>
        </div>
      </div>

      <div class="g24__io">
        <div class="g24__expr" :class="{ 'g24__expr--err': feedback?.type === 'err' }">
          <span v-if="!input" class="g24__placeholder">在此输入算式…</span>
          <template v-else>{{ input }}</template>
        </div>
        <div v-if="feedback" class="g24__feedback" :class="`g24__feedback--${feedback.type}`">{{ feedback.text }}</div>
      </div>

      <div class="g24__keys">
        <button v-for="c in cards" :key="`k-${c}`" class="btn btn-ghost g24__key g24__key--card" @click="append(cardLabel(c))">{{ cardLabel(c) }}</button>
        <button v-for="op in ['+', '-', '×', '÷', '(', ')']" :key="op" class="btn btn-ghost g24__key" @click="append(op)">{{ op }}</button>
        <button class="btn btn-ghost g24__key" @click="backspace">⌫</button>
        <button class="btn btn-ghost g24__key" @click="clearInput">清空</button>
        <button class="btn btn-primary g24__key g24__key--go" @click="submit">提交</button>
      </div>

      <div class="g24__tools">
        <button class="btn btn-ghost btn-sm" @click="revealSolution">看答案（连胜清零）</button>
        <button class="btn btn-ghost btn-sm" @click="skip">换一题（连胜清零）</button>
      </div>
      <p class="g24__hint">用加减乘除（可用括号）把 4 张牌各用一次，算出 24。也可以直接键盘输入，回车提交。</p>
    </div>

    <ResultDialog :visible="showSolution" title="一种解法" :message="solution ?? '无解（不应该出现）'" @close="showSolution = false">
      <template #actions>
        <button class="btn btn-primary" @click="showSolution = false; newHand()">下一题</button>
      </template>
    </ResultDialog>
  </GameShell>
</template>

<style scoped>
.g24 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: min(620px, 94vw);
}

.g24__hud {
  display: flex;
  gap: 28px;
  padding: 10px 26px;
}

.g24__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.g24__label {
  font-size: 12px;
  color: var(--muted);
}

.g24__value {
  font-size: 20px;
  font-weight: 700;
}

.g24__cards {
  display: flex;
  gap: 14px;
}

.g24__cards--shake {
  animation: shake 0.4s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  50% { transform: translateX(8px); }
  75% { transform: translateX(-5px); }
}

.card24 {
  width: 86px;
  height: 120px;
  background: linear-gradient(160deg, #ffffff, #f1f5f9);
  border-radius: 12px;
  border: 2px solid #e2e8f0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.15);
  color: #1e293b;
}

.card24__rank {
  font-size: 44px;
  font-weight: 800;
}

.card24__corner {
  position: absolute;
  top: 6px;
  left: 8px;
  font-size: 16px;
  font-weight: 700;
}

.card24__corner--bottom {
  top: auto;
  left: auto;
  bottom: 6px;
  right: 8px;
  transform: rotate(180deg);
}

.g24__io {
  width: 100%;
  text-align: center;
}

.g24__expr {
  font-size: 26px;
  font-weight: 700;
  background: #fff;
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 12px 18px;
  min-height: 56px;
  color: var(--text);
  letter-spacing: 1px;
  font-family: ui-monospace, Menlo, monospace;
}

.g24__expr--err {
  border-color: var(--danger);
}

.g24__placeholder {
  color: #94a3b8;
  font-weight: 400;
}

.g24__feedback {
  margin-top: 6px;
  font-size: 15px;
  min-height: 22px;
}

.g24__feedback--ok {
  color: var(--success);
}

.g24__feedback--err {
  color: var(--danger);
}

.g24__keys {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.g24__key {
  min-width: 54px;
  height: 48px;
  font-size: 20px;
}

.g24__key--card {
  font-weight: 800;
  border-color: #c7d2fe;
  color: #4338ca;
}

.g24__key--go {
  min-width: 90px;
}

.g24__tools {
  display: flex;
  gap: 12px;
}

.g24__hint {
  color: var(--muted);
  font-size: 13px;
  margin: 0;
  text-align: center;
}
</style>

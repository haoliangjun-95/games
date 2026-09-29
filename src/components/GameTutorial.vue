<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { TutorialStep } from '../games/tutorials'
import { sounds } from '../composables/useSound'

const props = defineProps<{
  visible: boolean
  gameName: string
  steps: TutorialStep[]
}>()

const emit = defineEmits<{ close: [] }>()

const idx = ref(0)

watch(
  () => props.visible,
  (v) => {
    if (v) idx.value = 0
  },
)

const step = computed(() => props.steps[idx.value])
const isLast = computed(() => idx.value === props.steps.length - 1)

function next() {
  if (isLast.value) {
    emit('close')
    sounds.click()
    return
  }
  idx.value++
  sounds.click()
}

function prev() {
  if (idx.value > 0) {
    idx.value--
    sounds.click()
  }
}

function onKey(e: KeyboardEvent) {
  if (!props.visible) return
  if (e.key === 'ArrowRight' || e.key === 'Enter') {
    e.preventDefault()
    next()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prev()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="props.visible" class="tut-overlay" @click.self="emit('close')">
      <div class="tut panel anim-pop">
        <header class="tut__head">
          <span class="tut__badge">🎓 新手教程</span>
          <h2 class="tut__game">{{ props.gameName }}</h2>
          <span class="tut__page">{{ idx + 1 }} / {{ props.steps.length }}</span>
        </header>

        <div :key="idx" class="tut__body tut-in">
          <div class="tut__icon">{{ step!.icon }}</div>
          <h3 class="tut__title">{{ step!.title }}</h3>
          <ul class="tut__lines">
            <li v-for="(line, i) in step!.lines" :key="i">{{ line }}</li>
          </ul>
        </div>

        <footer class="tut__foot">
          <div class="tut__dots">
            <span
              v-for="(_, i) in props.steps"
              :key="i"
              class="tut__dot"
              :class="{ 'tut__dot--on': i === idx }"
              @click="idx = i"
            />
          </div>
          <div class="tut__btns">
            <button class="btn btn-ghost btn-sm" :disabled="idx === 0" @click="prev">上一页</button>
            <button class="btn btn-primary btn-sm" @click="next">
              {{ isLast ? '开始游戏 🎮' : '下一页' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tut-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 150;
  animation: fade-in 0.15s ease both;
}

.tut {
  width: min(560px, 92vw);
  padding: 24px 26px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tut__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tut__badge {
  background: linear-gradient(135deg, #f59e0b, #f43f5e);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.tut__game {
  flex: 1;
  font-size: 22px;
}

.tut__page {
  color: var(--muted);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.tut__body {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 6px 4px;
}

.tut__icon {
  font-size: 56px;
  line-height: 1.2;
}

.tut__title {
  font-size: 20px;
  margin: 8px 0 14px;
}

.tut__lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
  max-width: 440px;
}

.tut__lines li {
  position: relative;
  padding-left: 26px;
  font-size: 15.5px;
  line-height: 1.65;
  color: var(--text);
}

.tut__lines li::before {
  content: '✦';
  position: absolute;
  left: 2px;
  top: 1px;
  color: var(--primary);
  font-size: 14px;
}

.tut__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tut__dots {
  display: flex;
  gap: 7px;
}

.tut__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #c7d2fe;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tut__dot--on {
  background: var(--primary);
  transform: scale(1.3);
}

.tut__btns {
  display: flex;
  gap: 8px;
}

/* 纯 CSS 入场动画：不依赖 JS 帧回调，任何环境都能正确切换内容 */
.tut-in {
  animation: tut-slide-in 0.22s ease both;
}

@keyframes tut-slide-in {
  from {
    opacity: 0;
    transform: translateX(18px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>

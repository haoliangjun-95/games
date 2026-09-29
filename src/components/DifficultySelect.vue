<script setup lang="ts">
import { sounds } from '../composables/useSound'

export interface DifficultyOption<T extends string | number> {
  value: T
  label: string
  desc?: string
}

const props = defineProps<{
  title: string
  options: DifficultyOption<string | number>[]
}>()

const emit = defineEmits<{
  select: [value: string | number]
  cancel: []
}>()

function pick(v: string | number) {
  sounds.click()
  emit('select', v)
}
</script>

<template>
  <div class="diff-overlay">
    <div class="diff-panel panel anim-pop">
      <h2 class="diff-title">{{ props.title }}</h2>
      <div class="diff-list">
        <button
          v-for="opt in props.options"
          :key="String(opt.value)"
          class="diff-item"
          :style="{ background: `linear-gradient(135deg, var(--d1, #5b6cff), var(--d2, #8b5cf6))` }"
          @click="pick(opt.value)"
        >
          <span class="diff-item__label">{{ opt.label }}</span>
          <span v-if="opt.desc" class="diff-item__desc">{{ opt.desc }}</span>
        </button>
      </div>
      <button class="btn btn-ghost diff-cancel" @click="emit('cancel')">取消</button>
    </div>
  </div>
</template>

<style scoped>
.diff-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fade-in 0.15s ease both;
}

.diff-panel {
  width: min(440px, 92vw);
  padding: 28px;
  text-align: center;
}

.diff-title {
  font-size: 22px;
  margin-bottom: 20px;
}

.diff-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.diff-item {
  border: none;
  border-radius: 14px;
  padding: 14px 18px;
  cursor: pointer;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition:
    transform 0.08s ease,
    box-shadow 0.15s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.diff-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
}

.diff-item__label {
  font-size: 19px;
  font-weight: 700;
}

.diff-item__desc {
  font-size: 13px;
  opacity: 0.9;
}

.diff-cancel {
  width: 100%;
}
</style>

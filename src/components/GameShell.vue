<script setup lang="ts">
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import { isMuted, toggleMute, sounds } from '../composables/useSound'

const props = defineProps<{
  title: string
  /** 副标题（如当前难度） */
  subtitle?: string
}>()

const router = useRouter()
const muted = computed(() => isMuted())

function back() {
  sounds.click()
  router.push('/')
}

function onToggleMute() {
  const m = toggleMute()
  if (!m) sounds.click()
}
</script>

<template>
  <div class="shell">
    <header class="shell__bar">
      <button class="btn btn-ghost btn-sm" @click="back">← 返回</button>
      <div class="shell__titles">
        <h1 class="shell__title">{{ props.title }}</h1>
        <span v-if="props.subtitle" class="shell__subtitle">{{ props.subtitle }}</span>
      </div>
      <div class="shell__actions">
        <button
          class="btn btn-ghost btn-sm"
          :title="muted ? '开启声音' : '关闭声音'"
          @click="onToggleMute"
        >
          {{ muted ? '🔇' : '🔊' }}
        </button>
        <slot name="actions" />
      </div>
    </header>
    <main class="shell__body">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  animation: fade-in 0.2s ease both;
}

.shell__bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 22px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 20;
}

.shell__titles {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.shell__title {
  font-size: 20px;
  font-weight: 700;
}

.shell__subtitle {
  color: var(--muted);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shell__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.shell__body {
  flex: 1;
  padding: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>

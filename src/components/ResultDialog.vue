<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  title: string
  message?: string
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="props.visible" class="modal-overlay" @click.self="emit('close')">
      <div class="modal panel anim-pop">
        <h2 class="modal__title">{{ props.title }}</h2>
        <p v-if="props.message" class="modal__message">{{ props.message }}</p>
        <div class="modal__extra">
          <slot />
        </div>
        <div class="modal__actions">
          <slot name="actions">
            <button class="btn btn-primary" @click="emit('close')">好的</button>
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 120;
  animation: fade-in 0.15s ease both;
}

.modal {
  width: min(420px, 92vw);
  padding: 30px 26px;
  text-align: center;
}

.modal__title {
  font-size: 26px;
  margin-bottom: 10px;
}

.modal__message {
  color: var(--muted);
  font-size: 16px;
  margin: 0 0 6px;
  line-height: 1.7;
}

.modal__extra {
  margin-bottom: 4px;
}

.modal__actions {
  margin-top: 18px;
  display: flex;
  gap: 10px;
  justify-content: center;
}
</style>

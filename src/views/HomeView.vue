<script setup lang="ts">
import { useRouter } from 'vue-router'
import { games } from '../games/registry'
import { sounds } from '../composables/useSound'

const router = useRouter()

function enter(id: string) {
  sounds.click()
  router.push(`/game/${id}`)
}
</script>

<template>
  <div class="home">
    <header class="home__hero">
      <div class="home__logo">🧠</div>
      <h1 class="home__title">智益游戏中心</h1>
      <p class="home__slogan">{{ games.length }} 款益智小游戏 · 离线可玩 · 边玩边学</p>
    </header>

    <main class="home__grid">
      <button v-for="g in games" :key="g.id" class="card anim-pop" @click="enter(g.id)">
        <div class="card__icon" :style="{ background: g.gradient }">{{ g.icon }}</div>
        <div class="card__info">
          <div class="card__name">{{ g.name }}</div>
          <div class="card__desc">{{ g.description }}</div>
          <div class="card__tip">{{ g.tip }}</div>
        </div>
        <span class="card__arrow">›</span>
      </button>
    </main>

    <footer class="home__footer">
      棋牌锻炼思维 · 语文积累成语 · 逻辑与运算齐飞
    </footer>
  </div>
</template>

<style scoped>
.home {
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 24px 30px;
}

.home__hero {
  text-align: center;
  margin-bottom: 34px;
  animation: slide-up 0.3s ease both;
}

.home__logo {
  font-size: 56px;
  line-height: 1;
}

.home__title {
  font-size: 34px;
  margin-top: 10px;
  background: linear-gradient(135deg, #4f46e5, #c026d3);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.home__slogan {
  color: var(--muted);
  margin-top: 8px;
  font-size: 16px;
}

.home__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 18px;
}

.card {
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: var(--radius);
  background: var(--card);
  box-shadow: var(--shadow);
  padding: 18px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 26px rgba(79, 70, 229, 0.18);
}

.card:active {
  transform: scale(0.98);
}

.card__icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  flex-shrink: 0;
  box-shadow: inset 0 -6px 12px rgba(0, 0, 0, 0.12);
}

.card__info {
  flex: 1;
  min-width: 0;
}

.card__name {
  font-size: 19px;
  font-weight: 700;
}

.card__desc {
  color: var(--muted);
  font-size: 14px;
  margin-top: 3px;
}

.card__tip {
  color: #94a3b8;
  font-size: 12px;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card__arrow {
  font-size: 26px;
  color: #c7d2fe;
  font-weight: 700;
}

.home__footer {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  margin-top: 36px;
}
</style>

import { createRouter, createWebHashHistory } from 'vue-router'

// 使用 hash 路由：file:// 直接打开 index.html 时也能正常工作
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/game/xiangqi',
      name: 'xiangqi',
      component: () => import('../games/xiangqi/index.vue'),
    },
    {
      path: '/game/gomoku',
      name: 'gomoku',
      component: () => import('../games/gomoku/index.vue'),
    },
    {
      path: '/game/go',
      name: 'go',
      component: () => import('../games/go/index.vue'),
    },
    {
      path: '/game/idiom',
      name: 'idiom',
      component: () => import('../games/idiom/index.vue'),
    },
    {
      path: '/game/sudoku',
      name: 'sudoku',
      component: () => import('../games/sudoku/index.vue'),
    },
    {
      path: '/game/klotski',
      name: 'klotski',
      component: () => import('../games/klotski/index.vue'),
    },
    {
      path: '/game/game24',
      name: 'game24',
      component: () => import('../games/game24/index.vue'),
    },
    {
      path: '/game/minesweeper',
      name: 'minesweeper',
      component: () => import('../games/minesweeper/index.vue'),
    },
    {
      path: '/game/g2048',
      name: 'g2048',
      component: () => import('../games/g2048/index.vue'),
    },
  ],
})

export default router

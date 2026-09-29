import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// base: './' 使产物路径全部相对化
// 普通构建（dist/）: 供 HTTP 服务器 / 调试使用
// 离线单文件构建（dist-offline/）: 全部内联进一个 index.html，
//   双击即可离线游玩（规避浏览器 file:// 下 ES module 外链的 CORS 限制）
export default defineConfig(({ mode }) => {
  const offline = mode === 'offline'
  return {
    base: './',
    plugins: [vue(), ...(offline ? [viteSingleFile()] : [])],
    define: {
      __OFFLINE__: JSON.stringify(offline),
    },
    build: offline
      ? {
          outDir: 'dist-offline',
          target: 'es2020',
          chunkSizeWarningLimit: 12000,
          rollupOptions: {
            output: {
              // 单文件模式：所有动态 import（含成语词典）内联
              inlineDynamicImports: true,
            },
          },
        }
      : {
          target: 'es2020',
          chunkSizeWarningLimit: 6000,
        },
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  }
})

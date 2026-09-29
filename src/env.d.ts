/// <reference types="vite/client" />

/** 离线单文件构建标记（vite.config.ts define 注入）：该模式下禁用 Web Worker，走主线程回退 */
declare const __OFFLINE__: boolean

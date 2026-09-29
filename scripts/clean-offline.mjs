#!/usr/bin/env node
/** 清理单文件构建产物中未使用的 worker 分块（离线模式禁用 Worker，走主线程回退） */
import { readdirSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist-offline')
for (const f of readdirSync(outDir)) {
  if (f.startsWith('ai.worker')) {
    unlinkSync(resolve(outDir, f))
    console.log('removed', f)
  }
}

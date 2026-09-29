/** AI Web Worker：在后台线程计算，避免阻塞 UI */
import { computeMove } from './ai'

self.onmessage = (e: MessageEvent) => {
  const { board, player, difficulty } = e.data as {
    board: number[][]
    player: 1 | 2
    difficulty: 'easy' | 'medium' | 'hard'
  }
  const move = computeMove(board, player, difficulty)
  ;(self as unknown as Worker).postMessage({ move })
}

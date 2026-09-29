/** 象棋 AI Web Worker */
import { computeMove } from './ai'

self.onmessage = (e: MessageEvent) => {
  const { board, side, difficulty } = e.data as {
    board: ({ side: 'red' | 'black'; type: string } | null)[][]
    side: 'red' | 'black'
    difficulty: 'easy' | 'medium' | 'hard'
  }
  const move = computeMove(board as never, side, difficulty)
  ;(self as unknown as Worker).postMessage({ move })
}

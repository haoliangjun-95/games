/** 五子棋核心规则 */

export const SIZE = 15

export type Player = 1 | 2 // 1 黑棋 2 白棋
export type Board = number[][] // SIZE×SIZE，0 空

export function createBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0))
}

export type Dir = [number, number]

export const DIRS: Dir[] = [
  [0, 1], // 横
  [1, 0], // 竖
  [1, 1], // 右下斜
  [1, -1], // 左下斜
]

/** (r,c) 落子后是否五连（返回连成的五个点，未连返回 null） */
export function checkWinAt(board: Board, r: number, c: number): Array<[number, number]> | null {
  const player = board[r]![c]!
  if (player === 0) return null
  for (const [dr, dc] of DIRS) {
    const line: Array<[number, number]> = [[r, c]]
    // 正向
    let nr = r + dr
    let nc = c + dc
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr]![nc] === player) {
      line.push([nr, nc])
      nr += dr
      nc += dc
    }
    // 反向
    nr = r - dr
    nc = c - dc
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr]![nc] === player) {
      line.unshift([nr, nc])
      nr -= dr
      nc -= dc
    }
    if (line.length >= 5) return line.slice(0, 5)
  }
  return null
}

export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((v) => v !== 0))
}

export function place(board: Board, r: number, c: number, player: Player): Board {
  const next = board.map((row) => row.slice())
  next[r]![c] = player
  return next
}

export function opponentOf(p: Player): Player {
  return p === 1 ? 2 : 1
}

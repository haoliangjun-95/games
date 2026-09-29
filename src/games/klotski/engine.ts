/** 数字华容道（N×N 滑块拼图）核心逻辑 */

/** 逆序数判定拼图是否可解（tiles 中 0 表示空格） */
export function isSolvable(tiles: number[], size: number): boolean {
  const arr = tiles.filter((v) => v !== 0)
  let inversions = 0
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i]! > arr[j]!) inversions++
    }
  }
  if (size % 2 === 1) {
    // 奇数宽度：逆序数为偶即可解
    return inversions % 2 === 0
  }
  // 偶数宽度：空格所在行（从底部数，1 起）与逆序数奇偶性需满足：
  // 空格在奇数行 → 逆序偶；空格在偶数行 → 逆序奇
  const blankIndex = tiles.indexOf(0)
  const blankRowFromBottom = size - Math.floor(blankIndex / size)
  const blankOnOddRow = blankRowFromBottom % 2 === 1
  return blankOnOddRow ? inversions % 2 === 0 : inversions % 2 === 1
}

export function isSolved(tiles: number[]): boolean {
  for (let i = 0; i < tiles.length - 1; i++) {
    if (tiles[i] !== i + 1) return false
  }
  return tiles[tiles.length - 1] === 0
}

/** 生成一个可解（且未复原）的乱序盘面 */
export function generatePuzzle(size: number, rng: () => number = Math.random): number[] {
  const tiles = Array.from({ length: size * size }, (_, i) => (i + 1) % (size * size))
  // 用随机交换保证均匀性，直到可解且未复原
  for (let attempt = 0; attempt < 1000; attempt++) {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!]
    }
    if (!isSolved(tiles) && isSolvable(tiles, size)) return tiles
  }
  // 兜底：从复原态做随机合法滑动
  let current = tiles.slice().map((v, i) => (i + 1) % (size * size))
  let blank = current.indexOf(0)
  for (let i = 0; i < size * size * 20; i++) {
    const [br, bc] = [Math.floor(blank / size), blank % size]
    const moves: number[] = []
    if (br > 0) moves.push(blank - size)
    if (br < size - 1) moves.push(blank + size)
    if (bc > 0) moves.push(blank - 1)
    if (bc < size - 1) moves.push(blank + 1)
    const target = moves[Math.floor(rng() * moves.length)]!
    ;[current[blank], current[target]] = [current[target]!, current[blank]!]
    blank = target
  }
  return current
}

/** 点击下标 index 的滑块：若与空格相邻则交换。返回 [新盘面, 是否移动] */
export function slide(tiles: number[], size: number, index: number): [number[], boolean] {
  const blank = tiles.indexOf(0)
  const [ar, ac] = [Math.floor(index / size), index % size]
  const [br, bc] = [Math.floor(blank / size), blank % size]
  const adjacent = Math.abs(ar - br) + Math.abs(ac - bc) === 1
  if (!adjacent) return [tiles, false]
  const next = tiles.slice()
  ;[next[blank], next[index]] = [next[index]!, next[blank]!]
  return [next, true]
}

/** 方向键移动：dir 表示「滑块滑入空格的方向」；返回 [新盘面, 是否移动, 被移动滑块原下标] */
export function slideByDirection(
  tiles: number[],
  size: number,
  dir: 'up' | 'down' | 'left' | 'right',
): [number[], boolean, number] {
  const blank = tiles.indexOf(0)
  const [br, bc] = [Math.floor(blank / size), blank % size]
  let tr = br
  let tc = bc
  // 按方向：空格另一侧的滑块滑入空格
  if (dir === 'up') tr = br + 1
  if (dir === 'down') tr = br - 1
  if (dir === 'left') tc = bc + 1
  if (dir === 'right') tc = bc - 1
  if (tr < 0 || tr >= size || tc < 0 || tc >= size) return [tiles, false, -1]
  const index = tr * size + tc
  const [next, moved] = slide(tiles, size, index)
  return [next, moved, index]
}

/** 最少步数求解（BFS，用于小尺寸提示/验证；大尺寸返回 null） */
export function solve(tiles: number[], size: number, maxNodes = 200000): number[] | null {
  if (isSolved(tiles)) return []
  const target = Array.from({ length: size * size }, (_, i) => (i + 1) % (size * size)).join(',')
  const start = tiles.join(',')
  const queue: string[] = [start]
  const prev = new Map<string, [string, number]>()
  prev.set(start, [start, -1])
  let nodes = 0
  while (queue.length > 0 && nodes < maxNodes) {
    const cur = queue.shift()!
    nodes++
    const arr = cur.split(',').map(Number)
    const blank = arr.indexOf(0)
    const [br, bc] = [Math.floor(blank / size), blank % size]
    const candidates: number[] = []
    if (br > 0) candidates.push(blank - size)
    if (br < size - 1) candidates.push(blank + size)
    if (bc > 0) candidates.push(blank - 1)
    if (bc < size - 1) candidates.push(blank + 1)
    for (const idx of candidates) {
      const next = arr.slice()
      ;[next[blank], next[idx]] = [next[idx]!, next[blank]!]
      const key = next.join(',')
      if (prev.has(key)) continue
      prev.set(key, [cur, idx])
      if (key === target) {
        // 回溯路径
        const path: number[] = []
        let k: string = key
        while (k !== start) {
          const [p, idx] = prev.get(k)!
          path.unshift(idx)
          k = p
        }
        return path
      }
      queue.push(key)
    }
  }
  return null
}

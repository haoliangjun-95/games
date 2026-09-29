export interface GameMeta {
  /** 唯一 id，同时用于路由与成绩存储键 */
  id: string
  name: string
  description: string
  /** emoji 图标 */
  icon: string
  /** 卡片渐变背景色 */
  gradient: string
  /** 一句话玩法提示 */
  tip: string
}

/** 游戏注册表：新增游戏时在此登记即可出现在游戏中心 */
export const games: GameMeta[] = [
  {
    id: 'xiangqi',
    name: '中国象棋',
    description: '楚河汉界，运筹帷幄',
    icon: '♟️',
    gradient: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
    tip: '支持人机对战（三档难度）和双人对战',
  },
  {
    id: 'gomoku',
    name: '五子棋',
    description: '五子连珠，一锤定音',
    icon: '⚫',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
    tip: '支持人机对战（三档难度）和双人对战',
  },
  {
    id: 'go',
    name: '围棋',
    description: '黑白纵横，围地称雄',
    icon: '⚪',
    gradient: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
    tip: '9/13/19 路，人机与双人，终局自动数子',
  },
  {
    id: 'idiom',
    name: '成语接龙',
    description: '妙语连珠，出口成章',
    icon: '📖',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    tip: '支持同音接龙，附成语释义与查询',
  },
  {
    id: 'sudoku',
    name: '数独',
    description: '九宫格里的逻辑风暴',
    icon: '🔢',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
    tip: '四档难度，支持铅笔标记与练习模式',
  },
  {
    id: 'klotski',
    name: '数字华容道',
    description: '滑动数字，还原顺序',
    icon: '🧩',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%)',
    tip: '3×3 / 4×4 / 5×5 三种规格，挑战最少步数',
  },
  {
    id: 'game24',
    name: '24 点',
    description: '四张牌，算出 24',
    icon: '🃏',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #ec4899 100%)',
    tip: '加减乘除任你组合，练好心算',
  },
  {
    id: 'minesweeper',
    name: '扫雷',
    description: '小心脚下，步步为营',
    icon: '💣',
    gradient: 'linear-gradient(135deg, #64748b 0%, #334155 100%)',
    tip: '三档难度，经典玩法',
  },
  {
    id: 'g2048',
    name: '2048',
    description: '合并数字，冲击 2048',
    icon: '🧮',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
    tip: '方向键或 WASD 操作',
  },
]

export function getGame(id: string): GameMeta | undefined {
  return games.find((g) => g.id === id)
}

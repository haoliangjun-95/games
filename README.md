# 🧠 智益游戏中心

面向初中生的**离线益智小游戏合集**，内置 9 款经典游戏，支持两种 Windows PC 交付形态：

1. **网页离线版**：一个 HTML 文件，双击即玩，无需安装任何软件（U 盘拷走也能用）。
2. **Windows 桌面版**：Electron 打包的安装包（exe）与绿色版，像"正经软件"一样双击图标启动。

## 🎮 游戏列表

| 游戏 | 玩法亮点 |
|------|---------|
| ♟️ 中国象棋 | 完整规则（马蹩腿/象眼/炮翻山/将帅照面/将死困毙判定），人机三档难度（Alpha-Beta 剪枝 + 吃子延伸）+ 双人对战，中文记谱 |
| ⚫ 五子棋 | 15×15 经典棋盘，人机三档难度（棋型评估 + Alpha-Beta 搜索）+ 双人对战，胜利连线高亮 |
| ⚪ 围棋 | 9/13/19 路棋盘，完整规则（提子/禁自杀/打劫），人机（启发式 AI）与双人，双虚手终局自动按中国规则数子（白贴 7.5 目）并标注领地 |
| 📖 成语接龙 | 2.9 万条开源成语词典，电脑陪玩接龙，**支持同音接龙**（更适合入门），成语拼音+释义边玩边学，附成语查询 |
| 🔢 数独 | 四档难度（保证唯一解），铅笔候选标记、即时纠错可关（练习模式）、计时暂停、撤销 |
| 🧩 数字华容道 | 3×3 / 4×4 / 5×5 三种规格，逆序数保证可解，滑动动画，最少步数纪录 |
| 🃏 24 点 | 随机发牌保证有解，表达式安全解析（不用 eval），"看答案"给出解法，连胜计分 |
| 💣 扫雷 | 初级/中级/高级三档，首次点击保证安全，右键插旗、双击快开 |
| 🧮 2048 | 方向键 / WASD 操作，最高分纪录，达成 2048 可继续挑战 |

所有游戏**成绩本地保存**（最佳时间/最少步数/最高分/连胜/战绩），**音效由 Web Audio 实时合成**（无外部素材），**完全离线运行**（无任何网络请求）。

## 🚀 快速开始（使用者）

### 网页离线版（最简单）

1. 下载发布页的 `智益游戏中心-离线版.html`（或 Actions 构建产物 `offline-web` 中的 `index.html`）；
2. 双击文件，浏览器打开即玩；
3. 想拷到别的电脑？把这个文件拷过去就行，单文件即全部。

> 提示：推荐使用 Edge / Chrome / Firefox 等现代浏览器。

### Windows 桌面版

1. 下载发布页的 `智益游戏中心-安装包-x.x.x.exe`（安装版，可选安装目录、创建桌面快捷方式）或 `智益游戏中心-绿色版-x.x.x.exe`（免安装，双击直接玩）；
2. 双击启动即可。

## 🛠️ 从源码构建（开发者）

```bash
# 环境要求：Node.js 20+
npm install            # 安装依赖
npm run dev            # 本地开发调试
npm test               # 运行全部单元测试（82 个）

npm run build          # 构建标准网页版（dist/，适合部署到任意静态服务器）
npm run build:offline  # 构建单文件离线版（dist-offline/index.html，双击即玩）
npm run electron:dev   # 本地运行 Electron 壳（调试桌面版）

# Windows exe 打包（在 Windows 机器或 CI 上执行，见下）
npm run electron:build:win
```

### 成语词典数据

成语数据来自开源数据集，仓库中已包含精简版（`src/games/idiom/data.json`）。如需重新生成：

```bash
# 1. 下载原始数据（约 10MB，放入 data-raw/idiom.json）
#    来源：https://github.com/pwxcoo/chinese-xinhua （MIT License）
#    raw.githubusercontent.com 较慢时可用 jsDelivr 镜像：
#    https://cdn.jsdelivr.net/gh/pwxcoo/chinese-xinhua@master/data/idiom.json
# 2. 精简
npm run trim:idiom
```

### 打包 Windows exe

推荐使用仓库自带的 GitHub Actions（推送到 GitHub 后自动可用）：

- `.github/workflows/build-windows.yml` 在 `windows-latest` 上执行测试 → 构建 → electron-builder 打包，产出**安装包、绿色版、离线网页单文件**三份构建产物（Artifacts），推送 tag（如 `v1.0.0`）时同样触发。

在 Windows 本机打包：`npm ci && npm run electron:build:win`（产物在 `release/`）。
macOS 上交叉打包需要 wine，不推荐。

> 💡 网络提示：国内环境安装/运行 Electron 若二进制下载卡住，使用镜像：
> `export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"` 再执行 `node node_modules/electron/install.js`。

## 📦 项目结构

```
├── electron/               # Electron 主进程
├── scripts/                # 成语数据精简等脚本
├── src/
│   ├── components/         # GameShell 顶栏、难度选择、结算弹窗等通用组件
│   ├── composables/        # 合成音效、成绩持久化
│   ├── views/HomeView.vue  # 游戏中心首页
│   └── games/              # 每个游戏一个目录（index.vue 界面 + engine.ts 纯逻辑 + ai.ts + 单测）
│       ├── registry.ts     # 游戏注册表：新游戏在此登记即可上架
│       ├── tutorials.ts    # 各游戏新手教程内容
│       ├── xiangqi/ gomoku/ go/ idiom/ sudoku/ klotski/ game24/ minesweeper/ g2048/
├── .github/workflows/      # Windows 自动打包
└── electron-builder.yml
```

**如何新增游戏**：在 `src/games/<你的游戏>/` 编写 `engine.ts`（纯逻辑+单测）与 `index.vue`（界面），到 `src/games/registry.ts` 登记一条、`src/router/index.ts` 加一条路由即可出现在游戏中心。

## 🧪 测试

```bash
npm test   # 82 个单元测试：各游戏引擎规则、AI 行为、数独唯一解、24点求解器等
```

浏览器端全部 8 款游戏均做过真实交互走查（走子/胜负/记谱/成绩保存）。

## 📄 开源致谢（License & Credits）

本项目基于以下开源项目参考/改造实现（谨致谢意）：

| 项目 | 许可证 | 用途 |
|------|--------|------|
| [pwxcoo/chinese-xinhua](https://github.com/pwxcoo/chinese-xinhua) | MIT | 成语词典数据（`data/idiom.json`） |
| [itlwei/chess](https://github.com/itlwei/chess) | MIT | 中国象棋 HTML5 实现参考 |
| [shibing624/chinese-chess-ai](https://github.com/shibing624/chinese-chess-ai) | Apache-2.0 | 中国象棋 AI 结构参考 |
| [lihongxun945/gobang](https://github.com/lihongxun945/gobang) | MIT | 五子棋 AI 算法参考 |
| [robatron/sudoku.js](https://github.com/robatron/sudoku.js) | MIT | 数独生成/求解思路参考 |
| [arnisritins/15-Puzzle](https://github.com/arnisritins/15-Puzzle) | MIT | 数字华容道交互参考 |
| Vue.js / Vite / Electron / electron-builder | MIT | 技术栈 |

本项目代码以 MIT 许可证开源（见 [LICENSE](LICENSE)）。

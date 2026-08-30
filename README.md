# LOL Tournament Schedule 2026 · Scriptable

一个自动选择当前 LOL 赛事的 Scriptable 赛程小组件。v3.1.0 在保留现有深蓝倒计时卡片 UI 的基础上，通过 Tournament Router 在 LPL、MSI、EWC、LPL 资格赛与 Worlds 之间选择当前比赛日。

## 主要功能

- 支持 Scriptable 小号、中号和大号组件
- 显示官方队伍 Logo，并在 Scriptable 本地缓存图片
- 自动校正官方 Logo 的透明留白，使不同队伍的视觉尺寸更一致
- Logo 缺失或加载失败时自动使用占位图
- 时间、比分和倒计时使用统一的等宽数字字体规范
- 已结束比赛突出胜者并弱化败者，直播与倒计时使用独立强调色
- 长队名自动缩放，比分、时间和倒计时使用稳定的固定宽度区域
- 支持深蓝、浅色和自动跟随系统外观三种主题模式
- SMART 模式优先选择今天有比赛且优先级最高的赛事，否则选择最近未来比赛日
- 赛事日期、优先级和赛程路径集中维护在 `data/tournaments.json`
- 比赛副标题显示第三赛段所属的登峰组或涅槃组
- 进入骑士之路和淘汰赛后自动切换为实际赛事阶段，不再显示组别
- 未开始显示时间，进行中显示 `LIVE`，结束后显示比分
- 中号和大号自动显示当天全部比赛，中号在 3 场时自动使用紧凑布局
- 中号三场使用真机优化的密集间距，避免标题和页脚被系统裁切
- 可高亮关注队伍
- 四层数据回退：
  1. Tournament Router 生成的 `data/active.json`
  2. v3.0.0 兼容数据 `data/schedule.json`
  3. LPL 官方赛事页面
  4. Scriptable 本地缓存
- GitHub 状态滞后时，开赛后直接补查官方状态接口
- 官方状态暂不可用时，开赛 10 分钟后推定为进行中并持续快速刷新
- 点击组件打开官方赛程页面
- 默认点击组件或比赛区域打开哔哩哔哩 LPL 直播间，可在设置中切回官方页面
- 设置菜单可临时预览中号单场布局，不改变桌面组件的真实赛程

## 项目结构

```text
LPL-Scriptable/
├── LPL-Schedule.js          主组件
├── LPL-Design-System.js     可复用的配色与设计规范
├── Installer.js             一键安装器
├── data/
│   ├── tournaments.json     集中式赛事元数据
│   ├── active.json          当前 SMART 选择结果
│   ├── schedules/           按赛事拆分的标准化赛程
│   └── schedule.json        v3.0.0 兼容 LPL 赛程
├── scripts/
│   ├── update-schedule.js   LPL 官方赛程同步脚本
│   ├── build-tournament-data.js
│   └── generate-active.js
├── src/
│   └── tournament-router.js SMART 赛事选择模块
├── tests/                   数据转换与解析回归测试
├── .github/workflows/
│   └── update-schedule.yml  定时更新赛程
├── docs/
│   └── style-reference.jpeg 风格参考图
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## 上传到 GitHub

请将项目文件上传到仓库根目录：

```text
braziliany/LPL-Scriptable
```

上传完成后，主脚本和安装器中预设的 Raw 地址即可生效。

未提交候选版本的 iPhone 验收请使用 [Scriptable 真机回归流程](docs/scriptable-device-regression.md)。该流程通过本地生成的 `Installer-Dev.js` 安装独立的 `LPL Schedule DEV`，不会覆盖正式脚本或读取 GitHub `main` 数据。

## 安装方法一：使用安装器

1. 在 GitHub 打开 `Installer.js`
2. 点击 **Raw**
3. 全选复制
4. 在 Scriptable 新建临时脚本并粘贴
5. 运行安装器
6. 安装器会自动创建：
   - `LPL-Design-System`
   - `LPL Schedule 2026`
   - `LPL Schedule Installer`
7. 以后只需运行 `LPL Schedule Installer` 完成全量更新

> 如果手机里只有旧版安装器，必须从 GitHub 重新复制一次最新 `Installer.js`。旧安装器不会自动更新自身，因此只会安装主脚本。

固定更新入口会在写入前：

- 比较本地与 GitHub 远端版本
- 显示首次安装、更新、重新安装或降级警告
- 展示目标版本的更新日志摘要
- 下载并校验全部脚本
- 安装失败时恢复原有文件

## 安装方法二：手动复制两个脚本

1. 打开 `LPL-Design-System.js`
2. 点击 **Raw**
3. 全选复制
4. 在 Scriptable 新建脚本，命名为 `LPL-Design-System` 并粘贴
5. 以相同方式复制 `LPL-Schedule.js`
6. 将主脚本命名为 `LPL Schedule 2026`，保存后运行一次
7. 在桌面添加 Scriptable 中号组件，并选择主脚本

> 主组件从 `2.0.0` 起依赖共享设计系统，两个脚本必须安装在同一个 Scriptable 文档目录中，且模块名称必须保持为 `LPL-Design-System`。

## 赛事路由与手动维护赛程

赛事日期、名称、赛段、优先级和 `schedulePath` 统一配置在 `data/tournaments.json`，不要在组件或 Renderer 中增加赛事日期。各赛事文件位于 `data/schedules/`，统一 Match Schema 见 `data/match.schema.json`。

修改赛事元数据或标准化赛程后，重新生成当前选择：

```bash
npm run active:generate
```

`data/schedule.json` 保留为 v3.0.0 LPL 数据源和官方页面回退的兼容层，其格式为：

```json
{
  "matches": [
    {
      "startTime": "2026-07-22 17:00:00",
      "left": "LGD",
      "right": "EDG",
      "status": "upcoming",
      "matchType": "BO3",
      "stage": "常规赛",
      "leftScore": 0,
      "rightScore": 0
    }
  ]
}
```

`status` 支持：

- `upcoming`：未开始
- `live`：进行中
- `finished`：已结束

更新兼容 `schedule.json` 后运行 `npm run tournament:build`，会重建对应的分赛事赛程和 `active.json`。Scriptable 会在下一次刷新时获取最新数据；GitHub Raw 内容可能存在几分钟缓存。

## 自动更新赛程

仓库中的 GitHub Actions 默认每 5 分钟读取 LPL 官方公开赛程数据，并在内容变化时更新 `data/schedule.json`、对应的 `data/schedules/` 文件和 `data/active.json`。也可以在仓库的 **Actions → Update LPL schedule → Run workflow** 中手动执行。

组件会根据比赛状态动态安排刷新：

- 直播中：建议 3 分钟后刷新。
- 直播中每次小场结束后显示官方最新局分，例如 `1-0`、`1-1`。
- 开赛前 60 分钟内：显示分钟倒计时，建议 5 分钟后刷新。
- 其他时间：最多 15 分钟后刷新。
- 当天赛程始终按开赛时间从早到晚排列，比赛状态不会改变顺序。
- 当天比赛全部结束后：自动展示下一个比赛日；赛季最后一个比赛日则保留最终赛果。
- 整场结束后至少保留当天最终比分 10 分钟，再切换到下一比赛日。

GitHub Actions 每 5 分钟同步一次官方局分，直播组件通常每 3 分钟刷新一次，并使用分钟级缓存键绕过旧 Raw 缓存。正常情况下，小场结束后的最新局分会在 10 分钟内显示；实际时间仍取决于 LPL 官方接口何时更新比分。

直播平台选择 `LPL 官方` 时，比赛区域的跳转地址会随状态更新：

- 直播中：打开该场比赛的 LPL 官方直播页。
- 已结束且有回放：打开该场比赛的官方回放页。
- 已结束但暂无回放：打开该场比赛的官方数据页。
- 未开始：打开官方赛程页。

本地更新需要 Node.js 18 或更高版本：

```bash
node scripts/update-schedule.js
```

更新脚本只保留 `2026 LPL 第三赛段`，并校验比赛编号、时间和对阵双方。官方数据异常或筛选结果为空时，脚本会失败且不会覆盖现有文件。

官方接口发生网络异常、HTTP 429 或 5xx 时，更新器会自动重试 3 次，并按 1 秒、2 秒递增等待；全部重试失败后才让工作流报错。

首次安装开发依赖并运行全部回归测试：

```bash
npm install
npm run check
```

`npm run check` 会依次运行：

- `npm test`：安装器、设计系统、赛程更新器、组件解析和 JSON Schema 五组测试，以及四个入口的语法检查
- `npm run lint`：ESLint 静态检查，包含 Scriptable 专用全局变量配置
- `npm run format:check`：检查 JavaScript、JSON 和 YAML 是否符合 Prettier 规范

修改代码后可运行 `npm run format` 自动统一格式。

`data/schedule.schema.json` 定义生成数据的正式结构。Schema 测试除字段类型外，还会检查比赛 ID 唯一性和全赛季时间排序。GitHub Actions 在提交自动赛程更新前必须通过同一套 `npm run check`。

## 发布版本

发布前需要同步修改以下四处版本号：

- `package.json`
- `Installer.js`
- `LPL-Design-System.js`
- `LPL-Schedule.js`

本地检查并预览 Release Notes：

```bash
npm run check
npm run version:check -- 3.1.0
npm run release:notes -- v3.1.0
```

确认无误后创建并推送标签：

```bash
git tag v3.1.0
git push origin v3.1.0
```

`Publish release` 工作流会再次执行完整质量检查，验证标签与四处版本号一致，从 `CHANGELOG.md` 提取对应更新说明，并创建 GitHub Release。Release 会附带：

- `Installer.js`
- `LPL-Schedule.js`
- `LPL-Design-System.js`

普通的 `main` 分支推送不会自动创建正式 Release。

## 复用设计系统

其他 Scriptable 项目可以直接调用共享模块：

```javascript
const DesignSystem = importModule("LPL-Design-System");
const palette = DesignSystem.resolvePalette(
  "auto",
  Device.isUsingDarkAppearance()
);

const widget = new ListWidget();
DesignSystem.applyCardBackground(widget, palette);

const title = widget.addText("NEW PROJECT");
title.font = Font.mediumSystemFont(DesignSystem.typography.header);
title.textColor = new Color(palette.white);
```

共享模块提供：

- `palettes`：深蓝和浅色主题色板
- `typography`：标题、队名、状态和数值字号
- `layout`：Logo、标题方块和数值区域尺寸
- `resolveThemeMode()`：解析深色、浅色或跟随系统
- `resolvePalette()`：取得当前色板副本
- `applyCardBackground()`：应用统一渐变卡片背景

## 用户设置

直接在 Scriptable 中运行主脚本即可打开设置菜单。也可以点击中号或大号组件的整个顶部标题栏；小号组件可点击黄色方块或日期。当前支持：

- 关注队伍
- 数据来源
- 直播平台：LPL 官方或哔哩哔哩
- 缓存有效期：1、3、6、12 或 24 小时
- 刷新频率：实时、均衡或省电
- 组件主题：深蓝、浅色或跟随系统
- 预览中号单场布局
- 运行诊断并一键复制诊断信息
- 恢复默认设置

设置保存在 Scriptable 本地文档目录的 `lpl-schedule-settings.json`，重新安装或升级主脚本不会覆盖。

“运行诊断”会显示主组件、设计系统和设置结构版本，以及当前数据模式、主题、刷新策略、运行环境和缓存状态。从组件标题栏进入设置时会显示小号、中号或大号来源；直接运行脚本时显示“应用内运行”。

组件还会持久化最近一次数据读取路径。诊断页可以看到 GitHub、官方页面和本地缓存分别成功或失败，以及最终使用的数据来源和失败原因。例如：

```text
读取路径：GitHub=失败（HTTP 503） → 官方页面=失败（解析失败） → 本地缓存=成功（有效）
```

遇到安装、比分延迟或缓存问题时，可点击“复制诊断信息”后直接粘贴到 Issue 或对话中。

> GitHub 上的脚本更新不会自动替换手机中的文件。`2.0.0` 起请重新运行 `Installer.js`，安装器会同时更新主组件与共享设计系统，并保留用户设置和 Logo 缓存。

也可以通过 URL Scheme 直接打开设置：

```text
scriptable:///run?scriptName=LPL%20Schedule%202026&action=settings
```

数据来源支持：

- `auto`：远程 JSON → 官方页面 → 本地缓存
- `remote`：只读取远程 JSON
- `official`：只解析官方页面

推荐保留 `auto`。

赛程更新器可通过环境变量选择赛季：

```text
LPL_YEAR=2026
LPL_STAGE=第三赛段
```

GitHub Actions 在工作流的 `env` 中显式保存这两个值。切换赛季时请按 `docs/season-migration.md` 完成迁移检查。

刷新频率预设：

| 预设 | 直播中 | 临近开赛 | 常规状态 |
|---|---:|---:|---:|
| 实时 | 2 分钟 | 3 分钟 | 10 分钟 |
| 均衡 | 3 分钟 | 5 分钟 | 15 分钟 |
| 省电 | 5 分钟 | 10 分钟 | 30 分钟 |

选择哔哩哔哩后，组件整体和所有比赛区域都会打开哔哩哔哩 LPL 直播间；如需按比赛状态进入官方直播、回放或数据页，请将直播平台切换为 `LPL 官方`。

## 组件预览

在 Scriptable 内运行主脚本时：

- 无参数运行默认打开设置菜单
- 将脚本参数设置为 `medium` 可预览中号
- 将脚本参数设置为 `large` 可预览大号
- 设置为 `small` 可预览小号

## 故障排查

### 显示“未来 90 天没有找到比赛”

说明成功获得了数据，但数据中没有今天之后的比赛。请更新 `data/schedule.json`，或检查官方页面解析是否仍然有效。

### 显示“远程 schedule.json 中没有有效赛程”

这是正常回退提示之一。当 JSON 为空时，`auto` 模式会继续尝试官方页面。

### 官网改版后无法解析

直接维护 `data/schedule.json` 即可，不需要修改组件布局代码。

## 免责声明

本项目与 Riot Games、腾讯游戏、英雄联盟职业联赛及哔哩哔哩无隶属关系。赛事名称和相关商标归各自权利人所有。

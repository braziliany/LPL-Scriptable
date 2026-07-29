# LPL Schedule 2026 · Scriptable

一个为 **2026 LPL 第三赛段**设计的 Scriptable 赛程小组件，视觉参考深蓝色倒计时卡片：深蓝渐变背景、彩色竖线、右侧突出显示比赛时间或比分。

## 主要功能

- 支持 Scriptable 小号、中号和大号组件
- 显示官方队伍 Logo，并在 Scriptable 本地缓存图片
- 自动校正官方 Logo 的透明留白，使不同队伍的视觉尺寸更一致
- Logo 缺失或加载失败时自动使用占位图
- 时间、比分和倒计时使用统一的等宽数字字体规范
- 已结束比赛突出胜者并弱化败者，直播与倒计时使用独立强调色
- 长队名自动缩放，比分、时间和倒计时使用稳定的固定宽度区域
- 支持深蓝、浅色和自动跟随系统外观三种主题模式
- 自动寻找今天或未来最近一个比赛日
- 未开始显示时间，进行中显示 `LIVE`，结束后显示比分
- 中号和大号自动显示当天全部比赛，中号在 3 场时自动使用紧凑布局
- 可高亮关注队伍
- 三层数据回退：
  1. 仓库中的 `data/schedule.json`
  2. LPL 官方赛事页面
  3. Scriptable 本地缓存
- 点击组件打开官方赛程页面
- 点击比赛区域按状态打开官方单场直播、回放、数据页或赛程页

## 项目结构

```text
LPL-Scriptable/
├── LPL-Schedule.js          主组件
├── LPL-Design-System.js     可复用的配色与设计规范
├── Installer.js             一键安装器
├── data/
│   └── schedule.json        可手动维护的赛程数据
├── scripts/
│   └── update-schedule.js   官方赛程同步脚本
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

## 手动维护赛程

`data/schedule.json` 的格式：

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

更新 `schedule.json` 后，Scriptable 会在下一次刷新时获取最新数据。GitHub Raw 内容可能存在几分钟缓存。

## 自动更新赛程

仓库中的 GitHub Actions 默认每 5 分钟读取 LPL 官方公开赛程数据，并在内容变化时更新 `data/schedule.json`。也可以在仓库的 **Actions → Update LPL schedule → Run workflow** 中手动执行。

组件会根据比赛状态动态安排刷新：

- 直播中：建议 3 分钟后刷新。
- 开赛前 60 分钟内：显示分钟倒计时，建议 5 分钟后刷新。
- 其他时间：最多 15 分钟后刷新。
- 当天赛程始终按开赛时间从早到晚排列，比赛状态不会改变顺序。
- 当天比赛全部结束后：自动展示下一个比赛日；赛季最后一个比赛日则保留最终赛果。

比赛区域的跳转地址也会随状态更新：

- 直播中：打开该场比赛的 LPL 官方直播页。
- 已结束且有回放：打开该场比赛的官方回放页。
- 已结束但暂无回放：打开该场比赛的官方数据页。
- 未开始：打开官方赛程页。

本地更新需要 Node.js 18 或更高版本：

```bash
node scripts/update-schedule.js
```

更新脚本只保留 `2026 LPL 第三赛段`，并校验比赛编号、时间和对阵双方。官方数据异常或筛选结果为空时，脚本会失败且不会覆盖现有文件。

运行回归测试：

```bash
node tests/official-schedule-parser.test.js
node tests/update-schedule.test.js
node tests/design-system.test.js
node tests/installer.test.js
node --check LPL-Schedule.js
```

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

点击中号或大号组件的整个顶部标题栏，即可在 Scriptable 中打开设置菜单；小号组件可点击黄色方块或日期。当前支持：

- 关注队伍
- 数据来源
- 直播平台：LPL 官方或哔哩哔哩
- 缓存有效期：1、3、6、12 或 24 小时
- 刷新频率：实时、均衡或省电
- 组件主题：深蓝、浅色或跟随系统
- 恢复默认设置

设置保存在 Scriptable 本地文档目录的 `lpl-schedule-settings.json`，重新安装或升级主脚本不会覆盖。

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

刷新频率预设：

| 预设 | 直播中 | 临近开赛 | 常规状态 |
|---|---:|---:|---:|
| 实时 | 2 分钟 | 3 分钟 | 10 分钟 |
| 均衡 | 3 分钟 | 5 分钟 | 15 分钟 |
| 省电 | 5 分钟 | 10 分钟 | 30 分钟 |

选择哔哩哔哩后，只有直播中的比赛会打开哔哩哔哩赛事直播间；已结束比赛仍会进入对应的 LPL 官方回放页或数据页。

## 组件预览

在 Scriptable 内运行主脚本时：

- 默认预览中号
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

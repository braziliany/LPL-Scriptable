# Scriptable 真机回归流程

本流程只用于把 Windows 工作区中的未提交候选版本安装到 iPhone。它不会修改、提交或发布正式版本，也不会从 GitHub `main` 下载主脚本或 DEV 数据。

## 文件边界

### A. 构建与测试期文件

以下文件用于在 Windows 上选择赛事、生成数据、校验结构和构建 DEV 安装包，Scriptable 组件运行时不会直接读取：

- `data/tournaments.json`
- `data/schedules/*.json`
- `src/tournament-router.js`
- `scripts/build-tournament-data.js`
- `scripts/generate-active.js`
- `scripts/build-dev-installer.js`
- `data/*.schema.json`
- `tests/*`
- `package.json`、`package-lock.json`、`node_modules/`

`Installer-Dev.js` 是由构建脚本生成的本地传输产物，已加入 `.gitignore`，不属于正式 Installer 更新链。

### B. Scriptable 运行时必须文件

运行普通 DEV 组件需要：

- `LPL Schedule DEV.js`：当前工作区 `LPL-Schedule.js` 的 DEV 构建。
- `LPL-Design-System-DEV.js`：与正式设计系统隔离的 DEV 模块。
- `LPL-Schedule-DEV/data/active.json`：Windows 工作区生成的当前赛事结果。
- `LPL-Schedule-DEV/data/schedule.json`：v3.0.0 兼容数据和本地回退层。

fixture 模式额外读取：

- `LPL-Schedule-DEV/data/fixtures/lpl-playoffs.json`
- `LPL-Schedule-DEV/data/fixtures/ewc-priority.json`
- `LPL-Schedule-DEV/data/fixtures/worlds.json`
- `LPL-Schedule-DEV/data/fixtures/remote-stale.json`
- `LPL-Schedule-DEV/data/fixtures/stale-remote.json`

`tournaments.json` 和 `schedules/*` 已在 Windows 上由 Tournament Router 编译为 `active.json`，因此不属于 iPhone 运行时依赖。队伍 Logo 仍从比赛数据里的 URL 加载并写入 DEV 专用本地缓存。

## DEV 隔离机制

DEV 安装器只写入以下 namespace：

- Scriptable 脚本：`LPL Schedule DEV`
- 设计系统：`LPL-Design-System-DEV`
- iCloud 数据目录：`LPL-Schedule-DEV/`
- 设置：`lpl-schedule-dev-settings.json`
- 缓存：`lpl-schedule-dev-cache.json`
- 诊断：`lpl-schedule-dev-data-diagnostics.json`
- Logo：`lpl-team-logo-dev-*.png`

正式版的脚本、`LPL-Design-System`、设置、缓存、诊断和 Logo 文件均不会被读取或覆盖。中号和大号 DEV 组件页脚显示 `DEV · v3.1.0`；小号组件日期前显示 `DEV ·`。

## 生成 DEV 安装包

每次修改主脚本、设计系统或数据后，在 Windows PowerShell 中运行：

```powershell
Set-Location -LiteralPath 'F:\Codex\LPL-Scriptable'
npm run dev:installer
```

该命令把当前工作区的以下内容直接内嵌到根目录 `Installer-Dev.js`：

- 当前 `LPL-Schedule.js`
- 当前 `LPL-Design-System.js`
- 当前 `data/active.json`
- 当前 `data/schedule.json`
- 五种 DEV 验收路径所需 fixture

安装器不发起 GitHub 请求。生成的 DEV 主脚本使用 `dev-local://LPL-Schedule-DEV` 占位 URL，并在数据加载入口强制走 iCloud DEV 数据通道。

## Windows → iPhone

1. 在 Windows 安装并登录 iCloud for Windows，确认资源管理器中存在 **iCloud Drive → Scriptable**。
2. 运行 `npm run dev:installer`。
3. 使用同步脚本自动识别 iCloud `Scriptable` 或 `iCloud~dk~simonbs~Scriptable` 容器并复制：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\sync-dev-installer.ps1
   ```

4. 如果 iCloud Drive 实际目录不同，显式传入：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\sync-dev-installer.ps1 `
     -ScriptableDirectory 'D:\iCloudDrive\Scriptable'
   ```

5. 等待资源管理器显示 `Installer-Dev.js` 已完成上传。
6. 在 iPhone 打开 Scriptable，运行 `Installer-Dev`，确认安装提示中的版本和工作区打包时间，然后选择“安装 DEV”。
7. Scriptable 中应同时保留手机原有正式脚本 `LPL Schedule` 和新脚本 `LPL Schedule DEV`。DEV 安装器不会创建、改名或覆盖正式脚本。若手机上的既有正式脚本显示为 `LPL Schedule 2026`，同样保持原名，不要为了 DEV 验收改动它。
8. 添加两个中号 Scriptable 组件，分别选择正式脚本和 `LPL Schedule DEV`，确认两者可独立刷新。

如果不使用同步脚本，也可以把 `F:\Codex\LPL-Scriptable\Installer-Dev.js` 手动复制到资源管理器中的 iCloud Drive `Scriptable` 目录。

## fixture 使用方法

编辑桌面上的 `LPL Schedule DEV` 组件，在“参数”中填写下列值；正式组件不要填写这些参数：

| 参数 | 预期结果 |
| --- | --- |
| 留空 | 不启用 fixture，使用正常在线数据链与 DEV 独立缓存 |
| `dev:lpl-playoffs` | 标题为 `LPL PLAYOFFS`，展示 LPL 季后赛 |
| `dev:ewc-priority` | LPL 与 EWC 同日，选择高 priority 的 `EWC 2026` |
| `dev:worlds` | 标题为 `WORLDS 2026` |
| `dev:remote-stale` | stale active 校验失败，转入内嵌官方页面回退 fixture |
| `dev:stale-remote` | 合法但超过 72 小时的 remote active 被拒绝，实际尝试 LPL 官方页面；官方成功才算本轮 PASS |
| `dev:offline-cache` | 模拟 active 与官方页面均离线，读取最近一次 DEV 缓存 |

`offline-cache` 建议在任一成功 fixture 之后测试；Installer-Dev 安装时也会用当前工作区 active 数据预先种入 DEV 缓存。fixture 选择只由带 DEV runtime 标记的脚本识别，正式版即使收到相同组件参数也不会进入 fixture 通道。

桌面组件采用缓存保护预算：启动时先冻结有效缓存；remote active 最多等待 3 秒，官方页面总计最多等待 4 秒，Logo 请求并行且最多等待 3 秒。有效缓存存在时不再追加 legacy remote 请求；网络失败后立即显示缓存。应用内手动运行保留完整回退链，remote、official 和资源请求上限分别为 5、8、5 秒。

飞行模式验收使用 `dev:offline-cache`。Installer-Dev 会预置一份有效 DEV 缓存，因此该 fixture 不发起网络请求，诊断链应为 `remote failed/timeout → official failed/timeout → cache accepted`，最终来源为 `DEV local cache`，并显示缓存来源、年龄和比赛数量。

国际战队资源 backlog：WORLDS 2026 fixture 中的 T1 暂无随包 Logo URL，真机允许使用通用占位 Logo；后续接入国际赛事正式数据源时补齐国际战队 Logo 映射。

切换参数后返回桌面并刷新组件。可直接运行 `LPL Schedule DEV`，从设置页打开“运行诊断”，检查“运行通道”“DEV fixture”“选择原因”和读取路径。

## 真机验收清单

1. 正式中号组件外观和数据保持不变。
2. DEV 中号组件页脚明确显示 `DEV · v3.1.0`。
3. 留空参数时显示当前工作区 active 赛事。
4. 按需验证全部显式 fixture 参数；留空必须显示“在线模式”。
5. 分别预览小号、中号和大号 DEV 组件。
6. 检查 B 站和 LPL 官方跳转设置仍可独立使用。
7. 在 DEV 诊断中确认缓存及读取路径均带 DEV 标识。
8. 回到正式组件，确认其设置、缓存和显示未被 DEV fixture 改变。

完成真机验收前，不创建 Tag 或 Release，也不执行提交、推送或合并。

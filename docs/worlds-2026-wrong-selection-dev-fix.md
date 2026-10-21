# Worlds 2026 错选赛事：DEV 安全包

核对日期：2026-10-21，北京时间。用户确认 iPhone 上的正式组件为 v3.1.2；所述 10 月 24 日画面标注来源为“官方页面”。

## 根因与证据

- `main` 上正式 `data/active.json` 最后生成于 10 月 14 日，状态为已结束的 LPL 资格赛；正式 `data/schedule.json` 也停留在 10 月 14 日，且没有 10 月 24 日的比赛。客户端的新鲜度门禁会拒绝它们。
- 正式客户端随后读取 LPL 页面文本。`parseOfficialSchedule` 仅从日期附近寻找已知队名，没有比赛 ID 或赛事 ID 校验，并将阶段设为“常规赛”、默认 BO3。用七行固定文本可复现用户所述的 10 月 24 日 02:00 IG–TES、03:00 BLG–AL 错误结果。此复现证明解析器的失效条件，**不是**对 iPhone 当时页面原文的取证。
- 页脚显示“官方页面”说明当次展示来自页面回退，而非 GitHub Active、Legacy 或本地缓存。SMART Router 用于生成 `active.json`，并未为这两场比赛生成赛事身份。正式 Worlds 赛程文件仍为空；Worlds DEV 审核通道没有进入正式组件。

## 本次修复边界

`scripts/build-dev-installer.js` 增加 `--worlds-safe`，生成独立 DEV 安装包。它将 DEV 组件锁定在 `worlds-reviewed` 通道，覆盖可能残留的旧 DEV 快照为显式 `UNAVAILABLE` 标记，且不访问旧 LPL 回退链。无有效审核快照时，组件显示“赛程暂不可用”，点按打开 [LoL Esports Worlds 赛程](https://lolesports.com/en-US/leagues/worlds)。即使传入其他 DEV fixture 参数，也不会改读旧赛事。

本次不修改 `LPL-Schedule.js`、正式 Installer、正式赛程数据或工作流。因此正式 v3.1.2 的错误路径仍需后续单独授权修复与发布；使用本包时必须将 iPhone 组件切到 `LPL Schedule DEV`。

## 构建与验收

```powershell
node scripts/build-dev-installer.js --worlds-safe --output 'F:\共享文件夹\Installer-Dev-Worlds-Safe-20261021.js'
Get-FileHash -Algorithm SHA256 -LiteralPath 'F:\共享文件夹\Installer-Dev-Worlds-Safe-20261021.js'
```

安装后选 `LPL Schedule DEV`，参数留空或填写 `dev:worlds-reviewed`。应看到 Worlds 不可用状态和官方页面入口，不能出现 IG–TES 或 BLG–AL 的旧 LPL 对阵。小、中、大尺寸需用户分别在 iPhone 确认。此安全包不含真实 Worlds 比赛；较早的私有审核快照已超过 48 小时有效期，不得重新打包延寿。

本次包 SHA-256：`ec9e03d624877dadcc884ca6974f2bda5f3cb7d69ff13f9c73d9962b2221c623`。解析最终安装包确认 `mode=WORLDS_SAFE`，且数据文件只有 `worlds-reviewed.json` 的显式不可用标记，没有 LPL 赛程或真实 Worlds 快照。

自动验证：`tests/worlds-reviewed-dev.test.js` 覆盖安全安装覆盖残留快照、参数锁定、离线读取拒绝和 DEV 隔离；`npm run check` 与 `git diff --check` 通过。桌面模拟不等于 iPhone 验收。

生产接入仍为 **NO-GO**。官方 Worlds 页面有后续动态加载，当前未证明目标窗口的完整性；[Riot General Policies](https://support-developer.riotgames.com/hc/en-us/articles/22698591841939-General-Policies) 要求产品注册与审核，[LoL Developer API Policy](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends) 明确玩家服务产品即便不使用文档化 API 也须注册。当前没有可确认适用于本项目自动采集及公开再发布的许可，不会把私有快照提交到公开数据通道。

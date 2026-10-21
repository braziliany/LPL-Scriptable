# Worlds 2026 正式客户端 v3.1.3 接入记录

核对日期：2026-10-22（北京时间）。主线基线：`c5f6472e39fe60445d0bb0782dff0cdb2dab9095`，正式 Installer、主脚本、包版本原为 3.1.2。

## 实际结果

正式 v3.1.2 的数据链仍依次尝试陈旧的 `data/active.json`、LPL Legacy JSON、LPL 官方页面和同一正式缓存。公开 `data/active.json` 的 `generatedAt` 是 2026-10-14，选中已结束的 LPL 资格赛；公开 `data/schedules/worlds-2026.json` 仍是零场。DEV 审核快照从未装入正式 Installer，因此主线已有审核工具不等于正式用户取得 Worlds 赛程。LPL 页面回退缺少 Worlds 赛事身份，可能在 Worlds 日期显示旧 LPL 比赛。

v3.1.3 在北京时间 2026-10-15 至 11-14 的 Worlds 窗口，只从正式 Active 通道接受 `worlds-2026` 比赛。正式比赛还必须具有 `PARTIAL_OBSERVED`、官方来源 URL、`sourceAuthorization: "VERIFIED"`、`coverageVerified: true`、对应日期范围、未过期源数据、唯一官方比赛 ID 和有效参赛身份；TBD 必须保留官方占位身份。Worlds 开赛时间按 `+08:00` 解释，避免设备时区改变比赛日或时间。缺失时只回退到仍有效且满足同一验证的 Worlds 缓存；旧 LPL Active、Legacy、页面及缓存均不能填充 Worlds。不可用界面可点按官方 Worlds 页面。正常 LPL 日期继续走原数据链。

正式 Worlds 渲染复用已验收的 Compact 每尺寸 1/2/4 场限制与已结束后移动到后续比赛的选择逻辑；标题和页脚明确显示“部分”覆盖范围。正式 Installer 的版本号与主脚本同步至 3.1.3，Raw main 是其下载来源。旧手机脚本不会因为 Git 提交自动替换，必须重新运行正式 Installer；本次没有创建 Tag 或 GitHub Release。

## 真实数据与授权边界

LoL Esports [官方 Worlds 页面](https://lolesports.com/en-US/leagues/worlds)是私有人工核对的来源。其分页终点和已发布窗口完整性尚未取得独立证据；私有快照未纳入本提交。Riot [General Policies](https://support-developer.riotgames.com/hc/en-us/articles/22698591841939-General-Policies) 要求产品经 Developer Portal 注册和审核，并建议使用受支持的数据服务；[League of Legends 政策](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends) 明确面向玩家的产品即使未使用文档化 API 仍需注册。[API Terms](https://developer.riotgames.com/terms) 与已检查的 [LoL 开发文档](https://developer.riotgames.com/docs/lol) 未提供本项目当前页面采集、缓存和公开再发布的已确认许可。官方 [LoL Esports Data Portal 介绍](https://lolesports.com/en-US/news/dev-diary-introducing-the-new-lol-esports-data-portal) 说明存在合作伙伴及社区数据渠道，但没有对本项目作出授权。

因此 `SOURCE AUTHORIZATION=NOT VERIFIED`、`DATA COVERAGE=BLOCKED`，正式赛程 **未上线**。不能通过手工修改元数据标记来代替授权或窗口完整性证据。取得适用的 Riot 批准和可审计的指定日期完整比赛 ID 集合后，方可人工审核并将获准数据加入 `data/schedules/worlds-2026.json`；更新器会把覆盖元数据传递给 Active，仍须核对公开 diff、运行 `npm run check` 并单独评估发布。现有每五分钟的 LPL 工作流仅更新 LPL 数据，不负责 Worlds 审核；不得将私有 DEV 快照放入公开仓库。

## 验证与分发

针对性自动测试覆盖：正式旧 Active 在 Worlds 日期拒绝、经标记的合成 Worlds 数据和 TBD 对阵接受、重复及缺失身份拒绝、离线有效 Worlds 缓存、损坏和过期缓存降级、官方赛程跳转、Compact 选择，以及 LPL 日期回退。`npm run check`、`git diff --check` 和正式 Installer 本地内容契约用于提交前验收；推送后还需读取 Raw main 对照版本与文件哈希。本记录中的合成数据不构成真实赛程发布证据。

生产决议：**NO-GO（真实 Worlds 赛程）**。v3.1.3 客户端修复可独立进入主线，但当前正式用户只能获得准确的“赛程暂不可用”状态和官方入口；私有 DEV 通道仍是唯一能显示人工审核比赛的现有通道。

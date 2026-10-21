# Worlds 2026 私有 DEV 赛程维护

流程更新：2026-10-22，北京时间；来源条款核对：2026-10-18。此流程只生成 `LPL Schedule DEV` 的**本地人工审核包**。不请求 Riot 接口，不写正式 `active.json`、`schedule.json`、`Installer.js`、GitHub 工作流或公开 Raw。`F:\共享文件夹\Worlds-DEV-Updates` 是交给手机的私有文件目录，不是生产发布位置。

该维护命令已选择性纳入 v3.1.2 代码；正式版本号、正式 Installer 和生产赛程未升级。私有审核快照和对应安装包只保存在本机，不提交到仓库。用户已将 Compact 布局的真机验收确认为稳定基线；只更新同一客户端的审核数据时，执行文件哈希、安装包内快照一致性及桌面读取验证，不重复要求 iPhone 布局验收。客户端代码或布局再变更时，应单独验证相应变化。

## 证据边界

官方来源：[LoL Esports Worlds 赛程](https://lolesports.com/en-US/leagues/worlds)。页面有 **Load More**；初始 HTML 的 `ApolloSSRDataTransport` 中包含 `EsportsData.events`。目前没有已验证的 Load More 游标、分页终点或适用于本项目的官方授权赛程 API 契约。候选数据一律标记 `PARTIAL_OBSERVED`、`paginationEndVerified=false`；不能凭首次 HTML 响应宣称某日期窗口或整届赛事完整。

快照的 `observedAt` 必须是实际取得来源文件的时间。审核、打包或重装不能刷新它。DEV 加载器只在 48 小时新鲜度内使用有效快照；已过开赛 6 小时仍标记 `upcoming/live` 的单场会从显示集合剔除。没有可显示比赛时，组件安全降级并指向官方赛程。

桌面测试覆盖 Scriptable `FileManager.iCloud` 模拟安装、读取和比赛选择，以及过期、JSON 损坏时的安全降级。桌面结果不能代替 iPhone 验收。私有真实快照的来源、差异、SHA-256 和安装包应在本机的审核目录与 `current.json` 中核对，不写入公开仓库。

## 每次更新

1. 人工打开上面的官方页面，核对日期、队伍、BO、状态和需要显示的日期窗口。若有 Load More，人工展开并记录哪些阶段、日期还未取得；网页“另存为”得到的 HTML 可能只包含初始 SSR 数据，**不能认为 Load More 已被保存**。将原始官方 HTML 保存在本机私有目录（例如 `D:\Temp\worlds-official-YYYYMMDD.html`），记录实际观察时刻。不要复制登录信息或请求头，不要绕过访问控制。没有涵盖目标比赛的原始文件时停止，不手编比赛或伪造完整性。
2. 在含有此流程的本地 `main` 工作树运行以下 PowerShell 命令。`$observedAt` 要取**实际取得该文件时**的 UTC 时间，不能在以后重打包时刷新。`$previous` 指向电脑端 `current.json` 记录的上一份审核快照。

   ```powershell
   $store = 'F:\共享文件夹\Worlds-DEV-Updates'
   $previous = (Get-Content -LiteralPath "$store\current.json" -Raw | ConvertFrom-Json).current.snapshotPath
   $observedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
   npm run worlds:review -- prepare --html 'D:\Temp\worlds-official-YYYYMMDD.html' --observed-at $observedAt --previous $previous --out 'D:\Temp\Worlds-Review-YYYYMMDD'
   ```

3. 阅读输出及 `worlds-reviewed-diff.json`：核对 `sourceUrl`、`observedAt`、`coverageStart/End`、`matchCount`、`addedIds`、`removedIds`、`changed[].fields`，把具体变化与官方页面逐一对照。`removedIds` 非空会阻止审批；先查明是分页截断、赛程取消还是来源变化。HTTP 成功、JSON 可解析、比赛数量增加都不是完整性证据。候选永远标记部分已观察，不提供“完整”开关。审核时记录尚未覆盖的阶段和日期。
4. 认可差异后，将 `prepare` 输出的 `diffSha256` 原样填入下一条命令。审批会重新校验候选、上一版和差异，生成不可覆盖的版本化快照与 DEV Installer，最后原子切换电脑端 `current.json`。重复审批同一候选返回同一文件。失败不会切换指针。

   ```powershell
   npm run worlds:review -- approve --candidate 'D:\Temp\Worlds-Review-YYYYMMDD\worlds-reviewed-candidate.json' --diff 'D:\Temp\Worlds-Review-YYYYMMDD\worlds-reviewed-diff.json' --store $store --accept-sha '<prepare 输出的 diffSha256>'
   npm run worlds:review -- verify --store $store
   Get-FileHash -Algorithm SHA256 -LiteralPath (Get-Content -LiteralPath "$store\current.json" -Raw | ConvertFrom-Json).current.installerPath
   ```

5. 仅把 `current.json` 指向的 `Installer-Dev-Worlds-<版本>.js` 从 `F:\共享文件夹\Worlds-DEV-Updates` 安装到 iPhone。组件选择 `LPL Schedule DEV`，参数留空或设 `dev:worlds-reviewed`。新包不会远程自动更新，必须重新安装才能换版。Compact 布局在小、中、大组件分别显示最多 1、2、4 场，随已完赛状态向后显示；中、大组件页脚显示“部分”、已观察范围和观察更新日，小组件显示“WORLDS·部分”和比赛日。数据更新须核对 `verify`、SHA-256 和桌面读取；不要把这些检查写成一次新的 iPhone 实测。

已有的审核文件可用 `prepare --reviewed <文件> --previous <旧文件> --out <目录>` 导入，不改写原采集时刻；这是迁移已有证据的专用入口，不能用来刷新过期文件。

## 失败、过期与恢复

- 原始文件缺失、官方结构变更、重复或冲突 ID、队伍身份或比分错误：`prepare` 失败；保留电脑端 `current.json` 和手机上原有 DEV 安装。不要用旧页面的新文件时间重试。
- 候选 ID 比前版少：审批拒绝，必须调查是否只拿到了分页的一部分。既有比赛不会因一次短响应被删除。
- 审批中途失败：版本文件可留在私有目录，但指针仍指旧版；核对后对同一候选重复 `approve`。如果已经切换后发现问题，可运行 `npm run worlds:review -- rollback --store $store`，它只允许回到**仍在 48 小时内且哈希有效**的上一份本地审核快照。电脑指针回滚不会改变已安装的手机组件；须重新安装相应旧版 Installer。第一份本地审核版没有可回滚的本地前版。
- 快照损坏、文件未下载到 iPhone、过期、或没有近期可显示比赛：`dev:worlds-reviewed` 安全降级，不转而读取 Legacy/LPL 缓存。先用 `verify` 和 SHA 定位文件问题；重新安装仍有效的已审核包。过期后不得重设 `observedAt` 或靠重打包延寿，应重新查看官方赛程并审核新数据。
- 无网络：已安装且本地可读的 iCloud DEV 快照可在 48 小时内使用；文件尚需 iCloud 下载或超过时限则降级。这里没有声称离线 iPhone 实测通过。

## 来源许可和生产门禁

2026-10-18 再查 [Riot API Terms](https://developer.riotgames.com/terms) 的“Licensed Uses and Restrictions”“API Keys”、[General Policies](https://support-developer.riotgames.com/hc/en-us/articles/22698591841939-General-Policies) 的“Product Registration”，以及 [League of Legends Developer API Policy](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends) 的“Registration”：API 使用受到条款、密钥和适用产品审核约束；政策要求服务玩家的产品即便不使用官方文档化 API 也要注册，并建议使用受支持的数据接入服务。[公开 API 参考](https://developer.riotgames.com/apis/)中未核实到适用于本赛程的文档化接口（这是对当前参考目录的调查结论，不证明接口不存在）。上述条款没有给这个项目的网页自动采集、周期请求或公开 GitHub Raw 再发布提供可确认的适用授权。可人工查看公开页面，不由此推定可公开再发布。`SOURCE AUTHORIZATION=NOT VERIFIED`。需要获得适用的 Riot/LoL Esports 许可或获准替代来源，确认公开使用和缓存范围后才能考虑自动化及生产。

生产资格：`ENGINEERING=PASS`（本地自动测试与私有审核包桌面读取）；`DATA COVERAGE=PARTIAL_OBSERVED`（分页终点未证实）；`SOURCE AUTHORIZATION=NOT VERIFIED`；`UPDATE RELIABILITY=PASS`（本地版本化更新、故障保留和过期降级，目标 iPhone 新包待验收）；`PRODUCTION READY=NO-GO`。还须证明目标日期窗口的官方完整性、来源使用与再发布权限、正式分发/缓存/回滚持久性，并获得独立发布授权。上述工程结果不触发生产发布。

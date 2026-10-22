# Worlds getSchedule 候选更新

此工具只生成私有候选和差异，不修改正式赛程、Active、Installer 或 GitHub 工作流。接口技术可访问不等于 Riot/LoL Esports 授权自动采集及公开分发。目前正式 Worlds 数据仍为 0 场；自动生产更新未启用。

本机取得适用的接口凭据及使用许可后，在 PowerShell 中把 LoL Esports 网页接口专用 Key 放入当前会话的 `LOLESPORTS_API_KEY`。它与 Riot Developer Portal Key 不是同一体系。不要把 Key 写进命令行参数、仓库文件、日志或工单。仅在获准请求该接口后执行：

```powershell
$secureKey = Read-Host 'LoL Esports API Key' -AsSecureString
$env:LOLESPORTS_API_KEY = ConvertFrom-SecureString -SecureString $secureKey -AsPlainText
$private = 'F:\共享文件夹\Worlds-DEV-Updates'
$previous = (Get-Content -LiteralPath "$private\current.json" -Raw | ConvertFrom-Json).current.snapshotPath
$run = Join-Path $private ("api-candidate-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
npm run worlds:api-candidate -- --out $run --previous $previous
Remove-Item Env:LOLESPORTS_API_KEY
```

命令从 `getSchedule` 的初始页沿 `pages.older` / `pages.newer` 获取全部可达页；游标去重并设安全上限，比赛按 ID 去重及时间排序。检查 `worlds-api-diff.json` 的 `pageCount`、`addedIds`、`removedIds`、`changedIds`、覆盖日期和 `unchanged`。任何页失败、身份/比分冲突或分页未结束都会使候选生成失败；已有审核快照与指针不变。候选仍为 `PARTIAL_OBSERVED`、`NOT_VERIFIED`，因为分页终点只证明接口返回的范围，不证明尚未公布的赛程完整，也不证明使用许可。

人工逐场对照官方页面后，可将 `worlds-api-candidate.json` 输入现有 `npm run worlds:review -- prepare --reviewed ... --previous ... --out ...`，再按[DEV 审核维护流程](worlds-2026-update-runbook.md)核查差异、审批、验证并安装。未经来源许可及独立窗口完整性证据，不得把候选转换成公开正式数据，也不得启用 GitHub Actions 定时请求；正式客户端仍安全降级。

北京时间 2026-11-15 决赛窗口的正式客户端源代码边界已修正。只有具备上述授权、窗口证据、生产发布/恢复机制及新客户端安装或更新验证时，才可把该代码与实际赛程称为正式上线。

# 腾讯赛事 feed 的 Worlds 2026 私有候选

2026-10-24 10:17 北京时间，通过仓库现有 `fetchWithRetry` 请求赛程与队伍 feed。赛程响应为 HTTP 200、`status=0`、`lastUpTime=2026-10-24 09:40:06`，原始 SHA-256 为 `fc5b5ed9fd1fb311bebe92a0170c1f41282ba82df18db8fd987d3c21451b5975`。1106 条总记录中，`GameId=246` 且 `GameName=2026全球总决赛` 的 46 条比赛 ID 唯一，覆盖北京时间 10 月 16 日至 11 月 15 日；入围赛 6、瑞士轮 33、淘汰赛 7；14 场已结束，32 场未开始。全部队伍 ID 均在队伍 feed 中有记录。国际队伍的 `TeamShortName` 经常为空，转换时须校验并使用队伍表 `TeamName`；`TeamId=297` 是来源明确提供的 TBD。

腾讯 46 条记录与先前 LoL Esports 私有审核快照的 46 个北京时间/BO 槽位一致，但对阵及左右顺序已有变化；这不是整个赛事或未来所有日期完整性的独立证明。腾讯公开页面、接口 HTTP 200、仓库旧有 LPL 使用方式，均不等于本项目获准定时读取、加工或通过 GitHub Raw 公开再分发。尚未找到适用于该用途的明确许可，候选必须保持 `PARTIAL_OBSERVED`、`sourceAuthorization=NOT_VERIFIED`、`coverageVerified=false`。

本地转换命令仅使用已保存的 feed 文件，并将结果写到仓库外的隔离目录：

```powershell
$observedAt = (Get-Item -LiteralPath 'D:\Temp\lpl-worlds-tencent-20261024\matches.json').LastWriteTimeUtc.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
npm run worlds:tencent-candidate -- --matches 'D:\Temp\lpl-worlds-tencent-20261024\matches.json' --teams 'D:\Temp\lpl-worlds-tencent-20261024\teams.json' --observed-at $observedAt --out 'D:\Temp\lpl-worlds-tencent-20261024\candidate-new'
```

给 `--previous <上一候选文件>` 可查看新增、减少和变化的比赛 ID。任何身份、时间、队伍、状态、比分错误都会使生成失败；比赛减少会在审计结果中列出，不能据此直接删除上一有效版本。转换器没有网络请求、正式写入或发布路径。

正式 v3.1.3 客户端当前仅接受 Riot 来源身份与已核实授权标记，不能直接读取腾讯候选。若取得适用许可，还需独立完成窗口完整性、腾讯来源身份校验、正式客户端契约适配、故障回滚及自动更新验收，随后才可审查正式发布。当前 GitHub 正式 Worlds 数据仍为 0 场。

# Worlds 2026 腾讯来源：私有正式发布准备

`npm run worlds:tencent-stage` 是人工触发的一次性准备命令；它复用现有腾讯 feed 和转换器，不安装定时任务，也不修改正式赛程、Active、Installer 或工作流。输出目录必须是仓库外尚不存在的绝对路径。

```powershell
npm run worlds:tencent-stage -- --out 'D:\Temp\worlds-release-<本次时间>' --previous 'D:\Temp\<上一私有候选>\worlds-2026.candidate.json'
```

默认重新请求赛程与队伍 feed 一次。若已单独保存本次响应，可传 `--matches <赛程文件> --teams <队伍文件> --observed-at <实际采集的 ISO UTC 时间>`，从而重复验证同一来源。`--previous` 可指向旧的私有转换候选或正式结构候选；没有旧候选时省略，但差异报告只能显示所有 ID 为新增。不要把上次响应时间当成本次采集时间。

成功后，私有目录包含原始响应、`worlds-2026.candidate.json`、`active.candidate.json`、`differences.json`、`validation.json`、`publication-record.json`。前两份具有正式文件的字段结构，但明确写着 `sourceAuthorization=NOT_VERIFIED`、`coverageVerified=false`。正式 Schema 因此会拒绝直接发布；工具仅在内存中测试更改这两个门禁字段后的结构兼容性，不将虚构的已授权标记落盘。`publication-record.json` 记录正式文件原有 SHA-256 和未发布状态。生成过程先验证，再在同一隔离父目录准备临时文件，最后切换到新目录；失败不覆盖旧候选或正式文件。出现比赛 ID 减少时，差异报告会列出 ID，并额外阻断发布。

审核 `differences.json` 中的比赛 ID、时间、左右队伍、阶段、BO、状态和比分；检查 `validation.json` 中的采集时间、来源更新时间、覆盖日期、11 月 15 日决赛和 Active 选中日。每次赛程变更都要重新采集并审核。`PARTIAL_OBSERVED` 仅表示已观察部分，不能推断赛事全量完整。

正式发布与回滚尚未执行。后续必须先取得覆盖**定时获取、转换、缓存和 GitHub Raw 公开再分发**的适用许可，并取得拟发布日期窗口的完整性证据。届时应重新采集，复核新增、减少和变化的 ID，通过正式 Schema 与客户端门禁，在同一 Git 提交中更新 Worlds 赛程和 Active；远端 Raw 与缓存确认后才可宣布上线。若发布后发现错误，以新的修正或撤销提交恢复上一份有效数据及 Active，并验证客户端不再读到错误缓存；不得强制推送。当前工具刻意不提供绕过许可门禁的公开发布命令。

2026-10-24 核对的公开依据没有明确授予上述用途：[腾讯赛事赛程页](https://lpl.qq.com/web202301/schedule.html)可浏览，但未列出对本项目的再分发许可；[Riot 官方电竞数据说明](https://riotesportsdata.com/en-us/league-of-legends/)将商业赛程数据的获取指向 GRID，并说明非商业社区入口尚在规划。可从[腾讯官方联系页](https://www.tencent.com/zh-cn/contact/)的“互动娱乐和游戏业务合作”渠道询问 LPL feed 的数据权利人及授权方式；该栏目不是现成的数据许可。[Riot Developer Support 请求入口](https://support-developer.riotgames.com/hc/en-us/requests/new)可要求 Riot 书面确认权利归属、使用范围及公开镜像许可；官方合作数据的备选入口为 [GRID 联系页](https://grid.gg/plans/)。询问时提供项目 GitHub 地址、非商业 Scriptable 小组件用途、目标 feed URL、计划频率、保留时长、转换字段、GitHub Raw 分发及用户规模；不要提交 API Key。

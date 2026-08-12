# LPL 新赛季迁移检查清单

1. 在 `.github/workflows/update-schedule.yml` 更新 `LPL_YEAR` 与 `LPL_STAGE`。
2. 在 `LPL-Schedule.js` 的 `SEASON` 中同步年份和赛段。
3. 在 `Installer.js` 更新安装器显示的赛季文本。
4. 核对官方接口中的 `GameName`、`GameTypeName` 与新配置一致。
5. 检查新赛段参赛队伍与分组，必要时更新 `MATCH_GROUPS`。
6. 运行 `node scripts/update-schedule.js`，确认生成数据只包含目标赛季。
7. 运行 `npm run check`，确认结构、版本、格式和回归测试通过。
8. 在 Scriptable 重新运行安装器，核对诊断页的当前赛季。
9. 使用小号、中号和大号组件各进行一次真机验证。

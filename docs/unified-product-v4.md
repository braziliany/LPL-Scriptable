# 英雄联盟比赛赛程表 v4.0.0

## 单文件架构

`npm run build:unified` 从四份可维护源码生成 `LoL-Esports-Schedule.js`。生成文件内嵌 Theme、Cito 转换器及个人缓存模块，正式运行时不调用 `importModule()`。Scriptable 只需安装 `英雄联盟比赛赛程表.js`。旧源码文件仍保留在仓库中供构建和回归测试使用。

正式客户端的 App 负责运行环境与统一设置；Schedule 读取公开 Active 和按赛事登记的赛程；Cito 经本人 Keychain 请求 Worlds；Cache 在手机本地管理个人三小时缓存、最多二十四小时的明确旧缓存及退避；Router 选择比赛日；Renderer 沿用已验收的小、中、大 Compact 布局；Theme 内嵌原设计系统。

公开数据仍由现有 LPL 更新工作流维护。个人 Cito 响应、Key 和缓存均留在手机，不上传 GitHub Raw。`PARTIAL_OBSERVED` 不转换为完整赛程，也不降低公开 Worlds 门禁。

## 年份与赛事

正式 Active 校验根据赛事 `season`、日期和 `tournamentId` 检查身份；2027 LPL Active 可在登记真实数据后读取。Cito Worlds 转换器从官方响应的 `lol-worlds_YYYY` 得到赛季，生成 `worlds-YYYY`，并校验每场时间属于该赛季。赛事目录来自 `data/tournaments.json`，允许手动选取已登记赛事；没有真实赛程的未来赛事不显示为已可用。旧版 2026 LPL Legacy 和公开 Worlds 安全门禁属于历史兼容路径；2027 年不会把旧 LPL 页面回退当作新赛季赛程。

新增公开赛事时，先登记赛事元数据及真实 schedule，再由现有 Active 生成器发布；Renderer 无需改动。未来公开 Worlds 仍须单独满足数据完整性和公开分发门禁。个人 Worlds 在赛事时段通过本人 Cito 数据工作。

## 升级与恢复

安装器先下载并验证单文件，然后写入新名称。若旧 `LPL Schedule 2026` 或 `LPL Schedule` 已存在，安装器同时用同一源码原位更新；写入失败会恢复原文件。安装器不清理脚本、Keychain、设置或缓存。沿用 Keychain 标识 `lpl-schedule-personal-cito-api-key` 和旧个人缓存文件路径。旧数据读取失败时不会删除原文件；需要新赛季数据时才请求并验证新响应。

桌面组件与脚本名称的绑定只能在 iPhone 确认。安装后运行新名称脚本，确认设置中心、原 Cito Key 和 Worlds 比赛正常，再将旧组件的 Scriptable 脚本选择改为新名称。确认没有任何组件引用旧脚本后，用户可手动删除 `LPL-Design-System`、`LPL-Cito-Worlds`、`LPL-Cito-Personal` 和旧入口。回滚时使用旧版安装包和仍保留的旧脚本；安装器不删除个人数据。

## 验证边界

`npm run check` 覆盖安装器事务、单文件无辅助依赖、旧 Keychain/缓存路径、2027 Worlds 合成赛事、2027 LPL Active、现有 LPL 和 Worlds 回归。桌面 VM 不能验证 iOS Keychain、Scriptable 原生设置弹窗或桌面绑定；这些只需一次最小手机确认。不要将自动测试当作真机验收。

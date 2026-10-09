# Production Installer contract：v3.1.1 blocker

状态：v3.1.2 正式 Installer-RC 覆盖安装、正式组件渲染、GitHub Active 与赛事空窗真机验收已通过；DEV 官方回退专项验收由用户决定跳过，记录为 WAIVED。

## 已复现的根因

v3.1.1 Installer 的主脚本 validator 只有 `content.includes(resource.marker)`。
其 marker 是精确的 `importModule("LPL-Design-System")`。
v3.1.1 主脚本改为多行 `importModule(IS_DEV ? DEV_RUNTIME.designSystemModule : "LPL-Design-System")` 后不再包含这个精确字符串。
使用实际下载的 v3.1.1 文件执行旧 Installer 的同一 `downloadResource()`，复现了“LPL Schedule 2026 下载内容校验失败”。

旧下载 validator 不检查版本、脚本身份、Scriptable metadata、HTTP status 或 Content-Type。
VERSION 仅在下载通过后用于更新提示；`LPL Schedule 2026` 是安装文件名，主脚本内部 APP.name 是 `LPL Schedule`，二者用途不同。
兼容覆盖逻辑在下载全部通过后才执行，不参与这次拒绝。

## 真实 production download path

所有 URL 都是 GitHub Raw `main`，不是 Release assets。
URL 基础路径：`https://raw.githubusercontent.com/braziliany/LPL-Scriptable/main/`。

2026-09-28 的两次实际请求结果一致；三个资源均 HTTP 200、零重定向、最终 URL 与请求 URL 一致，Content-Type 均为 `text/plain; charset=utf-8`。

| 资源 | 字节数 | 实际 Raw SHA-256 = v3.1.1 Release SHA-256 |
| --- | ---: | --- |
| LPL-Schedule.js | 93579 | C6F20C77A2DDE21E637BA3A0BEB375F9C8E3CBE3CDAA7D4D10D7A5C18A0E106E |
| LPL-Design-System.js | 1963 | 8AA59B0F73B85789BCBA0E141561239D0C7DB3D7ECE6D0F12646B83E43267597 |
| Installer.js | 6629 | 7BAC3C6A4BE128281F9B145A8B4732922B12340DD06AC538A41A26FD0844EA12 |

响应头、body、修复后线上检查 JSON 存于本次审计临时目录；交付的 JSON 报告记录请求 URL、最终 URL、status、Content-Type、长度、SHA-256 和 validator 结果。
Design System 的原 marker `LPL Scriptable Design System` 仍存在，因此未触发同类错误；其旧 validator 同样只有单一字符串校验，候选已补充版本与 module.exports 校验。

## 写入与覆盖安全

Installer 使用 20 秒显式 Request timeout；`Promise.all` 下载并校验所有资源后才读取已有脚本、显示安装确认，再写入 iCloud Scriptable documents。
已有 `LPL Schedule` / `LPL Schedule 2026` 名称均存在时更新两者；只存在一个时更新该名称；全新安装默认 `LPL Schedule 2026`。
备份与写入失败回滚逻辑保留。没有删除用户旧脚本或清理缓存的排障步骤。
DEV 脚本不在覆盖名单中。

## 最小修复及 CI 缺口

原 CI 测试只检查资源 URL、版本比较和已有脚本别名覆盖；没有调用下载 validator，也没有实际请求生产 URL。
候选将主脚本 marker 改为稳定资源身份，并以同一个 validator 检查 Scriptable metadata、语义版本、APP 身份和正式 Design System 导入。直接导入和现有按通道导入均合法；DEV bootstrap、HTML、错误资源、缺失版本或导入仍拒绝。
HTTP 非 200 及 HTML/JSON Content-Type 在下载层拒绝。

新增本地 contract 测试调用 `Installer.js` 的实际 validator 和 downloadResource；新增在线命令同样执行这两个函数，只将 Scriptable Request 映射为真实 HTTP 请求。
Release workflow 在质量检查后、发布前运行在线命令，失败则阻止发布。

```powershell
npm run check
npm run installer:check-production -- --expected-widget-sha256 C6F20C77A2DDE21E637BA3A0BEB375F9C8E3CBE3CDAA7D4D10D7A5C18A0E106E
npm run installer:rc
```

## 正式 Installer RC 真机流程

将 `F:\Hermes-Share\Outbox\Installer-RC-v3.1.2.js` 作为独立安装器脚本导入 Scriptable，保留已有正式主脚本并运行 RC。
RC 内嵌当前工作区的 v3.1.2 正式主脚本与设计系统，并使用与正式 Installer 相同的 validator；因为 Raw main 在验收前仍为 v3.1.1，不能把它当作 RC 主脚本来源。正式 Installer 自更新资源和更新说明仍从真实 Raw main 下载。
因为线上 main 尚未合并修复，RC 将自更新资源替换为内嵌源码重建、再次校验的同一个 RC，防止成功安装或再次运行更新入口后又换回旧 validator。
此桥接只存在于生成的 RC，正式 Installer.js 仍沿用既有 Raw main 自更新路径。
当线上 Installer 已包含修复后的 validator 时，桥接自动退出，正式更新入口重新采用真实线上 Installer；自动测试同时覆盖连续 RC 安装和恢复正式自更新。

验收：正式资源校验成功，组件显示 v3.1.2；确认已有组件绑定继续工作、正式更新入口可再次运行，DEV/设置/缓存保持原状。
在 Wi-Fi 与蜂窝网络下分别手动运行正式组件，确认 GitHub Active 成功，当前 0 场 `TOURNAMENT_FINISHED` 进入正常赛事空窗，不出现毫秒级误超时。若返回 HTTP、解析或数据校验错误，应按原始错误记录，而不是统一视作 timeout。

官方路径使用 DEV 隔离验收：从同一 Outbox 导入 `Installer-Dev-v3.1.2.js`，运行后给 `LPL Schedule DEV` 设置 `dev:stale-remote`，观察 stale remote 拒绝、官方页面加载、解析和最终来源。该 fixture 不写正式缓存。蜂窝网络上曾观测 WebView 页面加载约 14.8 秒；原定应用内 8 秒预算保持不变，这种情况允许显示真实的官方超时，不把“页面加载成功”等同于“解析成功”。
正式发布仍须通过合并后自动检查、线上资源校验和 Release workflow；保留不可变的 v3.1.1 Tag 和 Release。

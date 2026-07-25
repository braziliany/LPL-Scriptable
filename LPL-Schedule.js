// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: trophy;

/**
 * LPL Schedule Widget
 * 2026 LPL 第三赛段赛程组件
 *
 * 推荐尺寸：中号 / 大号
 * 数据回退顺序：
 * 1. GitHub 仓库中的 data/schedule.json
 * 2. LPL 官方赛事页面
 * 3. Scriptable 本地缓存
 */

const APP = {
  name: "LPL Schedule",
  version: "1.0.0",
  repository:
    "https://github.com/braziliany/LPL-Scriptable",
  rawBase:
    "https://raw.githubusercontent.com/braziliany/LPL-Scriptable/main",
};

const CONFIG = {
  title: "LPL SCHEDULE",
  seasonText: "2026 第三赛段",

  // auto：远程 JSON → 官方页面 → 本地缓存
  // remote：只使用远程 JSON
  // official：只解析官方页面
  dataMode: "auto",

  remoteScheduleUrl: `${APP.rawBase}/data/schedule.json`,
  officialScheduleUrl:
    "https://lpl.qq.com/act/a20200518app/html/schedule.html",
  schedulePageUrl:
    "https://lpl.qq.com/web202301/schedule.html",
  liveUrl: "https://live.bilibili.com/6",

  // 官方页面动态加载等待时间
  officialPageWaitSeconds: 4,

  // 从今天起最多向后寻找多少天
  maxSearchDays: 90,

  // 缓存有效期（小时）
  cacheHours: 12,

  // 中号显示 2 场，大号显示 5 场
  mediumMatches: 2,
  largeMatches: 5,

  highlightedTeams: ["BLG", "AL", "TES", "WBG"],

  theme: {
    backgroundTop: "#292A58",
    backgroundBottom: "#171832",
    yellow: "#FFD34E",
    orange: "#FF7043",
    red: "#FF4D67",
    white: "#F7F7FB",
    secondary: "#AAAAC1",
    muted: "#85869F",
    divider: "#FFFFFF",
  },
};

const TEAM_ALIASES = {
  北京JDG: "JDG",
  苏州LNG: "LNG",
  深圳NIP: "NIP",
  西安WE: "WE",
  上海EDG: "EDG",
  杭州LGD: "LGD",
};

const KNOWN_TEAMS = [
  "BLG",
  "JDG",
  "TES",
  "WBG",
  "AL",
  "EDG",
  "WE",
  "IG",
  "FPX",
  "LNG",
  "NIP",
  "LGD",
  "OMG",
  "UP",
];

const CACHE_FILE = "lpl-schedule-cache.json";

// MARK: - 基础工具

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-");
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function parseLocalDateTime(value) {
  if (value instanceof Date) return value;

  const text = String(value || "").trim();
  const match = text.match(
    /(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) return null;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  );
}

function displayMonthDay(dateString) {
  const parts = String(dateString).split("-").map(Number);
  return `${parts[1]}月${parts[2]}日`;
}

function weekdayText(dateString) {
  const parts = String(dateString).split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
    date.getDay()
  ];
}

function normalizeTeamName(name) {
  let value = String(name || "")
    .replace(/\s+/g, "")
    .trim();

  if (TEAM_ALIASES[value]) return TEAM_ALIASES[value];

  value = value
    .replace(/^(北京|上海|苏州|深圳|西安|杭州)/, "")
    .replace(/电子竞技俱乐部|电竞俱乐部|电子竞技|电竞/g, "");

  return value.toUpperCase();
}

function isKnownTeam(value) {
  return KNOWN_TEAMS.includes(normalizeTeamName(value));
}

function isHighlighted(name) {
  return CONFIG.highlightedTeams.includes(normalizeTeamName(name));
}

function uniqueMatches(matches) {
  const result = [];
  const seen = new Set();

  for (const match of matches) {
    const key = [
      match.startTime,
      normalizeTeamName(match.left),
      normalizeTeamName(match.right),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(match);
  }

  return result;
}

function normalizeStatus(value) {
  const text = String(value || "").toLowerCase();

  if (
    ["live", "playing", "1"].includes(text) ||
    /进行中|比赛中|直播中/.test(text)
  ) {
    return "live";
  }

  if (
    ["finished", "ended", "complete", "2", "3"].includes(text) ||
    /已结束|已完成|比赛结束|完场/.test(text)
  ) {
    return "finished";
  }

  return "upcoming";
}

function normalizeMatch(raw) {
  const startTime =
    raw.startTime ||
    raw.start_time ||
    raw.matchTime ||
    raw.datetime ||
    raw.dateTime ||
    "";

  const date = parseLocalDateTime(startTime);
  if (!date) return null;

  const left = normalizeTeamName(
    raw.left || raw.leftTeam || raw.teamA || raw.home || ""
  );
  const right = normalizeTeamName(
    raw.right || raw.rightTeam || raw.teamB || raw.away || ""
  );

  if (!left || !right || left === right) return null;

  return {
    startTime: `${formatDate(date)} ${pad2(date.getHours())}:${pad2(
      date.getMinutes()
    )}:00`,
    dateString: formatDate(date),
    timestamp: date.getTime(),
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
    left,
    right,
    leftScore: raw.leftScore ?? raw.scoreA ?? raw.homeScore ?? null,
    rightScore: raw.rightScore ?? raw.scoreB ?? raw.awayScore ?? null,
    status: normalizeStatus(raw.status || raw.statusText),
    matchType: String(raw.matchType || raw.bo || "BO3").toUpperCase(),
    stage: String(raw.stage || "常规赛"),
    liveUrl: raw.liveUrl || CONFIG.liveUrl,
  };
}

// MARK: - 缓存

function cachePath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), CACHE_FILE);
}

function readCache() {
  try {
    const fm = FileManager.local();
    const path = cachePath();
    if (!fm.fileExists(path)) return null;

    const payload = JSON.parse(fm.readString(path));
    if (!payload || !Array.isArray(payload.matches)) return null;

    return payload;
  } catch (error) {
    console.warn(`读取缓存失败：${error}`);
    return null;
  }
}

function writeCache(matches, source) {
  try {
    const fm = FileManager.local();
    fm.writeString(
      cachePath(),
      JSON.stringify(
        {
          updatedAt: new Date().toISOString(),
          source,
          matches,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.warn(`写入缓存失败：${error}`);
  }
}

function isCacheFresh(payload) {
  if (!payload?.updatedAt) return false;
  const age = Date.now() - new Date(payload.updatedAt).getTime();
  return age <= CONFIG.cacheHours * 60 * 60 * 1000;
}

// MARK: - 远程 JSON

async function loadRemoteSchedule() {
  const request = new Request(CONFIG.remoteScheduleUrl);
  request.timeoutInterval = 15;
  request.headers = {
    "User-Agent": "Scriptable-LPL-Schedule/1.0",
    "Cache-Control": "no-cache",
  };

  const payload = await request.loadJSON();
  const sourceMatches = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.matches)
    ? payload.matches
    : [];

  const matches = sourceMatches.map(normalizeMatch).filter(Boolean);

  if (!matches.length) {
    throw new Error("远程 schedule.json 中没有有效赛程");
  }

  return uniqueMatches(matches).sort((a, b) => a.timestamp - b.timestamp);
}

// MARK: - 官方页面解析

async function sleep(seconds) {
  await new Promise((resolve) => Timer.schedule(seconds, false, resolve));
}

async function loadOfficialPageText() {
  const webView = new WebView();
  await webView.loadURL(CONFIG.officialScheduleUrl);
  await sleep(CONFIG.officialPageWaitSeconds);

  const text = await webView.evaluateJavaScript(`
    (() => {
      const body = document.body;
      if (!body) return "";
      return body.innerText || "";
    })()
  `);

  if (!text || text.length < 50) {
    throw new Error("官方页面未返回有效文本");
  }

  return text;
}

function cleanLines(text) {
  return String(text)
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function findPreviousTeam(lines, index) {
  for (let i = index - 1; i >= Math.max(0, index - 16); i--) {
    if (isKnownTeam(lines[i])) return normalizeTeamName(lines[i]);
  }
  return null;
}

function findNextTeam(lines, index) {
  for (
    let i = index + 1;
    i <= Math.min(lines.length - 1, index + 16);
    i++
  ) {
    if (isKnownTeam(lines[i])) return normalizeTeamName(lines[i]);
  }
  return null;
}

function nearbyText(lines, index, before = 10, after = 10) {
  return lines
    .slice(
      Math.max(0, index - before),
      Math.min(lines.length, index + after + 1)
    )
    .join(" ");
}

function findStatus(lines, index) {
  return normalizeStatus(nearbyText(lines, index));
}

function findScore(lines, index) {
  const area = lines.slice(
    Math.max(0, index - 10),
    Math.min(lines.length, index + 9)
  );

  // 常见格式：2-1、2 : 0、比分 2-1。
  // LPL 单局大比分只可能是 0–3；限制数字范围可避免把 2026-07 之类日期误判为比分。
  for (const line of area) {
    const match = line.match(/(?:^|\s|比分\s*)([0-3])\s*[:：-]\s*([0-3])(?:\s|$)/);
    if (match) {
      return {
        leftScore: match[1],
        rightScore: match[2],
      };
    }
  }

  // 部分页面会将双方比分拆成相邻的两行。
  for (let i = 0; i < area.length - 1; i++) {
    if (/^[0-3]$/.test(area[i]) && /^[0-3]$/.test(area[i + 1])) {
      return {
        leftScore: area[i],
        rightScore: area[i + 1],
      };
    }
  }

  // 没识别到真实比分时保持为空，避免把缺失数据误显示为 0-0。
  return {
    leftScore: null,
    rightScore: null,
  };
}

function findMatchType(lines, index) {
  const area = nearbyText(lines, index);
  if (/BO5|五局三胜/i.test(area)) return "BO5";
  if (/BO3|三局两胜/i.test(area)) return "BO3";
  return "BO3";
}

function parseOfficialSchedule(text) {
  const lines = cleanLines(text);
  const matches = [];

  for (let index = 0; index < lines.length; index++) {
    const date = parseLocalDateTime(lines[index]);
    if (!date) continue;

    const left = findPreviousTeam(lines, index);
    const right = findNextTeam(lines, index);

    if (!left || !right || left === right) continue;

    const score = findScore(lines, index);

    matches.push({
      startTime: `${formatDate(date)} ${pad2(date.getHours())}:${pad2(
        date.getMinutes()
      )}:00`,
      dateString: formatDate(date),
      timestamp: date.getTime(),
      time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
      left,
      right,
      ...score,
      status: findStatus(lines, index),
      matchType: findMatchType(lines, index),
      stage: "常规赛",
      liveUrl: CONFIG.liveUrl,
    });
  }

  const result = uniqueMatches(matches).sort(
    (a, b) => a.timestamp - b.timestamp
  );

  if (!result.length) {
    throw new Error("官方页面已加载，但未识别到赛程");
  }

  return result;
}

// MARK: - 数据加载

async function loadSchedule() {
  const mode = String(CONFIG.dataMode).toLowerCase();
  const cached = readCache();
  const errors = [];

  if (mode === "auto" || mode === "remote") {
    try {
      const matches = await loadRemoteSchedule();
      writeCache(matches, "remote");
      return { matches, source: "GitHub" };
    } catch (error) {
      errors.push(`GitHub：${error.message || error}`);
      if (mode === "remote") throw error;
    }
  }

  if (mode === "auto" || mode === "official") {
    try {
      const text = await loadOfficialPageText();
      const matches = parseOfficialSchedule(text);
      writeCache(matches, "official");
      return { matches, source: "官方页面" };
    } catch (error) {
      errors.push(`官方页面：${error.message || error}`);
      if (mode === "official") throw error;
    }
  }

  if (cached?.matches?.length) {
    return {
      matches: cached.matches.map(normalizeMatch).filter(Boolean),
      source: isCacheFresh(cached) ? "本地缓存" : "过期缓存",
    };
  }

  throw new Error(errors.join("\n") || "没有可用的赛程数据");
}

function findNextMatchDay(matches) {
  const today = startOfDay(new Date());

  for (let offset = 0; offset <= CONFIG.maxSearchDays; offset++) {
    const dateString = formatDate(addDays(today, offset));
    const dayMatches = matches.filter(
      (match) => match.dateString === dateString
    );

    if (dayMatches.length) {
      return {
        dateString,
        matches: dayMatches,
        offset,
      };
    }
  }

  throw new Error(`未来 ${CONFIG.maxSearchDays} 天没有找到比赛`);
}

// MARK: - 样式

function applyBackground(widget) {
  const gradient = new LinearGradient();
  gradient.colors = [
    new Color(CONFIG.theme.backgroundTop),
    new Color(CONFIG.theme.backgroundBottom),
  ];
  gradient.locations = [0, 1];
  widget.backgroundGradient = gradient;
}

function addHeader(widget, result) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const square = row.addStack();
  square.size = new Size(18, 18);
  square.cornerRadius = 4;
  square.backgroundColor = new Color(CONFIG.theme.yellow);

  row.addSpacer(12);

  const title = row.addText(CONFIG.title);
  title.font = Font.mediumSystemFont(18);
  title.textColor = new Color(CONFIG.theme.white);
  title.minimumScaleFactor = 0.72;

  row.addSpacer();

  const date = row.addText(displayMonthDay(result.dateString));
  date.font = Font.mediumSystemFont(15);
  date.textColor = new Color(CONFIG.theme.secondary);
}

function accentColor(index) {
  return index % 2 === 0 ? CONFIG.theme.yellow : CONFIG.theme.orange;
}

function addAccentBar(row, color) {
  const bar = row.addStack();
  bar.size = new Size(6, 37);
  bar.cornerRadius = 3;
  bar.backgroundColor = new Color(color);
}

function matchSubtitle(match) {
  if (match.status === "live") return `进行中 · ${match.matchType}`;
  if (match.status === "finished") return `已结束 · ${match.matchType}`;
  return `${match.stage || "常规赛"} · ${match.matchType}`;
}

function hasValidScore(match) {
  const left = Number(match.leftScore);
  const right = Number(match.rightScore);

  if (!Number.isInteger(left) || !Number.isInteger(right)) return false;
  if (left < 0 || left > 3 || right < 0 || right > 3) return false;

  // 已结束的 BO3/BO5 不可能是 0-0；这通常代表缺失值或误解析。
  if (match.status === "finished" && left === 0 && right === 0) return false;

  return true;
}

function matchRightValue(match) {
  if (match.status === "live") {
    return hasValidScore(match)
      ? `${match.leftScore}-${match.rightScore}`
      : "LIVE";
  }
  if (match.status === "finished") {
    return hasValidScore(match)
      ? `${match.leftScore}-${match.rightScore}`
      : "已结束";
  }
  return match.time;
}

function addMatchRow(widget, match, index, compact = false) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.url = match.liveUrl || CONFIG.liveUrl;

  const accent = accentColor(index);
  addAccentBar(row, accent);
  row.addSpacer(compact ? 10 : 12);

  const info = row.addStack();
  info.layoutVertically();

  const teams = info.addText(`${match.left}  vs  ${match.right}`);
  teams.font =
    isHighlighted(match.left) || isHighlighted(match.right)
      ? Font.boldSystemFont(compact ? 15 : 17)
      : Font.semiboldSystemFont(compact ? 15 : 17);
  teams.textColor = new Color(CONFIG.theme.white);
  teams.lineLimit = 1;
  teams.minimumScaleFactor = 0.65;

  info.addSpacer(3);

  const subtitle = info.addText(matchSubtitle(match));
  subtitle.font = Font.mediumSystemFont(compact ? 10 : 12);
  subtitle.textColor = new Color(CONFIG.theme.secondary);
  subtitle.lineLimit = 1;

  row.addSpacer();

  const value = row.addText(matchRightValue(match));
  value.font = Font.boldSystemFont(
    compact ? 20 : match.status === "live" ? 20 : 26
  );
  value.textColor = new Color(
    match.status === "live" ? CONFIG.theme.red : accent
  );
  value.minimumScaleFactor = 0.7;
}

function addDivider(widget) {
  const divider = widget.addStack();
  divider.size = new Size(0, 0.5);
  divider.backgroundColor = new Color(CONFIG.theme.divider, 0.08);
}

function addEmptyRow(widget) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  addAccentBar(row, CONFIG.theme.orange);
  row.addSpacer(12);

  const text = row.addText("当日暂无更多比赛");
  text.font = Font.mediumSystemFont(14);
  text.textColor = new Color(CONFIG.theme.secondary);
}

function addFooter(widget, source, result) {
  widget.addSpacer();

  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const left = row.addText(
    result.offset === 0 ? "今日赛程" : `${weekdayText(result.dateString)}赛程`
  );
  left.font = Font.mediumSystemFont(10);
  left.textColor = new Color(CONFIG.theme.muted);

  row.addSpacer();

  const right = row.addText(`${CONFIG.seasonText} · ${source}`);
  right.font = Font.mediumSystemFont(10);
  right.textColor = new Color(CONFIG.theme.muted);
}

function renderMedium(result, source) {
  const widget = new ListWidget();
  widget.setPadding(14, 16, 12, 16);
  widget.url = CONFIG.schedulePageUrl;
  applyBackground(widget);

  addHeader(widget, result);
  widget.addSpacer(12);

  const visible = result.matches.slice(0, CONFIG.mediumMatches);
  visible.forEach((match, index) => {
    addMatchRow(widget, match, index);
    if (index < visible.length - 1) widget.addSpacer(16);
  });

  if (visible.length === 1) {
    widget.addSpacer(16);
    addEmptyRow(widget);
  }

  addFooter(widget, source, result);
  return widget;
}

function renderLarge(result, source) {
  const widget = new ListWidget();
  widget.setPadding(16, 17, 14, 17);
  widget.url = CONFIG.schedulePageUrl;
  applyBackground(widget);

  addHeader(widget, result);
  widget.addSpacer(13);

  const visible = result.matches.slice(0, CONFIG.largeMatches);
  visible.forEach((match, index) => {
    addMatchRow(widget, match, index, true);

    if (index < visible.length - 1) {
      widget.addSpacer(8);
      addDivider(widget);
      widget.addSpacer(8);
    }
  });

  addFooter(widget, source, result);
  return widget;
}

function renderSmall(result) {
  const widget = new ListWidget();
  widget.setPadding(14, 14, 13, 14);
  widget.url = CONFIG.schedulePageUrl;
  applyBackground(widget);

  const square = widget.addStack();
  square.size = new Size(17, 17);
  square.cornerRadius = 4;
  square.backgroundColor = new Color(CONFIG.theme.yellow);

  widget.addSpacer(10);

  const date = widget.addText(displayMonthDay(result.dateString));
  date.font = Font.boldSystemFont(18);
  date.textColor = new Color(CONFIG.theme.white);

  widget.addSpacer(5);

  const first = result.matches[0];
  const teams = widget.addText(`${first.left} vs ${first.right}`);
  teams.font = Font.semiboldSystemFont(15);
  teams.textColor = new Color(CONFIG.theme.white);
  teams.lineLimit = 2;
  teams.minimumScaleFactor = 0.7;

  widget.addSpacer();

  const value = widget.addText(matchRightValue(first));
  value.font = Font.boldSystemFont(26);
  value.textColor = new Color(
    first.status === "live" ? CONFIG.theme.red : CONFIG.theme.yellow
  );

  return widget;
}

function renderError(error) {
  const widget = new ListWidget();
  widget.setPadding(16, 16, 14, 16);
  applyBackground(widget);

  const top = widget.addStack();
  top.layoutHorizontally();
  top.centerAlignContent();

  const square = top.addStack();
  square.size = new Size(18, 18);
  square.cornerRadius = 4;
  square.backgroundColor = new Color(CONFIG.theme.orange);

  top.addSpacer(12);

  const title = top.addText(CONFIG.title);
  title.font = Font.mediumSystemFont(18);
  title.textColor = new Color(CONFIG.theme.white);

  widget.addSpacer(18);

  const heading = widget.addText("赛程获取失败");
  heading.font = Font.boldSystemFont(20);
  heading.textColor = new Color(CONFIG.theme.white);

  widget.addSpacer(6);

  const message = widget.addText(String(error?.message || error));
  message.font = Font.mediumSystemFont(11);
  message.textColor = new Color(CONFIG.theme.secondary);
  message.lineLimit = 6;

  widget.addSpacer();

  const version = widget.addText(`${APP.name} · v${APP.version}`);
  version.font = Font.mediumSystemFont(10);
  version.textColor = new Color(CONFIG.theme.muted);

  return widget;
}

async function buildWidget() {
  const data = await loadSchedule();
  const result = findNextMatchDay(data.matches);

  if (config.widgetFamily === "small") {
    return renderSmall(result);
  }

  if (config.widgetFamily === "large") {
    return renderLarge(result, data.source);
  }

  return renderMedium(result, data.source);
}

async function main() {
  let widget;

  try {
    widget = await buildWidget();
  } catch (error) {
    console.error(error);
    widget = renderError(error);
  }

  Script.setWidget(widget);

  if (!config.runsInWidget) {
    const parameter = String(args.widgetParameter || "").toLowerCase();

    if (parameter === "large") {
      await widget.presentLarge();
    } else if (parameter === "small") {
      await widget.presentSmall();
    } else {
      await widget.presentMedium();
    }
  }

  Script.complete();
}

await main();

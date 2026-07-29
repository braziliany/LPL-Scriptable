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
  version: "2.0.0",
  repository:
    "https://github.com/braziliany/LPL-Scriptable",
  rawBase:
    "https://raw.githubusercontent.com/braziliany/LPL-Scriptable/main",
};

const DesignSystem = importModule("LPL-Design-System");
const TYPOGRAPHY = DesignSystem.typography;
const LAYOUT = DesignSystem.layout;

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
  liveUrl: "https://lpl.qq.com/web202301/schedule.html",
  bilibiliLiveUrl: "https://live.bilibili.com/6",
  livePlatform: "official",

  // 官方页面动态加载等待时间
  officialPageWaitSeconds: 4,

  // 从今天起最多向后寻找多少天
  maxSearchDays: 90,

  // 缓存有效期（小时）
  cacheHours: 12,

  // 实时状态：开赛前 60 分钟显示倒计时；直播时建议 3 分钟后刷新
  countdownMinutes: 60,
  liveRefreshMinutes: 3,
  nearMatchRefreshMinutes: 5,
  normalRefreshMinutes: 15,

  highlightedTeams: ["BLG", "AL", "TES", "WBG"],
  themeMode: "dark",
  theme: DesignSystem.resolvePalette("dark"),
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
  "TT",
];
// 官方 Logo 均为 200×200 透明画布，但图案占比不同。
// 以下系数根据非透明像素边界计算，使队标在相同容器中视觉大小接近。
const TEAM_LOGO_SCALES = {
  AL: 1.31,
  BLG: 1.34,
  EDG: 1.38,
  IG: 1.38,
  JDG: 1.25,
  LGD: 1.43,
  LNG: 1.35,
  NIP: 1.25,
  TES: 1.51,
  TT: 1.34,
  WE: 1.27,
  WBG: 1.43,
};

const CACHE_FILE = "lpl-schedule-cache.json";
const SETTINGS_FILE = "lpl-schedule-settings.json";
const REFRESH_PROFILES = {
  realtime: {
    label: "实时",
    liveMinutes: 2,
    nearMatchMinutes: 3,
    normalMinutes: 10,
  },
  balanced: {
    label: "均衡",
    liveMinutes: 3,
    nearMatchMinutes: 5,
    normalMinutes: 15,
  },
  battery: {
    label: "省电",
    liveMinutes: 5,
    nearMatchMinutes: 10,
    normalMinutes: 30,
  },
};
const DEFAULT_SETTINGS = {
  dataMode: CONFIG.dataMode,
  highlightedTeams: [...CONFIG.highlightedTeams],
  livePlatform: CONFIG.livePlatform,
  cacheHours: CONFIG.cacheHours,
  refreshProfile: "balanced",
  themeMode: CONFIG.themeMode,
};
const MATCH_VALUE_METRICS = {
  medium: {
    fontSize: TYPOGRAPHY.value,
    minimumScaleFactor: 0.6,
    width: LAYOUT.valueWidth,
  },
  large: {
    fontSize: TYPOGRAPHY.valueCompact,
    minimumScaleFactor: 0.65,
    width: LAYOUT.valueWidthCompact,
  },
  small: {
    fontSize: TYPOGRAPHY.valueSmall,
    minimumScaleFactor: 0.6,
    width: 0,
  },
};

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

// MARK: - 用户设置

function resolveThemeMode(mode, isDarkAppearance = true) {
  return DesignSystem.resolveThemeMode(mode, isDarkAppearance);
}

function applyThemeMode(mode) {
  const isDarkAppearance =
    typeof Device !== "undefined" &&
    typeof Device.isUsingDarkAppearance === "function"
      ? Device.isUsingDarkAppearance()
      : true;
  const resolved = resolveThemeMode(mode, isDarkAppearance);
  CONFIG.themeMode = mode;
  CONFIG.theme = DesignSystem.resolvePalette(resolved);
  return resolved;
}

function normalizeUserSettings(value) {
  const raw = value && typeof value === "object" ? value : {};
  const dataMode = ["auto", "remote", "official"].includes(
    String(raw.dataMode || "").toLowerCase()
  )
    ? String(raw.dataMode).toLowerCase()
    : DEFAULT_SETTINGS.dataMode;

  const highlightedTeams = Array.isArray(raw.highlightedTeams)
    ? [
        ...new Set(
          raw.highlightedTeams
            .map(normalizeTeamName)
            .filter((team) => KNOWN_TEAMS.includes(team))
        ),
      ]
    : [...DEFAULT_SETTINGS.highlightedTeams];
  const livePlatform = ["official", "bilibili"].includes(
    String(raw.livePlatform || "").toLowerCase()
  )
    ? String(raw.livePlatform).toLowerCase()
    : DEFAULT_SETTINGS.livePlatform;
  const cacheHours = [1, 3, 6, 12, 24].includes(Number(raw.cacheHours))
    ? Number(raw.cacheHours)
    : DEFAULT_SETTINGS.cacheHours;
  const refreshProfile = Object.prototype.hasOwnProperty.call(
    REFRESH_PROFILES,
    String(raw.refreshProfile || "").toLowerCase()
  )
    ? String(raw.refreshProfile).toLowerCase()
    : DEFAULT_SETTINGS.refreshProfile;
  const themeMode = ["auto", "dark", "light"].includes(
    String(raw.themeMode || "").toLowerCase()
  )
    ? String(raw.themeMode).toLowerCase()
    : DEFAULT_SETTINGS.themeMode;

  return {
    dataMode,
    highlightedTeams,
    livePlatform,
    cacheHours,
    refreshProfile,
    themeMode,
  };
}

function settingsPath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), SETTINGS_FILE);
}

function readUserSettings() {
  try {
    const fm = FileManager.local();
    const path = settingsPath();
    if (!fm.fileExists(path)) return normalizeUserSettings(DEFAULT_SETTINGS);
    return normalizeUserSettings(JSON.parse(fm.readString(path)));
  } catch (error) {
    console.warn(`读取设置失败，使用默认值：${error}`);
    return normalizeUserSettings(DEFAULT_SETTINGS);
  }
}

function writeUserSettings(settings) {
  const normalized = normalizeUserSettings(settings);
  FileManager.local().writeString(
    settingsPath(),
    JSON.stringify(normalized, null, 2)
  );
  return normalized;
}

function applyUserSettings(settings) {
  const normalized = normalizeUserSettings(settings);
  CONFIG.dataMode = normalized.dataMode;
  CONFIG.highlightedTeams = [...normalized.highlightedTeams];
  CONFIG.livePlatform = normalized.livePlatform;
  CONFIG.cacheHours = normalized.cacheHours;
  applyThemeMode(normalized.themeMode);

  const refresh = REFRESH_PROFILES[normalized.refreshProfile];
  CONFIG.liveRefreshMinutes = refresh.liveMinutes;
  CONFIG.nearMatchRefreshMinutes = refresh.nearMatchMinutes;
  CONFIG.normalRefreshMinutes = refresh.normalMinutes;
  return normalized;
}

function settingsUrl() {
  const url = URLScheme.forRunningScript();
  return `${url}${url.includes("?") ? "&" : "?"}action=settings`;
}

async function editHighlightedTeams(current) {
  const alert = new Alert();
  alert.title = "关注队伍";
  alert.message = `可选：${KNOWN_TEAMS.join(", ")}\n使用逗号或空格分隔。`;
  alert.addTextField("例如：BLG, AL, TES", current.join(", "));
  alert.addAction("保存");
  alert.addCancelAction("取消");

  if ((await alert.present()) === -1) return current;
  return String(alert.textFieldValue(0) || "")
    .split(/[\s,，、]+/)
    .filter(Boolean);
}

async function chooseDataMode(current) {
  const modes = [
    ["auto", "自动回退"],
    ["remote", "只用 GitHub"],
    ["official", "只用官方页面"],
  ];
  const alert = new Alert();
  alert.title = "数据来源";
  alert.message = `当前：${current}`;
  modes.forEach(([, label]) => alert.addAction(label));
  alert.addCancelAction("取消");

  const choice = await alert.present();
  return choice === -1 ? current : modes[choice][0];
}

async function chooseLivePlatform(current) {
  const platforms = [
    ["official", "LPL 官方"],
    ["bilibili", "哔哩哔哩"],
  ];
  const alert = new Alert();
  alert.title = "直播平台";
  alert.message = `当前：${current}`;
  platforms.forEach(([, label]) => alert.addAction(label));
  alert.addCancelAction("取消");

  const choice = await alert.present();
  return choice === -1 ? current : platforms[choice][0];
}

async function chooseCacheHours(current) {
  const values = [1, 3, 6, 12, 24];
  const alert = new Alert();
  alert.title = "缓存有效期";
  alert.message = `当前：${current} 小时`;
  values.forEach((value) => alert.addAction(`${value} 小时`));
  alert.addCancelAction("取消");

  const choice = await alert.present();
  return choice === -1 ? current : values[choice];
}

async function chooseRefreshProfile(current) {
  const entries = Object.entries(REFRESH_PROFILES);
  const alert = new Alert();
  alert.title = "刷新频率";
  alert.message = "实时更新更快，省电模式刷新更少。";
  entries.forEach(([, profile]) =>
    alert.addAction(
      `${profile.label}（直播 ${profile.liveMinutes} 分钟）`
    )
  );
  alert.addCancelAction("取消");

  const choice = await alert.present();
  return choice === -1 ? current : entries[choice][0];
}

async function chooseThemeMode(current) {
  const modes = [
    ["auto", "跟随系统"],
    ["dark", "深蓝主题"],
    ["light", "浅色主题"],
  ];
  const alert = new Alert();
  alert.title = "组件主题";
  alert.message = `当前：${current}`;
  modes.forEach(([, label]) => alert.addAction(label));
  alert.addCancelAction("取消");

  const choice = await alert.present();
  return choice === -1 ? current : modes[choice][0];
}

async function presentSettings() {
  let settings = readUserSettings();

  while (true) {
    const alert = new Alert();
    alert.title = "LPL Schedule 设置";
    alert.message = [
      `关注：${settings.highlightedTeams.join(", ") || "无"}`,
      `数据：${settings.dataMode}`,
      `直播：${settings.livePlatform}`,
      `缓存：${settings.cacheHours} 小时`,
      `刷新：${REFRESH_PROFILES[settings.refreshProfile].label}`,
      `主题：${settings.themeMode}`,
    ].join("\n");
    alert.addAction("关注队伍");
    alert.addAction("数据来源");
    alert.addAction("直播平台");
    alert.addAction("缓存有效期");
    alert.addAction("刷新频率");
    alert.addAction("组件主题");
    alert.addDestructiveAction("恢复默认设置");
    alert.addCancelAction("完成");

    const choice = await alert.present();
    if (choice === -1) break;

    if (choice === 0) {
      settings.highlightedTeams = await editHighlightedTeams(
        settings.highlightedTeams
      );
    } else if (choice === 1) {
      settings.dataMode = await chooseDataMode(settings.dataMode);
    } else if (choice === 2) {
      settings.livePlatform = await chooseLivePlatform(
        settings.livePlatform
      );
    } else if (choice === 3) {
      settings.cacheHours = await chooseCacheHours(settings.cacheHours);
    } else if (choice === 4) {
      settings.refreshProfile = await chooseRefreshProfile(
        settings.refreshProfile
      );
    } else if (choice === 5) {
      settings.themeMode = await chooseThemeMode(settings.themeMode);
    } else if (choice === 6) {
      settings = normalizeUserSettings(DEFAULT_SETTINGS);
    }

    settings = writeUserSettings(settings);
  }

  applyUserSettings(settings);
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
    /进行中|比赛中|直播中|正在直播|比赛直播|赛事直播/.test(text)
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
    leftLogo: String(raw.leftLogo || ""),
    rightLogo: String(raw.rightLogo || ""),
    leftScore: raw.leftScore ?? raw.scoreA ?? raw.homeScore ?? null,
    rightScore: raw.rightScore ?? raw.scoreB ?? raw.awayScore ?? null,
    status: normalizeStatus(raw.status || raw.statusText),
    matchType: String(raw.matchType || raw.bo || "BO3").toUpperCase(),
    stage: String(raw.stage || "常规赛"),
    liveUrl: raw.liveUrl || CONFIG.liveUrl,
  };
}

// MARK: - 缓存

function logoCacheFileName(team) {
  const safeName =
    normalizeTeamName(team).replace(/[^A-Z0-9_-]/g, "") || "UNKNOWN";
  return `lpl-team-logo-${safeName}.png`;
}

function teamLogoScale(team) {
  return TEAM_LOGO_SCALES[normalizeTeamName(team)] || 1.35;
}

function normalizeTeamLogoImage(image, team) {
  const canvasSize = 64;
  const scale = teamLogoScale(team);
  const drawSize = canvasSize * scale;
  const offset = (canvasSize - drawSize) / 2;
  const context = new DrawContext();
  context.size = new Size(canvasSize, canvasSize);
  context.opaque = false;
  context.respectScreenScale = true;
  context.drawImageInRect(
    image,
    new Rect(offset, offset, drawSize, drawSize)
  );
  return context.getImage();
}

function placeholderTeamLogo() {
  return SFSymbol.named("shield.fill").image;
}

async function loadTeamLogo(url, team) {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), logoCacheFileName(team));

  try {
    if (fm.fileExists(path)) {
      return normalizeTeamLogoImage(fm.readImage(path), team);
    }
    if (!/^https?:\/\//i.test(String(url || ""))) {
      return placeholderTeamLogo();
    }

    const request = new Request(url);
    request.timeoutInterval = 10;
    const image = await request.loadImage();
    fm.writeImage(path, image);
    return normalizeTeamLogoImage(image, team);
  } catch (error) {
    console.warn(`队伍 Logo 加载失败（${team}）：${error}`);
    return placeholderTeamLogo();
  }
}

async function prepareMatchLogos(matches) {
  await Promise.all(
    matches.map(async (match) => {
      [match.leftLogoImage, match.rightLogoImage] = await Promise.all([
        loadTeamLogo(match.leftLogo, match.left),
        loadTeamLogo(match.rightLogo, match.right),
      ]);
    })
  );
  return matches;
}

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

function validScoreValues(matchType) {
  return matchType === "BO5"
    ? new Set([
        "1-0",
        "0-1",
        "1-1",
        "2-0",
        "0-2",
        "2-1",
        "1-2",
        "2-2",
        "3-0",
        "3-1",
        "3-2",
        "0-3",
        "1-3",
        "2-3",
      ])
    : new Set(["1-0", "0-1", "1-1", "2-0", "2-1", "0-2", "1-2"]);
}

function isValidScore(matchType, leftScore, rightScore) {
  const left = Number(leftScore);
  const right = Number(rightScore);

  if (!Number.isInteger(left) || !Number.isInteger(right)) return false;
  return validScoreValues(matchType).has(`${left}-${right}`);
}

function findScore(lines, index, matchType) {
  const area = lines.slice(
    Math.max(0, index - 10),
    Math.min(lines.length, index + 9)
  );

  // 常见格式：2-1、2 : 0、比分 2-1。
  // 只接受对应赛制可达的比分，日期和 0-0 等无效组合会被排除。
  for (const line of area) {
    const match = line.match(/(?:^|\s|比分\s*)([0-3])\s*[:：-]\s*([0-3])(?:\s|$)/);
    if (match && isValidScore(matchType, match[1], match[2])) {
      return {
        leftScore: match[1],
        rightScore: match[2],
      };
    }
  }

  // 官方页面会将比分拆成三行（2、:、1），部分页面则拆成相邻两行。
  for (let i = 0; i < area.length - 1; i++) {
    const separatorOffset = /^[:：-]$/.test(area[i + 1]) ? 1 : 0;
    const rightIndex = i + 1 + separatorOffset;
    if (rightIndex >= area.length) continue;

    if (
      /^[0-3]$/.test(area[i]) &&
      /^[0-3]$/.test(area[rightIndex]) &&
      isValidScore(matchType, area[i], area[rightIndex])
    ) {
      return {
        leftScore: area[i],
        rightScore: area[rightIndex],
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

    const matchType = findMatchType(lines, index);
    const score = findScore(lines, index, matchType);

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
      matchType,
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

function sortMatchesByTime(matches) {
  // 实时状态只影响文案和刷新频率，不改变赛程的时间顺序。
  return [...matches].sort((a, b) => a.timestamp - b.timestamp);
}

function findNextMatchDay(matches, now = new Date()) {
  const today = startOfDay(now);
  let finishedToday = null;

  for (let offset = 0; offset <= CONFIG.maxSearchDays; offset++) {
    const dateString = formatDate(addDays(today, offset));
    const dayMatches = matches.filter(
      (match) => match.dateString === dateString
    );

    // 当天全部结束后自动展示下一个比赛日；未来比赛日不受此规则影响。
    const allFinished =
      dayMatches.length > 0 &&
      dayMatches.every((match) => match.status === "finished");

    if (offset === 0 && allFinished) {
      finishedToday = {
        dateString,
        matches: sortMatchesByTime(dayMatches),
        offset,
      };
      continue;
    }

    if (dayMatches.length && !(offset === 0 && allFinished)) {
      return {
        dateString,
        matches: sortMatchesByTime(dayMatches),
        offset,
      };
    }
  }

  // 赛季最后一个比赛日结束后保留当天最终赛果。
  if (finishedToday) return finishedToday;

  throw new Error(`未来 ${CONFIG.maxSearchDays} 天没有找到比赛`);
}

// MARK: - 样式

function applyBackground(widget) {
  DesignSystem.applyCardBackground(widget, CONFIG.theme);
}

function addHeader(widget, result) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  // 使用整个标题栏作为设置入口，避免 18×18 的方块难以点中。
  row.url = settingsUrl();

  const square = row.addStack();
  square.size = new Size(LAYOUT.headerSquare, LAYOUT.headerSquare);
  square.cornerRadius = 4;
  square.backgroundColor = new Color(CONFIG.theme.yellow);
  square.url = settingsUrl();

  row.addSpacer(LAYOUT.headerGap);

  const title = row.addText(CONFIG.title);
  title.font = Font.mediumSystemFont(TYPOGRAPHY.header);
  title.textColor = new Color(CONFIG.theme.white);
  title.minimumScaleFactor = 0.72;

  row.addSpacer();

  const date = row.addText(displayMonthDay(result.dateString));
  date.font = Font.mediumSystemFont(TYPOGRAPHY.date);
  date.textColor = new Color(CONFIG.theme.secondary);
}

function accentColor(index) {
  return index % 2 === 0 ? CONFIG.theme.yellow : CONFIG.theme.orange;
}

function matchWinner(match) {
  if (match.status !== "finished" || !hasValidScore(match)) return null;
  const left = Number(match.leftScore);
  const right = Number(match.rightScore);
  if (left === right) return null;
  return left > right ? "left" : "right";
}

function matchVisualStyle(match, index, now = new Date()) {
  const winner = matchWinner(match);
  const highlighted =
    isHighlighted(match.left) || isHighlighted(match.right);
  const countdown = countdownText(match, now);

  return {
    accent:
      match.status === "live"
        ? CONFIG.theme.red
        : match.status === "finished"
          ? CONFIG.theme.yellow
          : highlighted
            ? CONFIG.theme.yellow
            : accentColor(index),
    leftColor:
      winner && winner !== "left"
        ? CONFIG.theme.muted
        : CONFIG.theme.white,
    rightColor:
      winner && winner !== "right"
        ? CONFIG.theme.muted
        : CONFIG.theme.white,
    leftOpacity: winner && winner !== "left" ? 0.5 : 1,
    rightOpacity: winner && winner !== "right" ? 0.5 : 1,
    valueColor:
      match.status === "live"
        ? CONFIG.theme.red
        : countdown
          ? CONFIG.theme.orange
          : match.status === "finished"
            ? CONFIG.theme.yellow
            : highlighted
              ? CONFIG.theme.yellow
              : accentColor(index),
    subtitleColor:
      match.status === "live"
        ? CONFIG.theme.red
        : CONFIG.theme.secondary,
  };
}

function addAccentBar(row, color, compact = false) {
  const bar = row.addStack();
  bar.size = new Size(6, compact ? 29 : 37);
  bar.cornerRadius = 3;
  bar.backgroundColor = new Color(color);
}

function hasValidScore(match) {
  return isValidScore(match.matchType, match.leftScore, match.rightScore);
}

function countdownText(match, now = new Date()) {
  if (match.status !== "upcoming") return null;

  const remainingMs = match.timestamp - now.getTime();
  if (remainingMs <= 0) return "即将开始";

  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
  if (remainingMinutes > CONFIG.countdownMinutes) return null;
  return `还有${remainingMinutes}分钟`;
}

function matchSubtitle(match, now = new Date()) {
  if (match.status === "live") {
    return hasValidScore(match)
      ? `进行中 · ${match.matchType}`
      : `直播中 · 比分待更新 · ${match.matchType}`;
  }
  if (match.status === "finished") {
    return hasValidScore(match)
      ? `已结束 · ${match.matchType}`
      : `已结束 · 比分待确认 · ${match.matchType}`;
  }

  const countdown = countdownText(match, now);
  return countdown
    ? `${countdown} · ${match.matchType}`
    : `未开始 · ${match.matchType}`;
}

function matchRightValue(match, now = new Date()) {
  if (match.status === "live") {
    return hasValidScore(match)
      ? `${match.leftScore}-${match.rightScore}`
      : "进行中";
  }
  if (match.status === "finished") {
    return hasValidScore(match)
      ? `${match.leftScore}-${match.rightScore}`
      : "已结束";
  }
  return countdownText(match, now) || match.time;
}

function matchValueMetrics(layout) {
  return (
    MATCH_VALUE_METRICS[layout] || MATCH_VALUE_METRICS.medium
  );
}

function matchValueFont(size) {
  // 旧版 Scriptable 不支持等宽粗体时回退到系统粗体。
  return typeof Font.boldMonospacedSystemFont === "function"
    ? Font.boldMonospacedSystemFont(size)
    : Font.boldSystemFont(size);
}

function shouldUseCompactMedium(matches) {
  return Array.isArray(matches) && matches.length >= 3;
}

function nextRefreshDate(matches, now = new Date()) {
  let refreshMinutes = CONFIG.normalRefreshMinutes;

  if (matches.some((match) => match.status === "live")) {
    refreshMinutes = CONFIG.liveRefreshMinutes;
  } else {
    const nextMatch = matches
      .filter(
        (match) =>
          match.status === "upcoming" && match.timestamp > now.getTime()
      )
      .sort((a, b) => a.timestamp - b.timestamp)[0];

    if (nextMatch) {
      const remainingMinutes =
        (nextMatch.timestamp - now.getTime()) / (60 * 1000);
      if (remainingMinutes <= CONFIG.countdownMinutes) {
        refreshMinutes = CONFIG.nearMatchRefreshMinutes;
      } else {
        // 尽量在进入倒计时窗口时唤醒，同时不超过常规刷新间隔。
        refreshMinutes = Math.min(
          CONFIG.normalRefreshMinutes,
          Math.max(1, remainingMinutes - CONFIG.countdownMinutes)
        );
      }
    }
  }

  return new Date(now.getTime() + refreshMinutes * 60 * 1000);
}

function configureRefresh(widget, result, now = new Date()) {
  widget.refreshAfterDate = nextRefreshDate(result.matches, now);
}

function resolveMatchUrl(match, livePlatform = CONFIG.livePlatform) {
  if (match.status === "live" && livePlatform === "bilibili") {
    return CONFIG.bilibiliLiveUrl;
  }
  return match.liveUrl || CONFIG.liveUrl;
}

function addTeamLogo(stack, image, size, opacity = 1) {
  const logo = stack.addImage(image || placeholderTeamLogo());
  logo.imageSize = new Size(size, size);
  logo.cornerRadius = Math.round(size * 0.2);
  logo.imageOpacity = opacity;
  logo.resizable = true;
}

function addMatchRow(widget, match, index, compact = false, now = new Date()) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.url = resolveMatchUrl(match);

  const visual = matchVisualStyle(match, index, now);
  addAccentBar(row, visual.accent, compact);
  row.addSpacer(compact ? 10 : 12);

  const content = row.addStack();
  content.layoutVertically();

  const top = content.addStack();
  top.layoutHorizontally();
  top.centerAlignContent();

  const logoSize = compact ? LAYOUT.logoCompact : LAYOUT.logo;
  addTeamLogo(top, match.leftLogoImage, logoSize, visual.leftOpacity);
  top.addSpacer(6);

  const leftTeam = top.addText(match.left);
  leftTeam.font = Font.semiboldSystemFont(
    compact ? TYPOGRAPHY.teamCompact : TYPOGRAPHY.team
  );
  leftTeam.textColor = new Color(visual.leftColor);
  leftTeam.lineLimit = 1;
  leftTeam.minimumScaleFactor = 0.68;

  const versus = top.addText("  vs  ");
  versus.font = Font.mediumSystemFont(
    compact ? TYPOGRAPHY.versusCompact : TYPOGRAPHY.versus
  );
  versus.textColor = new Color(CONFIG.theme.secondary);
  versus.lineLimit = 1;
  versus.minimumScaleFactor = 0.8;

  const rightTeam = top.addText(match.right);
  rightTeam.font = Font.semiboldSystemFont(
    compact ? TYPOGRAPHY.teamCompact : TYPOGRAPHY.team
  );
  rightTeam.textColor = new Color(visual.rightColor);
  rightTeam.lineLimit = 1;
  rightTeam.minimumScaleFactor = 0.68;

  top.addSpacer(6);
  addTeamLogo(top, match.rightLogoImage, logoSize, visual.rightOpacity);
  top.addSpacer();

  const metrics = matchValueMetrics(compact ? "large" : "medium");
  const valueBox = top.addStack();
  valueBox.size = new Size(metrics.width, 0);
  valueBox.layoutHorizontally();
  valueBox.addSpacer();

  const value = valueBox.addText(matchRightValue(match, now));
  value.font = matchValueFont(metrics.fontSize);
  value.textColor = new Color(visual.valueColor);
  value.lineLimit = 1;
  value.minimumScaleFactor = metrics.minimumScaleFactor;

  content.addSpacer(3);

  const subtitle = content.addText(matchSubtitle(match, now));
  subtitle.font = Font.mediumSystemFont(
    compact ? TYPOGRAPHY.subtitleCompact : TYPOGRAPHY.subtitle
  );
  subtitle.textColor = new Color(visual.subtitleColor);
  subtitle.lineLimit = 1;
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
  const now = new Date();
  widget.setPadding(14, 16, 12, 16);
  widget.url = CONFIG.schedulePageUrl;
  configureRefresh(widget, result, now);
  applyBackground(widget);

  addHeader(widget, result);
  const visible = result.matches;
  const compact = shouldUseCompactMedium(visible);
  widget.addSpacer(compact ? 8 : 12);

  visible.forEach((match, index) => {
    addMatchRow(widget, match, index, compact, now);
    if (index < visible.length - 1) {
      widget.addSpacer(compact ? 7 : 16);
    }
  });

  if (visible.length === 1) {
    widget.addSpacer(compact ? 7 : 16);
    addEmptyRow(widget);
  }

  addFooter(widget, source, result);
  return widget;
}

function renderLarge(result, source) {
  const widget = new ListWidget();
  const now = new Date();
  widget.setPadding(16, 17, 14, 17);
  widget.url = CONFIG.schedulePageUrl;
  configureRefresh(widget, result, now);
  applyBackground(widget);

  addHeader(widget, result);
  widget.addSpacer(13);

  const visible = result.matches;
  visible.forEach((match, index) => {
    addMatchRow(widget, match, index, true, now);

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
  const now = new Date();
  const first = result.matches[0];
  const visual = matchVisualStyle(first, 0, now);
  widget.setPadding(14, 14, 13, 14);
  widget.url = CONFIG.schedulePageUrl;
  configureRefresh(widget, result, now);
  applyBackground(widget);

  const square = widget.addStack();
  square.size = new Size(17, 17);
  square.cornerRadius = 4;
  square.backgroundColor = new Color(visual.accent);
  square.url = settingsUrl();

  widget.addSpacer(10);

  const date = widget.addText(displayMonthDay(result.dateString));
  date.font = Font.boldSystemFont(18);
  date.textColor = new Color(CONFIG.theme.white);
  date.url = settingsUrl();

  widget.addSpacer(5);

  const teamRow = widget.addStack();
  teamRow.layoutHorizontally();
  teamRow.centerAlignContent();
  addTeamLogo(
    teamRow,
    first.leftLogoImage,
    LAYOUT.logoSmall,
    visual.leftOpacity
  );
  teamRow.addSpacer(6);

  const leftTeam = teamRow.addText(first.left);
  leftTeam.font = Font.semiboldSystemFont(TYPOGRAPHY.teamSmall);
  leftTeam.textColor = new Color(visual.leftColor);
  leftTeam.lineLimit = 1;
  leftTeam.minimumScaleFactor = 0.7;

  const versus = teamRow.addText(" vs ");
  versus.font = Font.mediumSystemFont(TYPOGRAPHY.versusCompact);
  versus.textColor = new Color(CONFIG.theme.secondary);
  versus.lineLimit = 1;

  const rightTeam = teamRow.addText(first.right);
  rightTeam.font = Font.semiboldSystemFont(TYPOGRAPHY.teamSmall);
  rightTeam.textColor = new Color(visual.rightColor);
  rightTeam.lineLimit = 1;
  rightTeam.minimumScaleFactor = 0.7;

  teamRow.addSpacer(6);
  addTeamLogo(
    teamRow,
    first.rightLogoImage,
    LAYOUT.logoSmall,
    visual.rightOpacity
  );

  widget.addSpacer();

  const metrics = matchValueMetrics("small");
  const value = widget.addText(matchRightValue(first, now));
  value.font = matchValueFont(metrics.fontSize);
  value.textColor = new Color(visual.valueColor);
  value.lineLimit = 1;
  value.minimumScaleFactor = metrics.minimumScaleFactor;

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
  await prepareMatchLogos(result.matches);

  if (config.widgetFamily === "small") {
    return renderSmall(result);
  }

  if (config.widgetFamily === "large") {
    return renderLarge(result, data.source);
  }

  return renderMedium(result, data.source);
}

async function main() {
  applyUserSettings(readUserSettings());

  if (
    !config.runsInWidget &&
    String(
      args.queryParameters?.action ||
        args.shortcutParameter ||
        args.widgetParameter ||
        ""
    ).toLowerCase() === "settings"
  ) {
    await presentSettings();
    Script.complete();
    return;
  }

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

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_URL =
  "https://lpl.qq.com/web201612/data/LOL_MATCH2_MATCH_HOMEPAGE_BMATCH_LIST.js";
const TEAM_SOURCE_URL =
  "https://lpl.qq.com/web201612/data/LOL_MATCH2_TEAM_LIST.js";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "schedule.json");
function resolveSeasonConfig(environment = process.env) {
  const year = Number(environment.LPL_YEAR || 2026);
  const stage = String(environment.LPL_STAGE || "第三赛段").trim();
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    throw new Error(`LPL_YEAR 无效：${environment.LPL_YEAR}`);
  }
  if (!stage) throw new Error("LPL_STAGE 不能为空");
  return { year, stage };
}

const SEASON = resolveSeasonConfig();
const OFFICIAL_BASE_URL = "https://lpl.qq.com/web202301";
const REQUEST_RETRY_ATTEMPTS = 3;
const REQUEST_RETRY_BASE_DELAY_MS = 1000;
const MATCH_GROUPS = {
  登峰组: new Set(["AL", "BLG", "EDG", "JDG", "LGD", "TES", "TT", "WE"]),
  涅槃组: new Set(["IG", "LNG", "NIP", "WBG"]),
};

function inferMatchGroup(left, right) {
  const teams = [left, right].map((team) =>
    String(team || "")
      .trim()
      .toUpperCase()
  );
  for (const [group, members] of Object.entries(MATCH_GROUPS)) {
    if (teams.every((team) => members.has(team))) return group;
  }
  return "";
}

function inferMatchGroupForStage(stage, left, right) {
  return /组内赛/.test(String(stage || "")) ? inferMatchGroup(left, right) : "";
}

function buildMatchUrl(match) {
  const matchId = encodeURIComponent(String(match.bMatchId || ""));
  const gameId = encodeURIComponent(String(match.GameId || ""));
  const newsId = encodeURIComponent(String(match.NewsId || ""));

  if (String(match.MatchStatus) === "2" && matchId && gameId) {
    return `${OFFICIAL_BASE_URL}/live.html?bgid=${gameId}&bmid=${matchId}`;
  }

  if (String(match.MatchStatus) === "3" && newsId && newsId !== "0") {
    return `${OFFICIAL_BASE_URL}/video_detail.shtml?nid=${newsId}`;
  }

  if (String(match.MatchStatus) === "3" && matchId) {
    return `${OFFICIAL_BASE_URL}/stats.shtml?bmid=${matchId}`;
  }

  return `${OFFICIAL_BASE_URL}/schedule.html`;
}

function normalizeStatus(value) {
  if (String(value) === "2") return "live";
  if (String(value) === "3") return "finished";
  return "upcoming";
}

function normalizeUpdatedAt(value) {
  const match = String(value || "").match(
    /^(20\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/
  );
  if (!match) return new Date().toISOString();
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`;
}

function parseTeamListScript(text) {
  const match = String(text || "")
    .trim()
    .match(/^var\s+TeamList\s*=\s*([\s\S]+?);?\s*$/);
  if (!match) throw new Error("官方队伍接口返回格式无效");

  const payload = JSON.parse(match[1]);
  if (
    String(payload?.status) !== "0" ||
    !payload?.msg ||
    typeof payload.msg !== "object"
  ) {
    throw new Error("官方队伍接口返回格式无效");
  }
  return payload;
}

function normalizeLogoUrl(value) {
  const url = String(value || "").trim();
  if (url.startsWith("//")) return `https:${url}`;
  if (/^https?:\/\//i.test(url)) return url;
  return "";
}

function shouldRetryStatus(status) {
  return Number(status) === 429 || Number(status) >= 500;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(
  url,
  options = {},
  {
    attempts = REQUEST_RETRY_ATTEMPTS,
    baseDelayMs = REQUEST_RETRY_BASE_DELAY_MS,
    fetchImpl = globalThis.fetch,
    sleepImpl = delay,
  } = {}
) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(url, options);
      if (!shouldRetryStatus(response.status) || attempt === attempts) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }

    const waitMs = baseDelayMs * 2 ** (attempt - 1);
    console.warn(
      `请求失败，第 ${attempt}/${attempts} 次，${waitMs}ms 后重试：${lastError.message}`
    );
    await sleepImpl(waitMs);
  }

  throw lastError;
}

function transformSchedule(
  payload,
  teamPayload = null,
  previousSchedule = null,
  observedAt = new Date().toISOString()
) {
  if (String(payload?.status) !== "0" || !Array.isArray(payload?.msg)) {
    throw new Error("官方赛程接口返回格式无效");
  }

  const yearPrefix = `${SEASON.year}-`;
  const previousById = new Map(
    (previousSchedule?.matches || []).map((match) => [String(match.id), match])
  );
  const matches = payload.msg
    .filter(
      (match) =>
        String(match.MatchDate || "").startsWith(yearPrefix) &&
        String(match.GameName || "").includes(`${SEASON.year}职业联赛`) &&
        String(match.GameTypeName || "").includes(SEASON.stage)
    )
    .map((match) => {
      const leftTeam = teamPayload?.msg?.[String(match.TeamA)] || {};
      const rightTeam = teamPayload?.msg?.[String(match.TeamB)] || {};
      const id = String(match.bMatchId || "");
      const previous = previousById.get(id);
      const status = normalizeStatus(match.MatchStatus);
      const stage = String(match.GameTypeName || SEASON.stage);
      const leftScore =
        String(match.MatchStatus) === "1" ? null : Number(match.ScoreA);
      const rightScore =
        String(match.MatchStatus) === "1" ? null : Number(match.ScoreB);
      const scoreChanged =
        !previous ||
        previous.status !== status ||
        previous.leftScore !== leftScore ||
        previous.rightScore !== rightScore;
      const scoreUpdatedAt =
        status === "upcoming"
          ? null
          : scoreChanged
            ? observedAt
            : previous.scoreUpdatedAt || null;
      const finishedAt =
        status === "finished"
          ? previous?.status === "finished"
            ? previous.finishedAt || previous.scoreUpdatedAt || observedAt
            : observedAt
          : null;

      return {
        id,
        gameId: String(match.GameId || ""),
        startTime: String(match.MatchDate),
        left: String(match.TeamShortNameA || "")
          .trim()
          .toUpperCase(),
        right: String(match.TeamShortNameB || "")
          .trim()
          .toUpperCase(),
        leftLogo: normalizeLogoUrl(leftTeam.TeamLogo),
        rightLogo: normalizeLogoUrl(rightTeam.TeamLogo),
        status,
        matchType: String(match.GameModeName || "BO3").toUpperCase(),
        stage,
        phase: String(match.GameProcName || ""),
        group: inferMatchGroupForStage(
          stage,
          match.TeamShortNameA,
          match.TeamShortNameB
        ),
        leftScore,
        rightScore,
        scoreUpdatedAt,
        finishedAt,
        liveUrl: buildMatchUrl(match),
      };
    })
    .filter(
      (match) =>
        match.id &&
        new RegExp(`^${SEASON.year}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$`).test(
          match.startTime
        ) &&
        match.left &&
        match.right &&
        match.left !== match.right
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const uniqueMatches = [
    ...new Map(matches.map((match) => [match.id, match])).values(),
  ];

  if (!uniqueMatches.length) {
    throw new Error(`官方数据中没有 ${SEASON.year} LPL ${SEASON.stage}赛程`);
  }

  return {
    season: `${SEASON.year} LPL ${SEASON.stage}`,
    updatedAt: normalizeUpdatedAt(payload.lastUpTime),
    source: SOURCE_URL,
    matches: uniqueMatches,
  };
}

async function updateSchedule() {
  const requestOptions = {
    headers: {
      Accept: "application/json",
      "User-Agent": "LPL-Scriptable-Schedule-Updater/1.0",
    },
  };
  const [response, teamResponse] = await Promise.all([
    fetchWithRetry(SOURCE_URL, requestOptions),
    fetchWithRetry(TEAM_SOURCE_URL, requestOptions),
  ]);

  if (!response.ok) {
    throw new Error(`官方赛程请求失败：HTTP ${response.status}`);
  }
  if (!teamResponse.ok) {
    throw new Error(`官方队伍请求失败：HTTP ${teamResponse.status}`);
  }

  const teamPayload = parseTeamListScript(await teamResponse.text());
  let previousSchedule = null;
  try {
    previousSchedule = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  } catch (error) {
    console.warn(`未读取到旧赛程，将创建新的状态时间线：${error.message}`);
  }
  const schedule = transformSchedule(
    await response.json(),
    teamPayload,
    previousSchedule
  );
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(schedule, null, 2)}\n`);
  console.log(
    `已更新 ${schedule.matches.length} 场比赛，官方数据时间：${schedule.updatedAt}`
  );
}

if (require.main === module) {
  updateSchedule().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildMatchUrl,
  fetchWithRetry,
  inferMatchGroup,
  inferMatchGroupForStage,
  normalizeLogoUrl,
  normalizeStatus,
  normalizeUpdatedAt,
  parseTeamListScript,
  resolveSeasonConfig,
  shouldRetryStatus,
  transformSchedule,
};

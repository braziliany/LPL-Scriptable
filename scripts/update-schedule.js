const fs = require("node:fs");
const path = require("node:path");

const SOURCE_URL =
  "https://lpl.qq.com/web201612/data/LOL_MATCH2_MATCH_HOMEPAGE_BMATCH_LIST.js";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "schedule.json");
const TARGET_YEAR = 2026;
const TARGET_STAGE = "第三赛段";
const LIVE_URL = "https://live.bilibili.com/6";

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

function transformSchedule(payload) {
  if (String(payload?.status) !== "0" || !Array.isArray(payload?.msg)) {
    throw new Error("官方赛程接口返回格式无效");
  }

  const yearPrefix = `${TARGET_YEAR}-`;
  const matches = payload.msg
    .filter(
      (match) =>
        String(match.MatchDate || "").startsWith(yearPrefix) &&
        String(match.GameName || "").includes(`${TARGET_YEAR}职业联赛`) &&
        String(match.GameTypeName || "").includes(TARGET_STAGE)
    )
    .map((match) => ({
      id: String(match.bMatchId || ""),
      startTime: String(match.MatchDate),
      left: String(match.TeamShortNameA || "").trim().toUpperCase(),
      right: String(match.TeamShortNameB || "").trim().toUpperCase(),
      status: normalizeStatus(match.MatchStatus),
      matchType: String(match.GameModeName || "BO3").toUpperCase(),
      stage: String(match.GameTypeName || TARGET_STAGE),
      leftScore:
        String(match.MatchStatus) === "1" ? null : Number(match.ScoreA),
      rightScore:
        String(match.MatchStatus) === "1" ? null : Number(match.ScoreB),
      liveUrl: LIVE_URL,
    }))
    .filter(
      (match) =>
        match.id &&
        /^2026-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(match.startTime) &&
        match.left &&
        match.right &&
        match.left !== match.right
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const uniqueMatches = [
    ...new Map(matches.map((match) => [match.id, match])).values(),
  ];

  if (!uniqueMatches.length) {
    throw new Error(`官方数据中没有 ${TARGET_YEAR} LPL ${TARGET_STAGE}赛程`);
  }

  return {
    season: `${TARGET_YEAR} LPL ${TARGET_STAGE}`,
    updatedAt: normalizeUpdatedAt(payload.lastUpTime),
    source: SOURCE_URL,
    matches: uniqueMatches,
  };
}

async function updateSchedule() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "LPL-Scriptable-Schedule-Updater/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`官方赛程请求失败：HTTP ${response.status}`);
  }

  const schedule = transformSchedule(await response.json());
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
  normalizeStatus,
  normalizeUpdatedAt,
  transformSchedule,
};

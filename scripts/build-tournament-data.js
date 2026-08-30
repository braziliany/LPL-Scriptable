const fs = require("node:fs");
const path = require("node:path");
const { generateActiveFile } = require("./generate-active");

const ROOT = path.join(__dirname, "..");
const LEGACY_PATH = path.join(ROOT, "data", "schedule.json");
const REGULAR_ID = "lpl-2026-split3-regular";
const PLAYOFFS_ID = "lpl-2026-split3-playoffs";
const REGIONAL_FINALS_ID = "lpl-2026-regional-finals";

function toTournamentMatch(match, tournamentId) {
  return {
    id: String(match.id || ""),
    gameId: String(match.gameId || ""),
    tournamentId,
    startTime: match.startTime,
    left: match.left,
    right: match.right,
    leftLogo: String(match.leftLogo || ""),
    rightLogo: String(match.rightLogo || ""),
    status: match.status,
    matchType: match.matchType,
    stage: String(match.stage || ""),
    phase: String(match.phase || ""),
    group: String(match.group || ""),
    leftScore: match.leftScore ?? null,
    rightScore: match.rightScore ?? null,
    scoreUpdatedAt: match.scoreUpdatedAt || null,
    finishedAt: match.finishedAt || null,
    liveUrl: String(match.liveUrl || ""),
    detailUrl: String(match.detailUrl || match.liveUrl || ""),
  };
}

function splitLegacySchedule(legacySchedule) {
  const regularMatches = [];
  const playoffMatches = [];
  const regionalFinalsMatches = [];
  for (const match of legacySchedule.matches || []) {
    const isRegular = /组内赛|常规赛/.test(String(match.stage || ""));
    const isRegionalFinals = /资格赛/.test(String(match.stage || ""));
    const tournamentId = isRegular
      ? REGULAR_ID
      : isRegionalFinals
        ? REGIONAL_FINALS_ID
        : PLAYOFFS_ID;
    const normalized = toTournamentMatch(match, tournamentId);
    (isRegular
      ? regularMatches
      : isRegionalFinals
        ? regionalFinalsMatches
        : playoffMatches
    ).push(normalized);
  }

  const schedule = (tournamentId, matches) => ({
    tournamentId,
    updatedAt: legacySchedule.updatedAt,
    source: legacySchedule.source || null,
    matches,
  });
  return {
    [REGULAR_ID]: schedule(REGULAR_ID, regularMatches),
    [PLAYOFFS_ID]: schedule(PLAYOFFS_ID, playoffMatches),
    [REGIONAL_FINALS_ID]: schedule(REGIONAL_FINALS_ID, regionalFinalsMatches),
  };
}

function writeTournamentSchedules(legacySchedule, root = ROOT) {
  const schedules = splitLegacySchedule(legacySchedule);
  for (const [tournamentId, schedule] of Object.entries(schedules)) {
    const outputPath = path.join(
      root,
      "data",
      "schedules",
      `${tournamentId}.json`
    );
    fs.writeFileSync(outputPath, `${JSON.stringify(schedule, null, 2)}\n`);
  }
  return schedules;
}

function buildTournamentData({
  root = ROOT,
  now = process.env.ACTIVE_NOW,
} = {}) {
  const legacySchedule = JSON.parse(
    fs.readFileSync(path.join(root, "data", "schedule.json"), "utf8")
  );
  const schedules = writeTournamentSchedules(legacySchedule, root);
  const active = generateActiveFile({ now: now || new Date(), root });
  return { schedules, active };
}

if (require.main === module) {
  const result = buildTournamentData();
  console.log(
    `已生成赛事路由数据：常规赛 ${result.schedules[REGULAR_ID].matches.length} 场，季后赛 ${result.schedules[PLAYOFFS_ID].matches.length} 场，资格赛 ${result.schedules[REGIONAL_FINALS_ID].matches.length} 场`
  );
}

module.exports = {
  PLAYOFFS_ID,
  REGIONAL_FINALS_ID,
  REGULAR_ID,
  buildTournamentData,
  splitLegacySchedule,
  toTournamentMatch,
  writeTournamentSchedules,
};

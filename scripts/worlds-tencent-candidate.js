// Converts a locally saved Tencent LPL feed into a private Worlds candidate.
// It never requests data or writes a production schedule.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  SOURCE_URL,
  buildMatchUrl,
  normalizeLogoUrl,
  parseTeamListScript,
} = require("./update-schedule");

const ROOT = path.join(__dirname, "..");
const FEED_URL = SOURCE_URL;
const OFFICIAL_URL = "https://lpl.qq.com/web202301/schedule.html";
const EVENT_ID = "246";
const EVENT_NAME = "2026全球总决赛";
const TOURNAMENT_ID = "worlds-2026";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function beijingDateTime(value, worldsWindow = false) {
  invariant(
    /^2026-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value || ""),
    "比赛时间无效"
  );
  const date = new Date(`${value.replace(" ", "T")}+08:00`);
  invariant(
    Number.isFinite(date.getTime()) &&
      new Date(date.getTime() + 8 * 3600_000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ") === value &&
      (!worldsWindow ||
        (value.slice(0, 10) >= "2026-10-15" &&
          value.slice(0, 10) <= "2026-11-15")),
    "比赛时间或北京时间窗口无效"
  );
  return value;
}

function teamIdentity(id, shortName, teamPayload) {
  invariant(/^[1-9]\d*$/.test(String(id || "")), "队伍 ID 无效");
  const record = teamPayload.msg[String(id)];
  invariant(record && String(record.TeamId) === String(id), "队伍表缺失或冲突");
  const name = String(record.TeamName || "")
    .trim()
    .toUpperCase();
  const short = String(shortName || "")
    .trim()
    .toUpperCase();
  invariant(
    /^[A-Z0-9]+$/.test(name) &&
      (!short ||
        short === name ||
        short ===
          String(record.TeamShortName || "")
            .trim()
            .toUpperCase()),
    "队伍简称与队伍表冲突"
  );
  invariant((name === "TBD") === (String(id) === "297"), "TBD 身份冲突");
  return {
    code: short || name,
    participant: {
      kind: name === "TBD" ? "placeholder" : "team",
      id: String(id),
    },
    logo: name === "TBD" ? "" : normalizeLogoUrl(record.TeamLogo),
  };
}

function mapMatch(row, teamPayload, observedAt, previous) {
  const id = String(row.bMatchId || "");
  invariant(/^[1-9]\d*$/.test(id), "比赛 ID 无效");
  invariant(
    row.GameId === EVENT_ID && row.GameName === EVENT_NAME,
    "赛事身份冲突"
  );
  const startTime = beijingDateTime(row.MatchDate, true);
  const matchType = String(row.GameModeName || "").toUpperCase();
  invariant(["BO1", "BO3", "BO5"].includes(matchType), "BO 无效");
  const left = teamIdentity(row.TeamA, row.TeamShortNameA, teamPayload);
  const right = teamIdentity(row.TeamB, row.TeamShortNameB, teamPayload);
  invariant(
    left.participant.id !== right.participant.id ||
      (left.code === "TBD" && right.code === "TBD"),
    "同队对阵无效"
  );
  const states = { 1: "upcoming", 2: "live", 3: "finished" };
  const status = states[String(row.MatchStatus)];
  invariant(status, "比赛状态无效");
  const leftScore = status === "upcoming" ? null : Number(row.ScoreA);
  const rightScore = status === "upcoming" ? null : Number(row.ScoreB);
  if (status !== "upcoming") {
    const needed = (Number(matchType.slice(2)) + 1) / 2;
    invariant(
      Number.isInteger(leftScore) &&
        Number.isInteger(rightScore) &&
        leftScore >= 0 &&
        rightScore >= 0 &&
        leftScore <= needed &&
        rightScore <= needed &&
        left.code !== "TBD" &&
        right.code !== "TBD",
      "比赛比分无效"
    );
    if (status === "finished")
      invariant(
        (leftScore === needed && rightScore < leftScore) ||
          (rightScore === needed && leftScore < rightScore),
        "完赛比分与 BO 冲突"
      );
  }
  const scoreChanged =
    !previous ||
    previous.status !== status ||
    previous.leftScore !== leftScore ||
    previous.rightScore !== rightScore;
  return {
    id,
    gameId: EVENT_ID,
    tournamentId: TOURNAMENT_ID,
    startTime,
    left: left.code,
    right: right.code,
    leftLogo: left.logo,
    rightLogo: right.logo,
    status,
    matchType,
    stage: String(row.GameTypeName || "").trim(),
    phase: String(row.GameProcName || "").trim(),
    leftScore,
    rightScore,
    scoreUpdatedAt:
      status === "upcoming"
        ? null
        : scoreChanged
          ? observedAt
          : previous.scoreUpdatedAt || observedAt,
    finishedAt:
      status !== "finished"
        ? null
        : previous?.status === "finished"
          ? previous.finishedAt || observedAt
          : observedAt,
    liveUrl: buildMatchUrl(row),
    detailUrl: OFFICIAL_URL,
    participants: {
      version: 1,
      source: {
        provider: "tencent-lpl",
        url: OFFICIAL_URL,
        eventId: EVENT_ID,
        matchId: id,
      },
      left: left.participant,
      right: right.participant,
    },
  };
}

function convertTencentWorlds(
  payload,
  teamPayload,
  { observedAt, previousSchedule = null, feedSha256 = null } = {}
) {
  invariant(
    String(payload?.status) === "0" && Array.isArray(payload.msg),
    "腾讯赛程响应结构无效"
  );
  invariant(
    String(teamPayload?.status) === "0" &&
      teamPayload.msg &&
      typeof teamPayload.msg === "object",
    "腾讯队伍响应结构无效"
  );
  invariant(
    typeof observedAt === "string" &&
      new Date(observedAt).toISOString() === observedAt,
    "采集时间无效"
  );
  beijingDateTime(String(payload.lastUpTime || ""));
  const updatedAt = `${payload.lastUpTime.replace(" ", "T")}+08:00`;
  const sourceTime = new Date(updatedAt).getTime();
  const observedTime = new Date(observedAt).getTime();
  invariant(
    sourceTime <= observedTime && observedTime - sourceTime <= 48 * 3600_000,
    "腾讯 feed 数据已过期或时间超前"
  );
  invariant(
    feedSha256 === null || /^[a-f0-9]{64}$/.test(feedSha256),
    "来源哈希无效"
  );
  const conflict = payload.msg.some(
    (row) => (row.GameId === EVENT_ID) !== (row.GameName === EVENT_NAME)
  );
  invariant(!conflict, "赛事身份冲突");
  const selected = payload.msg.filter(
    (row) => row.GameId === EVENT_ID && row.GameName === EVENT_NAME
  );
  invariant(selected.length > 0, "腾讯 feed 中没有 Worlds 2026");
  const allIds = new Set();
  for (const row of payload.msg) {
    const id = String(row.bMatchId || "");
    invariant(!allIds.has(id), "腾讯 feed 存在重复比赛 ID");
    allIds.add(id);
  }
  const previous = new Map(
    (previousSchedule?.matches || []).map((match) => [match.id, match])
  );
  const matches = selected
    .map((row) =>
      mapMatch(row, teamPayload, observedAt, previous.get(String(row.bMatchId)))
    )
    .sort(
      (left, right) =>
        left.startTime.localeCompare(right.startTime) ||
        left.id.localeCompare(right.id)
    );
  invariant(
    matches.every((match) => match.stage),
    "比赛阶段缺失"
  );
  const current = new Map(matches.map((match) => [match.id, match]));
  const addedIds = [...current.keys()].filter((id) => !previous.has(id)).sort();
  const removedIds = [...previous.keys()]
    .filter((id) => !current.has(id))
    .sort();
  const changedIds = [...current.keys()]
    .filter(
      (id) =>
        previous.has(id) &&
        JSON.stringify(previous.get(id)) !== JSON.stringify(current.get(id))
    )
    .sort();
  const schedule = {
    tournamentId: TOURNAMENT_ID,
    updatedAt,
    observedAt,
    source: FEED_URL,
    sourceUrl: OFFICIAL_URL,
    sourceAuthorization: "NOT_VERIFIED",
    classification: "PARTIAL_OBSERVED",
    coverageVerified: false,
    coverageStart: matches[0].startTime.slice(0, 10),
    coverageEnd: matches.at(-1).startTime.slice(0, 10),
    feedEventId: EVENT_ID,
    feedSha256,
    matches,
  };
  return {
    schedule,
    audit: {
      observedAt,
      sourceUpdatedAt: updatedAt,
      source: FEED_URL,
      feedSha256,
      feedEventId: EVENT_ID,
      matchCount: matches.length,
      coverageStart: schedule.coverageStart,
      coverageEnd: schedule.coverageEnd,
      stageCounts: Object.fromEntries(
        [...new Set(matches.map((match) => match.stage))].map((stage) => [
          stage,
          matches.filter((match) => match.stage === stage).length,
        ])
      ),
      addedIds,
      removedIds,
      changedIds,
      publicationBlocked: true,
      publicationBlocker: "SOURCE_AUTHORIZATION_NOT_VERIFIED",
    },
  };
}

function option(args, name) {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? null : args[index + 1];
}

function createPrivateCandidate(args) {
  const matchesPath = option(args, "matches");
  const teamsPath = option(args, "teams");
  const outDir = option(args, "out");
  const observedAt = option(args, "observed-at");
  const previousPath = option(args, "previous");
  invariant(matchesPath && teamsPath && outDir && observedAt, "候选参数不完整");
  const relative = path.relative(ROOT, path.resolve(outDir));
  invariant(
    path.isAbsolute(relative) ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`),
    "候选目录必须在仓库外"
  );
  const feedBytes = fs.readFileSync(matchesPath);
  const payload = JSON.parse(feedBytes);
  const teamPayload = parseTeamListScript(fs.readFileSync(teamsPath, "utf8"));
  const previousSchedule = previousPath
    ? JSON.parse(fs.readFileSync(previousPath, "utf8"))
    : null;
  const candidate = convertTencentWorlds(payload, teamPayload, {
    observedAt,
    previousSchedule,
    feedSha256: sha256(feedBytes),
  });
  fs.mkdirSync(outDir, { recursive: true });
  const schedulePath = path.join(outDir, "worlds-tencent-candidate.json");
  const auditPath = path.join(outDir, "worlds-tencent-audit.json");
  fs.writeFileSync(schedulePath, json(candidate.schedule), { flag: "wx" });
  fs.writeFileSync(auditPath, json(candidate.audit), { flag: "wx" });
  return { schedulePath, auditPath, ...candidate.audit };
}

if (require.main === module) {
  try {
    process.stdout.write(json(createPrivateCandidate(process.argv.slice(2))));
  } catch (error) {
    console.error(`腾讯 Worlds 候选转换失败：${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  EVENT_ID,
  EVENT_NAME,
  FEED_URL,
  OFFICIAL_URL,
  convertTencentWorlds,
  createPrivateCandidate,
};

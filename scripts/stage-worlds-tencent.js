// Manually stages a private Tencent Worlds release candidate outside this repository.
// This tool cannot publish or mark unverified data as authorized.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");
const { buildActive, loadTournamentData } = require("./generate-active");
const {
  SOURCE_URL,
  TEAM_SOURCE_URL,
  fetchWithRetry,
  parseTeamListScript,
} = require("./update-schedule");
const { convertTencentWorlds } = require("./worlds-tencent-candidate");

const ROOT = path.join(__dirname, "..");
const WORLDS_ID = "worlds-2026";
const DIFF_FIELDS = [
  "startTime",
  "left",
  "right",
  "matchType",
  "stage",
  "phase",
  "status",
  "leftScore",
  "rightScore",
  "participants",
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJson(root, name) {
  return JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
}

function validateSchema(schema, value, ajv, label) {
  const validate = ajv.compile(schema);
  invariant(validate(value), `${label}: ${ajv.errorsText(validate.errors)}`);
}

function validateCandidate(schedule, active, root = ROOT) {
  const ids = new Set();
  for (const match of schedule.matches) {
    const timestamp = Date.parse(`${match.startTime.replace(" ", "T")}+08:00`);
    invariant(
      Number.isFinite(timestamp) &&
        new Date(timestamp + 8 * 3600_000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ") === match.startTime,
      "北京时间转换无效"
    );
    invariant(
      match.tournamentId === WORLDS_ID &&
        match.gameId === "246" &&
        match.participants?.source?.provider === "tencent-lpl" &&
        match.participants.source.eventId === "246" &&
        match.participants.source.matchId === match.id &&
        match.detailUrl === match.participants.source.url &&
        !ids.has(match.id),
      "Worlds 比赛身份或唯一 ID 无效"
    );
    ids.add(match.id);
  }
  invariant(
    schedule.matches.every(
      (match, index) =>
        index === 0 ||
        schedule.matches[index - 1].startTime < match.startTime ||
        (schedule.matches[index - 1].startTime === match.startTime &&
          schedule.matches[index - 1].id < match.id)
    ),
    "Worlds 比赛排序无效"
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(readJson(root, "data/match.schema.json"));
  ajv.addSchema(readJson(root, "data/tournaments.schema.json"));
  const scheduleSchema = readJson(root, "data/tournament-schedule.schema.json");
  const activeSchema = readJson(root, "data/active.schema.json");
  const candidateScheduleSchema = structuredClone(scheduleSchema);
  const candidateActiveSchema = structuredClone(activeSchema);
  candidateScheduleSchema.$id += "?private-candidate";
  candidateActiveSchema.$id += "?private-candidate";
  for (const schema of [candidateScheduleSchema, candidateActiveSchema]) {
    schema.properties.sourceAuthorization = { const: "NOT_VERIFIED" };
    schema.properties.coverageVerified = { const: false };
  }
  validateSchema(candidateScheduleSchema, schedule, ajv, "Worlds 候选结构无效");
  validateSchema(candidateActiveSchema, active, ajv, "Active 候选结构无效");

  // Check production shape in memory. No VERIFIED value is written to disk.
  validateSchema(
    scheduleSchema,
    { ...schedule, sourceAuthorization: "VERIFIED", coverageVerified: true },
    ajv,
    "Worlds 正式结构不兼容"
  );
  validateSchema(
    activeSchema,
    { ...active, sourceAuthorization: "VERIFIED", coverageVerified: true },
    ajv,
    "Active 正式结构不兼容"
  );
  invariant(
    active.tournament?.id === WORLDS_ID &&
      active.businessState === "MATCHES" &&
      active.matches.length > 0 &&
      active.matches.every((match) => match.tournamentId === WORLDS_ID),
    "Active 未选择 Worlds 的有效比赛"
  );
  return {
    candidateSchema: "PASS",
    productionShape: "PASS_STRUCTURAL_ONLY",
    productionGate: "BLOCKED",
  };
}

function compareMatches(previousSchedule, schedule) {
  const previous = new Map(
    (previousSchedule?.matches || []).map((match) => [match.id, match])
  );
  const current = new Map(schedule.matches.map((match) => [match.id, match]));
  const addedIds = [...current.keys()].filter((id) => !previous.has(id)).sort();
  const removedIds = [...previous.keys()]
    .filter((id) => !current.has(id))
    .sort();
  const changes = [...current.keys()]
    .filter((id) => previous.has(id))
    .map((id) => ({
      id,
      fields: Object.fromEntries(
        DIFF_FIELDS.filter(
          (field) =>
            JSON.stringify(previous.get(id)[field]) !==
            JSON.stringify(current.get(id)[field])
        ).map((field) => [
          field,
          { before: previous.get(id)[field], after: current.get(id)[field] },
        ])
      ),
    }))
    .filter((change) => Object.keys(change.fields).length);
  return { addedIds, removedIds, changes };
}

function privateOutputPath(outDir, root) {
  invariant(
    typeof outDir === "string" && path.isAbsolute(outDir),
    "候选目录须为绝对路径"
  );
  const resolved = path.resolve(outDir);
  const relative = path.relative(root, resolved);
  invariant(
    path.isAbsolute(relative) ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`),
    "候选目录必须位于仓库外"
  );
  invariant(!fs.existsSync(resolved), "候选目录已存在，不得覆盖");
  return resolved;
}

function stageWorldsTencent({
  matchesText,
  teamsText,
  observedAt,
  previousSchedule = null,
  outDir,
  root = ROOT,
  failurePoint = null,
}) {
  const output = privateOutputPath(outDir, root);
  const matchBytes = Buffer.from(matchesText);
  const teamBytes = Buffer.from(teamsText);
  const payload = JSON.parse(matchesText);
  const teamPayload = parseTeamListScript(teamsText);
  const converted = convertTencentWorlds(payload, teamPayload, {
    observedAt,
    previousSchedule,
    feedSha256: sha256(matchBytes),
  });
  const { tournaments, schedules } = loadTournamentData(root);
  const candidate = converted.schedule;
  const schedule = {
    tournamentId: candidate.tournamentId,
    updatedAt: candidate.updatedAt,
    source: candidate.source,
    classification: candidate.classification,
    sourceAuthorization: candidate.sourceAuthorization,
    coverageVerified: candidate.coverageVerified,
    sourceUrl: candidate.sourceUrl,
    coverageStart: candidate.coverageStart,
    coverageEnd: candidate.coverageEnd,
    matches: candidate.matches,
  };
  const active = buildActive(new Date(observedAt), tournaments, {
    ...schedules,
    [WORLDS_ID]: schedule,
  });
  const validation = validateCandidate(schedule, active, root);
  const differences = compareMatches(previousSchedule, schedule);
  const final = schedule.matches.find(
    (match) => match.startTime.slice(0, 10) === "2026-11-15"
  );
  invariant(final?.matchType === "BO5", "11 月 15 日决赛缺失或 BO 无效");
  const blockers = [
    "SOURCE_AUTHORIZATION_NOT_VERIFIED",
    "COVERAGE_NOT_VERIFIED",
  ];
  if (differences.removedIds.length)
    blockers.push("PREVIOUS_MATCH_IDS_MISSING");
  const summary = {
    observedAt,
    sourceUpdatedAt: candidate.updatedAt,
    sourceUrl: candidate.sourceUrl,
    feedSha256: sha256(matchBytes),
    teamsSha256: sha256(teamBytes),
    eventId: "246",
    matchCount: schedule.matches.length,
    timeBasis: "Asia/Shanghai (+08:00)",
    statusCounts: Object.fromEntries(
      ["upcoming", "live", "finished", "postponed", "cancelled"].map(
        (status) => [
          status,
          schedule.matches.filter((match) => match.status === status).length,
        ]
      )
    ),
    boCounts: Object.fromEntries(
      ["BO1", "BO3", "BO5"].map((bo) => [
        bo,
        schedule.matches.filter((match) => match.matchType === bo).length,
      ])
    ),
    coverageStart: schedule.coverageStart,
    coverageEnd: schedule.coverageEnd,
    classification: "PARTIAL_OBSERVED",
    selectedDate: active.selectedDate,
    selectedMatches: active.matches.length,
    finalId: final.id,
    finalStartTime: final.startTime,
    ...validation,
    blockers,
  };
  const baseline = {
    worldsSha256: sha256(
      fs.readFileSync(path.join(root, "data/schedules/worlds-2026.json"))
    ),
    activeSha256: sha256(fs.readFileSync(path.join(root, "data/active.json"))),
  };
  const candidateHashes = {
    worldsSha256: sha256(`${JSON.stringify(schedule, null, 2)}\n`),
    activeSha256: sha256(`${JSON.stringify(active, null, 2)}\n`),
  };
  const artifacts = {
    "worlds-2026.candidate.json": schedule,
    "active.candidate.json": active,
    "differences.json": differences,
    "validation.json": summary,
    "publication-record.json": {
      status: "PREPARED_NOT_PUBLISHED",
      publishPermitted: false,
      productionBefore: baseline,
      privateCandidate: candidateHashes,
      blockers,
      rollback:
        "正式文件未写入；失败时保持既有 worlds-2026.json 与 active.json",
    },
  };
  const parent = path.dirname(output);
  fs.mkdirSync(parent, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(parent, ".worlds-stage-"));
  invariant(path.dirname(temporary) === parent, "临时目录不在隔离目录内");
  try {
    for (const [name, value] of Object.entries(artifacts)) {
      fs.writeFileSync(
        path.join(temporary, name),
        `${JSON.stringify(value, null, 2)}\n`,
        {
          flag: "wx",
        }
      );
    }
    fs.writeFileSync(path.join(temporary, "matches.feed.json"), matchBytes, {
      flag: "wx",
    });
    fs.writeFileSync(path.join(temporary, "teams.feed.js"), teamBytes, {
      flag: "wx",
    });
    if (failurePoint === "beforeCommit")
      throw new Error("注入：候选切换前失败");
    fs.renameSync(temporary, output);
  } finally {
    if (fs.existsSync(temporary) && path.dirname(temporary) === parent) {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
  return { outDir: output, ...summary, ...differences };
}

function option(args, name) {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? null : args[index + 1];
}

async function main(args) {
  const outDir = option(args, "out");
  const matchesPath = option(args, "matches");
  const teamsPath = option(args, "teams");
  invariant(outDir, "须指定仓库外 --out 目录");
  invariant(
    Boolean(matchesPath) === Boolean(teamsPath),
    "须同时指定赛程和队伍文件"
  );
  const requestOptions = {
    headers: {
      Accept: "application/json",
      "User-Agent": "LPL-Scriptable-Schedule-Updater/1.0",
    },
  };
  let matchesText;
  let teamsText;
  let observedAt;
  if (matchesPath) {
    matchesText = fs.readFileSync(matchesPath, "utf8");
    teamsText = fs.readFileSync(teamsPath, "utf8");
    observedAt = option(args, "observed-at");
    invariant(observedAt, "本地来源须提供实际采集时间 --observed-at");
  } else {
    const [matchesResponse, teamsResponse] = await Promise.all([
      fetchWithRetry(SOURCE_URL, requestOptions),
      fetchWithRetry(TEAM_SOURCE_URL, requestOptions),
    ]);
    invariant(matchesResponse.ok && teamsResponse.ok, "腾讯来源请求失败");
    matchesText = await matchesResponse.text();
    teamsText = await teamsResponse.text();
    observedAt = new Date().toISOString();
  }
  const previousPath = option(args, "previous");
  const previousSchedule = previousPath
    ? JSON.parse(fs.readFileSync(previousPath, "utf8"))
    : null;
  return stageWorldsTencent({
    matchesText,
    teamsText,
    observedAt,
    previousSchedule,
    outDir,
  });
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((result) =>
      console.log(
        JSON.stringify(
          {
            outDir: result.outDir,
            observedAt: result.observedAt,
            sourceUpdatedAt: result.sourceUpdatedAt,
            matchCount: result.matchCount,
            selectedDate: result.selectedDate,
            selectedMatches: result.selectedMatches,
            added: result.addedIds.length,
            removed: result.removedIds.length,
            changed: result.changes.length,
            productionGate: result.productionGate,
            blockers: result.blockers,
          },
          null,
          2
        )
      )
    )
    .catch((error) => {
      console.error(`腾讯 Worlds 私有发布准备失败：${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { compareMatches, stageWorldsTencent, validateCandidate };

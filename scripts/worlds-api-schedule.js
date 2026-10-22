// Private LoL Esports schedule candidate builder. No public publication path.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeEvent } = require("./worlds-official-html");
const { SPEC, sha256, validateSnapshot } = require("./worlds-reviewed-update");

const ROOT = path.join(__dirname, "..");
const API_URL = "https://esports-api.lolesports.com/persisted/gw/getSchedule";
const MAX_PAGES = 64;
const MAX_EVENTS = 200;

function invariant(ok, message) {
  if (!ok) throw new Error(message);
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeApiEvent(event) {
  invariant(event && typeof event === "object", "比赛事件无效");
  invariant(event.type === "match", "未知事件类型");
  invariant(
    event.league?.id === SPEC.leagueId &&
      event.league.slug === SPEC.slug &&
      event.tournament?.id === SPEC.officialTournamentId,
    "赛事身份冲突"
  );
  const teams = event.match?.teams;
  invariant(Array.isArray(teams) && teams.length === 2, "比赛队伍结构无效");
  const matchTeams = teams.map((team) => {
    const id = team?.id ?? team?.teamId ?? (team?.code === "TBD" ? "0" : null);
    invariant(typeof id === "string", "队伍 ID 必须是字符串");
    return {
      teamId: id,
      code: team.code,
      name: team.name ?? (team.code === "TBD" ? "TBD" : null),
      result: team.result ?? null,
    };
  });
  const match = normalizeEvent(
    {
      ...event,
      __typename: "EventMatch",
      type: "match",
      matchTeams,
      match: { ...event.match, state: event.match.state ?? event.state },
    },
    SPEC
  );
  if (event.state === "completed") {
    const [left, right] = matchTeams.map((team) => team.result.gameWins);
    const winsNeeded = (event.match.strategy.count + 1) / 2;
    invariant(
      (left === winsNeeded && right < left) ||
        (right === winsNeeded && left < right),
      "完赛比分与 BO 不一致"
    );
  }
  for (let index = 0; index < teams.length; index++) {
    const outcome = teams[index].result?.outcome;
    if (outcome === undefined || outcome === null) continue;
    invariant(["win", "loss"].includes(outcome), "未知胜负结果");
    if (event.state === "completed") {
      const own = matchTeams[index].result.gameWins;
      const other = matchTeams[1 - index].result.gameWins;
      invariant((outcome === "win") === own > other, "比分与胜负冲突");
    }
  }
  return match;
}

function tokenValue(value) {
  if (value === null || value === "") return null;
  invariant(typeof value === "string" && value.length <= 512, "分页游标无效");
  return value;
}

async function collectSchedule(fetchPage) {
  invariant(typeof fetchPage === "function", "缺少分页读取器");
  const queue = [null];
  const pageKey = (token) => (token === null ? "initial" : `token:${token}`);
  const queued = new Set([pageKey(null)]);
  const visited = new Set();
  const byId = new Map();
  const pageHash = crypto.createHash("sha256");
  let olderTerminal = false;
  let newerTerminal = false;
  let historicalIgnored = 0;
  while (queue.length) {
    invariant(visited.size < MAX_PAGES, "分页数量超过安全上限");
    const token = queue.shift();
    const key = pageKey(token);
    if (visited.has(key)) continue;
    const response = await fetchPage(token);
    const schedule = response?.data?.schedule;
    invariant(
      Array.isArray(schedule?.events) &&
        schedule.pages &&
        Object.hasOwn(schedule.pages, "older") &&
        Object.hasOwn(schedule.pages, "newer"),
      "官方赛程分页结构无效"
    );
    visited.add(key);
    pageHash.update(JSON.stringify(response));
    for (const event of schedule.events) {
      invariant(
        event?.league?.id === SPEC.leagueId && event.league.slug === SPEC.slug,
        "赛事身份冲突"
      );
      if (
        /^20\d{2}$/.test(event.tournament?.name || "") &&
        Number(event.tournament.name) < Number(SPEC.season)
      ) {
        historicalIgnored++;
        continue;
      }
      const match = normalizeApiEvent(event);
      const previous = byId.get(match.id);
      if (previous) {
        invariant(
          JSON.stringify(previous.match) === JSON.stringify(match),
          "重复比赛 ID 冲突"
        );
      } else {
        invariant(byId.size < MAX_EVENTS, "比赛数量超过安全上限");
        byId.set(match.id, { event, match });
      }
    }
    for (const direction of ["older", "newer"]) {
      const next = tokenValue(schedule.pages[direction]);
      if (next === null) {
        if (direction === "older") olderTerminal = true;
        else newerTerminal = true;
      } else if (!visited.has(pageKey(next)) && !queued.has(pageKey(next))) {
        queued.add(pageKey(next));
        queue.push(next);
      }
    }
  }
  invariant(olderTerminal && newerTerminal, "未找到双向分页终点");
  invariant(byId.size > 0, "官方接口未提供 2026 Worlds 比赛");
  const events = [...byId.values()]
    .sort(
      (a, b) =>
        a.match.startTime.localeCompare(b.match.startTime) ||
        a.match.id.localeCompare(b.match.id)
    )
    .map((item) => item.event);
  return {
    events,
    pageCount: visited.size,
    paginationComplete: true,
    historicalIgnored,
    bodySha256: pageHash.digest("hex"),
  };
}

function buildReviewedCandidate(collection, now = new Date()) {
  invariant(collection?.paginationComplete === true, "分页终点未验证");
  const matches = collection.events
    .map(normalizeApiEvent)
    .sort(
      (a, b) =>
        a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
    );
  const dates = matches.map((match) => match.startTime.slice(0, 10)).sort();
  const snapshot = {
    schemaVersion: 1,
    classification: "PARTIAL_OBSERVED",
    event: SPEC.id,
    season: SPEC.season,
    leagueId: SPEC.leagueId,
    officialTournamentId: SPEC.officialTournamentId,
    observedAt: now.toISOString(),
    reviewedAt: null,
    sourceUrl: SPEC.url,
    apiEndpoint: API_URL,
    apiPageCount: collection.pageCount,
    apiPaginationComplete: true,
    bodySha256: collection.bodySha256,
    sourceAuthorization: "NOT_VERIFIED",
    paginationEndVerified: false,
    coverageStart: dates[0],
    coverageEnd: dates.at(-1),
    matchCount: matches.length,
    matchIds: matches.map((match) => match.id).sort(),
    dataVersion: sha256(json(matches)).slice(0, 16),
    validation: {
      result: "PASS",
      checked: "identity,time,team,BO,score,status,unique-IDs,pagination",
    },
    matches,
  };
  validateSnapshot(snapshot, now);
  return snapshot;
}

async function fetchSchedulePage(token, key) {
  invariant(typeof key === "string" && key.trim(), "缺少 LOLESPORTS_API_KEY");
  const url = new URL(API_URL);
  url.searchParams.set("hl", "zh-CN");
  url.searchParams.set("leagueId", SPEC.leagueId);
  if (token !== null) url.searchParams.set("pageToken", token);
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "LPL-Scriptable-Worlds-Candidate/1.0",
        "x-api-key": key,
      },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("LoL Esports 请求失败（未记录凭据）");
  }
  invariant(response.ok, `LoL Esports 请求失败：HTTP ${response.status}`);
  const body = await response.text();
  invariant(body.length <= 5_000_000, "官方响应过大");
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("LoL Esports 响应 JSON 无效");
  }
}

function changes(previous, current) {
  const old = new Map(
    (previous?.matches || []).map((match) => [match.id, match])
  );
  const next = new Map(current.matches.map((match) => [match.id, match]));
  return {
    addedIds: [...next.keys()].filter((id) => !old.has(id)).sort(),
    removedIds: [...old.keys()].filter((id) => !next.has(id)).sort(),
    changedIds: [...next.keys()]
      .filter(
        (id) =>
          old.has(id) &&
          JSON.stringify(old.get(id)) !== JSON.stringify(next.get(id))
      )
      .sort(),
  };
}

function writeImmutable(file, content) {
  if (fs.existsSync(file)) {
    invariant(
      fs.readFileSync(file, "utf8") === content,
      "候选文件已存在且内容不同"
    );
  } else {
    fs.writeFileSync(file, content, { flag: "wx" });
  }
}

async function createCandidate({
  outDir,
  previousPath = null,
  now = new Date(),
}) {
  invariant(outDir, "必须指定私有候选目录");
  const relative = path.relative(ROOT, path.resolve(outDir));
  invariant(
    path.isAbsolute(relative) ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`),
    "候选目录必须位于仓库外"
  );
  const key = process.env.LOLESPORTS_API_KEY;
  invariant(key, "缺少 LOLESPORTS_API_KEY；未发起网络请求");
  const collection = await collectSchedule((token) =>
    fetchSchedulePage(token, key)
  );
  const candidate = buildReviewedCandidate(collection, now);
  const previous = previousPath
    ? JSON.parse(fs.readFileSync(previousPath, "utf8"))
    : null;
  const delta = changes(previous, candidate);
  const report = {
    source: API_URL,
    pageCount: collection.pageCount,
    paginationComplete: collection.paginationComplete,
    historicalIgnored: collection.historicalIgnored,
    observedAt: candidate.observedAt,
    coverageStart: candidate.coverageStart,
    coverageEnd: candidate.coverageEnd,
    matchCount: candidate.matchCount,
    dataVersion: candidate.dataVersion,
    candidateSha256: sha256(json(candidate)),
    ...delta,
    unchanged:
      delta.addedIds.length === 0 &&
      delta.removedIds.length === 0 &&
      delta.changedIds.length === 0,
    approvalBlocked: delta.removedIds.length > 0,
    publicationEligible: false,
    publicationBlocker: "SOURCE_AUTHORIZATION_NOT_VERIFIED",
  };
  fs.mkdirSync(outDir, { recursive: true });
  const candidatePath = path.join(outDir, "worlds-api-candidate.json");
  const reportPath = path.join(outDir, "worlds-api-diff.json");
  writeImmutable(candidatePath, json(candidate));
  writeImmutable(reportPath, json(report));
  return { candidatePath, reportPath, ...report };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(`--${name}`);
    return index < 0 ? null : args[index + 1];
  };
  createCandidate({ outDir: option("out"), previousPath: option("previous") })
    .then((result) => process.stdout.write(json(result)))
    .catch((error) => {
      console.error(`Worlds API 候选更新失败：${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  API_URL,
  normalizeApiEvent,
  collectSchedule,
  buildReviewedCandidate,
  fetchSchedulePage,
  changes,
  createCandidate,
};

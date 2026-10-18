// Manual-only Worlds DEV review. Input is an HTML file saved by a human;
// this module has no network request or production publication path.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { adaptHtml } = require("./worlds-official-html");
const {
  buildBundle,
  buildFixtureBundle,
  installerSource,
} = require("./build-dev-installer");

const SPEC = Object.freeze({
  id: "worlds-2026",
  slug: "worlds",
  leagueId: "98767975604431411",
  officialTournamentId: "115660540725177488",
  season: "2026",
  url: "https://lolesports.com/en-US/leagues/worlds",
});
const CHANGE_FIELDS = [
  "startTime",
  "left",
  "right",
  "status",
  "matchType",
  "stage",
  "leftScore",
  "rightScore",
  "participants",
];

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function validObservedTime(value, now = new Date()) {
  const parsed = new Date(value);
  return (
    typeof value === "string" &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === value &&
    parsed <= now &&
    now - parsed <= 48 * 3600_000
  );
}

function validateSnapshot(value, now = new Date()) {
  invariant(value?.schemaVersion === 1, "快照 schema 无效");
  invariant(value.classification === "PARTIAL_OBSERVED", "仅允许部分观察快照");
  invariant(value.sourceUrl === SPEC.url, "来源 URL 无效");
  invariant(/^[a-f0-9]{64}$/.test(value.bodySha256 || ""), "来源哈希无效");
  invariant(
    validObservedTime(value.observedAt, now),
    "审核快照已过期或采集时间无效"
  );
  invariant(value.paginationEndVerified === false, "分页终点没有独立证据");
  invariant(value.sourceAuthorization === "NOT_VERIFIED", "不得推定再发布授权");
  invariant(
    Array.isArray(value.matches) && value.matches.length > 0,
    "比赛集合为空"
  );
  invariant(value.matches.length <= 200, "比赛集合异常过大");
  const ids = new Set();
  for (const match of value.matches) {
    invariant(
      /^\d+$/.test(match.id || "") && !ids.has(match.id),
      "比赛 ID 重复或无效"
    );
    ids.add(match.id);
    invariant(match.tournamentId === SPEC.id, "赛事身份冲突");
    invariant(
      /^2026-\d\d-\d\d \d\d:\d\d:\d\d$/.test(match.startTime || ""),
      "时间格式无效"
    );
    const date = new Date(`${match.startTime.replace(" ", "T")}+08:00`);
    invariant(
      !Number.isNaN(date.getTime()) &&
        new Date(date.getTime() + 8 * 3600_000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ") === match.startTime &&
        match.startTime.slice(0, 10) >= "2026-10-15" &&
        match.startTime.slice(0, 10) <= "2026-11-15",
      "赛程日期或时区无效"
    );
    invariant(["BO1", "BO3", "BO5"].includes(match.matchType), "BO 无效");
    invariant(
      ["upcoming", "live", "finished"].includes(match.status),
      "状态无效"
    );
    invariant(
      typeof match.stage === "string" && match.stage.trim(),
      "阶段缺失"
    );
    invariant(
      match.participants?.source?.matchId === match.id,
      "参赛身份与比赛 ID 冲突"
    );
    invariant(match.participants.version === 1, "参赛身份 schema 无效");
    invariant(
      match.participants.source.provider === "riot-lolesports",
      "参赛来源无效"
    );
    invariant(match.participants.source.url === SPEC.url, "比赛来源 URL 冲突");
    invariant(
      match.participants.source.leagueId === SPEC.leagueId,
      "League ID 冲突"
    );
    invariant(
      match.participants.source.tournamentId === SPEC.officialTournamentId,
      "Tournament ID 冲突"
    );
    for (const side of ["left", "right"]) {
      const participant = match.participants[side];
      invariant(
        match[side] === "TBD"
          ? participant?.kind === "placeholder" && participant.id === "0"
          : participant?.kind === "team" && /^[1-9]\d*$/.test(participant.id),
        "TBD 或队伍身份冲突"
      );
    }
    invariant(
      match.left === "TBD" ||
        match.right === "TBD" ||
        match.participants.left.id !== match.participants.right.id,
      "同队比赛身份冲突"
    );
    invariant(
      match.status === "upcoming"
        ? match.leftScore === null && match.rightScore === null
        : match.left !== "TBD" &&
            match.right !== "TBD" &&
            Number.isInteger(match.leftScore) &&
            match.leftScore >= 0 &&
            Number.isInteger(match.rightScore) &&
            match.rightScore >= 0,
      "比分与状态冲突"
    );
    if (match.status !== "upcoming") {
      const winsNeeded = (Number(match.matchType.slice(2)) + 1) / 2;
      invariant(
        match.leftScore <= winsNeeded && match.rightScore <= winsNeeded,
        "比分超过 BO 上限"
      );
    }
    invariant(
      match.status !== "finished" ||
        (Number.isInteger(match.leftScore) &&
          Number.isInteger(match.rightScore)),
      "完赛比分缺失"
    );
  }
  invariant(value.matchCount === ids.size, "比赛数量元数据不一致");
  invariant(
    JSON.stringify(value.matchIds) === JSON.stringify([...ids].sort()),
    "比赛 ID 集合元数据不一致"
  );
  const dates = value.matches
    .map((match) => match.startTime.slice(0, 10))
    .sort();
  invariant(
    value.coverageStart === dates[0] && value.coverageEnd === dates.at(-1),
    "覆盖日期与比赛不一致"
  );
  invariant(
    value.dataVersion === sha256(json(value.matches)).slice(0, 16),
    "数据版本与比赛不一致"
  );
  return value;
}

function changes(previous, current) {
  const old = new Map(
    (previous?.matches || []).map((match) => [match.id, match])
  );
  const next = new Map(current.matches.map((match) => [match.id, match]));
  return {
    addedIds: [...next.keys()].filter((id) => !old.has(id)).sort(),
    removedIds: [...old.keys()].filter((id) => !next.has(id)).sort(),
    changed: [...next.keys()]
      .filter((id) => old.has(id))
      .map((id) => ({
        id,
        fields: CHANGE_FIELDS.filter(
          (field) =>
            JSON.stringify(old.get(id)[field]) !==
            JSON.stringify(next.get(id)[field])
        ),
      }))
      .filter((item) => item.fields.length)
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function prepare({
  htmlPath = null,
  reviewedPath = null,
  observedAt,
  previousPath = null,
  outDir,
  now = new Date(),
}) {
  invariant(
    (htmlPath || reviewedPath) && !(htmlPath && reviewedPath) && outDir,
    "必须提供一种来源文件和独立候选目录"
  );
  let candidate;
  if (htmlPath) {
    invariant(
      validObservedTime(observedAt, now),
      "--observed-at 必须是 48 小时内的 UTC ISO 时间"
    );
    const html = fs.readFileSync(htmlPath, "utf8");
    candidate = adaptHtml({ html, spec: SPEC, fetchedAt: observedAt });
  } else {
    const imported = readJson(reviewedPath);
    invariant(
      imported.schemaVersion === 1 &&
        imported.classification === "PARTIAL_OBSERVED",
      "只可导入已有部分观察快照"
    );
    invariant(
      imported.sourceUrl === SPEC.url &&
        /^[a-f0-9]{64}$/.test(imported.bodySha256 || ""),
      "导入快照缺少官方来源证据"
    );
    invariant(validObservedTime(imported.observedAt, now), "导入快照已过期");
    invariant(
      !observedAt || observedAt === imported.observedAt,
      "导入时不得重设采集时间"
    );
    candidate = {
      source: {
        fetchedAt: imported.observedAt,
        bodySha256: imported.bodySha256,
      },
      matchIds: imported.matches.map((match) => match.id).sort(),
      schedule: { matches: imported.matches },
    };
  }
  invariant(candidate.matchIds.length > 0, "官方 HTML 未包含 2026 Worlds 比赛");
  const dates = candidate.schedule.matches
    .map((match) => match.startTime.slice(0, 10))
    .sort();
  const snapshot = {
    schemaVersion: 1,
    classification: "PARTIAL_OBSERVED",
    event: SPEC.id,
    season: SPEC.season,
    leagueId: SPEC.leagueId,
    officialTournamentId: SPEC.officialTournamentId,
    observedAt: candidate.source.fetchedAt,
    reviewedAt: null,
    sourceUrl: SPEC.url,
    bodySha256: candidate.source.bodySha256,
    sourceAuthorization: "NOT_VERIFIED",
    paginationEndVerified: false,
    coverageStart: dates[0],
    coverageEnd: dates.at(-1),
    matchCount: candidate.matchIds.length,
    matchIds: candidate.matchIds,
    dataVersion: sha256(json(candidate.schedule.matches)).slice(0, 16),
    validation: {
      result: "PASS",
      checked: "identity,time,team,BO,score,status,unique-IDs",
    },
    matches: candidate.schedule.matches,
  };
  validateSnapshot(snapshot, now);
  const previousBytes = previousPath ? fs.readFileSync(previousPath) : null;
  const previous = previousBytes ? JSON.parse(previousBytes) : null;
  const delta = changes(previous, snapshot);
  const candidateText = json(snapshot);
  const report = {
    inputKind: htmlPath
      ? "human-saved-official-html"
      : "existing-reviewed-snapshot",
    previousPath: previousPath ? path.resolve(previousPath) : null,
    classification: snapshot.classification,
    sourceUrl: SPEC.url,
    observedAt: snapshot.observedAt,
    coverageStart: snapshot.coverageStart,
    coverageEnd: snapshot.coverageEnd,
    matchCount: snapshot.matchCount,
    candidateSha256: sha256(candidateText),
    previousSha256: previousBytes ? sha256(previousBytes) : null,
    ...delta,
    approvalBlocked: delta.removedIds.length > 0,
  };
  fs.mkdirSync(outDir, { recursive: true });
  const candidatePath = path.join(outDir, "worlds-reviewed-candidate.json");
  const diffPath = path.join(outDir, "worlds-reviewed-diff.json");
  fs.writeFileSync(candidatePath, candidateText);
  fs.writeFileSync(diffPath, json(report));
  return {
    candidatePath,
    diffPath,
    diffSha256: sha256(json(report)),
    ...report,
  };
}

function verifyEntry(entry) {
  invariant(
    entry &&
      fs.existsSync(entry.snapshotPath) &&
      fs.existsSync(entry.installerPath),
    "已审核版本文件缺失"
  );
  invariant(
    sha256(fs.readFileSync(entry.snapshotPath)) === entry.snapshotSha256,
    "已审核快照 SHA 不符"
  );
  invariant(
    sha256(fs.readFileSync(entry.installerPath)) === entry.installerSha256,
    "安装包 SHA 不符"
  );
  const installer = fs.readFileSync(entry.installerPath, "utf8");
  const marker = "const BUNDLE = ";
  const start = installer.indexOf(marker);
  const end = installer.indexOf(";\n\nasync function readExistingFile", start);
  invariant(start >= 0 && end > start, "安装包缺少 DEV Bundle");
  const bundle = JSON.parse(installer.slice(start + marker.length, end));
  invariant(
    bundle.dataFiles?.["worlds-reviewed.json"] ===
      fs.readFileSync(entry.snapshotPath, "utf8"),
    "安装包与审核快照版本不一致"
  );
  return entry;
}

function switchPointer(storeDir, current, previous, beforePointer) {
  if (beforePointer) beforePointer();
  const pointerPath = path.join(storeDir, "current.json");
  const temporaryPath = path.join(
    storeDir,
    `.current-${process.pid}-${crypto.randomBytes(6).toString("hex")}.tmp`
  );
  fs.writeFileSync(temporaryPath, json({ current, previous }));
  try {
    fs.renameSync(temporaryPath, pointerPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function approve({
  candidatePath,
  diffPath,
  storeDir,
  acceptSha,
  beforePointer,
  now = new Date(),
}) {
  invariant(
    candidatePath && diffPath && storeDir && acceptSha,
    "审批参数不完整"
  );
  const candidateBytes = fs.readFileSync(candidatePath);
  const diffBytes = fs.readFileSync(diffPath);
  invariant(
    sha256(diffBytes) === acceptSha,
    "差异摘要 SHA 不符，必须重新人工审核"
  );
  const diff = JSON.parse(diffBytes);
  invariant(
    diff.candidateSha256 === sha256(candidateBytes),
    "候选快照 SHA 不符"
  );
  const previousBytes = diff.previousPath
    ? fs.readFileSync(diff.previousPath)
    : null;
  invariant(
    diff.previousSha256 === (previousBytes ? sha256(previousBytes) : null),
    "上一个快照 SHA 不符"
  );
  invariant(diff.removedIds.length === 0, "比赛 ID 减少，禁止直接删除已有比赛");
  const candidate = validateSnapshot(JSON.parse(candidateBytes), now);
  const actualChanges = changes(
    previousBytes ? JSON.parse(previousBytes) : null,
    candidate
  );
  invariant(
    JSON.stringify({
      addedIds: diff.addedIds,
      removedIds: diff.removedIds,
      changed: diff.changed,
    }) === JSON.stringify(actualChanges),
    "差异摘要与候选数据不一致"
  );
  invariant(candidate.reviewedAt === null, "只能审批未审核候选");
  const key = diff.candidateSha256.slice(0, 16);
  fs.mkdirSync(storeDir, { recursive: true });
  const pointerPath = path.join(storeDir, "current.json");
  const pointer = fs.existsSync(pointerPath) ? readJson(pointerPath) : null;
  if (pointer) verifyEntry(pointer.current);
  invariant(
    !pointer ||
      diff.previousSha256 === pointer.current.snapshotSha256 ||
      pointer.current.candidateSha256 === diff.candidateSha256,
    "当前版本已变化；请从当前审核快照重新准备候选"
  );
  const manifestPath = path.join(storeDir, `approval-${key}.json`);
  if (fs.existsSync(manifestPath)) {
    const entry = verifyEntry(readJson(manifestPath));
    invariant(entry.candidateSha256 === diff.candidateSha256, "版本 ID 冲突");
    if (pointer?.current?.candidateSha256 !== diff.candidateSha256)
      switchPointer(storeDir, entry, pointer?.current || null, beforePointer);
    return entry;
  }
  const snapshotPath = path.join(storeDir, `worlds-reviewed-${key}.json`);
  let snapshot;
  if (fs.existsSync(snapshotPath)) {
    snapshot = readJson(snapshotPath);
    invariant(
      snapshot.candidateSha256 === diff.candidateSha256,
      "残留快照版本冲突"
    );
    const original = { ...snapshot, reviewedAt: null };
    delete original.candidateSha256;
    invariant(
      isDeepStrictEqual(original, candidate),
      "残留快照与审核候选不一致"
    );
  } else {
    snapshot = {
      ...candidate,
      reviewedAt: now.toISOString(),
      candidateSha256: diff.candidateSha256,
    };
    fs.writeFileSync(snapshotPath, json(snapshot), { flag: "wx" });
  }
  validateSnapshot(snapshot, now);
  const bundle = buildBundle(buildFixtureBundle(), snapshot);
  const installerPath = path.join(storeDir, `Installer-Dev-Worlds-${key}.js`);
  if (!fs.existsSync(installerPath))
    fs.writeFileSync(installerPath, installerSource(bundle), { flag: "wx" });
  const entry = {
    candidateSha256: diff.candidateSha256,
    snapshotPath,
    snapshotSha256: sha256(fs.readFileSync(snapshotPath)),
    installerPath,
    installerSha256: sha256(fs.readFileSync(installerPath)),
    observedAt: candidate.observedAt,
    reviewedAt: snapshot.reviewedAt,
    matchCount: snapshot.matchCount,
    coverageStart: snapshot.coverageStart,
    coverageEnd: snapshot.coverageEnd,
  };
  verifyEntry(entry);
  fs.writeFileSync(manifestPath, json(entry), { flag: "wx" });
  switchPointer(storeDir, entry, pointer?.current || null, beforePointer);
  return entry;
}

function rollback({ storeDir, now = new Date() }) {
  const pointerPath = path.join(storeDir, "current.json");
  const pointer = readJson(pointerPath);
  invariant(pointer.previous, "没有上一份本地已审核版本可回滚");
  verifyEntry(pointer.previous);
  validateSnapshot(readJson(pointer.previous.snapshotPath), now);
  switchPointer(storeDir, pointer.previous, pointer.current);
  return pointer.previous;
}

function verifyCurrent({ storeDir }) {
  const pointer = readJson(path.join(storeDir, "current.json"));
  const entry = verifyEntry(pointer.current);
  validateSnapshot(readJson(entry.snapshotPath));
  return entry;
}

function option(args, name) {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? null : args[index + 1];
}

if (require.main === module) {
  try {
    const [, , command, ...args] = process.argv;
    let result;
    if (command === "prepare")
      result = prepare({
        htmlPath: option(args, "html"),
        reviewedPath: option(args, "reviewed"),
        observedAt: option(args, "observed-at"),
        previousPath: option(args, "previous"),
        outDir: option(args, "out"),
      });
    else if (command === "approve")
      result = approve({
        candidatePath: option(args, "candidate"),
        diffPath: option(args, "diff"),
        storeDir: option(args, "store"),
        acceptSha: option(args, "accept-sha"),
      });
    else if (command === "rollback")
      result = rollback({ storeDir: option(args, "store") });
    else if (command === "verify")
      result = verifyCurrent({ storeDir: option(args, "store") });
    else
      throw new Error(
        "用法: prepare | approve | verify | rollback（详见 docs/worlds-2026-update-runbook.md）"
      );
    process.stdout.write(json(result));
  } catch (error) {
    console.error(`Worlds 审核更新失败：${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  SPEC,
  sha256,
  validateSnapshot,
  prepare,
  approve,
  rollback,
  verifyCurrent,
};

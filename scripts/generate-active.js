const fs = require("node:fs");
const path = require("node:path");
const { selectTournament } = require("../src/tournament-router");

const ROOT = path.join(__dirname, "..");
const TOURNAMENTS_PATH = path.join(ROOT, "data", "tournaments.json");
const ACTIVE_PATH = path.join(ROOT, "data", "active.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadTournamentData(root = ROOT) {
  const tournaments = readJson(path.join(root, "data", "tournaments.json"));
  const schedules = Object.fromEntries(
    tournaments.map((tournament) => [
      tournament.id,
      readJson(path.join(root, tournament.schedulePath)),
    ])
  );
  return { tournaments, schedules };
}

function buildActive(now, tournaments, schedules) {
  const routedAt = new Date(now);
  if (!Number.isFinite(routedAt.getTime())) {
    throw new Error("ACTIVE_NOW 无效");
  }
  const result = selectTournament({ now: routedAt, tournaments, schedules });
  const selectedSchedule = result.activeTournament
    ? schedules[result.activeTournament.id]
    : null;
  const sourceUpdatedAt = new Date(selectedSchedule?.updatedAt || "");
  return {
    generatedAt: routedAt.toISOString(),
    sourceUpdatedAt: Number.isFinite(sourceUpdatedAt.getTime())
      ? sourceUpdatedAt.toISOString()
      : null,
    tournament: result.activeTournament,
    selectedDate: result.selectedDate,
    selectionReason: result.selectionReason,
    matches: result.matches,
  };
}

function generateActiveFile({
  now = process.env.ACTIVE_NOW || new Date(),
  root = ROOT,
  outputPath = path.join(root, "data", "active.json"),
} = {}) {
  const { tournaments, schedules } = loadTournamentData(root);
  const active = buildActive(now, tournaments, schedules);
  try {
    const previous = readJson(outputPath);
    const withoutGeneratedAt = (value) => {
      const copy = { ...value };
      delete copy.generatedAt;
      return copy;
    };
    if (
      JSON.stringify(withoutGeneratedAt(previous)) ===
      JSON.stringify(withoutGeneratedAt(active))
    ) {
      active.generatedAt = previous.generatedAt;
    }
  } catch {
    // 首次生成或旧文件无效时直接写入新结果。
  }
  fs.writeFileSync(outputPath, `${JSON.stringify(active, null, 2)}\n`);
  return active;
}

if (require.main === module) {
  const active = generateActiveFile();
  console.log(
    `已选择 ${active.tournament?.shortName || "无赛事"}：${active.selectionReason}`
  );
}

module.exports = {
  ACTIVE_PATH,
  TOURNAMENTS_PATH,
  buildActive,
  generateActiveFile,
  loadTournamentData,
};

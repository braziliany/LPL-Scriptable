const fs = require("node:fs");
const path = require("node:path");
const { selectTournament } = require("../src/tournament-router");

const ROOT = path.join(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "Installer-Dev.js");
const DEV_ACTIVE_PATH = path.join(ROOT, "dev", "active.json");
const DEV_SCRIPT_NAME = "LPL Schedule DEV";
const DEV_DESIGN_SYSTEM_NAME = "LPL-Design-System-DEV";
const DEV_DATA_DIRECTORY = "LPL-Schedule-DEV";

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fixtureMatch(
  tournamentId,
  startTime,
  left,
  right,
  matchType = "BO3",
  stage = "测试赛段"
) {
  return {
    id: `${tournamentId}-${startTime}-${left}-${right}`,
    gameId: "dev-fixture",
    tournamentId,
    startTime,
    left,
    right,
    leftLogo: "",
    rightLogo: "",
    status: "upcoming",
    matchType,
    stage,
    phase: "DEV fixture",
    group: "",
    leftScore: null,
    rightScore: null,
    scoreUpdatedAt: null,
    finishedAt: null,
    liveUrl: "https://lpl.qq.com/web202301/schedule.html",
    detailUrl: "https://lpl.qq.com/web202301/schedule.html",
  };
}

function schedule(tournamentId, updatedAt, matches) {
  return { tournamentId, updatedAt, source: "DEV fixture", matches };
}

function activeFromRoute(route, now) {
  const generatedAt = new Date(now).toISOString();
  return {
    generatedAt,
    sourceUpdatedAt: generatedAt,
    tournament: route.activeTournament,
    selectedDate: route.selectedDate,
    selectionReason: route.selectionReason,
    matches: route.matches,
  };
}

function buildFixtureBundle() {
  const tournaments = readJson("data/tournaments.json");
  const byId = new Map(
    tournaments.map((tournament) => [tournament.id, tournament])
  );

  const playoffs = byId.get("lpl-2026-split3-playoffs");
  const playoffSchedule = readJson(playoffs.schedulePath);
  const playoffMatches = playoffSchedule.matches.length
    ? playoffSchedule.matches
    : [
        fixtureMatch(
          playoffs.id,
          "2026-08-28 14:00:00",
          "EDG",
          "NIP",
          "BO5",
          "季后赛"
        ),
      ];
  const playoffDate = playoffMatches[0].startTime.slice(0, 10);
  const playoffNow = `${playoffDate}T02:00:00.000Z`;
  const playoffRoute = selectTournament({
    now: playoffNow,
    tournaments: [playoffs],
    schedules: {
      [playoffs.id]: schedule(playoffs.id, playoffNow, playoffMatches),
    },
  });

  const ewc = byId.get("ewc-2026");
  const lplOverlap = {
    ...playoffs,
    id: "lpl-2026-playoffs-ewc-overlap-fixture",
    name: "2026 LPL 第三赛段",
    shortName: "LPL PLAYOFFS",
    startDate: "2026-07-15",
    endDate: "2026-07-19",
    schedulePath: "DEV fixture",
  };
  const ewcNow = "2026-07-18T02:00:00.000Z";
  const ewcSchedules = {
    [lplOverlap.id]: schedule(lplOverlap.id, ewcNow, [
      fixtureMatch(lplOverlap.id, "2026-07-18 17:00:00", "BLG", "TES"),
    ]),
    [ewc.id]: schedule(ewc.id, ewcNow, [
      fixtureMatch(ewc.id, "2026-07-18 19:00:00", "GEN", "G2", "BO3", "EWC"),
    ]),
  };
  const ewcRoute = selectTournament({
    now: ewcNow,
    tournaments: [lplOverlap, ewc],
    schedules: ewcSchedules,
  });
  const ewcActive = activeFromRoute(ewcRoute, ewcNow);
  const ewcRouterSelectionReason = ewcActive.selectionReason;
  ewcActive.selectionReason = "SMART_TODAY_MATCHES";

  const worlds = {
    ...byId.get("worlds-2026"),
    name: "2026 全球总决赛",
    shortName: "WORLDS 2026",
    region: "international",
    stage: "瑞士轮",
    priority: 100,
  };
  const worldsNow = "2026-10-20T02:00:00.000Z";
  const worldsRoute = selectTournament({
    now: worldsNow,
    tournaments: [worlds],
    schedules: {
      [worlds.id]: schedule(worlds.id, worldsNow, [
        fixtureMatch(
          worlds.id,
          "2026-10-20 17:00:00",
          "BLG",
          "T1",
          "BO1",
          "瑞士轮"
        ),
      ]),
    },
  });

  const staleActive = activeFromRoute(playoffRoute, playoffNow);
  const staleUpdatedAt = new Date(
    new Date(playoffNow).getTime() - 96 * 60 * 60 * 1000
  ).toISOString();
  staleActive.generatedAt = staleUpdatedAt;
  staleActive.sourceUpdatedAt = staleUpdatedAt;
  const staleRemoteFixture = {
    now: playoffNow,
    upstreamUpdatedAt: staleUpdatedAt,
    active: staleActive,
    officialPageText: [
      "2026 LPL 第三赛段官方赛程",
      "英雄联盟职业联赛骑士之路",
      "EDG",
      `${playoffDate} 14:00`,
      "NIP",
      "比赛时间以官方公布为准",
    ].join("\n"),
  };

  return {
    "lpl-playoffs.json": {
      now: playoffNow,
      active: activeFromRoute(playoffRoute, playoffNow),
    },
    "ewc-priority.json": {
      now: ewcNow,
      routerSelectionReason: ewcRouterSelectionReason,
      scenario: {
        mode: "SMART",
        tournaments: [lplOverlap, ewc],
        schedules: ewcSchedules,
      },
      active: ewcActive,
    },
    "worlds.json": {
      now: worldsNow,
      active: activeFromRoute(worldsRoute, worldsNow),
    },
    "stale-remote.json": staleRemoteFixture,
    "remote-stale.json": staleRemoteFixture,
  };
}

function buildDevBootstrap(version = readJson("package.json").version) {
  return [
    "// DEV BOOTSTRAP - generated by Installer-Dev",
    "globalThis.__LPL_SCHEDULE_DEV__ = {",
    "  enabled: true,",
    `  version: ${JSON.stringify(version)},`,
    '  fixture: "",',
    `  designSystemModule: ${JSON.stringify(DEV_DESIGN_SYSTEM_NAME)},`,
    `  dataDirectory: ${JSON.stringify(DEV_DATA_DIRECTORY)},`,
    "};",
    "",
    "// MAIN SOURCE",
  ].join("\n");
}

function buildDevMainSource(source = readText("LPL-Schedule.js")) {
  const marker = "// icon-color: yellow; icon-glyph: trophy;";
  if (!source.includes(marker)) throw new Error("无法定位主脚本元数据标记");
  return source.replace(marker, `${marker}\n\n${buildDevBootstrap()}`);
}

function buildBundle(fixtures = buildFixtureBundle()) {
  const devActive = readJson("data/active.json");
  const dataFiles = {
    "active.json": `${JSON.stringify(devActive, null, 2)}\n`,
    "schedule.json": readText("data/schedule.json"),
    ...Object.fromEntries(
      Object.entries(fixtures).map(([name, value]) => [
        `fixtures/${name}`,
        `${JSON.stringify(value, null, 2)}\n`,
      ])
    ),
  };
  return {
    version: readJson("package.json").version,
    generatedAt: new Date().toISOString(),
    scriptName: DEV_SCRIPT_NAME,
    designSystemName: DEV_DESIGN_SYSTEM_NAME,
    dataDirectory: DEV_DATA_DIRECTORY,
    scripts: {
      [`${DEV_SCRIPT_NAME}.js`]: buildDevMainSource(),
      [`${DEV_DESIGN_SYSTEM_NAME}.js`]: readText("LPL-Design-System.js"),
    },
    dataFiles,
  };
}

function installerSource(bundle) {
  return `// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: wrench;

/**
 * LPL Schedule DEV 本地工作区安装器
 * 由 scripts/build-dev-installer.js 生成；不访问 GitHub，不属于正式更新链。
 */

const BUNDLE = ${JSON.stringify(bundle, null, 2)};

async function readExistingFile(fm, path) {
  if (!fm.fileExists(path)) return null;
  if (!fm.isFileDownloaded(path)) await fm.downloadFileFromiCloud(path);
  return fm.readString(path);
}

function joinedPath(fm, root, relativePath) {
  return String(relativePath)
    .split("/")
    .reduce((current, part) => fm.joinPath(current, part), root);
}

async function installBundle() {
  const fm = FileManager.iCloud();
  const documents = fm.documentsDirectory();
  const dataRoot = joinedPath(fm, documents, BUNDLE.dataDirectory);
  const dataDirectory = joinedPath(fm, dataRoot, "data");
  if (!fm.fileExists(dataRoot)) fm.createDirectory(dataRoot, true);
  if (!fm.fileExists(dataDirectory)) fm.createDirectory(dataDirectory, true);
  const fixturesDirectory = joinedPath(fm, dataDirectory, "fixtures");
  if (!fm.fileExists(fixturesDirectory)) fm.createDirectory(fixturesDirectory, true);

  const backups = [];
  const writes = [
    ...Object.entries(BUNDLE.scripts).map(([name, content]) => ({
      path: joinedPath(fm, documents, name),
      content,
    })),
    ...Object.entries(BUNDLE.dataFiles).map(([name, content]) => ({
      path: joinedPath(fm, dataDirectory, name),
      content,
    })),
  ];

  try {
    for (const item of writes) {
      backups.push({ path: item.path, content: await readExistingFile(fm, item.path) });
      fm.writeString(item.path, item.content);
    }
  } catch (error) {
    for (const backup of backups.reverse()) {
      if (backup.content === null) {
        if (fm.fileExists(backup.path)) fm.remove(backup.path);
      } else {
        fm.writeString(backup.path, backup.content);
      }
    }
    throw error;
  }

  const active = JSON.parse(BUNDLE.dataFiles["active.json"]);
  const local = FileManager.local();
  const cachePath = local.joinPath(local.documentsDirectory(), "lpl-schedule-dev-cache.json");
  local.writeString(
    cachePath,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      source: "Installer-Dev 工作区种子",
      tournament: active.tournament,
      selectedDate: active.selectedDate,
      selectionReason: "DEV_INSTALLER_SEED_CACHE",
      matches: active.matches,
    }, null, 2)
  );

  return writes.map((item) => item.path);
}

async function main() {
  const confirm = new Alert();
  confirm.title = "安装 LPL Schedule DEV";
  confirm.message = [
    "版本：v" + BUNDLE.version,
    "工作区打包时间：" + BUNDLE.generatedAt,
    "",
    "只会写入 DEV 脚本、DEV 数据目录和 DEV 缓存；不会覆盖正式版。",
  ].join("\\n");
  confirm.addAction("安装 DEV");
  confirm.addCancelAction("取消");
  if ((await confirm.present()) === -1) {
    Script.complete();
    return;
  }

  try {
    await installBundle();
    const done = new Alert();
    done.title = "DEV 安装完成";
    done.message = [
      "已安装：LPL Schedule DEV",
      "设计系统：LPL-Design-System-DEV",
      "",
      "中号组件参数留空使用工作区数据；fixture 参数见开发文档。",
    ].join("\\n");
    done.addAction("打开 Scriptable");
    await done.present();
    Safari.open("scriptable://");
  } catch (error) {
    const failed = new Alert();
    failed.title = "DEV 安装失败";
    failed.message = String(error?.message || error);
    failed.addAction("确定");
    await failed.present();
  }
  Script.complete();
}

await main();
`;
}

function buildDevInstaller(outputPath = OUTPUT_PATH) {
  const fixtures = buildFixtureBundle();
  const bundle = buildBundle(fixtures);
  fs.mkdirSync(path.dirname(DEV_ACTIVE_PATH), { recursive: true });
  fs.writeFileSync(DEV_ACTIVE_PATH, bundle.dataFiles["active.json"]);
  fs.writeFileSync(outputPath, installerSource(bundle));
  return bundle;
}

if (require.main === module) {
  const bundle = buildDevInstaller();
  console.log(
    `已生成 ${path.basename(OUTPUT_PATH)}：${bundle.scriptName} v${bundle.version}`
  );
}

module.exports = {
  DEV_ACTIVE_PATH,
  DEV_DATA_DIRECTORY,
  DEV_DESIGN_SYSTEM_NAME,
  DEV_SCRIPT_NAME,
  OUTPUT_PATH,
  buildBundle,
  buildDevBootstrap,
  buildDevInstaller,
  buildDevMainSource,
  buildFixtureBundle,
  installerSource,
};

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  prepare,
  approve,
  rollback,
  sha256,
  validateSnapshot,
} = require("../scripts/worlds-reviewed-update");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "worlds-review-"));
const htmlPath = path.join(temp, "official.html");
const previousPath = path.join(temp, "previous.json");
const storeDir = path.join(temp, "store");
const url = "https://lolesports.com/en-US/leagues/worlds";
const fixedNow = new Date("2026-10-18T03:20:00.000Z");
const observedAt = "2026-10-18T03:00:00.000Z";
const prepareAt = (options) => prepare({ ...options, now: fixedNow });
const approveAt = (options) => approve({ ...options, now: fixedNow });
const rollbackAt = (options) => rollback({ ...options, now: fixedNow });

function event(id, startTime, left, right, state = "unstarted") {
  const team = (code, side) => ({
    teamId: code === "TBD" ? "0" : String(100 + side),
    code,
    name: code,
    result: state === "unstarted" ? null : { gameWins: side ? 0 : 3 },
  });
  return {
    __typename: "EventMatch",
    type: "match",
    id,
    blockName: "Play-Ins",
    startTime,
    state,
    league: { slug: "worlds", id: "98767975604431411" },
    tournament: { id: "115660540725177488", name: "2026" },
    match: {
      id,
      state,
      strategy: { type: "bestOf", count: 5 },
    },
    matchTeams: [team(left, 0), team(right, 1)],
  };
}

function html(events) {
  return `<script>Symbol.for("ApolloSSRDataTransport");({"__typename":"EsportsData","events":${JSON.stringify(events)}})</script>`;
}

function saveHtml(events) {
  fs.writeFileSync(htmlPath, html(events));
}

try {
  const future = "2026-10-19T00:00:00Z";
  const first = event("111111111111111111", future, "TBD", "TBD");
  saveHtml([first]);
  const firstPrepared = prepareAt({
    htmlPath,
    observedAt,
    outDir: path.join(temp, "first"),
  });
  const firstCandidate = JSON.parse(
    fs.readFileSync(firstPrepared.candidatePath)
  );
  assert.equal(firstCandidate.classification, "PARTIAL_OBSERVED");
  assert.equal(firstCandidate.paginationEndVerified, false);
  assert.equal(firstCandidate.matches[0].left, "TBD");
  assert.equal(firstCandidate.matches[0].right, "TBD");
  assert.deepEqual(firstCandidate.matchIds, [first.id]);
  const firstApproved = approveAt({
    candidatePath: firstPrepared.candidatePath,
    diffPath: firstPrepared.diffPath,
    storeDir,
    acceptSha: firstPrepared.diffSha256,
  });
  assert.equal(fs.existsSync(firstApproved.installerPath), true);
  const firstPointer = fs.readFileSync(
    path.join(storeDir, "current.json"),
    "utf8"
  );
  const firstSnapshot = JSON.parse(fs.readFileSync(firstApproved.snapshotPath));
  assert.equal(firstSnapshot.reviewedAt.length > 0, true);
  assert.equal(firstSnapshot.sourceUrl, url);
  assert.equal(firstSnapshot.matches.length, 1);
  assert.equal(
    firstApproved.snapshotSha256,
    sha256(fs.readFileSync(firstApproved.snapshotPath))
  );
  assert.throws(
    () =>
      validateSnapshot(
        firstSnapshot,
        new Date(fixedNow.getTime() + 49 * 3600_000)
      ),
    /过期/
  );
  assert.deepEqual(
    approveAt({
      candidatePath: firstPrepared.candidatePath,
      diffPath: firstPrepared.diffPath,
      storeDir,
      acceptSha: firstPrepared.diffSha256,
    }),
    firstApproved
  );

  const second = event("222222222222222222", future, "TBD", "KC");
  saveHtml([event(first.id, future, "KC", "MVK"), second]);
  fs.copyFileSync(firstApproved.snapshotPath, previousPath);
  const secondPrepared = prepareAt({
    htmlPath,
    observedAt,
    previousPath,
    outDir: path.join(temp, "second"),
  });
  const diff = JSON.parse(fs.readFileSync(secondPrepared.diffPath));
  assert.deepEqual(diff.addedIds, [second.id]);
  assert.deepEqual(diff.removedIds, []);
  assert.deepEqual(
    diff.changed.map((item) => item.id),
    [first.id]
  );
  assert.ok(diff.changed[0].fields.includes("left"));
  assert.ok(diff.changed[0].fields.includes("right"));
  assert.throws(
    () =>
      approveAt({
        candidatePath: secondPrepared.candidatePath,
        diffPath: secondPrepared.diffPath,
        storeDir,
        acceptSha: secondPrepared.diffSha256,
        beforePointer: () => {
          throw new Error("injected interruption");
        },
      }),
    /injected interruption/
  );
  assert.equal(
    fs.readFileSync(path.join(storeDir, "current.json"), "utf8"),
    firstPointer
  );
  const secondApproved = approveAt({
    candidatePath: secondPrepared.candidatePath,
    diffPath: secondPrepared.diffPath,
    storeDir,
    acceptSha: secondPrepared.diffSha256,
  });
  assert.notEqual(secondApproved.snapshotSha256, firstApproved.snapshotSha256);
  assert.equal(
    JSON.parse(fs.readFileSync(secondApproved.snapshotPath)).matches.length,
    2
  );
  const soundSnapshot = fs.readFileSync(secondApproved.snapshotPath);
  fs.writeFileSync(secondApproved.snapshotPath, "{broken-json");
  assert.throws(
    () =>
      approveAt({
        candidatePath: secondPrepared.candidatePath,
        diffPath: secondPrepared.diffPath,
        storeDir,
        acceptSha: secondPrepared.diffSha256,
      }),
    /SHA/
  );
  rollbackAt({ storeDir });
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(storeDir, "current.json"))).current
      .snapshotSha256,
    firstApproved.snapshotSha256
  );
  fs.writeFileSync(secondApproved.snapshotPath, soundSnapshot);

  assert.throws(
    () =>
      prepareAt({
        htmlPath: path.join(temp, "missing-official.html"),
        observedAt,
        outDir: path.join(temp, "missing"),
      }),
    /ENOENT/
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(storeDir, "current.json"))).current
      .snapshotSha256,
    firstApproved.snapshotSha256
  );

  saveHtml([second]);
  const shrink = prepareAt({
    htmlPath,
    observedAt,
    previousPath: secondApproved.snapshotPath,
    outDir: path.join(temp, "shrink"),
  });
  assert.throws(
    () =>
      approveAt({
        candidatePath: shrink.candidatePath,
        diffPath: shrink.diffPath,
        storeDir,
        acceptSha: shrink.diffSha256,
      }),
    /减少|删除/
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(storeDir, "current.json"))).current
      .snapshotSha256,
    firstApproved.snapshotSha256
  );
  saveHtml([first, event(first.id, future, "KC", "MVK", "completed")]);
  assert.throws(
    () =>
      prepareAt({
        htmlPath,
        observedAt,
        outDir: path.join(temp, "conflict"),
      }),
    /冲突|Conflicting/
  );
  const tampered = fs
    .readFileSync(secondPrepared.candidatePath, "utf8")
    .replace("KC", "C9");
  fs.writeFileSync(secondPrepared.candidatePath, tampered);
  assert.throws(
    () =>
      approveAt({
        candidatePath: secondPrepared.candidatePath,
        diffPath: secondPrepared.diffPath,
        storeDir,
        acceptSha: secondPrepared.diffSha256,
      }),
    /SHA|哈希/
  );
  console.log("worlds-reviewed-update: ok");
} finally {
  assert.equal(
    path.dirname(fs.realpathSync(temp)),
    fs.realpathSync(os.tmpdir())
  );
  fs.rmSync(temp, { recursive: true, force: true });
}

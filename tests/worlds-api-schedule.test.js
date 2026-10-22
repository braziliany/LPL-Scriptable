const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { prepare } = require("../scripts/worlds-reviewed-update");
const {
  collectSchedule,
  buildReviewedCandidate,
  changes,
  createCandidate,
} = require("../scripts/worlds-api-schedule");

const now = new Date("2026-10-22T08:00:00.000Z");
function event(id, startTime, left, right, state = "unstarted") {
  const team = (code, id, wins, outcome) => ({
    id: code === "TBD" ? null : id,
    code,
    name: code,
    result: state === "unstarted" ? null : { gameWins: wins, outcome },
  });
  return {
    id,
    type: "match",
    startTime,
    blockName: startTime.startsWith("2026-11") ? "Finals" : "Swiss",
    state,
    league: { id: "98767975604431411", slug: "worlds" },
    tournament: { id: "115660540725177488", name: "2026" },
    match: {
      id,
      state,
      strategy: { type: "bestOf", count: 5 },
      teams: [
        team(left, left === "TBD" ? "0" : "101", 3, "win"),
        team(right, right === "TBD" ? "0" : "102", 1, "loss"),
      ],
    },
  };
}

function page(events, older, newer) {
  return { data: { schedule: { events, pages: { older, newer } } } };
}

(async () => {
  const first = event(
    "111111111111111111",
    "2026-10-24T00:00:00Z",
    "GEN",
    "IG",
    "completed"
  );
  const second = event(
    "222222222222222222",
    "2026-10-25T00:00:00Z",
    "TBD",
    "TBD"
  );
  const final = event(
    "333333333333333333",
    "2026-11-14T19:00:00Z",
    "TBD",
    "TBD"
  );
  const responses = new Map([
    [null, page([second], "older", "newer")],
    ["older", page([first, second], null, "newer")],
    ["newer", page([final], "older", null)],
  ]);
  const calls = [];
  const collection = await collectSchedule(async (token) => {
    calls.push(token);
    return responses.get(token);
  });
  assert.deepEqual(calls, [null, "older", "newer"]);
  assert.equal(collection.pageCount, 3);
  assert.equal(collection.paginationComplete, true);
  assert.equal(collection.events.length, 3);
  const candidate = buildReviewedCandidate(collection, now);
  assert.equal(candidate.matchCount, 3);
  assert.equal(candidate.coverageStart, "2026-10-24");
  assert.equal(candidate.coverageEnd, "2026-11-15");
  assert.equal(candidate.paginationEndVerified, false);
  assert.equal(candidate.sourceAuthorization, "NOT_VERIFIED");
  assert.deepEqual(
    candidate.matches.map((match) => match.id),
    [first.id, second.id, final.id]
  );
  assert.equal(candidate.matches[0].leftScore, 3);
  assert.equal(candidate.matches[0].rightScore, 1);
  assert.equal(candidate.matches[1].left, "TBD");
  assert.equal(candidate.matches[1].right, "TBD");
  assert.equal(candidate.matches[2].startTime, "2026-11-15 03:00:00");
  assert.deepEqual(changes(candidate, candidate), {
    addedIds: [],
    removedIds: [],
    changedIds: [],
  });
  const shifted = {
    ...candidate,
    matches: [
      { ...candidate.matches[0], startTime: "2026-10-24 09:00:00" },
      ...candidate.matches.slice(1),
    ],
  };
  assert.deepEqual(changes(candidate, shifted).changedIds, [first.id]);
  const privateDir = fs.mkdtempSync(path.join(os.tmpdir(), "worlds-api-test-"));
  try {
    const sourcePath = path.join(privateDir, "api-candidate.json");
    fs.writeFileSync(sourcePath, JSON.stringify(candidate));
    const prepared = prepare({
      reviewedPath: sourcePath,
      outDir: path.join(privateDir, "review"),
      now,
    });
    assert.equal(prepared.matchCount, 3);
    assert.equal(prepared.coverageEnd, "2026-11-15");
  } finally {
    assert.ok(
      path.resolve(privateDir).startsWith(path.resolve(os.tmpdir()) + path.sep)
    );
    fs.rmSync(privateDir, { recursive: true, force: true });
  }
  await assert.rejects(
    collectSchedule(async () => page([first], "repeat", "repeat")),
    /分页终点/
  );
  const priorKey = process.env.LOLESPORTS_API_KEY;
  try {
    delete process.env.LOLESPORTS_API_KEY;
    await assert.rejects(
      createCandidate({ outDir: path.join(os.tmpdir(), "worlds-no-key") }),
      /缺少 LOLESPORTS_API_KEY/
    );
  } finally {
    if (priorKey === undefined) delete process.env.LOLESPORTS_API_KEY;
    else process.env.LOLESPORTS_API_KEY = priorKey;
  }
  await assert.rejects(
    collectSchedule(async (token) =>
      token === null
        ? page([first], "older", null)
        : page([{ ...first, startTime: "2026-10-24T01:00:00Z" }], null, null)
    ),
    /重复比赛 ID 冲突/
  );
  await assert.rejects(
    collectSchedule(async () => {
      const tied = event(
        "444444444444444444",
        "2026-10-24T00:00:00Z",
        "GEN",
        "IG",
        "completed"
      );
      tied.match.teams[0].result = { gameWins: 3 };
      tied.match.teams[1].result = { gameWins: 3 };
      return page([tied], null, null);
    }),
    /完赛比分/
  );
  assert.throws(
    () =>
      buildReviewedCandidate(
        {
          ...collection,
          events: [{ ...first, league: { id: "other", slug: "lpl" } }],
        },
        now
      ),
    /赛事身份/
  );
  console.log("worlds API schedule: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

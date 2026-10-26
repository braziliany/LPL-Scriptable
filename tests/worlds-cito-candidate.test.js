const assert = require("node:assert/strict");
const {
  discoverWorldsLeague,
  eventsOf,
  hasMore,
  uniqueMatchIds,
  probe,
} = require("../scripts/worlds-cito-candidate");

const leagues = {
  data: {
    leagues: [
      { id: "lpl", name: "LPL 2026", season: 2026 },
      { id: "observed-worlds-id", name: "Worlds", season: 2026 },
    ],
  },
};

assert.deepEqual(discoverWorldsLeague(leagues), {
  id: "observed-worlds-id",
  name: "Worlds",
});
assert.throws(
  () =>
    discoverWorldsLeague({
      data: { leagues: [{ id: "lpl", name: "LPL 2026" }] },
    }),
  /found 0/
);
assert.throws(
  () =>
    discoverWorldsLeague({
      data: {
        leagues: [
          { id: "one", name: "Worlds", season: 2026 },
          { id: "two", name: "World Championship", season: 2026 },
        ],
      },
    }),
  /found 2/
);
assert.deepEqual(eventsOf({ data: { events: [{ id: "1" }] } }), [{ id: "1" }]);
assert.equal(hasMore({ data: { hasMore: true } }, 1, 100), true);
assert.equal(hasMore({ data: { hasMore: false } }, 1, 100), false);
assert.throws(() => hasMore({}, 100, 100), /pagination/);
assert.deepEqual(uniqueMatchIds([{ id: "123" }, { matchId: "456" }]), [
  "123",
  "456",
]);
assert.throws(
  () => uniqueMatchIds([{ id: "123" }, { id: "123" }]),
  /Duplicate/
);
assert.throws(() => uniqueMatchIds([{ other: "123" }]), /field unverified/);

(async () => {
  await assert.rejects(() => probe({ key: "" }), /CITO_API_KEY missing/);
  const urls = [];
  const fetchImpl = async (url, options) => {
    urls.push(url);
    assert.equal(options.headers["x-api-key"], "test-secret");
    return {
      ok: true,
      json: async () =>
        urls.length === 1
          ? leagues
          : { data: { events: [{ id: "123" }], hasMore: false } },
    };
  };
  const result = await probe({ key: "test-secret", fetchImpl });
  assert.equal(result.league.id, "observed-worlds-id");
  assert.equal(result.requests, 2);
  assert.match(urls[1], /observed-worlds-id\/schedule/);
  assert.match(urls[1], /from=2026-10-14/);
  assert.ok(!JSON.stringify(result).includes("test-secret"));
  console.log("worlds Cito private probe: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

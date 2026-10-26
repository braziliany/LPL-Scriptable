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
      { leagueId: "lol-lpl", name: "LPL", slug: "lpl" },
      {
        leagueId: "lol-worlds",
        esportsApiId: "98767975604431411",
        name: "Worlds",
        slug: "worlds",
      },
    ],
  },
};

assert.deepEqual(discoverWorldsLeague(leagues), {
  id: "lol-worlds",
  name: "Worlds",
  metadataUpdatedAt: null,
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
          {
            leagueId: "lol-worlds",
            esportsApiId: "98767975604431411",
            name: "Worlds",
            slug: "worlds",
          },
          {
            leagueId: "lol-worlds-duplicate",
            esportsApiId: "98767975604431411",
            name: "Worlds",
            slug: "worlds",
          },
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
  assert.equal(result.league.id, "lol-worlds");
  assert.equal(result.requests, 2);
  assert.match(urls[1], /lol-worlds\/schedule/);
  assert.match(urls[1], /from=2026-10-14/);
  assert.ok(!JSON.stringify(result).includes("test-secret"));
  const singleUrls = [];
  const single = await probe({
    key: "test-secret",
    knownLeagueId: "lol-worlds",
    fetchImpl: async (url) => {
      singleUrls.push(url);
      return {
        ok: true,
        json: async () => ({
          data: { events: [{ matchId: "lol-match-123" }], hasMore: false },
        }),
      };
    },
  });
  assert.equal(single.requests, 1);
  assert.equal(single.leagues, null);
  assert.match(singleUrls[0], /lol-worlds\/schedule/);
  const pageUrls = [];
  const paged = await probe({
    key: "test-secret",
    knownLeagueId: "lol-worlds",
    fetchImpl: async (url) => {
      pageUrls.push(url);
      return {
        ok: true,
        json: async () => ({
          data: {
            events: [{ matchId: `lol-match-${pageUrls.length}` }],
            hasMore: pageUrls.length === 1,
            nextOffset: pageUrls.length === 1 ? 1 : null,
          },
        }),
      };
    },
  });
  assert.equal(paged.requests, 2);
  assert.match(pageUrls[1], /offset=1/);
  await assert.rejects(
    () => probe({ key: "test-secret", knownLeagueId: "lol-lpl" }),
    /known league ID/
  );
  console.log("worlds Cito private probe: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

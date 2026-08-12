const assert = require("node:assert/strict");
const {
  fetchWithRetry,
  shouldRetryStatus,
} = require("../scripts/update-schedule");

async function main() {
  assert.equal(shouldRetryStatus(429), true);
  assert.equal(shouldRetryStatus(500), true);
  assert.equal(shouldRetryStatus(503), true);
  assert.equal(shouldRetryStatus(404), false);

  const delays = [];
  let networkAttempts = 0;
  const recovered = await fetchWithRetry(
    "https://example.com/schedule",
    {},
    {
      attempts: 3,
      baseDelayMs: 10,
      fetchImpl: async () => {
        networkAttempts += 1;
        if (networkAttempts < 3) throw new Error("connect timeout");
        return { ok: true, status: 200 };
      },
      sleepImpl: async (milliseconds) => delays.push(milliseconds),
    }
  );
  assert.equal(recovered.status, 200);
  assert.equal(networkAttempts, 3);
  assert.deepEqual(delays, [10, 20]);

  let serverAttempts = 0;
  const serverRecovered = await fetchWithRetry(
    "https://example.com/teams",
    {},
    {
      attempts: 3,
      baseDelayMs: 1,
      fetchImpl: async () => {
        serverAttempts += 1;
        return serverAttempts === 1
          ? { ok: false, status: 503 }
          : { ok: true, status: 200 };
      },
      sleepImpl: async () => {},
    }
  );
  assert.equal(serverRecovered.status, 200);
  assert.equal(serverAttempts, 2);

  let clientAttempts = 0;
  const clientError = await fetchWithRetry(
    "https://example.com/missing",
    {},
    {
      fetchImpl: async () => {
        clientAttempts += 1;
        return { ok: false, status: 404 };
      },
      sleepImpl: async () => {
        throw new Error("不应等待");
      },
    }
  );
  assert.equal(clientError.status, 404);
  assert.equal(clientAttempts, 1);

  await assert.rejects(
    fetchWithRetry(
      "https://example.com/timeout",
      {},
      {
        attempts: 3,
        baseDelayMs: 1,
        fetchImpl: async () => {
          throw new Error("connect timeout");
        },
        sleepImpl: async () => {},
      }
    ),
    /connect timeout/
  );

  console.log("schedule updater retry: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

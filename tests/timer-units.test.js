const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const designSystem = require("../LPL-Design-System");

const source = fs
  .readFileSync(path.join(__dirname, "..", "LPL-Schedule.js"), "utf8")
  .replace(
    /await main\(\);\s*$/,
    "globalThis.timerTestApi = { networkTimeoutSeconds, withNetworkTimeout, sleep, loadOfficialPageText };"
  );

function runtime(timer) {
  const context = {
    Set,
    console,
    config: { runsInWidget: false },
    importModule: () => designSystem,
    Timer: timer,
    WebView: class {
      async loadURL() {}
      async evaluateJavaScript() {
        return "2026 LPL 官方赛程：BLG 与 TES 比赛时间以官方公布为准。正式赛事时间请参考英雄联盟职业联赛官方公告。";
      }
    },
  };
  vm.runInNewContext(source, context, { filename: "LPL-Schedule.js" });
  return context;
}

function controlledTimer() {
  const calls = [];
  return {
    calls,
    schedule(milliseconds, repeats, callback) {
      const entry = {
        milliseconds,
        repeats,
        invalidated: false,
        fire: callback,
        invalidate() {
          this.invalidated = true;
        },
      };
      calls.push(entry);
      return entry;
    },
  };
}

async function verify() {
  const timer = controlledTimer();
  const context = runtime(timer);
  const api = context.timerTestApi;
  assert.equal(api.networkTimeoutSeconds("remote"), 5);
  assert.equal(api.networkTimeoutSeconds("official"), 8);

  const quick = api.withNetworkTimeout(
    () => Promise.resolve("ok"),
    5,
    "remote"
  );
  assert.equal(timer.calls.at(-1).milliseconds, 5000);
  assert.equal(await quick, "ok");
  assert.equal(timer.calls.at(-1).invalidated, true);

  const never = api.withNetworkTimeout(
    () => new Promise(() => {}),
    8,
    "official"
  );
  const deadline = timer.calls.at(-1);
  assert.equal(deadline.milliseconds, 8000);
  deadline.fire();
  await assert.rejects(never, /official timeout \(8s\)/);
  assert.equal(deadline.invalidated, true);

  const page = api.loadOfficialPageText();
  await new Promise(setImmediate);
  assert.deepEqual(
    timer.calls.slice(-2).map(({ milliseconds }) => milliseconds),
    [8000, 4000]
  );
  timer.calls.at(-1).fire();
  assert.match(await page, /官方赛程/);
  assert.equal(timer.calls.at(-2).invalidated, true);

  context.config.runsInWidget = true;
  assert.equal(api.networkTimeoutSeconds("remote"), 3);
  assert.equal(api.networkTimeoutSeconds("official"), 4);
  const widgetPage = api.loadOfficialPageText();
  await new Promise(setImmediate);
  assert.deepEqual(
    timer.calls.slice(-2).map(({ milliseconds }) => milliseconds),
    [4000, 1000]
  );
  timer.calls.at(-1).fire();
  await widgetPage;

  const realTimer = {
    schedule(milliseconds, _repeats, callback) {
      const handle = setTimeout(callback, milliseconds);
      return { invalidate: () => clearTimeout(handle) };
    },
  };
  const realApi = runtime(realTimer).timerTestApi;
  const startedAt = Date.now();
  assert.equal(
    await realApi.withNetworkTimeout(
      () => new Promise((resolve) => setTimeout(() => resolve("done"), 30)),
      0.05,
      "elapsed-time control"
    ),
    "done"
  );
  assert.equal(Date.now() - startedAt >= 20, true);
  console.log("timer units: ok");
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

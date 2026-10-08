// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: wifi;

// Standalone network probe. Does not import the widget or touch its cache/settings.
const RAW_BASE =
  "https://raw.githubusercontent.com/braziliany/LPL-Scriptable/main";
const OFFICIAL_URL = "https://lpl.qq.com/act/a20200518app/html/schedule.html";
const DEADLINE_MS = 15000;
const minuteKey = Math.floor(Date.now() / 60000);

function contentType(headers) {
  const entry = Object.entries(headers || {}).find(
    ([name]) => name.toLowerCase() === "content-type"
  );
  return entry ? String(entry[1]) : null;
}

function classifyFailure(error, response) {
  const message = String(error?.message || error);
  if (response?.statusCode >= 400) return "HTTP_ERROR";
  if (/diagnostic deadline/i.test(message)) return "WALL_CLOCK_TIMEOUT";
  if (/timed? ?out|timeout/i.test(message)) return "REQUEST_TIMEOUT";
  if (/dns|host.*not found|could not find server/i.test(message)) {
    return "DNS_ERROR";
  }
  if (/tls|ssl|certificate|secure connection/i.test(message)) {
    return "TLS_ERROR";
  }
  if (/json|parse|syntax/i.test(message)) return "PARSE_ERROR";
  return "NETWORK_OR_WEBVIEW_ERROR";
}

async function bounded(operation, label) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = Timer.schedule(DEADLINE_MS, false, () => {
          reject(new Error(`${label} diagnostic deadline ${DEADLINE_MS}ms`));
        });
      }),
    ]);
  } finally {
    if (timer) timer.invalidate();
  }
}

async function probeRequest(name, url, json) {
  const start = Date.now();
  const request = new Request(url);
  request.method = "GET";
  request.timeoutInterval = 15;
  request.headers = {
    "User-Agent": "Scriptable-LPL-Schedule/1.0",
    "Cache-Control": "no-cache",
  };
  const result = {
    name,
    url,
    method: "GET",
    api: json ? "loadJSON" : "loadString",
  };
  try {
    const payload = await bounded(
      () => (json ? request.loadJSON() : request.loadString()),
      name
    );
    result.outcome = "RESPONSE";
    if (json) {
      result.keys = Object.keys(payload || {});
      result.matches = Array.isArray(payload?.matches)
        ? payload.matches.length
        : null;
      result.generatedAt = payload?.generatedAt || null;
      result.updatedAt = payload?.updatedAt || null;
      result.businessState = payload?.businessState || null;
      result.season = payload?.season || payload?.tournament?.season || null;
    } else {
      result.characters = String(payload || "").length;
      result.hasScriptTags = /<script\b/i.test(String(payload || ""));
    }
  } catch (error) {
    result.outcome = classifyFailure(error, request.response);
    result.error = String(error?.message || error);
  }
  result.elapsedMs = Date.now() - start;
  result.httpStatus = request.response?.statusCode || null;
  result.finalUrl = request.response?.url || null;
  result.mimeType = request.response?.mimeType || null;
  result.contentType = contentType(request.response?.headers);
  return result;
}

async function probeOfficialWebView() {
  const start = Date.now();
  const result = {
    name: "Official WebView",
    url: OFFICIAL_URL,
    api: "WebView.loadURL",
  };
  try {
    const page = new WebView();
    await bounded(() => page.loadURL(OFFICIAL_URL), "Official WebView load");
    result.loadElapsedMs = Date.now() - start;
    const body = await bounded(
      () =>
        page.evaluateJavaScript(
          'document.body ? (document.body.innerText || "") : ""'
        ),
      "Official WebView evaluate"
    );
    result.outcome = "RESPONSE";
    result.bodyTextLength = String(body || "").length;
  } catch (error) {
    result.outcome = classifyFailure(error);
    result.error = String(error?.message || error);
  }
  result.elapsedMs = Date.now() - start;
  return result;
}

async function main() {
  const timerStart = Date.now();
  await new Promise((resolve) => Timer.schedule(1000, false, resolve));
  const timerCalibrationMs = Date.now() - timerStart;
  const results = [];
  results.push(
    await probeRequest(
      "GitHub Active",
      `${RAW_BASE}/data/active.json?v=${minuteKey}`,
      true
    )
  );
  results.push(
    await probeRequest(
      "GitHub Legacy",
      `${RAW_BASE}/data/schedule.json?v=${minuteKey}`,
      true
    )
  );
  results.push(await probeRequest("Official HTML", OFFICIAL_URL, false));
  results.push(await probeOfficialWebView());

  const report = {
    diagnosticVersion: 1,
    checkedAt: new Date().toISOString(),
    runtime: config.runsInWidget ? "widget" : "app",
    timerCalibrationMs,
    requestTimeoutIntervalSeconds: 15,
    wallClockDeadlineMs: DEADLINE_MS,
    results,
    cacheOrSettingsRead: false,
    cacheOrSettingsWritten: false,
  };
  console.log(JSON.stringify(report, null, 2));

  const alert = new Alert();
  alert.title = "LPL 网络诊断";
  alert.message = [
    `Timer.schedule(1000) 实测：${timerCalibrationMs} ms`,
    ...results.map(
      (result) =>
        `${result.name}：${result.outcome} · ${result.elapsedMs} ms` +
        (result.httpStatus ? ` · HTTP ${result.httpStatus}` : "")
    ),
    "完整 JSON 见 Scriptable 运行日志。",
  ].join("\n");
  alert.addAction("关闭");
  await alert.present();
  Script.complete();
}

await main();

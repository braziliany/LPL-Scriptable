const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  loadInstallerContract,
  readInstallerSource,
} = require("./installer-contract");

async function checkProductionInstaller({
  reportPath,
  expectedWidgetHash,
} = {}) {
  const downloads = [];
  class ProductionRequest {
    constructor(url) {
      this.url = url;
    }

    async loadString() {
      const response = await fetch(this.url, {
        redirect: "follow",
        signal: AbortSignal.timeout(this.timeoutInterval * 1000),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      const content = bytes.toString("utf8");
      this.response = {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers),
      };
      const record = {
        requestedUrl: this.url,
        finalUrl: response.url,
        status: response.status,
        redirected: response.redirected,
        contentType: response.headers.get("content-type"),
        length: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      };
      downloads.push(record);
      if (reportPath) {
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(
          path.join(
            path.dirname(reportPath),
            path.basename(new URL(this.url).pathname)
          ),
          bytes
        );
      }
      return content;
    }
  }
  const contract = loadInstallerContract(
    readInstallerSource(),
    ProductionRequest
  );
  let failure;
  try {
    for (const resource of contract.CONFIG.resources) {
      await contract.downloadResource(resource);
      downloads.at(-1).validation = "PASS";
    }
    if (expectedWidgetHash) {
      const widget = downloads.find(({ requestedUrl }) =>
        requestedUrl.endsWith("/LoL-Esports-Schedule.js")
      );
      assert.equal(
        widget.sha256,
        expectedWidgetHash.toLowerCase(),
        "production widget SHA-256 differs from Release asset"
      );
    }
  } catch (error) {
    failure = error;
    if (downloads.length && !downloads.at(-1).validation) {
      downloads.at(-1).validation = "FAIL";
    }
  }
  const report = {
    checkedAt: new Date().toISOString(),
    result: failure ? "FAIL" : "PASS",
    error: failure?.message || null,
    downloads,
  };
  if (reportPath)
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (failure) throw failure;
  return report;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const option = (name) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  checkProductionInstaller({
    reportPath: option("--report"),
    expectedWidgetHash: option("--expected-widget-sha256"),
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { checkProductionInstaller };

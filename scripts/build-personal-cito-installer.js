const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "Installer.js"), "utf8");
const resources = {
  "LPL-Design-System": "LPL-Design-System.js",
  "LPL Schedule 2026": "LPL-Schedule.js",
  "LPL-Cito-Worlds": "LPL-Cito-Worlds.js",
  "LPL-Cito-Personal": "LPL-Cito-Personal.js",
  "LPL Schedule Installer": "Installer.js",
};
const bundle = Object.fromEntries(
  Object.entries(resources).map(([name, file]) => [
    name,
    fs.readFileSync(path.join(root, file), "utf8"),
  ])
);
const anchor =
  "const downloads = await Promise.all(CONFIG.resources.map(downloadResource));";
if (!source.includes(anchor))
  throw new Error("Installer download anchor missing");
const releaseNotes = `let releaseNotes = "";
    try {
      releaseNotes = extractReleaseNotes(
        await downloadText(CONFIG.changelogUrl),
        remoteVersion
      );
    } catch (error) {
      console.warn(\`更新说明获取失败：\${error}\`);
    }`;
if (!source.includes(releaseNotes))
  throw new Error("Installer release note anchor missing");
const installer = source
  .replace(
    anchor,
    `const ready = new Alert();
    ready.title = "安装 Worlds Cito 个人版";
    ready.message = "安装包已在本机，继续后会检查并更新正式组件。不会传输 API Key 或赛事缓存。";
    ready.addAction("继续安装");
    ready.addCancelAction("取消");
    if ((await ready.present()) !== 0) { Script.complete(); return; }
    const downloads = CONFIG.resources.map((resource) => {
      const content = PERSONAL_CITO_BUNDLE[resource.scriptName];
      validateResourceContent(resource, content);
      return { ...resource, content };
    });`
  )
  .replace(releaseNotes, 'const releaseNotes = "";')
  .replace(
    /await main\(\);\s*$/,
    `const PERSONAL_CITO_BUNDLE = ${JSON.stringify(bundle)};\nawait main();\n`
  );

function writeInstaller(output) {
  fs.writeFileSync(output, installer, "utf8");
  return output;
}

if (require.main === module) {
  const output = process.argv[2];
  if (!output) throw new Error("Output path required");
  console.log(writeInstaller(path.resolve(output)));
}

module.exports = { installer, writeInstaller };

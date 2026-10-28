const fs = require("node:fs");
const path = require("node:path");
const { readInstallerSource } = require("./installer-contract");

function buildInstallerRcSource(source, widgetSource) {
  const anchor =
    "const downloads = await Promise.all(CONFIG.resources.map(downloadResource));";
  if (!source.includes(anchor))
    throw new Error("Installer candidate anchor missing");
  return source
    .replace(
      anchor,
      `const downloads = CONFIG.resources.map((resource) => {
    const content = INSTALLER_RC_WIDGET;
    validateResourceContent(resource, content);
    return { ...resource, content };
  });`
    )
    .replace(
      /await main\(\);\s*$/,
      `const INSTALLER_RC_WIDGET = ${JSON.stringify(widgetSource)};\nawait main();`
    );
}

if (require.main === module) {
  const root = path.join(__dirname, "..");
  const output = path.join(root, "Installer-RC.js");
  fs.writeFileSync(
    output,
    buildInstallerRcSource(
      readInstallerSource(),
      fs.readFileSync(path.join(root, "LoL-Esports-Schedule.js"), "utf8")
    ),
    "utf8"
  );
  console.log(output);
}
module.exports = { buildInstallerRcSource };

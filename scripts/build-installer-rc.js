const fs = require("node:fs");
const path = require("node:path");
const { readInstallerSource } = require("./installer-contract");

function buildInstallerRcSource(source, widgetSource, designSource) {
  const anchor =
    "const downloads = await Promise.all(CONFIG.resources.map(downloadResource));";
  if (!source.includes(anchor))
    throw new Error("Installer RC download anchor missing");
  const bridged = source.replace(
    anchor,
    `const downloads = await Promise.all(CONFIG.resources.map(async (resource) => {
      // Candidate scripts are bundled until v3.1.2 reaches Raw main.
      if (resource.scriptName === "LPL Schedule 2026" || resource.scriptName === "LPL-Design-System") {
        const content = resource.scriptName === "LPL Schedule 2026" ? INSTALLER_RC_WIDGET : INSTALLER_RC_DESIGN;
        validateResourceContent(resource, content);
        return { ...resource, content };
      }
      return downloadResource(resource);
    }));
    // Keep the RC installer while Raw main serves the older validator.
    const installerDownload = downloads.find((resource) => resource.scriptName === "LPL Schedule Installer");
    if (!installerDownload.content.includes("function validateResourceContent(")) {
      const candidateInstaller = buildInstallerRcSource(INSTALLER_RC_BASE, INSTALLER_RC_WIDGET, INSTALLER_RC_DESIGN);
      validateResourceContent(installerDownload, candidateInstaller);
      installerDownload.content = candidateInstaller;
    }`
  );
  return bridged.replace(
    /await main\(\);\s*$/,
    `const INSTALLER_RC_BASE = ${JSON.stringify(source)};
const INSTALLER_RC_WIDGET = ${JSON.stringify(widgetSource)};
const INSTALLER_RC_DESIGN = ${JSON.stringify(designSource)};
${buildInstallerRcSource.toString()}

await main();`
  );
}

if (require.main === module) {
  const output = path.join(__dirname, "..", "Installer-RC.js");
  const root = path.join(__dirname, "..");
  fs.writeFileSync(
    output,
    buildInstallerRcSource(
      readInstallerSource(),
      fs.readFileSync(path.join(root, "LPL-Schedule.js"), "utf8"),
      fs.readFileSync(path.join(root, "LPL-Design-System.js"), "utf8")
    ),
    "utf8"
  );
  console.log(`Generated production Installer RC: ${output}`);
}

module.exports = { buildInstallerRcSource };

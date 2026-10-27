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
const installer = source
  .replace(
    anchor,
    `const downloads = CONFIG.resources.map((resource) => {
      const content = PERSONAL_CITO_BUNDLE[resource.scriptName];
      validateResourceContent(resource, content);
      return { ...resource, content };
    });`
  )
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

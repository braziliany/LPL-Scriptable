const assert = require("node:assert/strict");
const DesignSystem = require("../LPL-Design-System");

assert.equal(DesignSystem.version, "3.0.0");
assert.equal(DesignSystem.normalizeThemeMode("LIGHT"), "light");
assert.equal(DesignSystem.normalizeThemeMode("invalid"), "dark");
assert.equal(DesignSystem.resolveThemeMode("auto", true), "dark");
assert.equal(DesignSystem.resolveThemeMode("auto", false), "light");

const light = DesignSystem.resolvePalette("light");
assert.equal(light.backgroundTop, "#F5F6FF");
assert.equal(light.white, "#20213C");
assert.notEqual(light, DesignSystem.palettes.light);

assert.equal(DesignSystem.typography.header, 16);
assert.equal(DesignSystem.typography.team, 19);
assert.equal(DesignSystem.layout.logo, 22);
assert.equal(DesignSystem.layout.valueWidth, 112);

console.log("design system: ok");

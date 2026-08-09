/**
 * LPL Scriptable Design System
 * 可供其他 Scriptable 项目通过 importModule("LPL-Design-System") 复用。
 */

const version = "2.9.0";

const palettes = {
  dark: {
    backgroundTop: "#292A58",
    backgroundBottom: "#171832",
    yellow: "#FFD34E",
    orange: "#FF7043",
    red: "#FF4D67",
    white: "#F7F7FB",
    secondary: "#AAAAC1",
    muted: "#85869F",
    divider: "#FFFFFF",
  },
  light: {
    backgroundTop: "#F5F6FF",
    backgroundBottom: "#E2E5F4",
    yellow: "#C89000",
    orange: "#DF5832",
    red: "#D93650",
    white: "#20213C",
    secondary: "#55576F",
    muted: "#77798F",
    divider: "#20213C",
  },
};

const typography = {
  header: 16,
  date: 15,
  team: 19,
  teamCompact: 17,
  teamSmall: 16,
  versus: 16,
  versusCompact: 14,
  subtitle: 13,
  subtitleCompact: 11,
  value: 28,
  valueCompact: 22,
  valueSmall: 28,
};

const layout = {
  headerSquare: 16,
  headerGap: 10,
  logo: 22,
  logoCompact: 20,
  logoSmall: 22,
  valueWidth: 112,
  valueWidthCompact: 96,
};

function normalizeThemeMode(mode, fallback = "dark") {
  const value = String(mode || "").toLowerCase();
  return ["auto", "dark", "light"].includes(value) ? value : fallback;
}

function resolveThemeMode(mode, isDarkAppearance = true) {
  const normalized = normalizeThemeMode(mode);
  if (normalized !== "auto") return normalized;
  return isDarkAppearance ? "dark" : "light";
}

function resolvePalette(mode, isDarkAppearance = true) {
  return {
    ...palettes[resolveThemeMode(mode, isDarkAppearance)],
  };
}

function applyCardBackground(widget, palette) {
  const gradient = new LinearGradient();
  gradient.colors = [
    new Color(palette.backgroundTop),
    new Color(palette.backgroundBottom),
  ];
  gradient.locations = [0, 1];
  widget.backgroundGradient = gradient;
}

module.exports = {
  version,
  palettes,
  typography,
  layout,
  normalizeThemeMode,
  resolveThemeMode,
  resolvePalette,
  applyCardBackground,
};

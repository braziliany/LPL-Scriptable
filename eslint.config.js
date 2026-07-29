const globals = require("globals");

const scriptableGlobals = {
  Alert: "readonly",
  Color: "readonly",
  config: "readonly",
  console: "readonly",
  Data: "readonly",
  DateFormatter: "readonly",
  Device: "readonly",
  DrawContext: "readonly",
  FileManager: "readonly",
  Font: "readonly",
  Image: "readonly",
  importModule: "readonly",
  Keychain: "readonly",
  LinearGradient: "readonly",
  ListWidget: "readonly",
  Notification: "readonly",
  Pasteboard: "readonly",
  Path: "readonly",
  Rect: "readonly",
  Request: "readonly",
  Safari: "readonly",
  Script: "readonly",
  SFSymbol: "readonly",
  Size: "readonly",
  Timer: "readonly",
  URLScheme: "readonly",
  WebView: "readonly",
  args: "readonly",
};

module.exports = [
  {
    ignores: ["node_modules/**", "data/schedule.json"],
  },
  {
    files: ["tests/**/*.js", "scripts/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
  {
    files: ["Installer.js", "LPL-Schedule.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: scriptableGlobals,
    },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
  {
    files: ["LPL-Design-System.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: scriptableGlobals,
    },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
    },
  },
];

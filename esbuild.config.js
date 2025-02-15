const { GasPlugin } = require("esbuild-gas-plugin");
const banner = require("./scripts/alert.js");

/** @type {import('esbuild').BuildOptions} */
const baseConfig = {
  bundle: true,
  platform: "node",
  target: "es2019",
  format: "cjs",
  plugins: [GasPlugin],
  charset: "utf8",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  treeShaking: false,
  banner: {
    js: banner
  }
};

module.exports = baseConfig;

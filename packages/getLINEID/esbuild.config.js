const path = require("node:path");
const baseConfig = require("../../esbuild.config.js");

/** @type {import('esbuild').BuildOptions} */
const config = {
  ...baseConfig,
  entryPoints: [path.join(__dirname, "src/index.ts")],
  outfile: path.join(__dirname, "dist/main.js"),
};

module.exports = config;

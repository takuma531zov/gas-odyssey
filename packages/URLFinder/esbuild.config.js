const path = require("node:path");
const fs = require("node:fs");
const baseConfig = require("../../esbuild.config.js");

/** @type {import('esbuild').BuildOptions} */
const config = {
  ...baseConfig,
  entryPoints: [path.join(__dirname, "src/index.ts")],
  outfile: path.join(__dirname, "dist/main.js"),
  plugins: [
    ...(baseConfig.plugins || []),
    {
      name: 'copy-html-files',
      setup(build) {
        build.onEnd(() => {
          const srcFile = path.join(__dirname, 'src', 'simpleOptions.html');
          const distFile = path.join(__dirname, 'dist', 'simpleOptions.html');
          
          if (fs.existsSync(srcFile)) {
            const distDir = path.dirname(distFile);
            if (!fs.existsSync(distDir)) {
              fs.mkdirSync(distDir, { recursive: true });
            }
            fs.copyFileSync(srcFile, distFile);
            console.log('Copied simpleOptions.html to dist/');
          }
        });
      }
    }
  ]
};

module.exports = config;

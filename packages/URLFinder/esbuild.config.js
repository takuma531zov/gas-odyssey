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
          // HTMLファイルをdistにコピー
          const htmlFiles = ['simpleOptions.html', 'progress.html'];
          const srcDir = path.join(__dirname, 'src');
          const distDir = path.join(__dirname, 'dist');
          
          // distディレクトリが存在することを確認
          if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir, { recursive: true });
          }
          
          htmlFiles.forEach(file => {
            const srcFile = path.join(srcDir, file);
            const distFile = path.join(distDir, file);
            
            if (fs.existsSync(srcFile)) {
              fs.copyFileSync(srcFile, distFile);
              console.log(`Copied ${file} to dist/`);
            }
          });
        });
      }
    }
  ]
};

module.exports = config;

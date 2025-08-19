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
          const htmlFiles = ['simple-options.html', 'progress.html'];
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
    },
    {
      name: 'remove-commonjs-exports',
      setup(build) {
        build.onEnd(() => {
          // CommonJSのexportsを削除してGAS互換にする
          const outputFile = path.join(__dirname, 'dist', 'main.js');
          
          if (fs.existsSync(outputFile)) {
            let content = fs.readFileSync(outputFile, 'utf8');
            
            // module.exports部分を削除
            content = content.replace(/\/\/ Annotate the CommonJS export names for ESM import in node:[\s\S]*?module\.exports = \{[\s\S]*?\}\);?/g, '');
            
            // 0 && の行も削除
            content = content.replace(/^0 && \(.*\);?$/gm, '');
            
            fs.writeFileSync(outputFile, content);
            console.log('Removed CommonJS exports from main.js');
          }
        });
      }
    }
  ]
};

module.exports = config;

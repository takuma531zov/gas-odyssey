const { build } = require("esbuild");
const path = require("node:path");
const fs = require("node:fs");

const projectName = process.argv[2];

if (!projectName) {
  console.error("Please specify a project name");
  process.exit(1);
}

const projectPath = path.join(__dirname, "../packages", projectName);
const configPath = path.join(projectPath, "esbuild.config.js");

console.log("configPath: ", configPath);

if (!fs.existsSync(configPath)) {
  console.error(`Config not found for project: ${projectName}`);
  process.exit(1);
}

async function buildProject() {
  console.log(`Building ${projectName}...`);
  const config = require(configPath);

  // Ensure the output directory exists
  const outDir = path.dirname(config.outfile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`Created output directory: ${outDir}`);
  }

  try {
    await build(config);
    console.log(`${projectName} built successfully.`);

    // Copy appsscript.json to dist directory
    const appsscriptPath = path.join(projectPath, "appsscript.json");
    const distAppsscriptPath = path.join(outDir, "appsscript.json");

    if (fs.existsSync(appsscriptPath)) {
      fs.copyFileSync(appsscriptPath, distAppsscriptPath);
      console.log(`Copied appsscript.json to ${distAppsscriptPath}`);
    } else {
      console.warn(`Warning: appsscript.json not found in ${projectPath}`);
    }

    const srcPath = path.join(projectPath, "src");
    // Copy HTML files to dist directory
    const htmlFiles = fs.readdirSync(srcPath).filter(file => file.endsWith('.html'));
    console.log("htmlFiles: ", htmlFiles);

    htmlFiles.forEach(file => {
      const originPath = path.join(srcPath, file);
      const destPath = path.join(outDir, file);
      fs.copyFileSync(originPath, destPath);
      console.log(`Copied ${file} to ${destPath}`);
    });

  } catch (error) {
    console.error(`Error building ${projectName}:`);
    if (error.errors) {
      for (const err of error.errors) {
        console.error("Build error:", err.text);
        console.error("  Location:", err.location);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

buildProject().catch(console.error);

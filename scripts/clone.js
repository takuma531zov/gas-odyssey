const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectName = process.argv[2];
const scriptId = process.argv[3];

if (!projectName || !scriptId) {
  console.error("Usage: pnpm clone <projectName> <scriptId>");
  process.exit(1);
}

const rootDir = path.join(__dirname, "..");
const projectPath = path.join(rootDir, "packages", projectName);
const srcPath = path.join(projectPath, "src");
const commonConfigPath = path.join(
  rootDir,
  "packages",
  "common",
  "config",
  "esbuild.config.js"
);
const templatePath = path.join(rootDir, "template");
const readmePath = path.join(templatePath, "README.md");

// Create project directory if it doesn't exist
if (!fs.existsSync(projectPath)) {
  fs.mkdirSync(projectPath, { recursive: true });
}

// Create src directory if it doesn't exist
if (!fs.existsSync(srcPath)) {
  fs.mkdirSync(srcPath, { recursive: true });
}

// Change to project directory
process.chdir(projectPath);

try {
  // Run clasp clone
  console.log(`Cloning project ${scriptId} into ${projectPath}...`);
  execSync(`clasp clone ${scriptId}`, { stdio: "inherit" });

  // Move all .js .html. gas files to src directory
  for (const file of fs.readdirSync(projectPath)) {
    if (
      file.endsWith(".js") ||
      file.endsWith(".html") ||
      file.endsWith(".gs")
    ) {
      fs.renameSync(path.join(projectPath, file), path.join(srcPath, file));
    }
  }

  // Modify rootDir field of .clasp.json
  const claspJsonPath = path.join(projectPath, ".clasp.json");
  if (fs.existsSync(claspJsonPath)) {
    const claspConfig = JSON.parse(fs.readFileSync(claspJsonPath, "utf8"));
    claspConfig.rootDir = "./dist";
    fs.writeFileSync(claspJsonPath, JSON.stringify(claspConfig, null, 2));
    console.log(".clasp.json updated with rootDir: ./dist");

    // Rename .clasp.json to .clasp.prod.json
    fs.renameSync(claspJsonPath, path.join(projectPath, ".clasp.prod.json"));
    console.log(".clasp.json renamed to .clasp.prod.json");

    // Create .clasp.dev.json as a copy of .clasp.prod.json
    fs.copyFileSync(
      path.join(projectPath, ".clasp.prod.json"),
      path.join(projectPath, ".clasp.dev.json")
    );
    console.log(".clasp.dev.json created as a copy of .clasp.prod.json");
  } else {
    console.error(".clasp.json not found after cloning");
    process.exit(1);
  }

  // Copy esbuild.config.js from common config
  if (fs.existsSync(commonConfigPath)) {
    fs.copyFileSync(
      commonConfigPath,
      path.join(projectPath, "esbuild.config.js")
    );
    console.log(
      `Copied esbuild.config.js from common config to ${projectPath}`
    );
  } else {
    console.warn(
      `Warning: esbuild.config.js not found in common config (${commonConfigPath})`
    );
  }

  // Copy README.md from template folder
  if (fs.existsSync(readmePath)) {
    fs.copyFileSync(readmePath, path.join(projectPath, "README.md"));
    console.log(`Copied README.md from template to ${projectPath}`);
  } else {
    console.warn(
      `Warning: README.md not found in template folder (${readmePath})`
    );
  }

  console.log(`Project ${projectName} cloned and set up successfully.`);
} catch (error) {
  console.error("Error occurred:", error.message);
  process.exit(1);
}

const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const env = process.argv[2];
const projectName = process.argv[3];

if (!env || !projectName) {
  console.error("Usage: node deploy.js <env> <projectName>");
  process.exit(1);
}

const projectPath = path.join(__dirname, "..", "packages", projectName);
const distPath = path.join(projectPath, "dist");

console.log(`Environment: ${env}`);
console.log(`Project path: ${projectPath}`);
console.log(`Dist path: ${distPath}`);

if (!fs.existsSync(distPath)) {
  console.error(`Dist directory not found for project: ${projectName}`);
  process.exit(1);
}

try {
  // Handle .clasp.json file based on environment
  const claspJsonPath = path.join(projectPath, ".clasp.json");
  const sourceClaspJson = path.join(projectPath, `.clasp.${env}.json`)

  if (!fs.existsSync(sourceClaspJson)) {
    throw new Error(`${path.basename(sourceClaspJson)} not found (env: ${env})`);
  }
  
  if (fs.existsSync(claspJsonPath)) {
    // If .clasp.json already exists, update its content
    const content = fs.readFileSync(sourceClaspJson, 'utf8');
    fs.writeFileSync(claspJsonPath, content);
    console.log(`.clasp.json updated with content from ${path.basename(sourceClaspJson)}`);
  } else {
    // If .clasp.json doesn't exist, create a copy
    fs.copyFileSync(sourceClaspJson, claspJsonPath);
    console.log(`.clasp.json created from ${path.basename(sourceClaspJson)}`);
  }

  // Copy appsscript.json to dist directory
  const appsscriptPath = path.join(projectPath, "appsscript.json");
  const distAppsscriptPath = path.join(distPath, "appsscript.json");

  console.log(`Checking appsscript.json at: ${appsscriptPath}`);

  if (fs.existsSync(appsscriptPath)) {
    console.log("appsscript.json found. Copying to dist...");
    fs.copyFileSync(appsscriptPath, distAppsscriptPath);
    console.log(`Copied appsscript.json to ${distAppsscriptPath}`);

    // Verify the copy
    if (fs.existsSync(distAppsscriptPath)) {
      console.log("Verified: appsscript.json exists in dist directory");
    } else {
      throw new Error("Failed to copy appsscript.json to dist directory");
    }
  } else {
    console.warn(`Warning: appsscript.json not found in ${projectPath}`);
  }

  console.log("Files in dist directory:");
  console.log(fs.readdirSync(distPath).join("\n"));

  console.log(`Pushing ${projectName} to Google Apps Script...`);

  // Execute clasp push from the project directory
  execSync("clasp push", { stdio: "inherit", cwd: projectPath });

  console.log(`${projectName} pushed successfully.`);
} catch (error) {
  console.error(`Error pushing ${projectName}:`, error.message);
  process.exit(1);
}
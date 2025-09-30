#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

function getPaths() {
  const cwd = process.cwd();
  const isInKalpana = /[\\\/]kalpana$/.test(cwd);
  return {
    context: isInKalpana
      ? path.join(cwd, "container")
      : path.join(cwd, "kalpana", "container"),
    display: isInKalpana ? "container" : "kalpana/container",
  };
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: true,
      ...options,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

async function main() {
  const { context, display } = getPaths();
  const image = process.env.WORKSPACE_IMAGE || "kalpana/workspace:latest";
  const localFlag = process.argv.includes("--local");

  console.log(`Building Docker image: ${image}`);
  console.log(`Using context: ${display}`);

  // Optional: buildx for better caching/platforms
  const args = ["build", "-t", image, context];

  await run("docker", args);

  if (localFlag) {
    console.log("Local build complete.");
  } else {
    console.log("Image built successfully.");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

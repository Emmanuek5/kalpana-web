#!/usr/bin/env bun

/**
 * Check workspace diagnostics - helps debug container and extension issues
 * Usage: bun run scripts/check-workspace-diagnostics.ts <workspace-id>
 */

const workspaceId = process.argv[2];

if (!workspaceId) {
  console.error(
    "❌ Usage: bun run scripts/check-workspace-diagnostics.ts <workspace-id>"
  );
  process.exit(1);
}

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function checkDiagnostics() {
  try {
    console.log(`🔍 Fetching diagnostics for workspace: ${workspaceId}\n`);

    const response = await fetch(
      `${API_URL}/api/workspaces/${workspaceId}/diagnostics`,
      {
        headers: {
          // Note: This won't work without auth, but shows the endpoint
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`❌ Error: ${response.status} ${response.statusText}`);
      const error = await response.json();
      console.error(error);
      return;
    }

    const data = await response.json();

    console.log("=".repeat(80));
    console.log("📊 WORKSPACE DIAGNOSTICS");
    console.log("=".repeat(80));
    console.log(`Workspace ID: ${data.workspaceId}`);
    console.log(`Container ID: ${data.containerId}`);
    console.log();

    const d = data.diagnostics;

    console.log("🔧 Extension Status:");
    console.log("-".repeat(80));
    console.log(
      `Extension Installed: ${d.kalpanaExtensionInstalled ? "✅ Yes" : "❌ No"}`
    );
    console.log(`\nExtension Activation Log:`);
    console.log(d.extensionActivationLog || "No log found");
    console.log();

    console.log("🔌 Process Status:");
    console.log("-".repeat(80));
    console.log(
      `Code Server Running: ${d.codeServerRunning ? "✅ Yes" : "❌ No"}`
    );
    console.log(
      `Agent Bridge Running: ${d.agentBridgeRunning ? "✅ Yes" : "❌ No"}`
    );
    console.log();

    console.log("🌐 Network Status:");
    console.log("-".repeat(80));
    console.log(`Port 3002 (Extension WebSocket):`);
    console.log(d.port3002Status || "Unable to check");
    console.log();

    console.log("📦 Installed Extensions:");
    console.log("-".repeat(80));
    console.log(d.installedExtensions || "Unable to list");
    console.log();

    console.log("📋 Recent Container Logs:");
    console.log("-".repeat(80));
    if (d.containerLogs) {
      // Show last 50 lines
      const lines = d.containerLogs.split("\n").slice(-50);
      console.log(lines.join("\n"));
    } else {
      console.log("No logs available");
    }
  } catch (error: any) {
    console.error("❌ Error checking diagnostics:", error.message);
  }
}

checkDiagnostics();

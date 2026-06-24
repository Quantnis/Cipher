import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const apiDir = join(root, "apps", "api");
const isWindows = process.platform === "win32";
const uvicorn = join(apiDir, ".venv", isWindows ? "Scripts" : "bin", isWindows ? "uvicorn.exe" : "uvicorn");
const npmCmd = isWindows ? "npm.cmd" : "npm";
const children = [];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiIsReady() {
  try {
    const response = await fetch("http://127.0.0.1:8000/health", { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

function spawnChild(command, args, options) {
  const child = spawn(command, args, { stdio: "inherit", shell: false, ...options });
  children.push(child);
  return child;
}

function shutdown(signal = "SIGTERM") {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit(130);
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit(143);
});

if (!(await apiIsReady())) {
  if (!existsSync(uvicorn)) {
    console.error(`API virtualenv uvicorn was not found at ${uvicorn}`);
    console.error("Create/install it first: python -m venv apps/api/.venv && apps/api/.venv/Scripts/pip install -r apps/api/requirements.txt");
    process.exit(1);
  }

  console.log("Starting ShadowGraph API on http://127.0.0.1:8000 ...");
  spawnChild(uvicorn, ["app.main:app", "--host", "127.0.0.1", "--port", "8000"], { cwd: apiDir });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await apiIsReady()) break;
    await wait(500);
  }

  if (!(await apiIsReady())) {
    console.error("API did not become ready on http://127.0.0.1:8000/health");
    shutdown();
    process.exit(1);
  }
} else {
  console.log("ShadowGraph API is already running on http://127.0.0.1:8000");
}

const web = spawnChild(npmCmd, ["--workspace", "apps/web", "run", "dev"], { cwd: root, shell: isWindows });
web.on("exit", (code, signal) => {
  shutdown();
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
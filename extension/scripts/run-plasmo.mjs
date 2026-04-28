import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionDir = resolve(scriptDir, "..");
const repoRoot = resolve(extensionDir, "..");

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const rawValue = line.slice(index + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");
        return [key, value];
      })
  );
}

const env = {
  ...readEnvFile(resolve(repoRoot, ".env")),
  ...readEnvFile(resolve(extensionDir, ".env")),
  ...process.env
};

if (!env.PLASMO_PUBLIC_JUPITER_API_KEY && env.JUPITER_API_KEY) {
  env.PLASMO_PUBLIC_JUPITER_API_KEY = env.JUPITER_API_KEY;
}

if (!env.PLASMO_PUBLIC_HELIUS_API_KEY && env.HELIUS_API_KEY) {
  env.PLASMO_PUBLIC_HELIUS_API_KEY = env.HELIUS_API_KEY;
}

if (!env.PLASMO_PUBLIC_OPENROUTER_API_KEY && env.OPENROUTER_API_KEY) {
  env.PLASMO_PUBLIC_OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
}

if (!env.PLASMO_PUBLIC_OPENROUTER_MODEL && env.OPENROUTER_MODEL) {
  env.PLASMO_PUBLIC_OPENROUTER_MODEL = env.OPENROUTER_MODEL;
}

const [command = "dev", ...args] = process.argv.slice(2);
const runner = process.env.npm_execpath ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const runnerArgs = process.env.npm_execpath
  ? [process.env.npm_execpath, "exec", "plasmo", command, ...args]
  : ["exec", "plasmo", command, ...args];
const child = spawn(runner, runnerArgs, {
  cwd: extensionDir,
  env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

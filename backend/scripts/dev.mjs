import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const tsc = spawn(
  "npx",
  ["tsc", "-p", "tsconfig.build.json", "--watch", "--preserveWatchOutput"],
  { stdio: ["ignore", "pipe", "inherit"] },
);

let started = false;

function startServer() {
  if (started || !existsSync("dist/main.js")) return;
  started = true;
  spawn("node", ["--watch", "dist/main.js"], { stdio: "inherit" });
}

tsc.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (text.includes("Found 0 errors")) startServer();
});

tsc.on("exit", (code) => process.exit(code ?? 1));

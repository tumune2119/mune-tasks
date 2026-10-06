// Checks that a launcher-started server (MUNE_TASKS_AUTO_EXIT=1) stops when its last window closes.
// Starts its own servers on port 3793 with a throwaway database; uses your installed Chrome.
//   node scripts/test-auto-exit.mjs
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const PORT = 3793;
const URL = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT), "-H", "127.0.0.1"], {
    env: {
      ...process.env,
      MUNE_TASKS_AUTO_EXIT: "1",
      MUNE_TASKS_DB_PATH: path.join(os.tmpdir(), "mune-tasks-auto-exit-test.db"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const exited = new Promise((r) => child.on("exit", () => r(Date.now())));
  return { child, exited, log: () => log };
}

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("server did not start");
}

/** Resolves true if the server exits within `ms`, false if it is still running. */
const exitsWithin = (srv, ms) => Promise.race([srv.exited.then(() => true), sleep(ms).then(() => false)]);

const browser = await chromium.launch({ channel: "chrome" });
const results = [];
const check = (name, ok) => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
};

try {
  // 1. Closing the only window stops the server.
  let srv = startServer();
  await waitUp();
  let ctx = await browser.newContext();
  let page = await ctx.newPage();
  await page.goto(URL);
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  check("Quit button is shown when started by the launcher", await page.getByRole("button", { name: "Quit MUNE TASKS" }).isVisible());

  // 2. A reload is not a close.
  await page.reload();
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  check("reloading the window keeps the server running", !(await exitsWithin(srv, 8000)));

  // 3. Two windows: closing one keeps it running, closing the last stops it.
  const second = await ctx.newPage();
  await second.goto(URL);
  await second.getByRole("heading", { name: "Dashboard" }).waitFor();
  await second.close({ runBeforeUnload: true });
  check("closing one of two windows keeps the server running", !(await exitsWithin(srv, 8000)));
  const closedAt = Date.now();
  await page.close({ runBeforeUnload: true });
  const stopped = await exitsWithin(srv, 15000);
  check(`closing the last window stops the server${stopped ? ` (${((Date.now() - closedAt) / 1000).toFixed(1)}s)` : ""}`, stopped);

  // 4. The Quit button stops the server and shows the stopped screen.
  srv = startServer();
  await waitUp();
  page = await ctx.newPage();
  await page.goto(URL);
  await page.getByRole("button", { name: "Quit MUNE TASKS" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Quit" }).click();
  check("Quit stops the server", await exitsWithin(srv, 8000));
  check("Quit shows the stopped screen", await page.getByText("MUNE TASKS has stopped").isVisible().catch(() => false));
  await ctx.close();
  if (results.includes(false)) console.log(srv.log());
} finally {
  await browser.close();
}
console.log(results.every(Boolean) ? "\nALL PASSED" : "\nSOME CHECKS FAILED");
process.exitCode = results.every(Boolean) ? 0 : 1;

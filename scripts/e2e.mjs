// End-to-end check against a running MUNE TASKS (default http://127.0.0.1:3777), driving your installed
// Chrome via playwright-core. Generation really calls Claude, so it uses a little of your quota.
//
//   node scripts/e2e.mjs run                → creates a project from a prompt + attachment, edits and ticks tasks
//   node scripts/e2e.mjs verify <id> <pct>  → after a server restart: checks the project and progress persisted
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.MUNE_TASKS_URL ?? "http://127.0.0.1:3777";
const OUT = path.resolve("e2e-output");
fs.mkdirSync(OUT, { recursive: true });

const [mode = "run", ...args] = process.argv.slice(2);
const log = (...m) => console.log("•", ...m);
const fail = (m) => {
  throw new Error(m);
};

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER ?? "chrome", headless: !process.env.HEADED });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(e.message));
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
const percent = async () => Number((await page.getByTestId("project-percent").innerText()).replace("%", ""));

try {
  if (mode === "run") await run();
  else if (mode === "verify") await verify(args[0], Number(args[1]));
  else fail(`Unknown mode ${mode}`);
  if (consoleErrors.length) fail(`Browser console errors:\n${consoleErrors.join("\n")}`);
  console.log("\nE2E PASSED");
} catch (err) {
  await shot("failure").catch(() => {});
  console.error("\nE2E FAILED:", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}

async function run() {
  await page.goto(BASE);
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  await shot("01-dashboard");
  log("dashboard loaded");

  // Shortcut N → new project
  await page.keyboard.press("n");
  await page.waitForURL("**/new");
  log("N shortcut opened /new");

  const spec = path.join(os.tmpdir(), "mune-tasks-e2e-spec.md");
  fs.writeFileSync(
    spec,
    "# Garden planner — notes\n- Track raised beds (name, size, sun hours).\n- Plant calendar: sow / transplant / harvest dates per crop.\n- Weekly watering reminders.\n- Stack: Next.js + SQLite.\n",
  );

  await page.locator("#prompt").fill("Build a small garden planner web app based on the attached notes. Solo developer, weekends only.");
  await page.getByTestId("file-input").setInputFiles(spec);
  await page.getByText(/mune-tasks-e2e-spec\.md/).waitFor();
  await page.getByText(/chars$/).first().waitFor();
  log("attachment extracted");

  const slider = page.getByRole("slider").first();
  await slider.focus();
  await page.keyboard.press("ArrowRight"); // 3 → 4
  await page.locator("#count").fill("about 8 tasks");
  await page.locator("#extra").fill("group by phase, include testing steps");

  await page.getByRole("button", { name: "Generate plan" }).click();
  await page.getByText(/Writing with/).waitFor({ timeout: 30_000 });
  log("generation streaming…");
  await page.waitForTimeout(4000);
  await shot("02-streaming");

  const saveBtn = page.getByRole("button", { name: "Save project" });
  await saveBtn.waitFor({ timeout: 240_000 });
  const summary = await page.getByText(/sections · \d+ tasks/).innerText();
  log("plan ready:", summary);
  await shot("03-review");

  // Edit the first task title in the review editor before saving
  const firstTask = page.getByPlaceholder("Task title").first();
  const original = await firstTask.inputValue();
  await firstTask.fill(`${original} (edited)`);
  await saveBtn.click();
  await page.waitForURL("**/projects/**", { timeout: 20_000 });
  const projectId = page.url().split("/projects/")[1];
  log("saved project", projectId);

  await page.getByTestId("project-percent").waitFor();
  if ((await percent()) !== 0) fail("New project should start at 0%");
  if (!(await page.getByText(`${original} (edited)`).count())) fail("Edited title was not saved");

  // Prompt panel shows the attachment
  await page.getByRole("button", { name: /Original prompt/ }).click();
  await page.getByText("mune-tasks-e2e-spec.md").waitFor();
  log("prompt panel shows attachment");

  // Tick the first top-level task via its checkbox
  const tasks = page.getByTestId("task");
  const taskCount = await tasks.count();
  await tasks.first().getByRole("checkbox").first().click();
  await page.waitForTimeout(600);
  const p1 = await percent();
  if (p1 <= 0) fail("Progress did not increase after ticking a task");
  log(`ticked first task → ${p1}%`);

  // Find a task with subtasks; tick one subtask and check the parent shows partial state
  const parentWithSubs = page.getByTestId("task").filter({ has: page.getByTestId("subtask") }).first();
  if (await parentWithSubs.count()) {
    const parentBox = parentWithSubs.getByRole("checkbox").first();
    await parentWithSubs.getByTestId("subtask").first().getByRole("checkbox").click();
    await page.waitForTimeout(500);
    const state = await parentBox.getAttribute("aria-checked");
    if (state !== "mixed") fail(`Parent should be partially done, got aria-checked=${state}`);
    log("subtask tick → parent is partial");
    // Tick the remaining subtasks → parent becomes done
    const subs = parentWithSubs.getByTestId("subtask");
    for (let i = 0; i < (await subs.count()); i++) {
      const cb = subs.nth(i).getByRole("checkbox");
      if ((await cb.getAttribute("aria-checked")) !== "true") await cb.click();
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(500);
    if ((await parentBox.getAttribute("aria-checked")) !== "true") fail("Parent should be done when all subtasks are done");
    log("all subtasks ticked → parent done");
  } else {
    log("(no task with subtasks in this plan — skipped subtask checks)");
  }

  // Keyboard: focus a row and toggle it with Space
  const before = await percent();
  const row = tasks.nth(Math.min(2, taskCount - 1)).locator("[data-task-row]").first();
  const wasDone = (await row.getAttribute("data-done")) === "true";
  await row.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(600);
  if ((await row.getAttribute("data-done")) === String(wasDone)) fail("Space did not toggle the focused task");
  log(`Space toggled a task (${before}% → ${await percent()}%)`);

  // Inline rename on the project page
  const titleSpan = tasks.last().locator("[data-task-row] span.cursor-text").first();
  await titleSpan.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Renamed in place");
  await page.keyboard.press("Enter");
  await page.getByText("Renamed in place").waitFor();
  log("inline rename works");

  // Add a task to the first section
  await page.getByTestId("section").first().getByRole("button", { name: "Add task" }).click();
  await page.keyboard.type("Manually added task");
  await page.keyboard.press("Enter");
  await page.getByText("Manually added task").waitFor();
  await page.keyboard.press("Escape");
  log("added a task");

  await page.waitForTimeout(800); // let the queued writes and sidebar refresh settle
  await shot("04-project");

  // Sidebar reflects the new progress after refresh
  const final = await percent();
  const sidebarItem = page.locator("aside a", { hasText: `${final}%` });
  await sidebarItem.first().waitFor({ timeout: 5000 });
  log(`sidebar shows ${final}%`);

  // Search shortcut
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("/");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-search"));
  if (!focused) fail("/ did not focus a search box");
  log("/ focuses search");

  fs.writeFileSync(path.join(OUT, "last-run.json"), JSON.stringify({ projectId, percent: final }));
  console.log(`\nPROJECT_ID=${projectId} PERCENT=${final}`);
}

async function verify(id, expected) {
  await page.goto(`${BASE}/projects/${id}`);
  await page.getByTestId("project-percent").waitFor();
  const got = await percent();
  if (got !== expected) fail(`Expected ${expected}% after restart, got ${got}%`);
  if (!(await page.getByText("Renamed in place").count())) fail("Renamed task did not persist");
  if (!(await page.getByText("Manually added task").count())) fail("Added task did not persist");
  log(`persisted after restart: ${got}%, edits intact`);

  // Finish every item → 100% (confetti), then archive with confirmation
  for (;;) {
    const open = page.locator('[data-task-row][data-done="false"]');
    if (!(await open.count())) break;
    await open.first().getByRole("checkbox").first().click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(800);
  if ((await percent()) !== 100) fail("Expected 100% after ticking everything");
  await page.waitForTimeout(300);
  await shot("05-complete");
  log("reached 100%");

  await page.locator("main").getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive", exact: true }).click();
  await page.locator("main").getByText("Archived", { exact: true }).first().waitFor();
  log("archived with confirmation");

  await page.goto(BASE);
  await page.getByRole("tab", { name: "Archived" }).click();
  await page.locator("main").getByText("100%").first().waitFor();
  await shot("06-dashboard-archived");
  log("shows under Archived filter on the dashboard");
}

// Checks scheduling, the calendar views and linked files against a throwaway database on port 3796.
// File opening runs in dry-run mode (nothing pops up). One small real Claude call (duration estimates).
//   node scripts/test-calendar.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const PORT = 3796;
const U = `http://127.0.0.1:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mune-cal-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

// --- server -----------------------------------------------------------------
let log = "";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT), "-H", "127.0.0.1"], {
  env: { ...process.env, MUNE_TASKS_DB_PATH: path.join(tmp, "test.db"), MUNE_TASKS_DRY_OPEN: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(U)).ok) break;
  } catch {}
  await sleep(500);
}

const json = (r) => r.json();
const patch = (id, action) =>
  fetch(`${U}/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) }).then(
    async (r) => ({ status: r.status, body: await r.json() }),
  );
const isWeekend = (s) => [0, 6].includes(new Date(`${s}T12:00:00`).getDay());
const topTasks = (tree) => tree.sections.flatMap((s) => s.tasks);

try {
  const { projects } = await fetch(`${U}/api/projects`).then(json);
  const example = projects[0];

  // 1. Hours-per-day scheduling: weekdays only, in plan order.
  let { body: tree } = await patch(example.id, {
    type: "schedule",
    options: { start: "2026-10-12", end: null, hoursPerDay: 2, weekends: false },
  });
  const open = topTasks(tree).filter((t) => !t.done);
  check("every unfinished task gets dates", open.every((t) => t.startDate && t.dueDate), `${open.length} tasks`);
  check("no work lands on a weekend", open.every((t) => !isWeekend(t.startDate) && !isWeekend(t.dueDate)));
  check(
    "tasks follow plan order",
    open.every((t, i) => i === 0 || t.startDate >= open[i - 1].startDate),
  );
  check("first task starts on the start date", open[0].startDate === "2026-10-12");
  check("schedule options are saved on the project", tree.schedule?.hoursPerDay === 2);

  // 2. Finish-by scheduling spreads work up to the end date.
  ({ body: tree } = await patch(example.id, {
    type: "schedule",
    options: { start: "2026-10-12", end: "2026-10-30", hoursPerDay: 2, weekends: false },
  }));
  const last = topTasks(tree).filter((t) => !t.done).at(-1);
  check("finish-by: last task ends on or just before the end date", last.dueDate <= "2026-10-30" && last.dueDate >= "2026-10-28", last.dueDate);

  // 3. Manual dates; reversed ranges are put in order.
  const t0 = open[0];
  ({ body: tree } = await patch(example.id, { type: "setTaskDates", taskId: t0.id, startDate: "2026-11-05", dueDate: "2026-11-03" }));
  const moved = topTasks(tree).find((t) => t.id === t0.id);
  check("manual dates are saved (and ordered)", moved.startDate === "2026-11-03" && moved.dueDate === "2026-11-05");
  const sub = topTasks(tree).find((t) => t.subtasks.length)?.subtasks[0];
  const subRes = await patch(example.id, { type: "setTaskDates", taskId: sub.id, startDate: "2026-11-01", dueDate: null });
  check("subtasks can't be put on the calendar", subRes.status === 400);

  // 4. Claude duration estimates (real call).
  const est = await fetch(`${U}/api/ai/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: example.id }),
  }).then(json);
  tree = await fetch(`${U}/api/projects/${example.id}`).then(json);
  const estimated = topTasks(tree).filter((t) => !t.done && t.estimateHours > 0).length;
  check("Claude estimates every unfinished task", est.estimated > 0 && estimated === est.of, `${estimated}/${est.of}, $${est.usage?.costUsd?.toFixed(3)}`);

  // 5. Linked files: a document, an image, a folder; duplicates are skipped.
  const doc = path.join(tmp, "Brief & notes (v2).txt");
  fs.writeFileSync(doc, "reference");
  const img = path.join(tmp, "moodboard.png");
  fs.copyFileSync("public/icons/icon-192.png", img);
  const folder = path.join(tmp, "Reference folder");
  fs.mkdirSync(folder);
  const target = topTasks(tree)[1];
  ({ body: tree } = await patch(example.id, { type: "addFiles", taskId: target.id, paths: [doc, `"${img}"`, folder, doc] }));
  let files = topTasks(tree).find((t) => t.id === target.id).files;
  check("files and folders link by path (duplicates skipped)", files.length === 3, files.map((f) => `${f.name}:${f.kind}`).join(", "));
  check("image is recognised", files.find((f) => f.name === "moodboard.png")?.isImage === true);
  const bad = await patch(example.id, { type: "addFiles", taskId: target.id, paths: ["C:\\nope\\missing.pdf"] });
  check("a path that doesn't exist is rejected", bad.status === 400, bad.body.error);

  const imgFile = files.find((f) => f.isImage);
  const preview = await fetch(`${U}/api/files/${imgFile.id}/preview`);
  check("image preview is served from its location", preview.ok && preview.headers.get("content-type") === "image/png");
  const docFile = files.find((f) => f.name.startsWith("Brief"));
  const opened = await fetch(`${U}/api/files/${docFile.id}/open`, { method: "POST" });
  const revealed = await fetch(`${U}/api/files/${docFile.id}/reveal`, { method: "POST" });
  await sleep(300);
  check("open and show-in-Explorer run for attached files", opened.status === 204 && revealed.status === 204 && log.includes(`[dry-open] reveal ${docFile.path}`));
  const forged = await fetch(`${U}/api/files/not-a-real-id/open`, { method: "POST" });
  check("only attached files can be opened", forged.status === 404);

  fs.rmSync(doc);
  tree = await fetch(`${U}/api/projects/${example.id}`).then(json);
  files = topTasks(tree).find((t) => t.id === target.id).files;
  check("a moved/deleted file is flagged as missing", files.find((f) => f.id === docFile.id)?.exists === false);
  const openMissing = await fetch(`${U}/api/files/${docFile.id}/open`, { method: "POST" });
  check("opening a missing file reports it", openMissing.status === 404);

  // 6. Backup round-trip keeps dates, estimates and links.
  const backup = await fetch(`${U}/api/backup`).then(json);
  await fetch(`${U}/api/backup?mode=replace`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(backup) });
  const restored = await fetch(`${U}/api/projects/${example.id}`).then(json);
  const rt = topTasks(restored).find((t) => t.id === target.id);
  check("backup restores dates, estimates and linked files", rt.dueDate && rt.estimateHours > 0 && rt.files.length === 3);

  // 7. UI: project page, calendar month + timeline, dashboard.
  // Put the project on this month's calendar so the views have something to show.
  const today = new Date().toLocaleDateString("sv-SE");
  await patch(example.id, { type: "schedule", options: { start: today, end: null, hoursPerDay: 2, weekends: true } });
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${U}/projects/${example.id}`);
  await page.getByTestId("project-percent").waitFor();
  check("project page shows date chips", (await page.locator("text=/\\w{3} \\d{1,2}/").count()) > 0);
  check("project page shows linked files", (await page.getByTestId("task-files").count()) > 0);
  await page.getByRole("button", { name: "Reschedule" }).click();
  const previewText = await page.getByTestId("schedule-preview").innerText();
  check("schedule dialog previews the finish date", /finishes/.test(previewText), previewText.split("\n")[0]);
  await page.keyboard.press("Escape");

  await page.goto(`${U}/calendar`);
  await page.getByTestId("month-grid").waitFor();
  const chips = page.getByTestId("calendar-chip");
  check("month view shows scheduled tasks", (await chips.count()) > 0, `${await chips.count()} chips`);

  // Drag the first chip one week later.
  const chip = chips.first();
  const taskId = await chip.getAttribute("data-task-id");
  const fromDay = await chip.evaluate((el) => el.closest("[data-day]").getAttribute("data-day"));
  const toDay = new Date(new Date(`${fromDay}T12:00:00`).getTime() + 7 * 864e5).toLocaleDateString("sv-SE");
  const dropCell = page.locator(`[data-day="${toDay}"]`);
  if (await dropCell.count()) {
    await chip.dragTo(dropCell);
    await sleep(1200);
    const after = await fetch(`${U}/api/projects/${example.id}`).then(json);
    const t = topTasks(after).find((x) => x.id === taskId);
    check("dragging a task to another day moves it", t.startDate >= toDay || t.dueDate >= toDay, `${fromDay} → ${t.startDate}`);
  }

  // Tick a task from its popover.
  await chips.first().click();
  await page.getByRole("checkbox").first().click();
  await sleep(800);
  check("a task can be ticked from the calendar", (await page.locator("[data-testid=calendar-chip] .line-through").count()) > 0);
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "Timeline" }).click();
  await page.getByTestId("timeline").waitFor();
  check("timeline view shows bars", (await page.getByTestId("timeline-bar").count()) > 0);
  await page.screenshot({ path: path.join(tmp, "timeline.png") });

  await page.goto(U);
  check("dashboard shows Up next", await page.getByTestId("up-next").isVisible());
  check("no browser errors", errors.length === 0, errors.join(" | "));
  await browser.close();
} catch (err) {
  console.error(err);
  results.push(false);
} finally {
  server.kill();
}
console.log(results.every(Boolean) ? `\nALL ${results.length} CHECKS PASSED` : "\nSOME CHECKS FAILED");
if (!results.every(Boolean)) console.log(log.slice(-2000));
process.exitCode = results.every(Boolean) ? 0 : 1;

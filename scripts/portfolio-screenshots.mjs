// Portfolio screenshots, 1440×900 at 2× device scale, saved to portfolio/screenshots/.
// Point it at a server with demo data (makes 2 real Claude calls):
//   MUNE_TASKS_URL=http://127.0.0.1:3792 node scripts/portfolio-screenshots.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const U = process.env.MUNE_TASKS_URL ?? "http://127.0.0.1:3777";
const OUT = path.resolve("portfolio/screenshots");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name, opts = {}) => {
  await page.waitForTimeout(opts.wait ?? 700);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !!opts.full });
  console.log("saved", name);
};
const projects = (await (await fetch(`${U}/api/projects`)).json()).projects;
const byName = (re) => projects.find((p) => re.test(p.name));

// 1. Dashboard
await page.goto(U);
await page.getByRole("heading", { name: "Dashboard" }).waitFor();
await shot("01-dashboard", { wait: 1200 });

// 2–3. New project: live streaming, then the review editor
await page.goto(`${U}/new`);
await page.locator("#prompt").fill(
  "Build a habit-tracking web app with streaks, reminders and weekly insights. Next.js + PostgreSQL, solo developer, MVP in 4 weeks.",
);
const spec = path.join(process.env.TEMP, "habit-app-notes.md");
fs.writeFileSync(spec, "# Habit app notes\n- Habits: daily / weekly, target count\n- Streaks + freeze days\n- Email + push reminders\n- Weekly insight email\n");
await page.getByTestId("file-input").setInputFiles(spec);
await page.getByText(/chars$/).first().waitFor();
await page.getByRole("slider").first().focus();
await page.keyboard.press("ArrowRight");
await page.locator("#count").fill("about 10 tasks");
await page.locator("#extra").fill("group by phase, include testing steps");
await shot("02-new-project-form");
await page.getByRole("button", { name: "Generate plan" }).click();
await page.getByText(/Writing with/).waitFor({ timeout: 30_000 });
// Wait until a few sections are on screen so the live preview looks substantial
await page.waitForFunction(() => document.querySelectorAll("main section h4").length >= 2, null, { timeout: 60_000 }).catch(() => {});
await shot("03-live-streaming", { wait: 200 });
await page.getByRole("button", { name: "Save project" }).waitFor({ timeout: 240_000 });
await shot("04-plan-review");
await page.getByRole("button", { name: "Discard" }).click();

// 5. Project page with the prompt panel open
const recipe = byName(/recipe/i);
await page.goto(`${U}/projects/${recipe.id}`);
await page.getByTestId("project-percent").waitFor();
await page.getByRole("button", { name: /Original prompt/ }).click();
await shot("05-project-page");

// 6. Project page, scrolled into a section with subtasks
await page.getByTestId("section").nth(1).scrollIntoViewIfNeeded();
await page.mouse.wheel(0, 250);
await shot("06-tasks-and-subtasks");

// 7. "Expand into detailed steps" dialog with a generated result
const withoutSubs = page.getByTestId("task").filter({ hasNot: page.getByTestId("subtask") });
const target = (await withoutSubs.count()) ? withoutSubs.first() : page.getByTestId("task").last();
const row = target.locator("[data-task-row]").first(); // the task's own row, not its subtasks'
await row.scrollIntoViewIfNeeded();
await row.hover();
await row.getByRole("button", { name: "Task menu" }).click();
await page.getByRole("menuitem", { name: /Expand into detailed steps/ }).click();
await page.getByRole("dialog").getByRole("button", { name: "Generate" }).click();
await page.getByRole("dialog").getByRole("button", { name: /Add subtasks|Replace subtasks/ }).waitFor({ timeout: 180_000 });
await shot("07-ai-expand-task");
await page.keyboard.press("Escape");

// 8. Claude usage (full page, hovering today's bar)
await page.goto(`${U}/usage`);
await page.getByRole("heading", { name: "Claude usage" }).waitFor();
await page.locator("svg[role=img] path").last().hover();
await shot("08-claude-usage", { full: true });

// 9. Settings
await page.goto(`${U}/settings`);
await page.getByRole("heading", { name: "Settings" }).waitFor();
await shot("09-settings");

// 10. Completing a project: tick the remaining items, capture the confetti
const japan = byName(/japan/i);
await page.goto(`${U}/projects/${japan.id}`);
await page.getByTestId("project-percent").waitFor();
for (;;) {
  const open = page.locator('[data-task-row][data-done="false"]');
  const n = await open.count();
  if (!n) break;
  await open.first().getByRole("checkbox").first().click();
  await page.waitForTimeout(n === 1 ? 50 : 250);
}
await page.evaluate(() => window.scrollTo(0, 0));
await shot("10-project-complete", { wait: 450 });

// 11. Archived filter on the dashboard
await page.goto(U);
await page.getByRole("tab", { name: "Archived" }).click();
await shot("11-archived-projects");

console.log(errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors");
await browser.close();

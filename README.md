# MUNE TASKS

A personal, local-only todo app. Describe a project (plus optional files), pick how detailed you want it, and Claude writes a structured plan: sections → tasks → subtasks. Each project gets its own page with progress tracking. Everything is stored in a local SQLite file; the server only listens on `127.0.0.1`.

## Setup

The app was previously called Taskforge. On first start after the rename, `data\taskforge.db` is moved to `data\mune-tasks.db` automatically, and old backups still import.

Requirements: **Node.js 20 or newer** (`node -v`). Chrome or Edge is recommended for the app-window experience.

1. **Pick how MUNE TASKS talks to Claude** (either works):
   - **Claude Code CLI (no setup if you already use Claude Code):** MUNE TASKS finds `claude` on your PATH, in `%USERPROFILE%\.local\bin`, or the copy bundled with the VS Code extension, and runs on your Claude subscription.
   - **API key:** copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY=sk-ant-...`. Restart MUNE TASKS afterwards.
2. **Start it:** double-click `launch-mune-tasks.vbs` (or the desktop shortcut below). On first run a console shows the install and build (a minute or two), then MUNE TASKS opens in its own window.
3. **Desktop shortcut (recommended):** right-click `create-shortcut.ps1` → *Run with PowerShell*, or run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\create-shortcut.ps1
   ```

In **Settings** you can switch between *Auto* (API key if present, otherwise CLI), *API key* and *Claude Code CLI*, change the model (default `claude-sonnet-5-5`) and effort, and use **Test connection**.

## Launching

The desktop shortcut runs `launch-mune-tasks.vbs`, which starts `start-mune-tasks.bat` **without a console window**. The bat:
- installs dependencies when `package-lock.json` changed,
- rebuilds when anything in `src/`, `public/` or the config changed since the last build,
- runs `next start -p 3777 -H 127.0.0.1`,
- opens `http://127.0.0.1:3777` as a Chrome/Edge `--app` window (default browser as a fallback).

When an install or rebuild is needed, the console is shown so you can follow it. Otherwise the server runs hidden and logs to `logs\server.log`; if it fails to start within 2 minutes, a message box points you there.

**Closing:** just close the MUNE TASKS window (or click **Quit MUNE TASKS** at the bottom of the sidebar). The server stops on its own about 5 seconds after the last MUNE TASKS window closes. Reloading the window doesn't stop it, and with two windows open it keeps running until both are closed. If you start the server with `npm start` or `npm run dev` instead, it doesn't stop on its own and there's no Quit button. If MUNE TASKS is already running, the launcher just opens another window.

**Install as an app:** in the MUNE TASKS window, open the browser menu → *Install MUNE TASKS* (or the install icon in the address bar). The installed app still needs the server, so start it with the launcher first.

## Using it

- **New project** (`N`): description, drag-and-drop files (`.md`, `.txt`, code, `.pdf`, `.docx`; text is extracted server-side), detail level 1–5, an optional item count ("about 10 tasks", "max 30 subtasks") and extra instructions. The plan streams in live. You can then edit anything before saving.
- **Project page:** tick tasks and subtasks (a task is done when all its subtasks are). Click any title to rename it. Drag the handles to reorder. The ✨ button on a section regenerates it, and the task menu → *Expand into detailed steps* breaks a task into 5–15 min subtasks. You preview AI changes before applying them. *Original prompt* shows what you asked for and which files were attached.
- **Progress** counts checkable items: a task without subtasks is one item, and a task with subtasks counts each subtask.

| Shortcut | Action |
| --- | --- |
| `N` | New project |
| `C` | Calendar |
| `/` | Focus search |
| `Space` | Tick / untick the focused task |
| `↑` `↓` (or `J` `K`) | Move between tasks |
| `Enter` | Rename the focused task |
| `→` `←` | Show / hide subtasks |
| `Ctrl+Enter` | Generate (on the New project screen) |

## Calendar

Projects can be laid out on a calendar so you can see what to work on each day.

- **When creating a project:** turn on **Schedule on calendar**, pick a start date, and choose either *hours per day* or a *finish by* date (plus whether weekends count). Claude estimates each task's hours while writing the plan, and the tasks are placed in plan order across your working days when you save.
- **Later, for any project:** click **Schedule** (or **Reschedule**) on the project page. For plans made before estimates existed, leave *Ask Claude to estimate durations first* on, which is one small Claude request. **Remove from calendar** clears the dates.
- **Change dates by hand:** click a task's date chip, or use the task menu → *Set dates…*. Only top-level tasks get dates; subtasks belong to their task.
- **Calendar page** (`C`): **Month** shows each task on the days it covers, coloured by project. Drag a task to another day to move it. **Timeline** shows five weeks of bars per project with a line for today. Click any task to tick it, edit its dates or jump to its project. Overdue tasks are marked in red.
- **Dashboard → Up next** lists overdue work, today's tasks and the next two days.

The scheduler (`src/lib/schedule.ts`) is deterministic: it fills each working day up to the hours you set, or spreads the total evenly up to the finish-by date. Finished tasks keep their dates and aren't rescheduled.

## Linked files

Any task or subtask can have reference files, documents or folders attached. They're **linked by their location on your PC, not uploaded or copied**, so editing the file in its usual app is always reflected.

- Task menu → **Attach files…** or **Attach folder…** opens the normal Windows picker. **Link by path…** lets you paste paths (in Explorer, Shift + right-click → *Copy as path*).
- Click a file to **open it** in its default app. The folder icon **shows it in Explorer** with the file selected. The × removes the link only; the file itself is never touched.
- Images show a small thumbnail. If a file is moved or deleted, it's flagged with a warning so you can re-link it.
- Links are included in JSON backups. On another PC they'll show as missing unless the files exist at the same paths.



Every request the app sends to Claude is logged: new-project plans, section regenerations, task expansions and connection tests. Open **Claude usage** in the sidebar to see:

- totals for the last 7 / 30 / 90 days (estimated cost, tokens in/out, requests and failures, average time),
- a daily chart of cost, tokens or requests, with a table view,
- breakdowns by feature, by model and by project,
- the 50 most recent requests, including cache tokens, retries and errors.

Each project's *Original prompt* panel also shows that project's total, and every generation shows its own usage when it finishes.

Cost comes from different places depending on how the request was made. **API key** requests are priced from Anthropic's list prices (`src/lib/ai/pricing.ts`). **Claude Code CLI** requests use the figure Claude Code reports, which is the API-equivalent cost: on a Claude subscription you aren't charged per request. Usage is recorded from the moment this feature was added; earlier requests weren't logged.

## Backup

- **Settings → Export all projects** downloads a JSON file with everything (including tick state).
- **Settings → Import backup** restores one: *Merge* keeps your current projects (same-id projects are overwritten), while *Replace everything* wipes them first.
- The raw database is `data\mune-tasks.db`. To copy it by hand, stop MUNE TASKS first.

> This folder is inside OneDrive. OneDrive syncing a live SQLite database can occasionally conflict. If that happens, either pause syncing while MUNE TASKS runs, or set `MUNE_TASKS_DB_PATH` in `.env.local` to a folder outside OneDrive and rely on JSON exports for backups.

## Development

```bash
npm run dev        # http://127.0.0.1:3778 (separate port, so it can run next to the launcher)
npm run typecheck
npm run lint
npm run build
npm run test:e2e   # drives your Chrome against a running server (makes one real Claude call)
node scripts/test-auto-exit.mjs   # checks the server stops when its last window closes (own port, no Claude calls)
node scripts/test-calendar.mjs    # scheduling, calendar views, linked files, backups (own port; one small Claude call)
```

`test:e2e` runs `scripts/e2e.mjs run`, which creates a project from a prompt and an attachment, edits it, and ticks tasks. After restarting the server, `node scripts/e2e.mjs verify <id> <percent>` checks that it all persisted, completes the project and archives it. Screenshots go to `e2e-output/`.

### How it fits together

- `src/lib/ai/`: prompts (detail levels 1–5, item-count rules, JSON-only output), the two providers (`provider-api.ts` uses `@anthropic-ai/sdk` streaming; `provider-cli.ts` runs `claude -p --output-format stream-json`), and `generate.ts`, which validates against the Zod schemas in `src/lib/plan-schema.ts` and retries once with the validation errors.
- `src/app/api/ai/*`: stream progress to the browser as NDJSON. Nothing AI-generated is saved until you click Save/Apply.
- `src/lib/projects.ts`: all database reads and edits. Every edit on the project page is one typed action (`src/lib/project-actions.ts`) sent to `PATCH /api/projects/[id]`.
- `src/lib/usage.ts`: the Claude usage log (`ai_usage` table) and its reports.
- `src/lib/db/`: Drizzle schema. Tables are created automatically on first start, and an example project is seeded once.
- `src/proxy.ts`: rejects requests with a foreign `Host` or cross-site `Origin`, so other websites can't drive your local server.

### Notes

- `better-sqlite3` is pinned to `12.9.0`: newer releases no longer ship prebuilt binaries for Node 20, and building from source needs Python plus Visual Studio build tools. Node 20 is past end-of-life. After upgrading to Node 22 or 24 you can move to the latest `better-sqlite3`.
- App icons live in `public/icons` and are regenerated with `npm run icons`.

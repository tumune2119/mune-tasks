import { eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { insertProject } from "./write-plan";
import type { PlanSection } from "../plan-schema";

const EXAMPLE_SECTIONS: PlanSection[] = [
  {
    title: "Phase 1 · Plan & content",
    tasks: [
      {
        title: "Define the site's goal and audience",
        notes: "One sentence: who visits and what should they do next?",
        priority: "high",
        subtasks: [
          { title: "Write the one-sentence goal" },
          { title: "List 3 target visitor types" },
          { title: "Pick the primary call-to-action" },
        ],
      },
      {
        title: "Gather portfolio pieces",
        priority: "med",
        subtasks: [
          { title: "Choose the 4 strongest projects" },
          { title: "Take screenshots / export images" },
          { title: "Write a 3-line blurb for each project" },
        ],
      },
      { title: "Draft the About page copy", priority: "low" },
    ],
  },
  {
    title: "Phase 2 · Build",
    tasks: [
      {
        title: "Scaffold the site",
        notes: "Next.js + Tailwind, deploy preview on every push.",
        priority: "high",
        subtasks: [
          { title: "Create the repo and project" },
          { title: "Set up fonts, colours and base layout" },
          { title: "Connect hosting and get a preview URL" },
        ],
      },
      { title: "Build the home page hero and project grid", priority: "high" },
      { title: "Build individual project pages", priority: "med" },
      { title: "Add a contact form", priority: "med" },
    ],
  },
  {
    title: "Phase 3 · Polish & launch",
    tasks: [
      {
        title: "Quality pass",
        subtasks: [
          { title: "Check every page on mobile" },
          { title: "Run Lighthouse and fix anything under 90" },
          { title: "Proofread all copy" },
        ],
      },
      { title: "Point the custom domain at the site", priority: "med" },
      { title: "Share the launch post", priority: "low" },
    ],
  },
];

/** Inserts one example project the very first time the database is created. */
export function seedIfEmpty(db: BetterSQLite3Database<typeof schema>) {
  const seeded = db.select().from(schema.settings).where(eq(schema.settings.key, "seeded")).get();
  if (seeded) return;

  db.transaction((tx) => {
    const now = Date.now();
    const id = insertProject(
      tx,
      {
        name: "Example · Launch a personal portfolio site",
        summary:
          "A sample project so you can see how MUNE TASKS works: phases, tasks, subtasks and progress. Delete it whenever you like.",
        prompt:
          "I want to launch a simple personal portfolio website to show my best projects and get contacted for freelance work. Keep it small and shippable in two weekends.",
        detailLevel: 3,
        itemCount: "about 10 tasks",
        extraInstructions: "Group by phase.",
        attachments: [],
        sections: EXAMPLE_SECTIONS,
      },
      now - 1000 * 60 * 60 * 26,
    );

    // Tick a few items so the progress UI has something to show.
    const doneTitles = [
      "Write the one-sentence goal",
      "List 3 target visitor types",
      "Pick the primary call-to-action",
      "Define the site's goal and audience",
      "Choose the 4 strongest projects",
      "Create the repo and project",
    ];
    tx.update(schema.tasks)
      .set({ done: true, doneAt: now - 1000 * 60 * 60 * 3 })
      .where(inArray(schema.tasks.title, doneTitles))
      .run();
    tx.update(schema.projects).set({ updatedAt: now - 1000 * 60 * 60 * 3 }).where(eq(schema.projects.id, id)).run();
    tx.insert(schema.settings).values({ key: "seeded", value: String(now) }).run();
  });
}

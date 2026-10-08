export interface CalendarTask {
  id: string;
  projectId: string;
  projectName: string;
  /** Index into PROJECT_COLORS. */
  color: number;
  section: string;
  title: string;
  /** YYYY-MM-DD, inclusive. */
  start: string;
  due: string;
  done: boolean;
  priority: "low" | "med" | "high" | null;
  estimateHours: number | null;
  subTotal: number;
  subDone: number;
  fileCount: number;
}

/**
 * One hue per project, in a fixed order (never cycled by rank): the validated reference categorical palette,
 * dark-mode steps, with the brand blue first. Red is left out because it means "overdue".
 * Passes lightness, chroma, colour-blind separation and contrast checks on the card surface (#0f1729).
 */
export const PROJECT_COLORS = ["#3b82f6", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];

import type { Modifier } from "@dnd-kit/core";

/** Lock dragging to the vertical axis (avoids pulling in @dnd-kit/modifiers for one function). */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

// Diff View Scenario - Read-only diff display with Zed-style formatting

import type { ScenarioDefinition } from "../types";
import type { DiffConfig, DiffResult } from "../../canvases/diff/types";

export const diffViewScenario: ScenarioDefinition<DiffConfig, DiffResult> = {
  name: "view",
  description: "View git diff with Zed-style formatting and navigation",
  canvasKind: "diff",
  interactionMode: "view-only",
  closeOn: "escape",
  defaultConfig: {
    diff: "",
    showLineNumbers: true,
    wordDiffEnabled: true,
    expandedByDefault: true,
  },
};

// Diff Canvas Types - Zed-style git diff viewer

// ============================================
// Input Configuration (from Claude)
// ============================================

export interface DiffConfig {
  diff: string;                  // Raw git diff output
  title?: string;                // Optional title (e.g., "Unstaged Changes")
  showLineNumbers?: boolean;     // Default: true
  wordDiffEnabled?: boolean;     // Enable word-level diff highlighting, default: true
  expandedByDefault?: boolean;   // Expand all hunks by default, default: true
}

// ============================================
// Internal Parsed Structures
// ============================================

export interface DiffFile {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
  status: FileStatus;
  isExpanded: boolean;          // For collapsible file sections
}

export type FileStatus = "added" | "deleted" | "modified" | "renamed" | "copied";

export interface DiffHunk {
  header: string;                // The @@ line
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: DiffChange[];
  isExpanded: boolean;           // For collapsible hunks
}

export interface DiffChange {
  type: ChangeType;
  content: string;               // Line content without +/- prefix
  oldLineNumber?: number;
  newLineNumber?: number;
  wordDiff?: WordChange[];       // For Zed-style word-level highlighting
}

export type ChangeType = "add" | "delete" | "normal";

export interface WordChange {
  type: ChangeType;
  value: string;
}

// ============================================
// Result (sent to Claude via IPC)
// ============================================

export interface DiffResult {
  dismissed: boolean;            // true if user pressed Escape/q
}

// ============================================
// UI State
// ============================================

export interface DiffViewState {
  scrollOffset: number;
  selectedFileIndex: number;
  selectedHunkIndex: number;
  collapsedFiles: Set<number>;
  collapsedHunks: Map<number, Set<number>>;  // fileIndex -> Set of hunkIndices
}

// ============================================
// Style Constants (Zed-inspired)
// ============================================

export const DIFF_COLORS = {
  // Line backgrounds
  addBg: "green",
  addFg: "white",
  deleteBg: "red",
  deleteFg: "white",
  normalBg: undefined,
  normalFg: undefined,

  // Word-level diff (bold/inverse for emphasis)
  wordAddBg: "greenBright",
  wordDeleteBg: "redBright",

  // UI elements
  hunkHeader: "cyan",
  fileHeader: "yellow",
  lineNumber: "gray",
  border: "gray",

  // Status indicators
  statusAdded: "green",
  statusDeleted: "red",
  statusModified: "yellow",
  statusRenamed: "blue",
} as const;

// File status display
export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  added: "[+]",
  deleted: "[-]",
  modified: "[M]",
  renamed: "[R]",
  copied: "[C]",
};

export const FILE_STATUS_COLORS: Record<FileStatus, string> = {
  added: DIFF_COLORS.statusAdded,
  deleted: DIFF_COLORS.statusDeleted,
  modified: DIFF_COLORS.statusModified,
  renamed: DIFF_COLORS.statusRenamed,
  copied: DIFF_COLORS.statusRenamed,
};

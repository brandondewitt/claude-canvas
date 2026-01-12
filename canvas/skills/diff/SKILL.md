# Diff Canvas

Display git diffs with Zed editor-style formatting in an interactive terminal canvas.

## Overview

The diff canvas renders git diff output with:
- Green/red background highlighting for additions/deletions
- Word-level diff highlighting for small changes
- Collapsible files and hunks
- Keyboard navigation between files and hunks
- Line numbers with old/new columns

## Usage

### Basic Display

Display a git diff:

```typescript
const result = await viewDiff({
  diff: gitDiffOutput,  // Raw output from `git diff`
  title: "Unstaged Changes",
});
```

### Configuration Options

```typescript
interface DiffConfig {
  diff: string;              // Required: Raw git diff output
  title?: string;            // Optional title for the canvas
  showLineNumbers?: boolean; // Show line numbers (default: true)
  wordDiffEnabled?: boolean; // Highlight word-level changes (default: true)
  expandedByDefault?: boolean; // Expand all hunks initially (default: true)
}
```

### Example: Show Unstaged Changes

```typescript
import { $ } from "bun";
import { viewDiff } from "./api";

const diff = await $`git diff`.text();
await viewDiff({
  diff,
  title: "Unstaged Changes",
});
```

### Example: Show Staged Changes

```typescript
const diff = await $`git diff --staged`.text();
await viewDiff({
  diff,
  title: "Staged Changes",
});
```

### Example: Compare Commits

```typescript
const diff = await $`git diff HEAD~1..HEAD`.text();
await viewDiff({
  diff,
  title: "Last Commit",
});
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Scroll down |
| `k` / `↑` | Scroll up |
| `n` | Jump to next hunk |
| `p` | Jump to previous hunk |
| `]` | Jump to next file |
| `[` | Jump to previous file |
| `Enter` | Toggle expand/collapse |
| `q` / `Esc` | Close |

## Visual Design

The canvas follows Zed editor's diff styling:

- **Additions**: Green background
- **Deletions**: Red background
- **Context**: No background
- **Word changes**: Brighter highlight within changed lines
- **File headers**: Yellow with status indicator `[+]`, `[-]`, `[M]`, `[R]`
- **Hunk headers**: Cyan `@@ -line,count +line,count @@`

## Result

The canvas returns when the user presses `q` or `Escape`:

```typescript
interface DiffResult {
  dismissed: boolean;  // Always true for view-only mode
}
```

## Scenarios

- `diff:view` - Read-only diff display (default)

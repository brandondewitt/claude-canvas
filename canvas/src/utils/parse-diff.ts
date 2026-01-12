// Git Diff Parser - Parses unified diff format into structured data

import type {
  DiffFile,
  DiffHunk,
  DiffChange,
  WordChange,
  FileStatus,
  ChangeType,
} from "../canvases/diff/types";

/**
 * Parse raw git diff output into structured DiffFile array
 */
export function parseGitDiff(diffOutput: string, expandedByDefault = true): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = diffOutput.split("\n");
  let i = 0;

  while (i < lines.length) {
    // Look for diff --git header
    if (lines[i].startsWith("diff --git")) {
      const file = parseFile(lines, i, expandedByDefault);
      if (file) {
        files.push(file.file);
        i = file.nextIndex;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return files;
}

interface ParseResult {
  file: DiffFile;
  nextIndex: number;
}

function parseFile(lines: string[], startIndex: number, expandedByDefault: boolean): ParseResult | null {
  let i = startIndex;

  // Parse diff --git line
  const gitLine = lines[i];
  const pathMatch = gitLine.match(/^diff --git a\/(.+?) b\/(.+)$/);
  if (!pathMatch) return null;

  const oldPath = pathMatch[1];
  const newPath = pathMatch[2];
  i++;

  // Determine file status and skip metadata lines
  let status: FileStatus = "modified";

  while (i < lines.length && !lines[i].startsWith("diff --git")) {
    const line = lines[i];

    if (line.startsWith("new file mode")) {
      status = "added";
      i++;
    } else if (line.startsWith("deleted file mode")) {
      status = "deleted";
      i++;
    } else if (line.startsWith("rename from")) {
      status = "renamed";
      i++;
    } else if (line.startsWith("copy from")) {
      status = "copied";
      i++;
    } else if (line.startsWith("index ")) {
      i++;
    } else if (line.startsWith("--- ")) {
      i++;
    } else if (line.startsWith("+++ ")) {
      i++;
    } else if (line.startsWith("@@")) {
      // Start of hunks
      break;
    } else if (line.startsWith("Binary files")) {
      // Binary file, skip
      i++;
      break;
    } else if (line.startsWith("similarity index") || line.startsWith("rename to") || line.startsWith("copy to")) {
      i++;
    } else {
      i++;
    }
  }

  // Parse hunks
  const hunks: DiffHunk[] = [];

  while (i < lines.length && !lines[i].startsWith("diff --git")) {
    if (lines[i].startsWith("@@")) {
      const hunk = parseHunk(lines, i, expandedByDefault);
      if (hunk) {
        hunks.push(hunk.hunk);
        i = hunk.nextIndex;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return {
    file: {
      oldPath,
      newPath,
      hunks,
      status,
      isExpanded: expandedByDefault,
    },
    nextIndex: i,
  };
}

interface HunkResult {
  hunk: DiffHunk;
  nextIndex: number;
}

function parseHunk(lines: string[], startIndex: number, expandedByDefault: boolean): HunkResult | null {
  const headerLine = lines[startIndex];

  // Parse @@ -oldStart,oldLines +newStart,newLines @@ optional context
  const match = headerLine.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
  if (!match) return null;

  const oldStart = parseInt(match[1], 10);
  const oldLines = match[2] ? parseInt(match[2], 10) : 1;
  const newStart = parseInt(match[3], 10);
  const newLines = match[4] ? parseInt(match[4], 10) : 1;
  const context = match[5] || "";

  const changes: DiffChange[] = [];
  let i = startIndex + 1;
  let currentOldLine = oldStart;
  let currentNewLine = newStart;

  while (i < lines.length) {
    const line = lines[i];

    // Stop at next hunk or next file
    if (line.startsWith("@@") || line.startsWith("diff --git")) {
      break;
    }

    // Handle empty lines at end of diff
    if (line === "" && i === lines.length - 1) {
      break;
    }

    const prefix = line[0];
    const content = line.slice(1);

    let type: ChangeType;
    let oldLineNumber: number | undefined;
    let newLineNumber: number | undefined;

    switch (prefix) {
      case "+":
        type = "add";
        newLineNumber = currentNewLine++;
        break;
      case "-":
        type = "delete";
        oldLineNumber = currentOldLine++;
        break;
      case " ":
        type = "normal";
        oldLineNumber = currentOldLine++;
        newLineNumber = currentNewLine++;
        break;
      case "\\":
        // "\ No newline at end of file" - skip
        i++;
        continue;
      default:
        // Unknown line, might be end of hunk
        if (line === "") {
          // Could be a blank context line that got trimmed
          type = "normal";
          oldLineNumber = currentOldLine++;
          newLineNumber = currentNewLine++;
        } else {
          break;
        }
    }

    changes.push({
      type,
      content: content || "",
      oldLineNumber,
      newLineNumber,
    });

    i++;
  }

  return {
    hunk: {
      header: headerLine,
      oldStart,
      oldLines,
      newStart,
      newLines,
      changes,
      isExpanded: expandedByDefault,
    },
    nextIndex: i,
  };
}

/**
 * Compute word-level diff between adjacent add/delete pairs
 * This implements Zed-style word highlighting for small hunks
 */
export function computeWordDiffs(files: DiffFile[]): DiffFile[] {
  return files.map((file) => ({
    ...file,
    hunks: file.hunks.map((hunk) => ({
      ...hunk,
      changes: computeHunkWordDiffs(hunk.changes),
    })),
  }));
}

function computeHunkWordDiffs(changes: DiffChange[]): DiffChange[] {
  const result: DiffChange[] = [];
  let i = 0;

  while (i < changes.length) {
    const change = changes[i];

    // Look for delete followed by add (replacement pattern)
    if (change.type === "delete") {
      // Collect consecutive deletes
      const deletes: DiffChange[] = [];
      while (i < changes.length && changes[i].type === "delete") {
        deletes.push(changes[i]);
        i++;
      }

      // Collect consecutive adds
      const adds: DiffChange[] = [];
      while (i < changes.length && changes[i].type === "add") {
        adds.push(changes[i]);
        i++;
      }

      // If we have both deletes and adds, compute word diff
      if (deletes.length > 0 && adds.length > 0 && deletes.length <= 5 && adds.length <= 5) {
        // Compute word diff for paired lines
        const maxPairs = Math.min(deletes.length, adds.length);

        for (let j = 0; j < deletes.length; j++) {
          if (j < maxPairs) {
            result.push({
              ...deletes[j],
              wordDiff: computeLineDiff(deletes[j].content, adds[j].content, "delete"),
            });
          } else {
            result.push(deletes[j]);
          }
        }

        for (let j = 0; j < adds.length; j++) {
          if (j < maxPairs) {
            result.push({
              ...adds[j],
              wordDiff: computeLineDiff(deletes[j].content, adds[j].content, "add"),
            });
          } else {
            result.push(adds[j]);
          }
        }
      } else {
        // No pairing, just add as-is
        result.push(...deletes, ...adds);
      }
    } else {
      result.push(change);
      i++;
    }
  }

  return result;
}

/**
 * Compute word-level diff between two lines
 */
function computeLineDiff(oldLine: string, newLine: string, forType: "add" | "delete"): WordChange[] {
  const oldWords = tokenize(oldLine);
  const newWords = tokenize(newLine);

  // Simple LCS-based diff
  const lcs = computeLCS(oldWords, newWords);
  const result: WordChange[] = [];

  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldWords.length || newIdx < newWords.length) {
    if (lcsIdx < lcs.length) {
      // Add deletions before the next LCS element
      while (oldIdx < oldWords.length && oldWords[oldIdx] !== lcs[lcsIdx]) {
        if (forType === "delete") {
          result.push({ type: "delete", value: oldWords[oldIdx] });
        }
        oldIdx++;
      }

      // Add additions before the next LCS element
      while (newIdx < newWords.length && newWords[newIdx] !== lcs[lcsIdx]) {
        if (forType === "add") {
          result.push({ type: "add", value: newWords[newIdx] });
        }
        newIdx++;
      }

      // Add the common element
      if (lcsIdx < lcs.length) {
        result.push({ type: "normal", value: lcs[lcsIdx] });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      }
    } else {
      // No more LCS elements, add remaining as changes
      while (oldIdx < oldWords.length) {
        if (forType === "delete") {
          result.push({ type: "delete", value: oldWords[oldIdx] });
        }
        oldIdx++;
      }
      while (newIdx < newWords.length) {
        if (forType === "add") {
          result.push({ type: "add", value: newWords[newIdx] });
        }
        newIdx++;
      }
    }
  }

  return result;
}

/**
 * Tokenize a line into words and whitespace
 */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inWord = false;

  for (const char of line) {
    const isWordChar = /\w/.test(char);

    if (isWordChar !== inWord && current) {
      tokens.push(current);
      current = "";
    }

    current += char;
    inWord = isWordChar;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Compute Longest Common Subsequence
 */
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Get summary stats for a diff
 */
export function getDiffStats(files: DiffFile[]): { additions: number; deletions: number; files: number } {
  let additions = 0;
  let deletions = 0;

  for (const file of files) {
    for (const hunk of file.hunks) {
      for (const change of hunk.changes) {
        if (change.type === "add") additions++;
        if (change.type === "delete") deletions++;
      }
    }
  }

  return { additions, deletions, files: files.length };
}

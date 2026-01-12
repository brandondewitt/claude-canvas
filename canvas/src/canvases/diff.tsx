// Diff Canvas - Zed-style git diff viewer

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { useIPCServer } from "./calendar/hooks/use-ipc-server";
import { parseGitDiff, computeWordDiffs, getDiffStats } from "../utils/parse-diff";
import { FileHeader } from "./diff/components/file-header";
import { HunkHeader } from "./diff/components/hunk-header";
import { DiffLine } from "./diff/components/diff-line";
import type { DiffConfig, DiffFile, DiffResult } from "./diff/types";
import { DIFF_COLORS } from "./diff/types";

interface Props {
  id: string;
  config?: DiffConfig;
  socketPath?: string;
  scenario?: string;
}

// Represents a line in the virtual list for scrolling
type VirtualLine =
  | { type: "file-header"; fileIndex: number }
  | { type: "hunk-header"; fileIndex: number; hunkIndex: number }
  | { type: "change"; fileIndex: number; hunkIndex: number; changeIndex: number };

export function DiffCanvas({ id, config: initialConfig, socketPath, scenario = "view" }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Terminal dimensions
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });

  // Live config state (can be updated via IPC)
  const [liveConfig, setLiveConfig] = useState<DiffConfig | undefined>(initialConfig);

  // Scroll and selection state
  const [scrollOffset, setScrollOffset] = useState(0);
  const [cursorLine, setCursorLine] = useState(0);

  // Collapsed state
  const [collapsedFiles, setCollapsedFiles] = useState<Set<number>>(new Set());
  const [collapsedHunks, setCollapsedHunks] = useState<Map<number, Set<number>>>(new Map());

  // IPC for communicating with Claude
  const ipc = useIPCServer({
    socketPath,
    scenario: scenario || "view",
    onClose: () => exit(),
    onUpdate: (newConfig) => {
      setLiveConfig(newConfig as DiffConfig);
    },
    onGetSelection: () => null,
    onGetContent: () => ({ content: liveConfig?.diff || "", cursorPosition: 0 }),
  });

  // Config with defaults
  const {
    diff: diffInput = "",
    title = "Diff",
    showLineNumbers = true,
    wordDiffEnabled = true,
    expandedByDefault = true,
  } = liveConfig || {};

  // Parse diff and compute word diffs
  const files = useMemo(() => {
    const parsed = parseGitDiff(diffInput, expandedByDefault);
    return wordDiffEnabled ? computeWordDiffs(parsed) : parsed;
  }, [diffInput, wordDiffEnabled, expandedByDefault]);

  // Get diff stats
  const stats = useMemo(() => getDiffStats(files), [files]);

  // Build virtual line list for scrolling
  const virtualLines = useMemo((): VirtualLine[] => {
    const lines: VirtualLine[] = [];

    files.forEach((file, fileIndex) => {
      // File header
      lines.push({ type: "file-header", fileIndex });

      // Skip hunks if file is collapsed
      if (collapsedFiles.has(fileIndex)) return;

      file.hunks.forEach((hunk, hunkIndex) => {
        // Hunk header
        lines.push({ type: "hunk-header", fileIndex, hunkIndex });

        // Skip changes if hunk is collapsed
        const fileCollapses = collapsedHunks.get(fileIndex);
        if (fileCollapses?.has(hunkIndex)) return;

        hunk.changes.forEach((_, changeIndex) => {
          lines.push({ type: "change", fileIndex, hunkIndex, changeIndex });
        });
      });
    });

    return lines;
  }, [files, collapsedFiles, collapsedHunks]);

  // Calculate line number width
  const lineNumberWidth = useMemo(() => {
    let maxLine = 0;
    for (const file of files) {
      for (const hunk of file.hunks) {
        maxLine = Math.max(maxLine, hunk.oldStart + hunk.oldLines, hunk.newStart + hunk.newLines);
      }
    }
    return Math.max(3, maxLine.toString().length);
  }, [files]);

  // Listen for terminal resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: stdout?.columns || 120,
        height: stdout?.rows || 40,
      });
    };
    stdout?.on("resize", updateDimensions);
    updateDimensions();
    return () => {
      stdout?.off("resize", updateDimensions);
    };
  }, [stdout]);

  // Layout calculations
  const termWidth = dimensions.width;
  const termHeight = dimensions.height;
  const headerHeight = 3;
  const footerHeight = 2;
  const viewportHeight = termHeight - headerHeight - footerHeight;
  const maxScroll = Math.max(0, virtualLines.length - viewportHeight);

  // Ensure cursor is visible
  const ensureCursorVisible = useCallback((line: number) => {
    setScrollOffset((offset) => {
      if (line < offset) return line;
      if (line >= offset + viewportHeight) return line - viewportHeight + 1;
      return offset;
    });
  }, [viewportHeight]);

  // Toggle file collapse
  const toggleFile = useCallback((fileIndex: number) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileIndex)) {
        next.delete(fileIndex);
      } else {
        next.add(fileIndex);
      }
      return next;
    });
  }, []);

  // Toggle hunk collapse
  const toggleHunk = useCallback((fileIndex: number, hunkIndex: number) => {
    setCollapsedHunks((prev) => {
      const next = new Map(prev);
      const fileSet = new Set(next.get(fileIndex) || []);
      if (fileSet.has(hunkIndex)) {
        fileSet.delete(hunkIndex);
      } else {
        fileSet.add(hunkIndex);
      }
      next.set(fileIndex, fileSet);
      return next;
    });
  }, []);

  // Find next/previous hunk from current position
  const findNextHunk = useCallback((fromLine: number, direction: 1 | -1): number => {
    let line = fromLine + direction;
    while (line >= 0 && line < virtualLines.length) {
      const vLine = virtualLines[line];
      if (vLine && vLine.type === "hunk-header") {
        return line;
      }
      line += direction;
    }
    return fromLine;
  }, [virtualLines]);

  // Find next/previous file from current position
  const findNextFile = useCallback((fromLine: number, direction: 1 | -1): number => {
    let line = fromLine + direction;
    while (line >= 0 && line < virtualLines.length) {
      const vLine = virtualLines[line];
      if (vLine && vLine.type === "file-header") {
        return line;
      }
      line += direction;
    }
    return fromLine;
  }, [virtualLines]);

  // Keyboard controls
  useInput((input, key) => {
    // Quit with Escape or q
    if (key.escape || input === "q") {
      const result: DiffResult = { dismissed: true };
      ipc.sendSelected(result);
      exit();
      return;
    }

    // Scroll/cursor movement
    if (key.upArrow || input === "k") {
      const newLine = Math.max(0, cursorLine - 1);
      setCursorLine(newLine);
      ensureCursorVisible(newLine);
      return;
    }

    if (key.downArrow || input === "j") {
      const newLine = Math.min(virtualLines.length - 1, cursorLine + 1);
      setCursorLine(newLine);
      ensureCursorVisible(newLine);
      return;
    }

    if (key.pageUp) {
      const newLine = Math.max(0, cursorLine - viewportHeight);
      setCursorLine(newLine);
      setScrollOffset((o) => Math.max(0, o - viewportHeight));
      return;
    }

    if (key.pageDown) {
      const newLine = Math.min(virtualLines.length - 1, cursorLine + viewportHeight);
      setCursorLine(newLine);
      setScrollOffset((o) => Math.min(maxScroll, o + viewportHeight));
      return;
    }

    // Jump to next/previous hunk
    if (input === "n") {
      const newLine = findNextHunk(cursorLine, 1);
      setCursorLine(newLine);
      ensureCursorVisible(newLine);
      return;
    }

    if (input === "p") {
      const newLine = findNextHunk(cursorLine, -1);
      setCursorLine(newLine);
      ensureCursorVisible(newLine);
      return;
    }

    // Jump to next/previous file
    if (input === "]") {
      const newLine = findNextFile(cursorLine, 1);
      setCursorLine(newLine);
      ensureCursorVisible(newLine);
      return;
    }

    if (input === "[") {
      const newLine = findNextFile(cursorLine, -1);
      setCursorLine(newLine);
      ensureCursorVisible(newLine);
      return;
    }

    // Toggle expand/collapse with Enter
    if (key.return) {
      const currentLine = virtualLines[cursorLine];
      if (currentLine?.type === "file-header") {
        toggleFile(currentLine.fileIndex);
      } else if (currentLine?.type === "hunk-header") {
        toggleHunk(currentLine.fileIndex, currentLine.hunkIndex);
      }
      return;
    }
  });

  // Render a single virtual line
  const renderLine = (vLine: VirtualLine, isSelected: boolean) => {
    switch (vLine.type) {
      case "file-header": {
        const file = files[vLine.fileIndex];
        if (!file) return null;
        return (
          <FileHeader
            key={`file-${vLine.fileIndex}`}
            oldPath={file.oldPath}
            newPath={file.newPath}
            status={file.status}
            isExpanded={!collapsedFiles.has(vLine.fileIndex)}
            isSelected={isSelected}
            hunkCount={file.hunks.length}
          />
        );
      }
      case "hunk-header": {
        const file = files[vLine.fileIndex];
        const hunk = file?.hunks[vLine.hunkIndex];
        if (!file || !hunk) return null;
        const fileCollapses = collapsedHunks.get(vLine.fileIndex);
        return (
          <HunkHeader
            key={`hunk-${vLine.fileIndex}-${vLine.hunkIndex}`}
            header={hunk.header}
            isExpanded={!fileCollapses?.has(vLine.hunkIndex)}
            isSelected={isSelected}
            changeCount={hunk.changes.length}
          />
        );
      }
      case "change": {
        const file = files[vLine.fileIndex];
        const hunk = file?.hunks[vLine.hunkIndex];
        const change = hunk?.changes[vLine.changeIndex];
        if (!file || !hunk || !change) return null;
        return (
          <Box key={`change-${vLine.fileIndex}-${vLine.hunkIndex}-${vLine.changeIndex}`}>
            <Text color={isSelected ? "cyan" : undefined}>
              {isSelected ? ">" : " "}
            </Text>
            <Text> </Text>
            <DiffLine
              change={change}
              showLineNumbers={showLineNumbers}
              lineNumberWidth={lineNumberWidth}
            />
          </Box>
        );
      }
    }
  };

  // Get visible lines
  const visibleLines = virtualLines.slice(scrollOffset, scrollOffset + viewportHeight);

  // Scroll indicator
  const scrollPercent = maxScroll > 0 ? Math.round((scrollOffset / maxScroll) * 100) : 100;

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      {/* Title bar */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="white">
          {title}
        </Text>
        <Box>
          <Text color={DIFF_COLORS.statusAdded}>+{stats.additions}</Text>
          <Text color={DIFF_COLORS.lineNumber}> / </Text>
          <Text color={DIFF_COLORS.statusDeleted}>-{stats.deletions}</Text>
          <Text color={DIFF_COLORS.lineNumber}> in </Text>
          <Text color={DIFF_COLORS.fileHeader}>{stats.files} file{stats.files !== 1 ? "s" : ""}</Text>
        </Box>
      </Box>

      {/* Diff content */}
      <Box flexDirection="column" flexGrow={1}>
        {files.length === 0 ? (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <Text color={DIFF_COLORS.lineNumber} dimColor>
              No changes to display
            </Text>
          </Box>
        ) : (
          visibleLines.map((vLine, i) => {
            const absoluteIndex = scrollOffset + i;
            const isSelected = absoluteIndex === cursorLine;
            return (
              <Box key={i}>
                {renderLine(vLine, isSelected)}
              </Box>
            );
          })
        )}
      </Box>

      {/* Status bar */}
      <Box justifyContent="space-between">
        <Text color={DIFF_COLORS.lineNumber} dimColor>
          j/k scroll | n/p hunk | [/] file | Enter toggle | q quit
        </Text>
        <Text color={DIFF_COLORS.lineNumber} dimColor>
          {virtualLines.length > viewportHeight
            ? `${scrollPercent}%`
            : `${virtualLines.length} lines`}
        </Text>
      </Box>
    </Box>
  );
}

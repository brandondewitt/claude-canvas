// Diff Line Component - Renders a single diff line with Zed-style coloring

import React from "react";
import { Box, Text } from "ink";
import type { DiffChange, WordChange } from "../types";
import { DIFF_COLORS } from "../types";

interface Props {
  change: DiffChange;
  showLineNumbers: boolean;
  lineNumberWidth: number;
}

export function DiffLine({ change, showLineNumbers, lineNumberWidth }: Props) {
  const { type, content, oldLineNumber, newLineNumber, wordDiff } = change;

  // Line prefix
  const prefix = type === "add" ? "+" : type === "delete" ? "-" : " ";

  // Background color based on change type
  const bgColor = type === "add"
    ? DIFF_COLORS.addBg
    : type === "delete"
    ? DIFF_COLORS.deleteBg
    : undefined;

  // Format line numbers
  const oldNum = oldLineNumber?.toString().padStart(lineNumberWidth, " ") || " ".repeat(lineNumberWidth);
  const newNum = newLineNumber?.toString().padStart(lineNumberWidth, " ") || " ".repeat(lineNumberWidth);

  return (
    <Box>
      {/* Line numbers */}
      {showLineNumbers && (
        <>
          <Text color={DIFF_COLORS.lineNumber} dimColor>
            {oldNum}
          </Text>
          <Text color={DIFF_COLORS.border} dimColor>
            {" "}
          </Text>
          <Text color={DIFF_COLORS.lineNumber} dimColor>
            {newNum}
          </Text>
          <Text color={DIFF_COLORS.border} dimColor>
            {" | "}
          </Text>
        </>
      )}

      {/* Prefix (+/-/space) */}
      <Text backgroundColor={bgColor}>
        {prefix}
      </Text>

      {/* Content with optional word-level diff */}
      {wordDiff && wordDiff.length > 0 ? (
        <WordDiffContent wordDiff={wordDiff} baseBgColor={bgColor} />
      ) : (
        <Text backgroundColor={bgColor}>
          {content}
        </Text>
      )}
    </Box>
  );
}

interface WordDiffProps {
  wordDiff: WordChange[];
  baseBgColor: string | undefined;
}

function WordDiffContent({ wordDiff, baseBgColor }: WordDiffProps) {
  return (
    <>
      {wordDiff.map((word, i) => {
        // Highlight changed words more prominently
        let bgColor = baseBgColor;
        let bold = false;
        let inverse = false;

        if (word.type === "add") {
          bgColor = DIFF_COLORS.wordAddBg;
          bold = true;
        } else if (word.type === "delete") {
          bgColor = DIFF_COLORS.wordDeleteBg;
          bold = true;
        }

        return (
          <Text
            key={i}
            backgroundColor={bgColor}
            bold={bold}
            inverse={inverse}
          >
            {word.value}
          </Text>
        );
      })}
    </>
  );
}

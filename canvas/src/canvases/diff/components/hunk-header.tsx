// Hunk Header Component - Displays @@ line info

import React from "react";
import { Box, Text } from "ink";
import { DIFF_COLORS } from "../types";

interface Props {
  header: string;
  isExpanded: boolean;
  isSelected: boolean;
  changeCount: number;
}

export function HunkHeader({ header, isExpanded, isSelected, changeCount }: Props) {
  // Parse the header to extract line numbers and context
  const match = header.match(/^(@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@)(.*)$/);
  const lineInfo = match?.[1] || header;
  const context = match?.[2]?.trim() || "";

  return (
    <Box>
      {/* Selection indicator */}
      <Text color={isSelected ? "cyan" : undefined}>
        {isSelected ? " >" : "  "}
      </Text>

      {/* Expand/collapse indicator */}
      <Text color={DIFF_COLORS.border}>
        {isExpanded ? "v" : ">"}
      </Text>

      {/* Line info */}
      <Text color={DIFF_COLORS.hunkHeader}>
        {" "}{lineInfo}
      </Text>

      {/* Function/context if present */}
      {context && (
        <Text color={DIFF_COLORS.lineNumber} dimColor>
          {" "}{context}
        </Text>
      )}

      {/* Change count when collapsed */}
      {!isExpanded && (
        <Text color={DIFF_COLORS.lineNumber} dimColor>
          {" "}({changeCount} line{changeCount !== 1 ? "s" : ""})
        </Text>
      )}
    </Box>
  );
}

// File Header Component - Displays file path with status indicator

import React from "react";
import { Box, Text } from "ink";
import type { FileStatus } from "../types";
import { FILE_STATUS_LABELS, FILE_STATUS_COLORS, DIFF_COLORS } from "../types";

interface Props {
  oldPath: string;
  newPath: string;
  status: FileStatus;
  isExpanded: boolean;
  isSelected: boolean;
  hunkCount: number;
}

export function FileHeader({
  oldPath,
  newPath,
  status,
  isExpanded,
  isSelected,
  hunkCount,
}: Props) {
  const statusLabel = FILE_STATUS_LABELS[status];
  const statusColor = FILE_STATUS_COLORS[status];

  // Display path based on status
  const displayPath = status === "renamed" ? `${oldPath} -> ${newPath}` : newPath;

  return (
    <Box>
      {/* Selection indicator */}
      <Text color={isSelected ? "cyan" : undefined}>
        {isSelected ? ">" : " "}
      </Text>

      {/* Expand/collapse indicator */}
      <Text color={DIFF_COLORS.border}>
        {isExpanded ? "[-]" : "[+]"}
      </Text>

      {/* Status indicator */}
      <Text color={statusColor} bold>
        {" "}{statusLabel}
      </Text>

      {/* File path */}
      <Text color={DIFF_COLORS.fileHeader} bold>
        {" "}{displayPath}
      </Text>

      {/* Hunk count when collapsed */}
      {!isExpanded && (
        <Text color={DIFF_COLORS.lineNumber} dimColor>
          {" "}({hunkCount} hunk{hunkCount !== 1 ? "s" : ""})
        </Text>
      )}
    </Box>
  );
}

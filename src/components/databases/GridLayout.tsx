import { Box, Group } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./GridLayout.module.css";

function GridLayout({
  search,
  table,
  preview,
  compactSearch = false,
}: {
  search: ReactNode;
  table: ReactNode;
  preview: ReactNode;
  compactSearch?: boolean;
}) {
  return (
    <Group grow h="100%">
      <Box
        style={{
          display: "flex",
          gap: compactSearch ? "0.5rem" : "1rem",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <Box className={compactSearch ? classes.compactSearch : classes.search}>{search}</Box>
        {table}
      </Box>

      <Box
        style={{
          display: "flex",
          gap: "1rem",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {preview}
      </Box>
    </Group>
  );
}

export default GridLayout;

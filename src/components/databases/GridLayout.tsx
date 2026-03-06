import { Box, Group } from "@mantine/core";
import type { ReactNode } from "react";
import * as classes from "./GridLayout.css";

function GridLayout({
  search,
  table,
  preview,
}: {
  search: ReactNode;
  table: ReactNode;
  preview: ReactNode;
}) {
  return (
    <Group grow h="100%">
      <Box
        style={{
          display: "flex",
          gap: "1rem",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <Box className={classes.search}>{search}</Box>
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

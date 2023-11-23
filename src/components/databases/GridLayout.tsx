import { Box, Group } from "@mantine/core";
import useStyles from "./styles";

function GridLayout({
  search,
  table,
  preview,
}: {
  search: JSX.Element;
  table: JSX.Element;
  preview: JSX.Element;
}) {
  const { classes } = useStyles();
  return (
    <>
      <Group grow h="100%">
        <Box
          sx={{
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
          sx={{
            display: "flex",
            gap: "1rem",
            flexDirection: "column",
            height: "100%",
          }}
        >
          {preview}
        </Box>
      </Group>
    </>
  );
}

export default GridLayout;

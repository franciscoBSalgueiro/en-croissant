import { Flex, Stack } from "@mantine/core";

function BoardLayout({
  board,
  children,
}: {
  board: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <>
      <Flex gap="md" wrap="nowrap" align="start" h="100%">
        {board}
        <Stack
          sx={{
            flex: 1,
            flexGrow: 1,
            height: "100%",
          }}
        >
          {children}
        </Stack>
      </Flex>
    </>
  );
}

export default BoardLayout;

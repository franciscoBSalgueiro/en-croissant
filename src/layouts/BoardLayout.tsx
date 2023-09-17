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
      <Flex gap="md" wrap="wrap" align="start">
        {board}
        <Stack
          sx={{
            flex: 1,
            flexGrow: 1,
            justifyContent: "space-between",
            height: window.innerWidth > 1000 ? "80vh" : "100%",
          }}
        >
          {children}
        </Stack>
      </Flex>
    </>
  );
}

export default BoardLayout;

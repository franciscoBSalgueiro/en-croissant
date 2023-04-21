import { Flex, Stack } from "@mantine/core";
import { useViewportSize } from "@mantine/hooks";

function BoardLayout({
  board,
  children,
}: {
  board: JSX.Element;
  children: JSX.Element;
}) {
  const { width } = useViewportSize();

  return (
    <>
      <Flex gap="md" wrap="wrap" align="start">
        {board}
        <Stack
          sx={{
            flex: 1,
            flexGrow: 1,
            justifyContent: "space-between",
            height: width > 1000 ? "80vh" : "100%",
          }}
        >
          {children}
        </Stack>
      </Flex>
    </>
  );
}

export default BoardLayout;

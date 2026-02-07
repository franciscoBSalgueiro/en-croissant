import { sessionsAtom } from "@/state/atoms";
import { Box, Card, Group, SimpleGrid, Stack, Title } from "@mantine/core";
import { useAtomValue } from "jotai";
import Accounts from "./Accounts";
import Databases from "./Databases";

function AccountsPage() {
  const sessions = useAtomValue(sessionsAtom);

  return (
    <Group grow px="lg" pb="lg" h="100%" style={{ overflow: "hidden" }}>
      <Stack h="100%">
        <Title py="sm">Accounts</Title>
        <Accounts />
      </Stack>

      {sessions.length > 0 && (
        <Box h="100%" pt="md" style={{ overflow: "hidden" }}>
          <Databases />
        </Box>
      )}
    </Group>
  );
}

export default AccountsPage;

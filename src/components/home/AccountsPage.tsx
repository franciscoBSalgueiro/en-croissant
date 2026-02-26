import { Box, Group, Stack } from "@mantine/core";
import { useAtomValue } from "jotai";
import { sessionsAtom } from "@/state/atoms";
import Accounts from "./Accounts";
import Databases from "./Databases";

function AccountsPage() {
  const sessions = useAtomValue(sessionsAtom);

  return (
    <Group grow px="lg" pb="lg" h="100%" style={{ overflow: "hidden" }}>
      <Stack h="100%">
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

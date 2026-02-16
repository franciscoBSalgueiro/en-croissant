import { Box, Group, Stack, Title } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { sessionsAtom } from "@/state/atoms";
import Accounts from "./Accounts";
import Databases from "./Databases";

function AccountsPage() {
  const sessions = useAtomValue(sessionsAtom);
  const { t } = useTranslation();

  return (
    <Group grow px="lg" pb="lg" h="100%" style={{ overflow: "hidden" }}>
      <Stack h="100%">
        <Title py="sm">{t("Home.Accounts.Title")}</Title>
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

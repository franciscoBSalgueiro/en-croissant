import GameTable from "@/components/databases/GameTable";
import HistoryGameTable from "@/components/databases/HistoryGameTable";
import PlayerTable from "@/components/databases/PlayerTable";
import { selectedDatabaseAtom } from "@/state/atoms";
import { ActionIcon, Box, Group, Stack, Tabs, Title } from "@mantine/core";
import {
  IconArrowBackUp,
  IconChess,
  IconTrophy,
  IconUser,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useAtom } from "jotai";
import TournamentTable from "./TournamentTable";

function DatabaseView() {
  const [database, setDatabase] = useAtom(selectedDatabaseAtom);

  return (
    <Box p="sm" h="100%">
      {database && (
        <Stack h="100%" style={{ overflow: "hidden" }}>
          <Group align="center">
            <Link onClick={() => setDatabase(null)} to={"/databases"}>
              <ActionIcon variant="default">
                <IconArrowBackUp size="1rem" />
              </ActionIcon>
            </Link>
            <Title>{database.title}</Title>
          </Group>
          <Tabs
            defaultValue="games"
            flex={1}
            style={{
              display: "flex",
              overflow: "hidden",
              flexDirection: "column",
            }}
          >
            <Tabs.List>
              <Tabs.Tab leftSection={<IconChess size="1rem" />} value="games">
                Games
              </Tabs.Tab>
              {database?.filename !== "botvinnik" && (
                <Tabs.Tab leftSection={<IconUser size="1rem" />} value="players">
                  Players
                </Tabs.Tab>
              )}
              {database?.filename !== "botvinnik" && (
                <Tabs.Tab leftSection={<IconTrophy size="1rem" />} value="tournaments">
                  Tournaments
                </Tabs.Tab>
              )}
            </Tabs.List>
            <Tabs.Panel value="games" flex={1} style={{ overflow: "hidden" }} pt="md">
              {database?.filename === "botvinnik" ? (
                <HistoryGameTable />
              ) : (
                <GameTable database={database} />
              )}
            </Tabs.Panel>
            {database?.filename !== "botvinnik" && (
              <Tabs.Panel value="players" flex={1} style={{ overflow: "hidden" }} pt="md">
                <PlayerTable database={database} />
              </Tabs.Panel>
            )}
            {database?.filename !== "botvinnik" && (
              <Tabs.Panel value="tournaments" flex={1} style={{ overflow: "hidden" }} pt="md">
                <TournamentTable database={database} />
              </Tabs.Panel>
            )}
          </Tabs>
        </Stack>
      )}
    </Box>
  );
}

export default DatabaseView;

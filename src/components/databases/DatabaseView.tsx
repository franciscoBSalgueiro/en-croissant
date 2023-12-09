import { ActionIcon, Box, Group, Stack, Tabs, Title } from "@mantine/core";
import {
  IconArrowBackUp,
  IconChess,
  IconTrophy,
  IconUser,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import GameTable from "@/components/databases/GameTable";
import PlayerTable from "@/components/databases/PlayerTable";
import TournamentTable from "./TournamentTable";
import { useAtom } from "jotai";
import { selectedDatabaseAtom } from "@/atoms/atoms";

function DatabaseView() {
  const [database, setDatabase] = useAtom(selectedDatabaseAtom);

  return (
    <Box p="sm" h="100%">
      {database && (
        <Stack h="100%" style={{ overflow: "hidden" }}>
          <Group align="center">
            <Link onClick={() => setDatabase(null)} to={`/databases`}>
              <ActionIcon variant="default">
                <IconArrowBackUp size="1rem" />
              </ActionIcon>
            </Link>
            <Title>{database.title}</Title>
          </Group>
          <Tabs
            defaultValue="games"
            style={{
              display: "flex",
              flex: 1,
              overflow: "hidden",
              flexDirection: "column",
            }}
          >
            <Tabs.List>
              <Tabs.Tab leftSection={<IconChess size="1rem" />} value="games">
                Games
              </Tabs.Tab>
              <Tabs.Tab leftSection={<IconUser size="1rem" />} value="players">
                Players
              </Tabs.Tab>
              <Tabs.Tab leftSection={<IconTrophy size="1rem" />} value="tournaments">
                Tournaments
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="games" style={{ flex: 1, overflow: "hidden" }}>
              <GameTable database={database} />
            </Tabs.Panel>
            <Tabs.Panel value="players" style={{ flex: 1, overflow: "hidden" }}>
              <PlayerTable database={database} />
            </Tabs.Panel>
            <Tabs.Panel
              value="tournaments"
              style={{ flex: 1, overflow: "hidden" }}
            >
              <TournamentTable database={database} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Box>
  );
}

export default DatabaseView;

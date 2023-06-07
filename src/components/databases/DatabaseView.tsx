import { Button, Tabs, Title } from "@mantine/core";
import { useSessionStorage } from "@mantine/hooks";
import {
  IconArrowBackUp,
  IconChess,
  IconTrophy,
  IconUser,
} from "@tabler/icons-react";
import Link from "next/link";
import GameTable from "../../components/databases/GameTable";
import PlayerTable from "../../components/databases/PlayerTable";
import { DatabaseInfo } from "../../utils/db";
import TournamentTable from "./TournamentTable";

function DatabaseView() {
  const [database] = useSessionStorage<DatabaseInfo | null>({
    key: "database-view",
    defaultValue: null,
  });

  return (
    <>
      {database && (
        <>
          <Link href={`/databases`} passHref>
            <Button
              mt="md"
              compact
              leftIcon={<IconArrowBackUp size={16} />}
              variant="outline"
            >
              Back
            </Button>
          </Link>
          <Title mt="sm">{database.title}</Title>
          <Tabs defaultValue="games" mt="md">
            <Tabs.List>
              <Tabs.Tab icon={<IconChess size={16} />} value="games">
                Games
              </Tabs.Tab>
              <Tabs.Tab icon={<IconUser size={16} />} value="players">
                Players
              </Tabs.Tab>
              <Tabs.Tab icon={<IconTrophy size={16} />} value="tournaments">
                Tournaments
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="games">
              <GameTable database={database!} />
            </Tabs.Panel>
            <Tabs.Panel value="players">
              <PlayerTable database={database!} />
            </Tabs.Panel>
            <Tabs.Panel value="tournaments">
              <TournamentTable database={database!} />
            </Tabs.Panel>
          </Tabs>
        </>
      )}
    </>
  );
}

export default DatabaseView;

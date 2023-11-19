import { Button, Tabs, Title } from "@mantine/core";
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
    <>
      {database && (
        <>
          <Link onClick={() => setDatabase(null)} to={`/databases`}>
            <Button
              mt="md"
              compact
              leftIcon={<IconArrowBackUp size="1rem" />}
              variant="outline"
            >
              Back
            </Button>
          </Link>
          <Title mt="sm">{database.title}</Title>
          <Tabs defaultValue="games" mt="md">
            <Tabs.List>
              <Tabs.Tab icon={<IconChess size="1rem" />} value="games">
                Games
              </Tabs.Tab>
              <Tabs.Tab icon={<IconUser size="1rem" />} value="players">
                Players
              </Tabs.Tab>
              <Tabs.Tab icon={<IconTrophy size="1rem" />} value="tournaments">
                Tournaments
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="games">
              <GameTable database={database} />
            </Tabs.Panel>
            <Tabs.Panel value="players">
              <PlayerTable database={database} />
            </Tabs.Panel>
            <Tabs.Panel value="tournaments">
              <TournamentTable database={database} />
            </Tabs.Panel>
          </Tabs>
        </>
      )}
    </>
  );
}

export default DatabaseView;

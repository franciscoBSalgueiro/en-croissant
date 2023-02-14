import { Button, Group, Tabs, Title } from "@mantine/core";
import { useSessionStorage } from "@mantine/hooks";
import { IconArrowBackUp, IconChess, IconUser } from "@tabler/icons";
import Link from "next/link";
import GameTable from "../../components/databases/GameTable";
import PlayerTable from "../../components/databases/PlayerTable";
import { Database } from "../../utils/db";

function DatabaseView() {
  const [database, setDatabase] = useSessionStorage<Database | null>({
    key: "database-view",
    defaultValue: null,
  });
  return (
    <>
      {database && (
        <>
          <Group align="baseline">
            <Link href={`/databases`} passHref>
              <Button leftIcon={<IconArrowBackUp />} variant="outline">
                Back
              </Button>
            </Link>
            <Title>{database.title}</Title>
          </Group>
          <Tabs defaultValue="games" mt="md">
            <Tabs.List>
              <Tabs.Tab icon={<IconChess size={16} />} value="games">
                Games
              </Tabs.Tab>
              <Tabs.Tab icon={<IconUser size={16} />} value="players">
                Players
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="games">
              <GameTable database={database!} />
            </Tabs.Panel>
            <Tabs.Panel value="players">
              <PlayerTable database={database!} />
            </Tabs.Panel>
          </Tabs>
        </>
      )}
    </>
  );
}

export default DatabaseView;

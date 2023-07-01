import { Card, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { DatabaseInfo, getDatabases } from "@/utils/db";
import useStyles from "./styles";

function Databases() {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);

  useEffect(() => {
    getDatabases().then((dbs) => setDatabases(dbs));
  }, []);

  const { classes } = useStyles();

  return (
    <ScrollArea sx={{ height: "80vh" }}>
      <Stack>
        {databases.length === 0 && <Text>No databases installed.</Text>}
        {databases.map((db) => (
          <Card key={db.file} withBorder radius="md" className={classes.card}>
            <h3 className={classes.lead}>{db.title}</h3>
            <Group grow>
              <div>
                <Text fw="bold">Games</Text>
                <Text>{db.game_count}</Text>
              </div>
              <div>
                <Text fw="bold">Players</Text>
                <Text>{db.player_count}</Text>
              </div>
            </Group>
          </Card>
        ))}
      </Stack>
    </ScrollArea>
  );
}

export default Databases;

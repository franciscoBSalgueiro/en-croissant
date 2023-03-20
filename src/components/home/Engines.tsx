import { Card, Group, Image, ScrollArea, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { Engine, getEngines } from "../../utils/engines";
import useStyles from "./styles";

function Engines() {
  const [engines, setEngines] = useState<Engine[]>([]);

  useEffect(() => {
    getEngines().then((engs) => setEngines(engs));
  }, []);

  const { classes } = useStyles();

  return (
    <ScrollArea sx={{ height: "80vh" }}>
      <Stack>
        {engines.length === 0 && <Text>No engines installed.</Text>}
        {engines.map((eng) => (
          <Card
            key={eng.path}
            withBorder
            radius="md"
            className={classes.card}
          >
            <Group grow>
              <div>
                <h3 className={classes.lead}>{eng.name}</h3>
                <p>ELO: {eng.elo}</p>
              </div>
              <Image src={eng.image} alt={eng.name} height={75} width={75} />
            </Group>
          </Card>
        ))}
      </Stack>
    </ScrollArea>
  );
}

export default Engines;

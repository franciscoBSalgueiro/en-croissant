import {
  ActionIcon,
  Button,
  Group,
  Image,
  ScrollArea,
  Table,
  Text,
  Title
} from "@mantine/core";
import { IconPlus, IconRobot, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Engine } from "../../utils/engines";
import { useLocalFile } from "../../utils/hooks";
import OpenFolderButton from "../common/OpenFolderButton";
import AddEngine from "./AddEngine";

export default function EnginePage() {
  const [engines, setEngines] = useLocalFile<Engine[]>(
    "engines/engines.json",
    []
  );
  const [opened, setOpened] = useState(false);

  return (
    <>
      <AddEngine
        engines={engines}
        opened={opened}
        setOpened={setOpened}
        setEngines={setEngines}
      />
      <Group align="baseline" ml="lg" mt="xl">
        <Title>Your Engines</Title>
        <OpenFolderButton folder="engines" />
      </Group>
      <ScrollArea>
        <Table sx={{ minWidth: 800 }} verticalSpacing="sm">
          <thead>
            <tr>
              <th>Engine</th>
              <th>Elo</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {engines &&
              engines.map((item, index) => {
                return (
                  <tr key={index}>
                    <td>
                      <Group spacing="sm">
                        {item.image ? (
                          <Image width={60} height={60} src={item.image} />
                        ) : (
                          <IconRobot size={60} />
                        )}
                        <Text size="md" weight={500}>
                          {item.name}
                        </Text>
                      </Group>
                    </td>
                    <td>{item.elo}</td>
                    <td>
                      <ActionIcon>
                        <IconTrash
                          size={20}
                          onClick={() =>
                            setEngines(
                              engines.filter((e) => e.name !== item.name)
                            )
                          }
                        />
                      </ActionIcon>
                    </td>
                  </tr>
                );
              })}
            <tr>
              <td>
                <Button
                  onClick={() => setOpened(true)}
                  variant="default"
                  rightIcon={<IconPlus size={14} />}
                >
                  Add new
                </Button>
              </td>
            </tr>
          </tbody>
        </Table>
      </ScrollArea>
    </>
  );
}

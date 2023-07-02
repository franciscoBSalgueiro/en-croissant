import {
  ActionIcon,
  Button,
  Group,
  Image,
  ScrollArea,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconPlus, IconRobot, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Engine } from "@/utils/engines";
import { useLocalFile } from "@/utils/misc";
import OpenFolderButton from "../common/OpenFolderButton";
import AddEngine from "./AddEngine";
import { useToggle } from "@mantine/hooks";
import ConfirmModal from "../common/ConfirmModal";

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
              engines.map((item) => (
                <EngineRow
                  key={item.path}
                  item={item}
                  setEngines={setEngines}
                />
              ))}
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

function EngineRow({
  item,
  setEngines,
}: {
  item: Engine;
  setEngines: React.Dispatch<React.SetStateAction<Engine[]>>;
}) {
  const [deleteModal, toggleDeleteModal] = useToggle();

  return (
    <>
      <ConfirmModal
        title={"Remove engine"}
        description={`Are you sure you want to remove "${item.name}"?`}
        opened={deleteModal}
        onClose={toggleDeleteModal}
        onConfirm={() =>
          setEngines((prev) => prev.filter((e) => e.name !== item.name))
        }
      />
      <tr>
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
            <IconTrash size={20} onClick={() => toggleDeleteModal()} />
          </ActionIcon>
        </td>
      </tr>
    </>
  );
}

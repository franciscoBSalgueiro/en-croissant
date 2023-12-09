import {
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  Image,
  ScrollArea,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconEdit, IconPlus, IconRobot, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { LocalEngine } from "@/utils/engines";
import OpenFolderButton from "../common/OpenFolderButton";
import AddEngine from "./AddEngine";
import { useToggle } from "@mantine/hooks";
import ConfirmModal from "../common/ConfirmModal";
import EditEngine from "./EditEngine";
import { exists } from "@tauri-apps/api/fs";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { useAtom, useAtomValue } from "jotai";
import { enginesAtom } from "@/atoms/atoms";

export default function EnginesPage() {
  const engines = useAtomValue(enginesAtom);
  const [opened, setOpened] = useState(false);

  return (
    <>
      <AddEngine opened={opened} setOpened={setOpened} />
      <Group align="baseline" pl="lg" py="sm">
        <Title>Your Engines</Title>
        <OpenFolderButton base="AppDir" folder="engines" />
      </Group>
      <ScrollArea>
        <Table style={{ minWidth: 800 }} verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Engine</Table.Th>
              <Table.Th>Elo</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {engines &&
              engines.map((item) => <EngineRow key={item.path} item={item} />)}
            <Table.Tr>
              <Table.Td>
                <Button
                  onClick={() => setOpened(true)}
                  variant="default"
                  rightSection={<IconPlus />}
                >
                  Add new
                </Button>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </>
  );
}

function EngineRow({ item }: { item: LocalEngine }) {
  const [, setEngines] = useAtom(enginesAtom);
  const [deleteModal, toggleDeleteModal] = useToggle();
  const [editModal, toggleEditModal] = useToggle();
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      if (item.image) {
        if (item.image.startsWith("http")) {
          setImageSrc(item.image);
        } else {
          setImageSrc(await convertFileSrc(item.image));
        }
      }
    })();
  }, [item.image]);

  const [fileExists, setFileExists] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      setFileExists(await exists(item.path));
    })();
  }, [item.path]);

  return (
    <>
      <ConfirmModal
        title={"Remove engine"}
        description={`Are you sure you want to remove "${item.name}"?`}
        opened={deleteModal}
        onClose={toggleDeleteModal}
        onConfirm={() =>
          setEngines(async (prev) =>
            (await prev).filter((e) => e.name !== item.name)
          )
        }
      />
      <EditEngine
        opened={editModal}
        setOpened={toggleEditModal}
        initialEngine={item}
      />

      <Table.Tr>
        <Table.Td>
          <Group>
            <Box w="5rem">
              <Center>
                {imageSrc ? (
                  <Image fit="contain" src={imageSrc} />
                ) : (
                  <IconRobot size="3.75rem" />
                )}
              </Center>
            </Box>
            <Text size="md" fw={500} color={fileExists ? undefined : "red"}>
              {item.name} {fileExists ? "" : "(file missing)"}
            </Text>
          </Group>
        </Table.Td>
        <Table.Td>{item.elo || "Unknown"}</Table.Td>
        <Table.Td>
          <Group>
            <ActionIcon>
              <IconEdit size="1.25rem" onClick={() => toggleEditModal()} />
            </ActionIcon>
            <ActionIcon>
              <IconX size="1.25rem" onClick={() => toggleDeleteModal()} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
    </>
  );
}

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
import { IconEdit, IconPlus, IconRobot, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Engine } from "@/utils/engines";
import OpenFolderButton from "../common/OpenFolderButton";
import AddEngine from "./AddEngine";
import { useToggle } from "@mantine/hooks";
import ConfirmModal from "../common/ConfirmModal";
import EditEngine from "./EditEngine";
import { exists } from "@tauri-apps/api/fs";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { useAtom, useAtomValue } from "jotai";
import { enginesAtom } from "@/atoms/atoms";

export default function EnginePage() {
  const engines = useAtomValue(enginesAtom);
  const [opened, setOpened] = useState(false);

  return (
    <>
      <AddEngine opened={opened} setOpened={setOpened} />
      <Group align="baseline" pl="lg" py="xl">
        <Title>Your Engines</Title>
        <OpenFolderButton base="AppDir" folder="engines" />
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
              engines.map((item) => <EngineRow key={item.path} item={item} />)}
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

function EngineRow({ item }: { item: Engine }) {
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

      <tr>
        <td>
          <Group spacing="sm">
            {imageSrc ? (
              <Image width={60} height={60} src={imageSrc} />
            ) : (
              <IconRobot size={60} />
            )}
            <Text size="md" weight={500} color={fileExists ? undefined : "red"}>
              {item.name} {fileExists ? "" : "(file missing)"}
            </Text>
          </Group>
        </td>
        <td>{item.elo}</td>
        <td>
          <Group>
            <ActionIcon>
              <IconEdit size={20} onClick={() => toggleEditModal()} />
            </ActionIcon>
            <ActionIcon>
              <IconX size={20} onClick={() => toggleDeleteModal()} />
            </ActionIcon>
          </Group>
        </td>
      </tr>
    </>
  );
}

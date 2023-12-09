import { read_games } from "@/utils/db";
import { createTab } from "@/utils/tabs";
import {
  Stack,
  Badge,
  Group,
  Text,
  ActionIcon,
  Tooltip,
  Box,
} from "@mantine/core";
import { FileMetadata } from "./file";
import { tabsAtom, activeTabAtom } from "@/atoms/atoms";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { IconEdit, IconEye } from "@tabler/icons-react";
import GameSelector from "../panels/info/GameSelector";
import GamePreview from "../databases/GamePreview";
import { useNavigate } from "react-router-dom";

function FileCard({
  selected,
  games,
  setGames,
  toggleEditModal,
}: {
  selected: FileMetadata;
  games: Map<number, string>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
  toggleEditModal: () => void;
}) {
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const navigate = useNavigate();

  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [selected]);

  useEffect(() => {
    async function loadGames() {
      const data = await read_games(selected.path, page, page);

      setSelectedGame(data[0]);
    }
    loadGames();
  }, [selected, page]);

  async function openGame() {
    createTab({
      tab: {
        name: selected.name || "Untitled",
        type: "analysis",
      },
      setTabs,
      setActiveTab,
      pgn: selectedGame || "",
      fileInfo: selected,
      gameNumber: page,
    });
    navigate("/boards");
  }

  return (
    <Stack h="100%">
      <Stack align="center">
        <Text ta="center" fz="xl" fw="bold">
          {selected?.name}
        </Text>
        <Badge>{selected.metadata.type}</Badge>
      </Stack>

      <Group align="center" grow>
        <Group>
          <Tooltip label="Open">
            <ActionIcon onClick={openGame}>
              <IconEye />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Edit Metadata">
            <ActionIcon onClick={() => toggleEditModal()}>
              <IconEdit />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Text ta="center" c="dimmed">
          {selected?.numGames} Games
        </Text>
        <div />
      </Group>

      {selectedGame && (
        <>
          <GameSelector
            height={150}
            setGames={setGames}
            games={games}
            activePage={page}
            path={selected.path}
            setPage={setPage}
            total={selected.numGames}
          />
          <GamePreview pgn={selectedGame} />
        </>
      )}
    </Stack>
  );
}

export default FileCard;

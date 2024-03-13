import { activeTabAtom, tabsAtom } from "@/atoms/atoms";
import { read_games } from "@/utils/db";
import { createTab } from "@/utils/tabs";
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconEdit, IconEye } from "@tabler/icons-react";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import GamePreview from "../databases/GamePreview";
import GameSelector from "../panels/info/GameSelector";
import type { FileMetadata } from "./file";

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
    navigate("/");
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
          <Box h={0} flex={1}>
            <GameSelector
              setGames={setGames}
              games={games}
              activePage={page}
              path={selected.path}
              setPage={setPage}
              total={selected.numGames}
            />
          </Box>
          <Box h="55%">
            <GamePreview pgn={selectedGame} />
          </Box>
        </>
      )}
    </Stack>
  );
}

export default FileCard;

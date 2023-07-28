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
import router from "next/router";
import { FileMetadata } from "./file";
import { tabsAtom, activeTabAtom } from "@/atoms/atoms";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { IconEye } from "@tabler/icons-react";
import GameSelector from "../panels/info/GameSelector";
import GamePreview from "../databases/GamePreview";

function FileCard({
  selected,
  games,
  setGames,
}: {
  selected: FileMetadata;
  games: Map<number, string>;
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
}) {
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    async function loadGames() {
      const data = await read_games(selected.path, page, page);

      setSelectedGame(data[0]);
    }
    loadGames();
  }, [selected, page]);

  async function openGame() {
    const pgn = (await read_games(selected.path, 0, 0))[0];

    const fileInfo = {
      path: selected.path,
      numGames: selected.numGames,
    };
    createTab({
      tab: {
        name: selected.name || "Untitled",
        type: "analysis",
      },
      setTabs,
      setActiveTab,
      pgn,
      fileInfo,
    });
    router.push("/boards");
  }

  return (
    <Stack>
      <Stack align="center">
        <Group>
          <Text align="center" fz="xl" fw="bold">
            {selected?.name}
          </Text>
          <Tooltip label="Open">
            <ActionIcon onClick={openGame}>
              <IconEye />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Badge>{selected.metadata.type}</Badge>
      </Stack>
      <Text align="center" color="dimmed">
        {selected?.numGames} Games
      </Text>

      {selectedGame && (
        <>
          <Box h={150}>
            <GameSelector
              height={150}
              setGames={setGames}
              games={games}
              activePage={page}
              path={selected.path}
              setPage={setPage}
              total={selected.numGames}
            />
          </Box>
          <GamePreview pgn={selectedGame} />
        </>
      )}
      {/* <Group>
        <Button
          onClick={async () => {
            const metadataPath = selected.path.replace(".pgn", ".metadata");
            const deck = new SM2Algorithm(metadataPath);
            const fileExists = await exists(metadataPath);
            if (!fileExists) {
              deck.buildFromTree(
                (await parsePGN((await read_games(selected.path, 0, 0))[0]))
                  .root,
                "w"
              );
              await deck.saveData();
            } else {
              await deck.loadData();
            }
            router.push("/boards");
          }}
        >
          Build Deck
        </Button>
      </Group> */}
    </Stack>
  );
}

export default FileCard;

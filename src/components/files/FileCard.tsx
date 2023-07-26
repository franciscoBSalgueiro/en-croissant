import { parsePGN } from "@/utils/chess";
import { read_games } from "@/utils/db";
import { createTab } from "@/utils/tabs";
import {
  Stack,
  Badge,
  Group,
  Button,
  Text,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { exists } from "@tauri-apps/api/fs";
import router from "next/router";
import { SM2Algorithm } from "./opening";
import { FileMetadata } from "./file";
import { tabsAtom, activeTabAtom } from "@/atoms/atoms";
import { useAtom, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import GamePreview from "../databases/GamePreview";
import { IconEye } from "@tabler/icons-react";

function FileCard({ selected }: { selected: FileMetadata }) {
  const [loading, setLoading] = useState(false);
  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  const [games, setGames] = useState<string[]>([]);

  useEffect(() => {
    async function loadGames() {
      const data = await read_games(selected.path, 0, 10);
      setGames(data);
    }
    loadGames();
  }, [selected]);

  async function openGame() {
    setLoading(true);
    const pgn = (await read_games(selected.path, 0, 0))[0];
    setLoading(false);

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
      {games.length > 0 && <GamePreview pgn={games[0]} />}
      <Group>
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
      </Group>
    </Stack>
  );
}

export default FileCard;

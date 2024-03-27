import { activeTabAtom, tabsAtom } from "@/state/atoms";
import type { NormalizedGame } from "@/utils/db";
import { invoke } from "@/utils/invoke";
import { createTab } from "@/utils/tabs";
import {
  ActionIcon,
  Divider,
  Group,
  Paper,
  Stack,
  Tooltip,
} from "@mantine/core";
import { IconTrash, IconZoomCheck } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAtom, useSetAtom } from "jotai";
import GameInfo from "../common/GameInfo";
import GamePreview from "./GamePreview";

function GameCard({
  game,
  file,
  mutate,
}: { game: NormalizedGame; file: string; mutate: () => void }) {
  const navigate = useNavigate();

  const [, setTabs] = useAtom(tabsAtom);
  const setActiveTab = useSetAtom(activeTabAtom);

  return (
    <Paper shadow="sm" p="sm" withBorder h="100%">
      <Stack h="100%">
        <GameInfo headers={game} />
        <Divider />
        <Group justify="left">
          <Tooltip label="Analyze game">
            <ActionIcon
              variant="subtle"
              onClick={() => {
                createTab({
                  tab: {
                    name: `${game.white} - ${game.black}`,
                    type: "analysis",
                  },
                  setTabs,
                  setActiveTab,
                  pgn: game.moves,
                  headers: game,
                });
                navigate({ to: "/" });
              }}
            >
              <IconZoomCheck size="1.2rem" stroke={1.5} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Delete game">
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => {
                invoke("delete_db_game", {
                  file,
                  gameId: game.id,
                }).then(() => mutate());
              }}
            >
              <IconTrash size="1.2rem" stroke={1.5} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Divider mb="sm" />
        <GamePreview pgn={game.moves} headers={game} showOpening />
      </Stack>
    </Paper>
  );
}

export default GameCard;

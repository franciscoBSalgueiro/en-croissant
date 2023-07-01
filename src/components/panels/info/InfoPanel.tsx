import {
  Box,
  Code,
  Divider,
  Group,
  ScrollArea,
  Stack,
  TextInput,
  Text,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { useContext, useState } from "react";
import { getNodeAtPath } from "../../../utils/treeReducer";
import GameInfo from "../../common/GameInfo";
import { TreeStateContext } from "../../common/TreeStateContext";
import GameSelector from "./GameSelector";
import PgnInput from "./PgnInput";
import { formatNumber } from "../../../utils/format";
import { IconReload } from "@tabler/icons-react";
import { count_pgn_games } from "../../../utils/db";
import { useAtom } from "jotai";
import { tabsAtom } from "../../../atoms/atoms";

function InfoPanel({ boardSize, id }: { boardSize: number; id: string }) {
  const tree = useContext(TreeStateContext);
  const currentNode = getNodeAtPath(tree.root, tree.position);
  const [tabs, setTabs] = useAtom(tabsAtom);
  const [games, setGames] = useState(new Map<number, string>());

  const tab = tabs.find((t) => t.value === id);
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: `${boardSize / 2}px`,
      }}
    >
      <GameSelector
        id={id}
        headers={tree.headers}
        games={games}
        setGames={setGames}
      />
      <ScrollArea offsetScrollbars>
        {tab?.file && (
          <>
            <Group position="apart" py="sm" px="md">
              <Text>
                {formatNumber(tab.file.numGames || 0)} game
                {tab.file.numGames === 1 ? "" : "s"}
              </Text>
              <Group>
                <Tooltip label={tab.file.path}>
                  <Code>{tab.file.path.split(/[\\/]/).pop()}</Code>
                </Tooltip>

                <Tooltip label="Reload file">
                  <ActionIcon
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      count_pgn_games(tab.file!.path).then((v) => {
                        setTabs((prev) => {
                          const tab = prev.find((t) => t.value === id);
                          if (!tab) return prev;
                          tab.file!.numGames = v;
                          return [...prev];
                        });
                        setGames(new Map());
                      })
                    }
                  >
                    <IconReload size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            <Divider />
          </>
        )}
        <Stack>
          <GameInfo headers={tree.headers} />
          {currentNode && (
            <TextInput
              readOnly
              value={currentNode.fen}
              label="FEN"
              labelProps={{
                sx: {
                  fontWeight: "bold",
                  fontSize: "1rem",
                  marginBottom: "0.5rem",
                },
              }}
            />
          )}
          <PgnInput headers={tree.headers} root={tree.root} />
        </Stack>
      </ScrollArea>
    </Box>
  );
}

export default InfoPanel;

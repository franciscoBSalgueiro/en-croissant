import { Group, Code, ActionIcon, Divider, Text, Tooltip } from "@mantine/core";
import { IconReload } from "@tabler/icons-react";
import { count_pgn_games } from "@/utils/db";
import { formatNumber } from "@/utils/format";
import { useAtom } from "jotai";
import { currentTabAtom } from "@/atoms/atoms";

function FileInfo({
  setGames,
}: {
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
}) {
  const [tab, setCurrentTab] = useAtom(currentTabAtom);

  if (!tab?.file) return null;
  return (
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
                  setCurrentTab((prev) => {
                    prev.file!.numGames = v;
                    return { ...prev };
                  });
                  setGames(new Map());
                })
              }
            >
              <IconReload size="1rem" />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Divider />
    </>
  );
}

export default FileInfo;

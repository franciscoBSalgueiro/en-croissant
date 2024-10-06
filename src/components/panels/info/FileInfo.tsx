import { commands } from "@/bindings";
import { currentTabAtom } from "@/state/atoms";
import { formatNumber } from "@/utils/format";
import { unwrap } from "@/utils/unwrap";
import { ActionIcon, Code, Divider, Group, Text, Tooltip } from "@mantine/core";
import { IconReload } from "@tabler/icons-react";
import { useAtom } from "jotai";

function FileInfo({
  setGames,
}: {
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
}) {
  const [tab, setCurrentTab] = useAtom(currentTabAtom);

  if (!tab?.file) return null;
  return (
    <>
      <Group justify="space-between" py="sm" px="md">
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
                tab.file &&
                commands.countPgnGames(tab.file.path).then((v) => {
                  setCurrentTab((prev) => {
                    prev.file!.numGames = unwrap(v);
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

import { ActionIcon, Code, Divider, Group, Text, Tooltip } from "@mantine/core";
import { IconReload } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { currentTabAtom } from "@/state/atoms";
import { formatNumber } from "@/utils/format";
import { getTabFile } from "@/utils/tabs";
import { unwrap } from "@/utils/unwrap";

function FileInfo({
  setGames,
}: {
  setGames: React.Dispatch<React.SetStateAction<Map<number, string>>>;
}) {
  const { t } = useTranslation();
  const [tab, setCurrentTab] = useAtom(currentTabAtom);
  const tabFile = getTabFile(tab);

  if (!tabFile) return null;
  return (
    <>
      <Group justify="space-between" py="sm" px="md">
        <Text>
          {t("Files.GameCountSuffix", {
            count: tabFile.numGames ?? 0,
            number: formatNumber(tabFile.numGames ?? 0),
          })}
        </Text>
        <Group>
          <Tooltip label={tabFile.path}>
            <Code>{tabFile.path.split(/[\\/]/).pop()}</Code>
          </Tooltip>

          <Tooltip label={t("Files.Reload")}>
            <ActionIcon
              variant="outline"
              size="sm"
              onClick={() =>
                commands.countPgnGames(tabFile.path).then((v) => {
                  setCurrentTab((prev) => {
                    if (prev.gameOrigin.kind !== "file" && prev.gameOrigin.kind !== "temp_file") {
                      return prev;
                    }
                    return {
                      ...prev,
                      gameOrigin: {
                        ...prev.gameOrigin,
                        file: {
                          ...prev.gameOrigin.file,
                          numGames: unwrap(v),
                        },
                      },
                    };
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

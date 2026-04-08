import { Box, Stack, Text } from "@mantine/core";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { currentLocalOptionsAtom } from "@/state/atoms";
import { GameFilters } from "@/components/databases/GameFilters";

function LocalOptionsPanel() {
  const { t } = useTranslation();
  const [options, setOptions] = useAtom(currentLocalOptionsAtom);

  return (
    <Stack>
      <Text fw="bold" fz="sm">
        {t("Board.Database.Local")}
      </Text>
      <Box px="xs">
        <GameFilters
          query={options}
          setQuery={(val) => setOptions({ ...val, path: options.path })}
          file={options.path!}
          hidePositionSearch
          alwaysExpanded
        />
      </Box>
    </Stack>
  );
}

export default LocalOptionsPanel;

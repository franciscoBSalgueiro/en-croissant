import { Box } from "@mantine/core";
import { useAtom } from "jotai";
import { currentLocalOptionsAtom } from "@/state/atoms";
import { GameFilters } from "@/components/databases/GameFilters";

function LocalOptionsPanel({ file }: { file: string }) {
  const [options, setOptions] = useAtom(currentLocalOptionsAtom);

  return (
    <Box px="xs">
      <GameFilters
        query={options}
        setQuery={setOptions}
        file={file}
        hidePositionSearch
        alwaysExpanded
      />
    </Box>
  );
}

export default LocalOptionsPanel;

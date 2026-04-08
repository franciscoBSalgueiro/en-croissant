import { Box } from "@mantine/core";
import { useAtom } from "jotai";
import { currentLocalOptionsAtom } from "@/state/atoms";
import { GameFilters } from "@/components/databases/GameFilters";

function LocalOptionsPanel() {
  const [options, setOptions] = useAtom(currentLocalOptionsAtom);

  return (
    <Box px="xs">
      <GameFilters
        query={options}
        setQuery={(val) => setOptions({ ...val, path: options.path })}
        file={options.path!}
        hidePositionSearch
        alwaysExpanded
      />
    </Box>
  );
}

export default LocalOptionsPanel;

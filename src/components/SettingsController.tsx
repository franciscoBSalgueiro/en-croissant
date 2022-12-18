import { Switch } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";

function SettingsController() {
  const [showDests, setShowDests] = useLocalStorage<boolean>({
    key: "show-dests",
    defaultValue: true,
  });
  const [showArrows, setShowArrows] = useLocalStorage<boolean>({
    key: "show-arrows",
    defaultValue: true,
  });

  return (
    <div>
      <Switch
        checked={showDests}
        label="Show piece destinations"
        onChange={(event) => setShowDests(event.currentTarget.checked)}
      />
      
      <Switch
        checked={showArrows}
        label="Show best move arrows"
        onChange={(event) => setShowArrows(event.currentTarget.checked)}
      />
    </div>
  );
}

export default SettingsController;

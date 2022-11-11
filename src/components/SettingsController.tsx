import { Switch } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";

function SettingsController() {
  const [showDests, setShowDests] = useLocalStorage<boolean>({
    key: "show-dests",
    defaultValue: true,
  });

  return (
    <div>
      <Switch
        checked={showDests}
        label="Arrows on board"
        onChange={(event) => setShowDests(event.currentTarget.checked)}
      />
    </div>
  );
}

export default SettingsController;

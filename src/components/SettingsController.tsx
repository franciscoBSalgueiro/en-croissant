import { NumberInput, Switch } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";

function SettingsController() {
  const [showDests, setShowDests] = useLocalStorage<boolean>({
    key: "show-dests",
    defaultValue: true,
  });
  const [numberLines, setNumberLines] = useLocalStorage<number>({
    key: "number-lines",
    defaultValue: 3,
  });

  return (
    <div>
      <Switch
        checked={showDests}
        label="Arrows on board"
        onChange={(event) => setShowDests(event.currentTarget.checked)}
      />
      <NumberInput label="Number of lines" value={numberLines} onChange={(value) => setNumberLines(value ?? 3)} />
    </div>
  );
}

export default SettingsController;

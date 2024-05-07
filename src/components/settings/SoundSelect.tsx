import { soundCollectionAtom } from "@/state/atoms";
import { playSound } from "@/utils/sound";
import {
  Combobox,
  Group,
  Input,
  InputBase,
  ScrollArea,
  Text,
  useCombobox,
} from "@mantine/core";
import { useAtom } from "jotai";

type Item = {
  label: string;
  value: string;
};

const soundCollections: Item[] = [
  { label: "Futuristic", value: "futuristic" },
  { label: "Lisp", value: "lisp" },
  { label: "NES", value: "nes" },
  { label: "Piano", value: "piano" },
  { label: "Robot", value: "robot" },
  { label: "SFX", value: "sfx" },
  { label: "Standard", value: "standard" },
  { label: "WoodLand", value: "woodland" },
];

function SelectOption({ label }: { label: string }) {
  return (
    <Group wrap="nowrap">
      <Text fz="sm" fw={500}>
        {label}
      </Text>
    </Group>
  );
}

export default function SoundSelect() {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [soundCollection, setSoundCollection] = useAtom(soundCollectionAtom);

  const options = soundCollections.map((item) => (
    <Combobox.Option value={item.value} key={item.value}>
      <SelectOption label={item.label} />
    </Combobox.Option>
  ));

  const selected = soundCollections.find((p) => p.value === soundCollection);

  return (
    <Combobox
      store={combobox}
      withinPortal={true}
      onOptionSubmit={(val) => {
        setSoundCollection(val);
        playSound(false, false);
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          component="button"
          type="button"
          pointer
          onClick={() => combobox.toggleDropdown()}
          multiline
          w="10rem"
        >
          {selected ? (
            <SelectOption label={selected.label} />
          ) : (
            <Input.Placeholder>Pick value</Input.Placeholder>
          )}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize mah={200} type="always">
            {options}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

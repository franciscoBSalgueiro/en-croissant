import { boardImageAtom } from "@/state/atoms";
import {
  Box,
  Combobox,
  Group,
  Input,
  InputBase,
  ScrollArea,
  Text,
  useCombobox,
} from "@mantine/core";
import { useAtom } from "jotai";

const boardImages: string[] = [
  "blue-marble.jpg",
  "blue.svg",
  "blue2.jpg",
  "blue3.jpg",
  "brown.svg",
  "bubblegum.jpg",
  "canvas2.jpg",
  "glass.jpg",
  "gray.svg",
  "green-plastic.png",
  "green.svg",
  "grey.jpg",
  "horsey.jpg",
  "ic.svg",
  "leather.jpg",
  "lol.jpg",
  "maple.jpg",
  "maple2.jpg",
  "marble.jpg",
  "marble2.jpg",
  "metal.jpg",
  "newspaper.svg",
  "olive.jpg",
  "pink-pyramid.png",
  "purple.svg",
  "purple-diag.png",
  "tournament.jpg",
  "wood.jpg",
  "wood2.jpg",
  "wood3.jpg",
  "wood4.jpg",
];

function SelectOption({ label }: { label: string }) {
  let image = label;
  if (!label.endsWith(".svg")) {
    image = label.replace(".", ".thumbnail.");
  }

  return (
    <Group wrap="nowrap">
      <Box
        style={{
          width: "64px",
          height: "32px",
          backgroundImage: `url(/board/${image})`,
          flexShrink: 0,
          backgroundSize: label.endsWith(".svg") ? "256px" : undefined,
        }}
      />
      <Text fz="sm" fw={500}>
        {label.split(".")[0]}
      </Text>
    </Group>
  );
}

export default function BoardSelect() {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [board, setBoard] = useAtom(boardImageAtom);

  const options = boardImages.map((item) => (
    <Combobox.Option value={item} key={item}>
      <SelectOption label={item} />
    </Combobox.Option>
  ));

  const selected = boardImages.find((p) => p === board);

  return (
    <Combobox
      store={combobox}
      withinPortal={false}
      onOptionSubmit={(val) => {
        setBoard(val);
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
            <SelectOption label={selected} />
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

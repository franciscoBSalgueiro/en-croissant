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
  "purple.svg",
  "newspaper.svg",
  "ic.svg",
  "green.svg",
  "gray.svg",
  "brown.svg",
  "blue.svg",
  "wood4.jpg",
  "wood3.jpg",
  "wood2.jpg",
  "wood.jpg",
  "purple-diag.png",
  "olive.jpg",
  "pink-pyramid.png",
  "metal.jpg",
  "marble.jpg",
  "maple2.jpg",
  "maple.jpg",
  "leather.jpg",
  "grey.jpg",
  "horsey.jpg",
  "green-plastic.png",
  "blue3.jpg",
  "canvas2.jpg",
  "blue2.jpg",
  "blue-marble.jpg",
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

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
import { useTranslation } from "react-i18next";
import { boardImageAtom, is3dAtom } from "@/state/atoms";

const boardImages2d: string[] = [
  "blue.png",
  "blue2.jpg",
  "blue3.jpg",
  "blue-marble.jpg",
  "canvas2.jpg",
  "wood.jpg",
  "wood2.jpg",
  "wood3.jpg",
  "wood4.jpg",
  "maple.jpg",
  "maple2.jpg",
  "leather.jpg",
  "green.png",
  "brown.png",
  "pink-pyramid.png",
  "marble.jpg",
  "green-plastic.png",
  "grey.jpg",
  "metal.jpg",
  "olive.jpg",
  "newspaper.svg",
  "purple.png",
  "purple-diag.png",
  "ic.png",
  "horsey.jpg",
  "gray.svg",
];

const boardImages3d = [
  "Black-White-Aluminium.png", "Brushed-Aluminium.png", "China-Blue.png", "China-Green.png",
  "China-Grey.png", "China-Scarlet.png", "China-Yellow.png", "Classic-Blue.png",
  "Glass.png", "Gold-Silver.png", "Green-Glass.png", "Jade.png", "Light-Wood.png",
  "Marble.png", "Power-Coated.png", "Purple-Black.png", "Rosewood.png",
  "Wax.png", "Wood-Glass.png", "Woodi.png"
];

function SelectOption({ label, is3d }: { label: string; is3d: boolean }) {
  let image = label;
  if (!label.endsWith(".svg")) {
    image = label.replace(".", ".thumbnail.");
  }
  const boardPath = is3d ? "/board-3d" : "/board";

  return (
    <Group wrap="nowrap">
      <Box
        style={{
          width: "64px",
          height: "32px",
          backgroundImage: `url(${boardPath}/${image})`,
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
  const { t } = useTranslation();
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [board, setBoard] = useAtom(boardImageAtom);
  const [is3d] = useAtom(is3dAtom);

  const boardImages = is3d ? boardImages3d : boardImages2d;

  const options = boardImages.map((item) => (
    <Combobox.Option value={item} key={item}>
      <SelectOption label={item} is3d={is3d} />
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
          w="12rem"
        >
          {selected ? (
            <SelectOption label={selected} is3d={is3d} />
          ) : (
            <Input.Placeholder>{t("Common.PickValue")}</Input.Placeholder>
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

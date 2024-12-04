import { pieceSetAtom } from "@/state/atoms";
import {
  Box,
  Combobox,
  Flex,
  Input,
  InputBase,
  ScrollArea,
  Text,
  useCombobox,
} from "@mantine/core";
import { useAtom } from "jotai";
import PieceComponent from "../common/Piece";

type Item = {
  label: string;
  value: string;
};

const pieceSets: Item[] = [
  { label: "Alpha", value: "alpha" },
  { label: "Anarcandy", value: "anarcandy" },
  { label: "California", value: "california" },
  { label: "Cardinal", value: "cardinal" },
  { label: "Cburnett", value: "cburnett" },
  { label: "Chess7", value: "chess7" },
  { label: "Chessnut", value: "chessnut" },
  { label: "Companion", value: "companion" },
  { label: "Disguised", value: "disguised" },
  { label: "Dubrovny", value: "dubrovny" },
  { label: "Fantasy", value: "fantasy" },
  { label: "Fresca", value: "fresca" },
  { label: "Gioco", value: "gioco" },
  { label: "Governor", value: "governor" },
  { label: "Horsey", value: "horsey" },
  { label: "ICpieces", value: "icpieces" },
  { label: "Kosal", value: "kosal" },
  { label: "Leipzig", value: "leipzig" },
  { label: "Letter", value: "letter" },
  { label: "Libra", value: "libra" },
  { label: "Maestro", value: "maestro" },
  { label: "Merida", value: "merida" },
  { label: "Pirouetti", value: "pirouetti" },
  { label: "Pixel", value: "pixel" },
  { label: "Reillycraig", value: "reillycraig" },
  { label: "Riohacha", value: "riohacha" },
  { label: "Shapes", value: "shapes" },
  { label: "Spatial", value: "spatial" },
  { label: "Staunty", value: "staunty" },
  { label: "Tatiana", value: "tatiana" },
];

function DisplayPieces() {
  const pieces = ["rook", "knight", "bishop", "queen", "king", "pawn"] as const;
  return (
    <Flex gap="xs">
      {pieces.map((role, index) => (
        <Box key={index} h="2.5rem" w="2.5rem">
          <PieceComponent piece={{ color: "white", role }} />
        </Box>
      ))}
    </Flex>
  );
}

export default function PiecesSelect() {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [pieceSet, setPieceSet] = useAtom(pieceSetAtom);

  const options = pieceSets.map((item) => (
    <Combobox.Option
      value={item.value}
      key={item.value}
      onMouseOver={() => setPieceSet(item.value)}
    >
      <Text fz="sm" fw={500}>
        {item.label}
      </Text>
    </Combobox.Option>
  ));

  const selected = pieceSets.find((p) => p.value === pieceSet);

  return (
    <div>
      <Flex justify="space-between" align="center" gap="md">
        <DisplayPieces />
        <Combobox
          store={combobox}
          withinPortal={false}
          onOptionSubmit={(val) => {
            setPieceSet(val);
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
                <Text fz="sm" fw={500}>
                  {selected.label}
                </Text>
              ) : (
                <Input.Placeholder>Pick value</Input.Placeholder>
              )}
            </InputBase>
          </Combobox.Target>

          <Combobox.Dropdown>
            <Combobox.Options>
              <ScrollArea.Autosize mah={200} type="always" scrollbars="y">
                {options}
              </ScrollArea.Autosize>
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>
      </Flex>
    </div>
  );
}

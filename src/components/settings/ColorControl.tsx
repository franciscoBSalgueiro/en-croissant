import { primaryColorAtom } from "@/state/atoms";
import {
  CheckIcon,
  ColorSwatch,
  Group,
  Input,
  useMantineColorScheme,
  useMantineTheme,
} from "@mantine/core";
import { useAtom } from "jotai";

export default function ColorControl() {
  const [primaryColor, setPrimaryColor] = useAtom(primaryColorAtom);
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

  const colors = Object.keys(theme.colors).map((color) => (
    <ColorSwatch
      color={
        colorScheme === "dark" ? theme.colors[color][7] : theme.colors[color][5]
      }
      component="button"
      key={color}
      onClick={() => setPrimaryColor(color)}
      radius="sm"
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: colorScheme === "dark" ? theme.colors[color][2] : theme.white,
        flex: "1 0 calc(15% - 4px)",
      }}
    >
      {primaryColor === color && <CheckIcon width={12} height={12} />}
    </ColorSwatch>
  ));

  return (
    <Input.Wrapper labelElement="div">
      <Group gap={2}>{colors}</Group>
    </Input.Wrapper>
  );
}

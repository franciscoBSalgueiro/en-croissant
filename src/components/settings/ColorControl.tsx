import { primaryColorAtom } from "@/atoms/atoms";
import {
  CheckIcon,
  ColorSwatch,
  Group,
  Input,
  useMantineTheme,
} from "@mantine/core";
import { useAtom } from "jotai";

export default function ColorControl() {
  const [primaryColor, setPrimaryColor] = useAtom(primaryColorAtom);
  const theme = useMantineTheme();

  const colors = Object.keys(theme.colors).map((color) => (
    <ColorSwatch
      color={
        theme.colorScheme === "dark"
          ? theme.colors[color][7]
          : theme.colors[color][5]
      }
      component="button"
      key={color}
      onClick={() => setPrimaryColor(color)}
      radius="sm"
      sx={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color:
          theme.colorScheme === "dark" ? theme.colors[color][2] : theme.white,
        flex: "1 0 calc(15% - 4px)",
      }}
    >
      {primaryColor === color && <CheckIcon width={12} height={12} />}
    </ColorSwatch>
  ));

  return (
    <Input.Wrapper labelElement="div">
      <Group spacing={2} mt={5}>
        {colors}
      </Group>
    </Input.Wrapper>
  );
}

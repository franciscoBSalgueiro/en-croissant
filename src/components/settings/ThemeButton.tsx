import {
  Box,
  Center,
  Group,
  SegmentedControl,
  useMantineColorScheme
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons";

export function ThemeButton() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  console.log(colorScheme);

  return (
    <Group position="center" my="xl">
      <SegmentedControl
        value={colorScheme}
        onChange={(value: "light" | "dark") => toggleColorScheme(value)}
        data={[
          {
            value: "light",
            label: (
              <Center>
                <IconSun size={16} stroke={1.5} />
                <Box ml={10}>Light</Box>
              </Center>
            ),
          },
          {
            value: "dark",
            label: (
              <Center>
                <IconMoon size={16} stroke={1.5} />
                <Box ml={10}>Dark</Box>
              </Center>
            ),
          },
        ]}
      />
    </Group>
  );
}

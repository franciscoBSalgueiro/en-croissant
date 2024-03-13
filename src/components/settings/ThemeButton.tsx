import {
  Box,
  Center,
  Group,
  type MantineColorScheme,
  SegmentedControl,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";

export default function ThemeButton() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <Group justify="center">
      <SegmentedControl
        value={colorScheme}
        onChange={(value) => setColorScheme(value as MantineColorScheme)}
        data={[
          {
            value: "light",
            label: (
              <Center>
                <IconSun size="1rem" stroke={1.5} />
                <Box ml={10}>Light</Box>
              </Center>
            ),
          },
          {
            value: "dark",
            label: (
              <Center>
                <IconMoon size="1rem" stroke={1.5} />
                <Box ml={10}>Dark</Box>
              </Center>
            ),
          },
        ]}
      />
    </Group>
  );
}

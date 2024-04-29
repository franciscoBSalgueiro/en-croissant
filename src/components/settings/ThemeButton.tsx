import {
  Box,
  Center,
  Group,
  type MantineColorScheme,
  SegmentedControl,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export default function ThemeButton() {
  const { t } = useTranslation();

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
                <Box ml={10}>{t("Settings.Appearance.Theme.Light")}</Box>
              </Center>
            ),
          },
          {
            value: "dark",
            label: (
              <Center>
                <IconMoon size="1rem" stroke={1.5} />
                <Box ml={10}>{t("Settings.Appearance.Theme.Dark")}</Box>
              </Center>
            ),
          },
        ]}
      />
    </Group>
  );
}

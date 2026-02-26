import { Button, Center, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconUserPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export function EmptyAccounts({ onAddAccount }: { onAddAccount: () => void }) {
  const { t } = useTranslation();

  return (
    <Center h="100%">
      <Stack align="center" gap="md">
        <ThemeIcon size={80} radius="100%" variant="light" color="blue">
          <IconUserPlus size={40} />
        </ThemeIcon>
        <Title order={3}>{t("Home.Accounts.Empty.Title")}</Title>
        <Text c="dimmed" ta="center" maw={400}>
          {t("Home.Accounts.Empty.Description")}
        </Text>
        <Button onClick={onAddAccount} size="md" mt="sm">
          {t("Home.Accounts.Add")}
        </Button>
      </Stack>
    </Center>
  );
}

import { ActionIcon, Card, Group, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import type { EncEngineAccountSummary } from "@/bindings";
import { commands } from "@/bindings";
import { capitalize } from "@/utils/format";

const emptySummary: EncEngineAccountSummary = {
  registered: false,
  username: "",
  totalGames: 0,
  lastPlayedAtMs: null,
  perfs: [],
};

export function EncAccountCard({ playerName }: { playerName: string }) {
  const { t } = useTranslation();
  const { data, mutate, isLoading } = useSWR(["enc-account-summary", playerName], async () => {
    const r = await commands.getEncroissantEngineAccountSummary(playerName);
    if (r.status !== "ok") {
      throw new Error(r.error);
    }
    return r.data;
  });

  const summary = data ?? emptySummary;

  const items = summary.perfs.map((p) => (
    <Group key={p.key} justify="space-between" wrap="nowrap" gap={4}>
      <Text size="xs" c="dimmed" fw={700} tt="uppercase" style={{ flexShrink: 0 }}>
        {capitalize(p.key)}
      </Text>
      <Group gap={6} wrap="nowrap">
        <Text size="xs" c="dimmed">
          {p.games}
        </Text>
        <Text fw={700} size="sm">
          {p.rating}
        </Text>
      </Group>
    </Group>
  ));

  return (
    <Card withBorder radius="md" padding="sm" style={{ minWidth: 0 }}>
      <Card.Section withBorder inheritPadding py="xs">
        <Group justify="space-between" wrap="nowrap" gap={4}>
          <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
            <Text fw={800} size="xs" c="blue" style={{ flexShrink: 0 }}>
              EC
            </Text>
            <Text fw={600} size="xs" lineClamp={1} style={{ minWidth: 0 }}>
              {t("Home.Accounts.EncEngine")}
            </Text>
          </Group>
          <Tooltip label={t("Home.Accounts.UpdateStats")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              loading={isLoading}
              onClick={() => mutate()}
            >
              <IconRefresh size="0.9rem" />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Card.Section>
      <Card.Section inheritPadding py="sm">
        <SimpleGrid cols={1} spacing={4}>
          {summary.registered ? (
            items
          ) : (
            <Text size="xs" c="dimmed">
              {t("Home.Accounts.EncNotRegistered")}
            </Text>
          )}
        </SimpleGrid>
      </Card.Section>
      <Card.Section inheritPadding pb="xs">
        <Stack gap={2}>
          <Group justify="space-between" wrap="nowrap" gap={4}>
            <Text size="xs" c="dimmed">
              {t("Common.Games")}
            </Text>
            <Text size="xs" fw={500}>
              {summary.totalGames}
            </Text>
          </Group>
          {summary.lastPlayedAtMs != null && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {t("Home.Accounts.LastUpdate", {
                date: new Date(Number(summary.lastPlayedAtMs)).toLocaleDateString(),
                interpolation: { escapeValue: false },
              })}
            </Text>
          )}
        </Stack>
      </Card.Section>
    </Card>
  );
}

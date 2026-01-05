import {
  ActionIcon,
  Avatar,
  Badge,
  Card,
  Center,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCloud } from "@tabler/icons-react";
import * as Flags from "mantine-flagpack";

import { getFidePlayer } from "@/utils/lichess/api";
import useSWR from "swr/immutable";
import { useTranslation } from "react-i18next";

import COUNTRIES from "./countries.json";

const flags = Object.entries(Flags).map(([key, value]) => ({
  key: key.replace("Flag", ""),
  component: value,
}));

function FideInfo({
  opened,
  setOpened,
  name,
}: {
  opened: boolean;
  setOpened: (opened: boolean) => void;
  name: string;
}) {
  const { t } = useTranslation();
  const {
    data: player,
    error,
    isLoading,
  } = useSWR(!opened ? null : name, async (name) => {
    return await getFidePlayer(name);
  });

  const country = COUNTRIES.find((c) => c.ioc === player?.federation);

  const Flag = player?.federation
    ? flags.find((f) => f.key === country?.a2)?.component
    : undefined;

  return (
    <Modal
      styles={{
        title: {
          flex: 1,
        },
      }}
      title={
        <Group>
          <b>{t("Databases.FIDE.Title")}</b>
          {player && (
            <a
              href={`https://ratings.fide.com/profile/${player.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <ActionIcon>
                <IconCloud />
              </ActionIcon>
            </a>
          )}
        </Group>
      }
      opened={opened}
      onClose={() => setOpened(false)}
    >
      {isLoading ? (
        <Center>{t("Common.Loading")}</Center>
      ) : player ? (
        <Stack gap="md">
          <Group wrap="nowrap" align="flex-start">
            {player.photo?.small && (
              <Avatar src={player.photo.small} size={80} radius="sm" />
            )}
            <Stack gap={4} style={{ flex: 1 }}>
              <Group gap="xs">
                <Text fz="xl" fw="bold">
                  {player.name}
                </Text>
                {player.title && <Badge>{player.title}</Badge>}
              </Group>
              {Flag && country?.name && (
                <Group gap="xs">
                  <Flag w={30} />
                  <Text c="dimmed">{country.name}</Text>
                </Group>
              )}
              {player.year && (
                <Text size="sm" c="dimmed">
                  {t("Databases.FIDE.Born", { year: player.year })}
                </Text>
              )}
              {player.name !== name && (
                <Text c="dimmed" fz="xs">
                  {t("Databases.FIDE.ClosestMatchTo")} <u>{name}</u>
                </Text>
              )}
            </Stack>
          </Group>

          <Divider />
          <Group grow>
            <Card p="sm">
              <Text fw="bold">{t("Databases.FIDE.Standard")}</Text>
              <Text fz="sm">{player.standard || t("Databases.FIDE.NotRated")}</Text>
            </Card>
            <Card p="sm">
              <Text fw="bold">{t("Databases.FIDE.Rapid")}</Text>
              <Text fz="sm">{player.rapid || t("Databases.FIDE.NotRated")}</Text>
            </Card>
            <Card p="sm">
              <Text fw="bold">{t("Databases.FIDE.Blitz")}</Text>
              <Text fz="sm">{player.blitz || t("Databases.FIDE.NotRated")}</Text>
            </Card>
          </Group>
          <div />
        </Stack>
      ) : (
        <Text>
          {error ? (
            <>
              {t("Databases.FIDE.SearchError", { name })}
              <br /> {error.message}
            </>
          ) : (
            t("Databases.FIDE.PlayerNotFound")
          )}
        </Text>
      )}
    </Modal>
  );
}

export default FideInfo;

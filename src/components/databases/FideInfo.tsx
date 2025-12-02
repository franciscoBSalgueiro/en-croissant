import {
  ActionIcon,
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
          <b>FIDE Player Info</b>
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
        <Center>Loading...</Center>
      ) : player ? (
        <Stack gap="xs">
          <Divider />
          <Group justify="space-between">
            <Stack gap={0}>
              <Group>
                <Group>
                  <Text fz="lg" fw="bold">
                    {player.name}
                  </Text>
                  {player.title && <Badge>{player.title}</Badge>}
                </Group>
              </Group>
              {player.name !== name && (
                <Text c="dimmed" fz="xs">
                  Closest match to <u>{name}</u>
                </Text>
              )}
            </Stack>

            {Flag && country?.name && (
              <Tooltip label={country.name}>
                <div>
                  <Flag w={50} />
                </div>
              </Tooltip>
            )}
          </Group>

          <Group>
            {player.sex && <Text>Sex: {player.sex}</Text>}
            {player.birth_year && <Text>Born: {player.birth_year}</Text>}
          </Group>
          <Group grow>
            <Card p="sm">
              <Text fw="bold">Standard</Text>
              <Text fz="sm">{player.standard || "Not Rated"}</Text>
            </Card>
            <Card p="sm">
              <Text fw="bold">Rapid</Text>
              <Text fz="sm">{player.rapid || "Not Rated"}</Text>
            </Card>
            <Card p="sm">
              <Text fw="bold">Blitz</Text>
              <Text fz="sm">{player.blitz || "Not Rated"}</Text>
            </Card>
          </Group>
          <div />
        </Stack>
      ) : (
        <Text>
          {error ? (
            <>
              There was an error searching for {name}
              <br /> {error.message}
            </>
          ) : (
            "Player not found"
          )}
        </Text>
      )}
    </Modal>
  );
}

export default FideInfo;

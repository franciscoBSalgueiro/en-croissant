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

import { events, commands } from "@/bindings";
import { BaseDirectory, exists } from "@tauri-apps/plugin-fs";
import { useEffect, useState } from "react";
import useSWR from "swr/immutable";
import ProgressButton from "../common/ProgressButton";
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
  const [fileExists, setFileExists] = useState<boolean>(false);
  const {
    data: player,
    error,
    isLoading,
  } = useSWR(!fileExists || !opened ? null : name, async (name) => {
    const res = await commands.findFidePlayer(name);
    if (res.status === "ok") {
      return res.data;
    }
    throw new Error(res.error);
  });

  const country = COUNTRIES.find((c) => c.ioc === player?.country);

  const Flag = player?.country
    ? flags.find((f) => f.key === country?.a2)?.component
    : undefined;

  useEffect(() => {
    exists("fide.bin", { baseDir: BaseDirectory.AppData }).then((exists) => {
      setFileExists(exists);
    });
  }, []);

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
              href={`https://ratings.fide.com/profile/${player.fideid}`}
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
      {!fileExists ? (
        <Stack>
          No FIDE database installed
          <ProgressButton
            id="fide_db"
            initInstalled={false}
            progressEvent={events.downloadProgress}
            onClick={() => commands.downloadFideDb()}
            labels={{
              completed: "Downloaded",
              action: "Download",
              inProgress: "Downloading...",
              finalizing: "Processing...",
            }}
            inProgress={false}
            setInProgress={(v) => setFileExists(!v)}
          />
        </Stack>
      ) : isLoading ? (
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
            {player.birthday && <Text>Born: {player.birthday}</Text>}
          </Group>
          <Group grow>
            <Card p="sm">
              <Text fw="bold">Standard</Text>
              <Text fz="sm">{player.rating || "Not Rated"}</Text>
            </Card>
            <Card p="sm">
              <Text fw="bold">Rapid</Text>
              <Text fz="sm">{player.rapid_rating || "Not Rated"}</Text>
            </Card>
            <Card p="sm">
              <Text fw="bold">Blitz</Text>
              <Text fz="sm">{player.blitz_rating || "Not Rated"}</Text>
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

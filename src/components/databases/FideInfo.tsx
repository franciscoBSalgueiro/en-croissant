import {
  ActionIcon,
  Badge,
  Card,
  Center,
  Group,
  Modal,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCloud } from "@tabler/icons-react";
import * as Flags from "mantine-flagpack";

import { events, commands } from "@/bindings";
import { invoke } from "@tauri-apps/api";
import { BaseDirectory, exists } from "@tauri-apps/api/fs";
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
    exists("fide.bin", { dir: BaseDirectory.AppData }).then((exists) => {
      setFileExists(exists);
    });
  }, []);

  return (
    <Modal opened={opened} onClose={() => setOpened(false)}>
      {!fileExists ? (
        <Stack>
          No FIDE database installed
          <ProgressButton
            id="fide_db"
            initInstalled={false}
            progressEvent={events.downloadProgress}
            onClick={() => invoke("download_fide_db")}
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
        <Stack>
          <Group justify="space-between" pr="md">
            <Group>
              <Text fz="lg" fw="bold">
                {player.name}
              </Text>
              {player.title && <Badge>{player.title}</Badge>}
            </Group>

            <a
              href={`https://ratings.fide.com/profile/${player.fideid}`}
              target="_blank"
              rel="noreferrer"
            >
              <ActionIcon>
                <IconCloud />
              </ActionIcon>
            </a>
          </Group>

          <Group>
            {player.sex && <Text>Sex: {player.sex}</Text>}
            {player.birthday && <Text>Born: {player.birthday}</Text>}
            {Flag && country?.name && (
              <Tooltip label={country.name}>
                <div>
                  <Flag w={40} />
                </div>
              </Tooltip>
            )}
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
              <Text fw="bold">Rapid</Text>
              <Text fz="sm">{player.blitz_rating || "Not Rated"}</Text>
            </Card>
          </Group>
          <div />
        </Stack>
      ) : (
        <Center>
          <Text fz="lg" pb="lg">
            {error
              ? `There was an error searching for player: ${error.message}`
              : "Player not found"}
          </Text>
        </Center>
      )}
    </Modal>
  );
}

export default FideInfo;

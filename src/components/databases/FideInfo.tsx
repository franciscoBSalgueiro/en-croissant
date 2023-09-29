import { findFidePlayer } from "@/bindings";
import {
  Badge,
  Group,
  Modal,
  Text,
  Stack,
  Card,
  Tooltip,
  ActionIcon,
  Center,
} from "@mantine/core";
import * as Flags from "mantine-flagpack";
import { IconCloud } from "@tabler/icons-react";

import COUNTRIES from "./countries.json";
import useSWR from "swr";
import { useEffect, useState } from "react";
import { BaseDirectory, exists } from "@tauri-apps/api/fs";
import ProgressButton from "../common/ProgressButton";
import { invoke } from "@tauri-apps/api";

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
  } = useSWR(fileExists ? name : null, async (name) => {
    return await findFidePlayer(name).catch((e) => {
      console.error(e);
      return null;
    });
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
            id={0}
            initInstalled={false}
            progressEvent={"download_progress"}
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
          <Group position="apart" pr="md">
            <Group>
              <Text fz="lg" fw="bold">
                {player.name}
              </Text>
              {player.title && <Badge>{player.title}</Badge>}
            </Group>

            <a
              href={"https://ratings.fide.com/profile/" + player.fideid}
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
          <div></div>
        </Stack>
      ) : (
        <Center>
          <Text fz="lg" pb="lg">
            {error ?? "Player not found"}
          </Text>
        </Center>
      )}
    </Modal>
  );
}

export default FideInfo;

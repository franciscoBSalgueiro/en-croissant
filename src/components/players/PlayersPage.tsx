import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { Route } from "@/routes/players";
import { useNavigate } from "@tanstack/react-router";
import { playersAtom, defaultPlayerIdAtom } from "@/state/atoms";
import type { Player } from "@/utils/players";
import { Box, Button, Divider, Group, NumberInput, Paper, ScrollArea, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import * as classes from "@/components/common/GenericCard.css";
import GenericCard from "@/components/common/GenericCard";
import ConfirmModal from "@/components/common/ConfirmModal";
import { genID } from "@/utils/tabs";

export default function PlayersPage() {
  const [players, setPlayers] = useAtom(playersAtom);
  const [defaultPlayerId, setDefaultPlayerId] = useAtom(defaultPlayerIdAtom);
  const { selected } = Route.useSearch();
  const navigate = useNavigate();
  const setSelected = (v: number | null) => {
    navigate({ search: { selected: v ?? undefined } });
  };

  const selectedPlayer = selected !== undefined ? players[selected] : null;

  useEffect(() => {
    // placeholder for future side-effects
  }, [players, selected]);

  function addDefaultPlayer() {
    const newPlayer: Player = {
      id: genID(),
      name: `Player ${players.length + 1}`,
      elo: 1500,
      earnedELO: 1500,
    } as Player;
    setPlayers((prev) => [...prev, newPlayer]);
    setSelected(players.length);
  }

  function removeSelected() {
    if (selected == null) return;
    if (players.length <= 1) return; // prevent fewer than 1
    setPlayers((prev) => {
      const next = [...prev];
      const removed = next.splice(selected, 1)[0];
      // if we removed the default, reset to first remaining
      if (removed?.id === defaultPlayerId && next.length > 0) {
        setDefaultPlayerId(next[0].id);
      }
      return next;
    });
    setSelected(null);
  }

  return (
    <Stack h="100%" px="lg" pb="lg">
      <Group align="baseline" py="sm">
        <Title>Players</Title>
      </Group>
      <Group grow flex={1} style={{ overflow: "hidden" }} align="start">
        <ScrollArea h="100%" offsetScrollbars>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "md", md: "sm" }}>
            {players.map((item, i) => {
              return (
                <GenericCard
                  id={i}
                  key={item.id}
                  isSelected={selected === i}
                  setSelected={setSelected}
                  error={undefined}
                  Header={<PlayerHeader player={item} />}
                  stats={[]}
                />
              );
            })}
            <Box className={classes.card} component="button" type="button" onClick={addDefaultPlayer}>
              <Stack gap={0} justify="center" w="100%" h="100%">
                <Text mb={10}>Add New</Text>
                <Box>+</Box>
              </Stack>
            </Box>
          </SimpleGrid>
        </ScrollArea>
        <Paper withBorder p="md" h="100%">
          {!selectedPlayer || selected === undefined ? (
            <Text ta="center">Select a player</Text>
          ) : (
            <PlayerDetails selected={selected} setSelected={setSelected} defaultPlayerId={defaultPlayerId} setDefaultPlayerId={setDefaultPlayerId} onRemove={removeSelected} />
          )}
        </Paper>
      </Group>
    </Stack>
  );
}

function PlayerHeader({ player }: { player: Player }) {
  return (
    <Group wrap="nowrap">
      <Stack gap={0}>
        <Text fw="bold" lineClamp={1}>{player.name}</Text>
        <Text size="xs" c="dimmed" lineClamp={1}>{player.lichess?.username || player.chessCom?.username || ""}</Text>
      </Stack>
    </Group>
  );
}

function PlayerDetails({ selected, setSelected, defaultPlayerId, setDefaultPlayerId, onRemove }: { selected: number; setSelected: (v: number | null) => void; defaultPlayerId: string; setDefaultPlayerId: (id: string) => void; onRemove: () => void }) {
  const [players, setPlayers] = useAtom(playersAtom);
  const player = players[selected];
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  function setPlayer(newPlayer: Player) {
    setPlayers((prev) => {
      const copy = [...prev];
      copy[selected] = newPlayer;
      return copy;
    });
  }

  return (
    <ScrollArea h="100%" offsetScrollbars>
      <Stack>
        <Divider variant="dashed" label="General Settings" />
        <Stack>
          <TextInput label="Name" value={player.name} onChange={(e) => setPlayer({ ...player, name: e.currentTarget.value })} />
          <NumberInput label="ELO" min={400} max={3600} value={player.elo ?? 1500} onChange={(v) => setPlayer({ ...player, elo: typeof v === "number" ? v : 1500, earnedELO: typeof v === "number" ? (player.earnedELO ?? v) : player.earnedELO })} />
          <NumberInput label="Earned ELO" min={400} max={3600} value={player.earnedELO ?? player.elo ?? 1500} onChange={(v) => setPlayer({ ...player, earnedELO: typeof v === "number" ? v : player.earnedELO })} />
          <Group>
            <Button variant={player.id === defaultPlayerId ? "filled" : "light"} onClick={() => setDefaultPlayerId(player.id)}>
              {player.id === defaultPlayerId ? "Default User" : "Set Default User"}
            </Button>
          </Group>
        </Stack>
        <Divider variant="dashed" label="Accounts" />
        <Stack>
          <TextInput
            label="Lichess Username"
            value={player.lichess?.username || ""}
            onChange={(e) => setPlayer({ ...player, lichess: e.currentTarget.value ? { username: e.currentTarget.value } : undefined })}
            placeholder="e.g. MagnusCarlsen"
          />
          <TextInput
            label="Chess.com Username"
            value={player.chessCom?.username || ""}
            onChange={(e) => setPlayer({ ...player, chessCom: e.currentTarget.value ? { username: e.currentTarget.value } : undefined })}
            placeholder="e.g. Hikaru"
          />
        </Stack>
        <Group justify="end">
          <Button color="red" onClick={() => setDeleteModalOpen(true)} disabled={players.length <= 1}>
            Remove
          </Button>
        </Group>
        <ConfirmModal
          title="Remove Player"
          description="Are you sure you want to remove this player?"
          opened={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={() => {
            onRemove();
            setDeleteModalOpen(false);
          }}
          confirmLabel="Remove"
        />
      </Stack>
    </ScrollArea>
  );
}



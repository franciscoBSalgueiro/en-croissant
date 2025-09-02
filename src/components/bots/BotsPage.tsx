import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { Route } from "@/routes/bots";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { botsAtom } from "@/state/atoms";
import type { Bot } from "@/utils/bots";
import { Box, Button, Checkbox, Divider, Group, Modal, NumberInput, Paper, ScrollArea, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import * as classes from "@/components/common/GenericCard.css";
import GenericCard from "@/components/common/GenericCard";
import ConfirmModal from "@/components/common/ConfirmModal";
import { genID } from "@/utils/tabs";

export default function BotsPage() {
  const [bots, setBots] = useAtom(botsAtom);
  const { selected } = Route.useSearch();
  const navigate = useNavigate();
  const setSelected = (v: number | null) => {
    navigate({ search: { selected: v ?? undefined } });
  };

  const [tourOpen, setTourOpen] = useState(false);
  const [tourSelected, setTourSelected] = useState<string[]>([]);

  const list = Array.isArray(bots) ? bots : [];
  const selectedBot = selected !== undefined ? list[selected] : null;

  useEffect(() => {
    // noop; placeholder for future logging
  }, [bots, selected]);

  function addDefaultBot() {
    const newBot: Bot = {
      id: genID(),
      name: `Bot ${(Array.isArray(bots) ? bots.length : 0) + 1}`,
      strategy: { mode: "rankSet", ranks: [1, 2, 3] } as any,
      elo: 1500,
      skillLevel: 10,
      earnedELO: 1500,
      confThreshold: 90,
      ...( { resignBelowWinPct: undefined } as any ),
      thinkingDelayMinMs: 1000,
      thinkingDelayMaxMs: 10000,
    } as Bot;
    setBots((prev) => (Array.isArray(prev) ? [...prev, newBot] : [newBot]) as any);
    const newIndex = (Array.isArray(bots) ? bots.length : 0);
    setSelected(newIndex);
  }

  return (
    <>
    <Stack h="100%" px="lg" pb="lg">
      <Group align="baseline" py="sm">
        <Title>Bots</Title>
        <Button
          variant="light"
          onClick={() => {
            setTourSelected([]);
            setTourOpen(true);
          }}
        >
          Start Bot Tournament
        </Button>
      </Group>
      <Group grow flex={1} style={{ overflow: "hidden" }} align="start">
        <ScrollArea h="100%" offsetScrollbars>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "md", md: "sm" }}>
            {list.map((item, i) => {
              return (
                <GenericCard
                  id={i}
                  key={item.id}
                  isSelected={selected === i}
                  setSelected={setSelected}
                  error={undefined}
                  Header={<BotHeader bot={item} />}
                  stats={[]}
                />
              );
            })}
            <Box className={classes.card} component="button" type="button" onClick={addDefaultBot}>
              <Stack gap={0} justify="center" w="100%" h="100%">
                <Text mb={10}>Add New</Text>
                <Box>+</Box>
              </Stack>
            </Box>
          </SimpleGrid>
        </ScrollArea>
        <Paper withBorder p="md" h="100%">
          {!selectedBot || selected === undefined ? (
            <Text ta="center">Select a bot</Text>
          ) : (
            <BotDetails selected={selected} setSelected={setSelected} />
          )}
        </Paper>
      </Group>
      <Modal opened={tourOpen} onClose={() => setTourOpen(false)} title="Select Bots">
        <Stack>
          {list.length === 0 ? (
            <Text c="dimmed">No bots available.</Text>
          ) : (
            list.map((b) => (
              <Checkbox
                key={b.id}
                label={`${b.name}`}
                checked={tourSelected.includes(b.id)}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setTourSelected((prev) => {
                    if (checked) return [...prev, b.id];
                    return prev.filter((x) => x !== b.id);
                  });
                }}
              />
            ))
          )}
          <Group justify="end">
            <Button
              disabled={tourSelected.length < 2}
              onClick={() => {
                const ids = tourSelected.join(",");
                setTourOpen(false);
                navigate({ to: "/bots/tournament", search: { ids } });
              }}
            >
              Start
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
    <Outlet />
    </>
  );
}

function BotHeader({ bot }: { bot: Bot }) {
  return (
    <Group wrap="nowrap">
      <Stack gap={0}>
        <Text fw="bold" lineClamp={1}>{bot.name}</Text>
        <Text size="xs" c="dimmed" lineClamp={1}></Text>
      </Stack>
    </Group>
  );
}

function BotDetails({ selected, setSelected }: { selected: number; setSelected: (v: number | null) => void }) {
  const [bots, setBots] = useAtom(botsAtom);
  const list = Array.isArray(bots) ? bots : [];
  const bot = list[selected];
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  function setBot(newBot: Bot) {
    setBots((prev) => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      if (selected < 0 || selected >= arr.length) return arr as any;
      arr[selected] = newBot;
      return arr as any;
    });
  }

  return (
    <ScrollArea h="100%" offsetScrollbars>
      <Stack>
        <Divider variant="dashed" label="General Settings" />
        <Stack>
          <TextInput label="Name" value={bot.name} onChange={(e) => setBot({ ...bot, name: e.currentTarget.value })} />
        </Stack>
        <Divider variant="dashed" label="Move Selection Strategy" />
        <Stack>
          <NumberInput
            label="ELO (strength)"
            min={400}
            max={3600}
            value={(bot as any).elo ?? 1500}
            onChange={(v) => setBot({ ...bot, elo: typeof v === "number" ? v : 1500 } as any)}
          />
          <NumberInput
            label="Engine Skill Level"
            description="Used when running a dedicated engine for this bot"
            min={0}
            max={20}
            value={(bot as any).skillLevel ?? 10}
            onChange={(v) => setBot({ ...bot, skillLevel: typeof v === "number" ? v : undefined } as any)}
          />
          <NumberInput
            label="Earned ELO"
            min={400}
            max={3600}
            value={(bot as any).earnedELO ?? (bot as any).elo ?? 1500}
            onChange={(v) => setBot({ ...bot, earnedELO: typeof v === "number" ? v : (bot as any).earnedELO } as any)}
          />
          <SegmentedControl
            value={bot.strategy?.mode || "rank"}
            onChange={(v) =>
              setBot({
                ...bot,
                strategy:
                  v === "rank"
                    ? { mode: "rank", rank: bot.strategy?.mode === "rank" ? (bot.strategy as any).rank : (bot.pickRank ?? 1) }
                  : v === "rankSet"
                    ? { mode: "rankSet", ranks: [1, 2, 3] }
                    : { mode: "randomTopN", topN: bot.strategy?.mode === "randomTopN" ? (bot.strategy as any).topN : 2 },
              })
            }
            data={[
              { value: "rank", label: "Nth best" },
              { value: "rankSet", label: "Pick from set" },
              { value: "randomTopN", label: "Random top-N" },
            ]}
          />
          {(!bot.strategy || bot.strategy.mode === "rank") && (
            <NumberInput
              label="Pick nth best move"
              min={1}
              max={100}
              value={bot.strategy?.mode === "rank" ? (bot.strategy as any).rank : (bot.pickRank ?? 1)}
              onChange={(v) =>
                setBot({
                  ...bot,
                  strategy: { mode: "rank", rank: typeof v === "number" ? v : 1 },
                })
              }
            />
          )}
          {bot.strategy?.mode === "rankSet" && (
            <TextInput
              label="Pick from ranks (comma-separated)"
              placeholder="e.g. 1,2,3"
              value={(bot.strategy as any).ranks?.join(",")}
              onChange={(e) => {
                const parts = e.currentTarget.value
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n) && n >= 1 && n <= 100);
                setBot({ ...bot, strategy: { mode: "rankSet", ranks: parts.length > 0 ? parts : [1] } });
              }}
            />
          )}
          {bot.strategy?.mode === "randomTopN" && (
            <NumberInput
              label="Top-N"
              min={1}
              max={100}
              value={(bot.strategy as any).topN}
              onChange={(v) =>
                setBot({
                  ...bot,
                  strategy: { mode: "randomTopN", topN: typeof v === "number" ? v : 2 },
                })
              }
            />
          )}
          <Divider variant="dashed" label="Confidence override (optional)" />
          <NumberInput
            label="Confidence threshold %"
            min={0}
            max={100}
            value={bot.confThreshold ?? undefined}
            placeholder="Disabled"
            onChange={(v) => setBot({ ...bot, confThreshold: typeof v === "number" ? v : undefined })}
          />
          <NumberInput
            label="Resign below win chance (%)"
            description="Bot will resign if top line win chance drops below this."
            min={0}
            max={100}
            value={(bot as any).resignBelowWinPct ?? undefined}
            placeholder="Disabled"
            onChange={(v) => setBot({ ...(bot as any), resignBelowWinPct: typeof v === 'number' ? v : undefined } as any)}
          />
          <Divider variant="dashed" label="Thinking delay (ms)" />
          <Group grow>
            <NumberInput
              label="Min"
              min={0}
              max={60000}
              value={bot.thinkingDelayMinMs ?? 200}
              onChange={(v) => setBot({ ...bot, thinkingDelayMinMs: typeof v === "number" ? v : 200 })}
            />
            <NumberInput
              label="Max"
              min={0}
              max={60000}
              value={bot.thinkingDelayMaxMs ?? 1200}
              onChange={(v) => setBot({ ...bot, thinkingDelayMaxMs: typeof v === "number" ? v : 1200 })}
            />
          </Group>
        </Stack>
        <Group justify="end">
          <Button color="red" onClick={() => setDeleteModalOpen(true)}>
            Remove
          </Button>
        </Group>
        <ConfirmModal
          title="Remove Bot"
          description="Are you sure you want to remove this bot?"
          opened={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={() => {
            setBots((prev) => {
              const arr = Array.isArray(prev) ? [...prev] : [];
              if (selected < 0 || selected >= arr.length) return arr as any;
              arr.splice(selected, 1);
              return arr as any;
            });
            setSelected(null);
          }}
          confirmLabel="Remove"
        />
      </Stack>
    </ScrollArea>
  );
} 